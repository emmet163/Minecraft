using Godot;
using System;
using System.Collections.Generic;
using Stonewake.Player;
using Stonewake.Items;
using Stonewake.Saving;
using Stonewake.UI;
using Stonewake.World;
using Stonewake.Survival;

namespace Stonewake.Game;

public partial class Main : Node3D
{
    private FirstPersonPlayer _player = null!;
    private GameHud _hud = null!;
    private VoxelWorld _world = null!;
    private bool _paused;
    private readonly HotbarInventory _inventory = new();
    private readonly WorldItems _worldItems = new();
    private InventoryPanel _inventoryPanel = null!;
    private readonly List<DroppedBlock> _drops = new();
    private MeshInstance3D _outline = null!;
    private StandardMaterial3D _outlineMaterial = null!;
    private AudioStreamPlayer _breakSound = null!;
    private AudioStreamPlayer _placeSound = null!;
    private CellKey? _target;
    private Vector3I _targetNormal;
    private CellKey? _miningCell;
    private float _miningTime;
    private bool _mineHeld;
    private double _pickupNotice;
    public HotbarInventory Inventory => _inventory;
    public void SelectHotbarSlot(int index) => SelectSlot(index);

    public override void _Ready()
    {
        ControlSettings.Load();
        RegisterControls();
        _world = new VoxelWorld { Name = "World" };
        AddChild(_world);
        CreateLighting();
        _player = new FirstPersonPlayer();
        AddChild(_player);
        var settings = SaveStore.LoadWorldSettings();
        _world.Configure(settings.Seed, settings.RenderDistance, _player);
        LoadItems();
        _hud = new GameHud { Name = "HUD" };
        AddChild(_hud);
        _hud.SetWorldSettings(settings.Seed, settings.RenderDistance);
        _hud.SetHotbar(_inventory);
        _inventoryPanel = new InventoryPanel { Name = "InventoryPanel" };
        _inventoryPanel.Setup(_inventory, _worldItems);
        _inventoryPanel.Changed += () => { SaveItems(); _hud.SetHotbar(_inventory); };
        _inventoryPanel.DropRequested += stack => SpawnItem(stack.Id, stack.Count, _player.GlobalPosition + Vector3.Up);
        AddChild(_inventoryPanel);
        SetupSurvival();
        _outlineMaterial = new StandardMaterial3D
        {
            AlbedoColor = new Color(1f, .94f, .35f),
            ShadingMode = BaseMaterial3D.ShadingModeEnum.Unshaded,
            CullMode = BaseMaterial3D.CullModeEnum.Disabled
        };
        _outline = new MeshInstance3D
        {
            Name = "SelectionOutline",
            Mesh = CreateOutlineMesh(),
            MaterialOverride = _outlineMaterial,
            Visible = false
        };
        AddChild(_outline);
        _breakSound = new AudioStreamPlayer { Stream = SoundEffects.Make(true), VolumeDb = -10f };
        _placeSound = new AudioStreamPlayer { Stream = SoundEffects.Make(false), VolumeDb = -12f };
        AddChild(_breakSound);
        AddChild(_placeSound);
        Input.MouseMode = Input.MouseModeEnum.Captured;
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (_dead)
        {
            if (@event is InputEventKey { Pressed: true, Echo: false, PhysicalKeycode: Key.R }) Respawn();
            return;
        }
        if (@event.IsActionPressed("pause"))
        {
            if (_inventoryPanel.IsOpen) { _inventoryPanel.Close(); GetViewport().SetInputAsHandled(); return; }
            SetPaused(!_paused);
            GetViewport().SetInputAsHandled();
            return;
        }
        if (_paused) return;
        if (@event is InputEventKey { Pressed: true, Echo: false, PhysicalKeycode: Key.E })
        {
            if (_inventoryPanel.IsOpen) _inventoryPanel.Close(); else OpenInventory(InventoryMode.Personal);
            GetViewport().SetInputAsHandled(); return;
        }
        if (_inventoryPanel.IsOpen) return;
        if (@event is InputEventKey { Pressed: true, Echo: false, PhysicalKeycode: Key.F })
        { UseSelected(); GetViewport().SetInputAsHandled(); return; }
        if (@event is InputEventMouseButton mouse)
        {
            if (mouse.ButtonIndex == MouseButton.Left) _mineHeld = mouse.Pressed;
            else if (mouse.Pressed && mouse.ButtonIndex == MouseButton.Right && _target.HasValue)
                TryPlaceSelected(_target.Value, _targetNormal);
            else if (mouse.Pressed && mouse.ButtonIndex == MouseButton.WheelUp) SelectSlot(_inventory.Selected - 1);
            else if (mouse.Pressed && mouse.ButtonIndex == MouseButton.WheelDown) SelectSlot(_inventory.Selected + 1);
        }
        if (@event is InputEventKey { Pressed: true, Echo: false } key)
        {
            if (key.PhysicalKeycode == Key.Q)
            {
                _inventory.CycleTool();
                _hud.SetHotbar(_inventory);
                ResetMining();
                SaveItems();
            }
            else if (key.PhysicalKeycode >= Key.Key1 && key.PhysicalKeycode <= Key.Key9)
                SelectSlot((int)(key.PhysicalKeycode - Key.Key1));
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_paused || _inventoryPanel.IsOpen || _dead) return;
        if (_mineHeld && !Input.IsMouseButtonPressed(MouseButton.Left)) _mineHeld = false;
        var camera = _player.Camera;
        var origin = camera.GlobalPosition;
        var end = origin - camera.GlobalTransform.Basis.Z * 6f;
        using var query = PhysicsRayQueryParameters3D.Create(origin, end);
        query.Exclude = new Godot.Collections.Array<Rid> { _player.GetRid() };
        var hit = GetWorld3D().DirectSpaceState.IntersectRay(query);
        _target = null;
        var direction = (end - origin).Normalized();
        var visibleDistance = hit.Count > 0 ? origin.DistanceTo(hit["position"].AsVector3()) : 6f;
        var decoration = FindDecorativeTarget(origin, direction, visibleDistance);
        if (decoration.HasValue)
        {
            var cell = decoration.Value;
            var decorative = _world.GetState(cell.X, cell.Y, cell.Z);
            _target = cell;
            _targetNormal = Vector3I.Up;
            _hud.SetTarget($"{decorative.Type}  ·  {cell.X}, {cell.Y}, {cell.Z}");
            ShowOutline(new Vector3I(cell.X, cell.Y, cell.Z), decorative);
        }
        if (!_target.HasValue && hit.Count > 0 && hit["collider"].AsGodotObject() is StaticBody3D)
        {
            var inside = hit["position"].AsVector3() - hit["normal"].AsVector3() * .01f;
            var cell = new Vector3I(Mathf.RoundToInt(inside.X), Mathf.RoundToInt(inside.Y), Mathf.RoundToInt(inside.Z));
            var state = _world.GetState(cell.X, cell.Y, cell.Z);
            if (state.Type != BlockType.Air)
            {
                _target = new CellKey(cell.X, cell.Y, cell.Z);
                var normal = hit["normal"].AsVector3();
                _targetNormal = new Vector3I(Mathf.RoundToInt(normal.X), Mathf.RoundToInt(normal.Y), Mathf.RoundToInt(normal.Z));
                _hud.SetTarget($"{state.Type}  ·  {cell.X}, {cell.Y}, {cell.Z}");
                ShowOutline(cell, state);
            }
        }
        if (!_target.HasValue) { _hud.SetTarget(""); _outline.Visible = false; }
        if (_mineHeld && _target.HasValue) MineBlock(_target.Value, (float)delta);
        else ResetMining();
        CollectDrops();
        if (_pickupNotice > 0)
        {
            _pickupNotice -= delta;
            if (_pickupNotice <= 0) _hud.ShowPickup("");
        }
        var location = _player.GlobalPosition;
        _hud.SetWorldInfo($"Seed {_world.Seed}  ·  {_world.GetBiome(Mathf.RoundToInt(location.X), Mathf.RoundToInt(location.Z))}  ·  Chunks {_world.LoadedCount} / {_world.PendingCount} loading");
    }

    public CellKey? FindDecorativeTarget(Vector3 origin, Vector3 direction, float visibleDistance)
    {
        for (var distance = .05f; distance < visibleDistance; distance += .05f)
        {
            var point = origin + direction * distance;
            var cell = new Vector3I(Mathf.RoundToInt(point.X), Mathf.RoundToInt(point.Y), Mathf.RoundToInt(point.Z));
            var decorative = _world.GetState(cell.X, cell.Y, cell.Z);
            if (decorative.Type is not (BlockType.Plant or BlockType.Flower)) continue;
            if (Mathf.Abs(point.X - cell.X) > .2f || Mathf.Abs(point.Z - cell.Z) > .2f ||
                Mathf.Abs(point.Y - cell.Y) > .35f) continue;
            return new CellKey(cell.X, cell.Y, cell.Z);
        }
        return null;
    }

    public void ApplyWorldSettings(int seed, int renderDistance)
    {
        SaveItems();
        _itemSaveOverride = null;
        var error = SaveStore.SaveWorldSettings(seed, renderDistance);
        if (error != Error.Ok) GD.PushWarning($"Could not save world settings: {error}");
        _world.Configure(seed, renderDistance, _player);
        LoadItems();
        ApplyMode();
        _hud.SetHotbar(_inventory);
        _hud.SetTarget("");
        _target = null;
        _outline.Visible = false;
        ResetMining();
        foreach (var drop in _drops) if (GodotObject.IsInstanceValid(drop)) drop.QueueFree();
        _drops.Clear();
    }

    // Isolated files keep automated Godot probes away from player worlds and settings.
    public void ConfigureIsolatedWorld(int seed, string editPath, string itemPath)
    {
        _itemSaveOverride = itemPath;
        _world.Configure(seed, 2, _player, editPath);
        LoadItems();
        _dead = false;
        _hud.ShowDeath(false);
        _player.ProcessMode = ProcessModeEnum.Pausable;
        ApplyMode();
        _hud.SetWorldSettings(seed, 2);
        _hud.SetSurvival(Life, Cycle, IsSnowing());
        _target = null;
        _outline.Visible = false;
        ResetMining();
        foreach (var drop in _drops) if (GodotObject.IsInstanceValid(drop)) drop.QueueFree();
        _drops.Clear();
    }

    public bool MineBlock(CellKey target, float elapsed)
    {
        var state = _world.GetState(target.X, target.Y, target.Z);
        if (state.Type == BlockType.Air) { ResetMining(); return false; }
        if (state.Type == BlockType.Door && state.Upper)
        {
            target = new CellKey(target.X, target.Y - 1, target.Z);
            state = _world.GetState(target.X, target.Y, target.Z);
        }
        if (_miningCell != target) { _miningCell = target; _miningTime = 0; }
        _miningTime += elapsed;
        var duration = Life.Mode == GameMode.Creative ? 0f : _inventory.MiningSeconds(state.Type);
        var progress = duration <= 0 ? 1f : Mathf.Clamp(_miningTime / duration, 0, 1);
        _hud.SetMiningProgress(progress);
        _outlineMaterial.AlbedoColor = new Color(1f, .94f - progress * .65f, .35f - progress * .25f);
        if (_miningTime < duration) return false;
        var changed = state.Type == BlockType.Door
            ? _world.ApplyChanges((target, BlockState.Empty), (new CellKey(target.X, target.Y + 1, target.Z), BlockState.Empty))
            : _world.ApplyChanges((target, BlockState.Empty));
        ResetMining();
        if (!changed) return false;
        if (Life.Mode == GameMode.Survival) _inventory.WearTool();
        ReleaseContainer(target, state.Type);
        SaveItems();
        var dropped = BlockRules.DropType(state.Type);
        if (Life.Mode == GameMode.Survival && dropped != BlockType.Air)
            SpawnDrop(dropped, new Vector3(target.X, target.Y + .5f, target.Z));
        if (Life.Mode == GameMode.Survival && state.Type is BlockType.Coal or BlockType.Copper or BlockType.Iron or BlockType.Gold)
            Life.AddExperience(2);
        else if (Life.Mode == GameMode.Survival) Life.AddExperience(1);
        SpawnBurst(state.Type, new Vector3(target.X, target.Y, target.Z));
        _breakSound.Play();
        return true;
    }

    public bool TryPlaceSelected(CellKey target, Vector3I normal)
    {
        var targetState = _world.GetState(target.X, target.Y, target.Z);
        if (targetState.Type == BlockType.Bed) return SleepAt(target);
        if (targetState.Type is BlockType.CraftingStation or BlockType.Chest or BlockType.Furnace)
        {
            OpenInventory(targetState.Type switch
            {
                BlockType.CraftingStation => InventoryMode.Station,
                BlockType.Chest => InventoryMode.Chest,
                _ => InventoryMode.Furnace
            }, target);
            return true;
        }
        if (targetState.Type == BlockType.Door)
        {
            var lower = targetState.Upper ? new CellKey(target.X, target.Y - 1, target.Z) : target;
            var lowState = _world.GetState(lower.X, lower.Y, lower.Z);
            var highCell = new CellKey(lower.X, lower.Y + 1, lower.Z);
            var highState = _world.GetState(highCell.X, highCell.Y, highCell.Z);
            if (highState.Type != BlockType.Door) return false;
            var toggled = _world.ApplyChanges((lower, lowState.WithOpen(!lowState.Open)),
                (highCell, highState.WithOpen(!highState.Open)));
            if (toggled) _placeSound.Play();
            return toggled;
        }
        if (targetState.Type == BlockType.Air || Life.Mode == GameMode.Survival &&
            (_inventory.SelectedStack.IsEmpty || _inventory.SelectedBlock == BlockType.Air)) return false;
        var cell = new CellKey(target.X + normal.X, target.Y + normal.Y, target.Z + normal.Z);
        var type = Life.Mode == GameMode.Creative ? Life.CreativeBlock : _inventory.SelectedBlock;
        if (!CanPlace(cell, type, normal)) return false;
        var facing = FacingFromCamera();
        var properties = (byte)(facing | (type == BlockType.Slab && normal.Y < 0 ? 4 : 0));
        var state = new BlockState(type, properties);
        var placed = type == BlockType.Door
            ? _world.ApplyChanges((cell, state), (new CellKey(cell.X, cell.Y + 1, cell.Z), new BlockState(type, (byte)(properties | 4))))
            : _world.ApplyChanges((cell, state));
        if (!placed) return false;
        if (Life.Mode == GameMode.Survival) _inventory.SpendSelected();
        SaveItems();
        _hud.SetHotbar(_inventory);
        SpawnBurst(type, new Vector3(cell.X, cell.Y, cell.Z));
        _placeSound.Play();
        return true;
    }

    private bool CanPlace(CellKey cell, BlockType type, Vector3I normal)
    {
        if (cell.Y < 0 || cell.Y >= ChunkData.Height || !_world.IsLoaded(cell.X, cell.Z) ||
            !BlockRules.IsReplaceable(_world.GetBlock(cell.X, cell.Y, cell.Z))) return false;
        if (type == BlockType.Door && (cell.Y + 1 >= ChunkData.Height ||
            !BlockRules.IsReplaceable(_world.GetBlock(cell.X, cell.Y + 1, cell.Z)))) return false;
        var feet = _player.GlobalPosition;
        var playerBounds = new Aabb(new Vector3(feet.X - .34f, feet.Y, feet.Z - .34f),
            new Vector3(.68f, 1.8f, .68f));
        var boxY = type == BlockType.Slab ? (normal.Y < 0 ? cell.Y : cell.Y - .5f) : cell.Y - .5f;
        var blockBounds = new Aabb(new Vector3(cell.X - .5f, boxY, cell.Z - .5f),
            new Vector3(1, type == BlockType.Door ? 2 : type == BlockType.Slab ? .5f : 1, 1));
        return !playerBounds.Intersects(blockBounds);
    }

    private int FacingFromCamera()
    {
        var forward = -_player.Camera.GlobalTransform.Basis.Z;
        return Mathf.Abs(forward.X) > Mathf.Abs(forward.Z) ? forward.X > 0 ? 1 : 3 : forward.Z > 0 ? 2 : 0;
    }

    private void SelectSlot(int index)
    {
        _inventory.Select(index);
        _hud.SetHotbar(_inventory);
        SaveItems();
    }

    private void ResetMining()
    {
        _miningCell = null;
        _miningTime = 0;
        if (_hud != null) _hud.SetMiningProgress(0);
        if (_outlineMaterial != null) _outlineMaterial.AlbedoColor = new Color(1f, .94f, .35f);
    }

    private void ShowOutline(Vector3I cell, BlockState state)
    {
        var position = new Vector3(cell.X, cell.Y, cell.Z);
        var size = Vector3.One * 1.025f;
        if (state.Type == BlockType.Slab)
        {
            size.Y = .525f;
            position.Y += state.Upper ? .25f : -.25f;
        }
        else if (state.Type is BlockType.Plant or BlockType.Flower)
            size = new Vector3(.38f, .65f, .38f);
        else if (state.Type == BlockType.Bed)
        { size.Y = .525f; position.Y -= .25f; }
        else if (state.Type == BlockType.Door)
        {
            position.Y += state.Upper ? -.5f : .5f;
            size.Y = 2.025f;
            var facing = (state.Facing + (state.Open ? 1 : 0)) & 3;
            if (facing % 2 == 0) size.X = .205f; else size.Z = .205f;
        }
        else if (state.Type == BlockType.Fence) { size.X = 1.025f; size.Z = 1.025f; }
        _outline.Position = position;
        _outline.Scale = size;
        _outline.Visible = true;
    }

    private static ImmediateMesh CreateOutlineMesh()
    {
        var mesh = new ImmediateMesh();
        var corners = new[]
        {
            new Vector3(-.5f,-.5f,-.5f), new Vector3(.5f,-.5f,-.5f),
            new Vector3(.5f,-.5f,.5f), new Vector3(-.5f,-.5f,.5f),
            new Vector3(-.5f,.5f,-.5f), new Vector3(.5f,.5f,-.5f),
            new Vector3(.5f,.5f,.5f), new Vector3(-.5f,.5f,.5f)
        };
        var edges = new[] { 0,1, 1,2, 2,3, 3,0, 4,5, 5,6, 6,7, 7,4, 0,4, 1,5, 2,6, 3,7 };
        mesh.SurfaceBegin(Mesh.PrimitiveType.Lines);
        for (var i = 0; i < edges.Length; i++) mesh.SurfaceAddVertex(corners[edges[i]]);
        mesh.SurfaceEnd();
        return mesh;
    }

    private void SpawnDrop(BlockType type, Vector3 position)
    {
        SpawnItem(ItemCatalog.ForBlock(type), 1, position);
    }

    private void SpawnItem(string id, int count, Vector3 position)
    {
        var drop = new DroppedBlock { Position = position, ProcessMode = ProcessModeEnum.Pausable };
        var block = ItemCatalog.BlockOf(id);
        drop.Setup(id, count, _world.MaterialFor(block == BlockType.Air ? BlockType.Stone : block));
        AddChild(drop);
        drop.ApplyCentralImpulse(new Vector3(.4f, 1.5f, -.3f));
        _drops.Add(drop);
    }

    private void CollectDrops()
    {
        for (var i = _drops.Count - 1; i >= 0; i--)
        {
            var drop = _drops[i];
            if (!GodotObject.IsInstanceValid(drop) || drop.IsQueuedForDeletion()) { _drops.RemoveAt(i); continue; }
            if (drop.Age < .4 || drop.GlobalPosition.DistanceTo(_player.GlobalPosition + Vector3.Up) > 1.7f) continue;
            var remaining = _inventory.Slots.Add(drop.ItemId, drop.Count);
            if (remaining > 0) { if (remaining < drop.Count) { drop.SetCount(remaining); SaveItems(); } continue; }
            _hud.SetHotbar(_inventory);
            _hud.ShowPickup($"Collected {ItemCatalog.Get(drop.ItemId).Name}");
            _pickupNotice = 1.5;
            drop.QueueFree();
            _drops.RemoveAt(i);
            SaveItems();
        }
    }

    private void SpawnBurst(BlockType type, Vector3 position)
    {
        var burst = new BreakBurst { Position = position };
        burst.Setup(_world.MaterialFor(type));
        AddChild(burst);
    }

    public void SetPaused(bool paused)
    {
        _paused = paused;
        _mineHeld = false;
        ResetMining();
        GetTree().Paused = paused;
        Input.MouseMode = paused ? Input.MouseModeEnum.Visible : Input.MouseModeEnum.Captured;
        _hud.ShowPause(paused);
        if (paused) SaveItems();
    }

    public override void _Process(double delta)
    {
        if (_paused) return;
        var active = false;
        foreach (var furnace in _worldItems.Furnaces.Values)
        {
            var before = furnace.Progress;
            furnace.Tick((float)delta);
            if (furnace.Progress != before) active = true;
        }
        _saveClock += delta;
        if (active && _saveClock >= 1) { _saveClock = 0; SaveItems(); }
        UpdateSurvival((float)delta);
    }

    private double _saveClock;
    private bool _itemsWritable = true;
    private string? _itemSaveOverride;
    public void OpenInventory(InventoryMode mode, CellKey cell = default)
    {
        if (_paused) return;
        _mineHeld = false; ResetMining();
        _inventoryPanel.Open(mode, cell);
        _player.ProcessMode = ProcessModeEnum.Disabled;
        Input.MouseMode = Input.MouseModeEnum.Visible;
    }
    public void CloseInventory()
    {
        _player.ProcessMode = ProcessModeEnum.Pausable;
        Input.MouseMode = Input.MouseModeEnum.Captured;
        _hud.SetHotbar(_inventory);
        SaveItems();
    }
    private void ReleaseContainer(CellKey cell, BlockType type)
    {
        InventoryGrid? grid = null;
        if (type == BlockType.Chest && _worldItems.Chests.Remove(cell, out var chest)) grid = chest;
        if (type == BlockType.CraftingStation && _worldItems.Stations.Remove(cell, out var station)) grid = station;
        if (type == BlockType.Furnace && _worldItems.Furnaces.Remove(cell, out var furnace)) grid = furnace.Slots;
        if (grid == null) return;
        foreach (var stack in grid.Snapshot()) if (!stack.IsEmpty) SpawnItem(stack.Id, stack.Count, new Vector3(cell.X, cell.Y + 1, cell.Z));
    }
    private string ItemSavePath() => _itemSaveOverride ?? ProjectSettings.GlobalizePath($"user://items_{_world.Seed}.json");
    private void LoadItems()
    {
        try { _worldItems.Load(ItemSavePath(), _inventory, _world.Seed); _itemsWritable = true; }
        catch (Exception error) { GD.PushError($"Could not load inventory: {error}"); _inventory.Reset(); _worldItems.Clear(); _itemsWritable = false; }
    }
    private void SaveItems()
    {
        if (!_itemsWritable) return;
        try { _worldItems.Save(ItemSavePath(), _inventory); }
        catch (Exception error) { GD.PushError($"Could not save inventory: {error}"); }
    }
    public override void _ExitTree()
    {
        if (_world != null) SaveItems();
        foreach (var player in new[] { _breakSound, _placeSound, _thunder })
        {
            if (player == null || !GodotObject.IsInstanceValid(player)) continue;
            player.Stop();
            player.Stream = null;
        }
    }

    private static void RegisterControls()
    {
        Bind("move_forward", Key.W);
        Bind("move_back", Key.S);
        Bind("move_left", Key.A);
        Bind("move_right", Key.D);
        Bind("jump", Key.Space);
        Bind("sprint", Key.Shift);
        Bind("crouch", Key.Ctrl);
        Bind("pause", Key.Escape);
    }

    private static void Bind(string action, Key key)
    {
        if (!InputMap.HasAction(action)) InputMap.AddAction(action);
        InputMap.ActionAddEvent(action, new InputEventKey { PhysicalKeycode = key });
    }

    private void CreateLighting()
    {
        _worldEnvironment = new WorldEnvironment();
        _skyMaterial = new ProceduralSkyMaterial
        {
            SkyTopColor = new Color(0.20f, 0.43f, 0.72f),
            SkyHorizonColor = new Color(0.70f, 0.81f, 0.91f),
            GroundHorizonColor = new Color(0.70f, 0.81f, 0.91f),
            GroundBottomColor = new Color(0.45f, 0.65f, 0.82f)
        };
        _worldEnvironment.Environment = new Godot.Environment
        {
            BackgroundMode = Godot.Environment.BGMode.Sky,
            Sky = new Sky { SkyMaterial = _skyMaterial },
            AmbientLightSource = Godot.Environment.AmbientSource.Color,
            AmbientLightColor = new Color(0.76f, 0.81f, 0.89f),
            AmbientLightEnergy = 0.65f,
            ReflectedLightSource = Godot.Environment.ReflectionSource.Bg
        };
        AddChild(_worldEnvironment);
        _sun = new DirectionalLight3D { LightEnergy = 1.4f, ShadowEnabled = true };
        _sun.RotationDegrees = new Vector3(-52f, -35f, 0f);
        AddChild(_sun);
        _moon = new DirectionalLight3D { LightEnergy = 0, LightColor = new Color(.62f, .72f, 1f), ShadowEnabled = false };
        AddChild(_moon);
    }
}
