using System;
using Godot;
using Stonewake.Items;
using Stonewake.Survival;
using Stonewake.World;

namespace Stonewake.Game;

public partial class Main
{
    private WorldEnvironment _worldEnvironment = null!;
    private ProceduralSkyMaterial _skyMaterial = null!;
    private DirectionalLight3D _sun = null!;
    private DirectionalLight3D _moon = null!;
    private WeatherVisual _weatherVisual = null!;
    private AudioStreamPlayer _thunder = null!;
    private bool _dead;
    private float _lightingClock;
    private float _survivalSaveClock;
    public SurvivalState Life => _worldItems.Survival;
    public WorldCycle Cycle => _worldItems.Cycle;
    public bool IsDead => _dead;

    private void SetupSurvival()
    {
        _weatherVisual = new WeatherVisual { Name = "Weather" };
        _weatherVisual.Setup(_player);
        AddChild(_weatherVisual);
        _thunder = new AudioStreamPlayer { Stream = SoundEffects.Thunder(), VolumeDb = -10f };
        AddChild(_thunder);
        _player.Landed += fall =>
        {
            if (fall > 4) TakeDamage((fall - 3) * 1.5f, DamageKind.Fall);
        };
        _hud.ModeRequested += SetMode;
        _hud.RespawnRequested += Respawn;
        _inventoryPanel.Crafted += recipe =>
        {
            if (Life.Mode == GameMode.Survival) Life.AddExperience(Math.Max(1, recipe.Count));
            SaveItems();
        };
        ApplyMode();
        if (Life.IsDead) EnterDeath(false);
        _hud.SetSurvival(Life, Cycle, IsSnowing());
    }
    private void ApplyMode()
    {
        _player.SetFlight(Life.Mode == GameMode.Creative);
        if (_hud != null) { _hud.SetMode(Life.Mode); _hud.SetHotbar(_inventory); }
    }
    public void SetMode(GameMode mode)
    {
        if (_dead) return;
        Life.SetMode(mode);
        ApplyMode();
        _hud.SetSurvival(Life, Cycle, IsSnowing());
        SaveItems();
    }
    public bool UseSelected()
    {
        if (_dead || Life.Mode == GameMode.Creative) return false;
        var held = _inventory.SelectedStack;
        if (held.IsEmpty) return false;
        var item = ItemCatalog.Get(held.Id);
        if (!Life.Eat(item.Nutrition, item.SaturationGain, item.Healing)) return false;
        _inventory.SpendSelected();
        _hud.SetHotbar(_inventory);
        _hud.SetSurvival(Life, Cycle, IsSnowing());
        SaveItems();
        return true;
    }
    public bool SleepAt(CellKey bed)
    {
        if (_dead || _world.GetState(bed.X, bed.Y, bed.Z).Type != BlockType.Bed) return false;
        Life.SetBedSpawn(bed);
        var slept = Cycle.IsNight;
        if (slept)
        {
            Cycle.SleepToMorning();
            Life.Heal(6);
            Life.Eat(4, 2);
        }
        _hud.ShowPickup(slept ? "Spawn set · morning has arrived" : "Spawn set · sleep at night");
        _pickupNotice = 2;
        UpdateLighting();
        SaveItems();
        return true;
    }
    public void TakeDamage(float amount, DamageKind kind)
    {
        if (Life.Damage(amount, kind))
        {
            _hud.SetSurvival(Life, Cycle, IsSnowing());
            if (Life.IsDead) EnterDeath(true);
            else SaveItems();
        }
    }
    private void EnterDeath(bool dropItems)
    {
        if (_dead) return;
        _dead = true;
        if (_inventoryPanel.IsOpen) _inventoryPanel.Close();
        _mineHeld = false;
        _player.ProcessMode = ProcessModeEnum.Disabled;
        _player.Velocity = Vector3.Zero;
        if (dropItems) DropPlayerItems();
        _hud.ShowDeath(true);
        Input.MouseMode = Input.MouseModeEnum.Visible;
        SaveItems();
    }
    private void DropPlayerItems()
    {
        var position = _player.GlobalPosition + Vector3.Up;
        void DropGrid(InventoryGrid grid)
        {
            foreach (var stack in grid.Snapshot())
                if (!stack.IsEmpty) SpawnItem(stack.Id, stack.Count, position);
            grid.Load(Array.Empty<ItemStack>());
        }
        DropGrid(_inventory.Slots);
        DropGrid(_inventory.Equipment);
        DropGrid(_worldItems.PersonalCraft);
        if (!_worldItems.Cursor.IsEmpty) SpawnItem(_worldItems.Cursor.Id, _worldItems.Cursor.Count, position);
        _worldItems.Cursor = ItemStack.Empty;
        _hud.SetHotbar(_inventory);
    }
    public void Respawn()
    {
        if (!_dead) return;
        Vector3 spawn;
        if (Life.BedSpawn is { } bed)
        {
            _world.EnsureLoaded(bed.X, bed.Z);
            if (_world.GetState(bed.X, bed.Y, bed.Z).Type == BlockType.Bed)
                spawn = new Vector3(bed.X, bed.Y + 1, bed.Z);
            else { Life.SetBedSpawn(null); spawn = _world.FindSpawn(); }
        }
        else spawn = _world.FindSpawn();
        _world.EnsureLoaded(Mathf.RoundToInt(spawn.X), Mathf.RoundToInt(spawn.Z));
        _player.GlobalPosition = spawn;
        _player.Velocity = Vector3.Zero;
        Life.Respawn();
        _dead = false;
        _player.ProcessMode = ProcessModeEnum.Pausable;
        ApplyMode();
        _hud.ShowDeath(false);
        _hud.SetSurvival(Life, Cycle, IsSnowing());
        Input.MouseMode = Input.MouseModeEnum.Captured;
        SaveItems();
    }
    private void UpdateSurvival(float delta)
    {
        var previousFlash = Cycle.LightningFlash;
        Cycle.Tick(delta);
        var snowing = IsSnowing();
        _weatherVisual.SetConditions(Cycle.Weather, snowing, Cycle.WeatherIntensity);
        if (previousFlash < .9f && Cycle.LightningFlash >= .9f)
        {
            _thunder.Play();
            if (Outdoors() && !_dead) TakeDamage(2, DamageKind.Lightning);
        }
        if (!_dead)
        {
            var eye = _player.Camera.GlobalPosition;
            var head = _world.GetBlock(Mathf.RoundToInt(eye.X), Mathf.RoundToInt(eye.Y), Mathf.RoundToInt(eye.Z));
            var chest = _world.GetBlock(Mathf.RoundToInt(eye.X), Mathf.RoundToInt(_player.GlobalPosition.Y + 1), Mathf.RoundToInt(eye.Z));
            var underwater = head == BlockType.Water;
            var suffocating = BlockRules.IsSolid(head) && head != BlockType.Bed || BlockRules.IsSolid(chest) && chest != BlockType.Bed;
            var biome = _world.GetBiome(Mathf.RoundToInt(eye.X), Mathf.RoundToInt(eye.Z));
            var cold = snowing && Cycle.WeatherIntensity > .4f && Outdoors();
            var hot = biome == Biome.Desert && Cycle.Daylight > .7f && Life.Hunger <= 8;
            Life.Tick(delta, Input.IsActionPressed("sprint"), underwater, suffocating, cold, hot);
            if (Life.IsDead) EnterDeath(true);
        }
        _lightingClock += delta;
        if (_lightingClock >= .2f) { _lightingClock = 0; UpdateLighting(); }
        _survivalSaveClock += delta;
        if (_survivalSaveClock >= 5) { _survivalSaveClock = 0; SaveItems(); }
        _hud.SetSurvival(Life, Cycle, snowing);
    }
    private bool IsSnowing()
    {
        var p = _player.GlobalPosition;
        return _world.GetBiome(Mathf.RoundToInt(p.X), Mathf.RoundToInt(p.Z)) == Biome.Snow;
    }
    private bool Outdoors()
    {
        var p = _player.GlobalPosition;
        return p.Y >= _world.SurfaceHeight(Mathf.RoundToInt(p.X), Mathf.RoundToInt(p.Z)) + 1;
    }
    private void UpdateLighting()
    {
        var daylight = Cycle.Daylight;
        var stormDim = Cycle.WeatherIntensity * (Cycle.Weather == WeatherKind.Storm ? .35f : .13f);
        var brightness = Mathf.Clamp(daylight * (1 - stormDim) + Cycle.LightningFlash * .5f, 0, 1);
        _sun.LightEnergy = .02f + brightness * 1.35f;
        _sun.ShadowEnabled = brightness > .18f;
        _sun.RotationDegrees = new Vector3(-15f - daylight * 65f, Cycle.TimeOfDay * 360f - 90f, 0);
        _moon.LightEnergy = .06f + (1 - daylight) * .28f;
        _moon.RotationDegrees = _sun.RotationDegrees + new Vector3(180, 0, 0);
        _worldEnvironment.Environment.AmbientLightEnergy = .18f + brightness * .48f;
        _skyMaterial.SkyTopColor = new Color(.025f, .055f, .13f).Lerp(new Color(.20f, .43f, .72f), brightness);
        _skyMaterial.SkyHorizonColor = new Color(.08f, .12f, .23f).Lerp(new Color(.70f, .81f, .91f), brightness);
    }
}
