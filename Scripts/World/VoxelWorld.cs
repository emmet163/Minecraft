using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Godot;

namespace Stonewake.World;

public partial class VoxelWorld : Node3D
{
    private sealed record BuildResult(int Epoch, int EditRevision, Vector2I Key, ChunkData? Data, ChunkMeshData? Mesh, long Milliseconds, Exception? Error);
    private const int MaxWorkers = 2;
    private readonly Dictionary<Vector2I, VoxelChunk> _loaded = new();
    private readonly HashSet<Vector2I> _pending = new();
    private readonly ConcurrentQueue<BuildResult> _results = new();
    private readonly HashSet<CellKey> _fallCandidates = new();
    private WorldEdits _edits = new();
    private bool _editsWritable = true;
    private string _editPath = "";
    private double _fallTimer;
    private Dictionary<BlockType, StandardMaterial3D> _materials = new();
    private WorldGenerator _generator = new(12345);
    private Node3D? _player;
    private int _epoch;
    private int _editRevision;
    private Vector2I _lastCenter = new(int.MinValue, int.MinValue);

    public int Seed => _generator.Seed;
    public int RenderDistance { get; private set; } = 2;
    public int LoadedCount => _loaded.Count;
    public int PendingCount => _pending.Count;
    public long LastGenerationMilliseconds { get; private set; }
    public long LastEditMilliseconds { get; private set; }

    public override void _Ready()
    {
        ProcessMode = ProcessModeEnum.Pausable;
        for (var i = 1; i <= (int)BlockType.Fence; i++)
            _materials[(BlockType)i] = BlockPalette.Create((BlockType)i);
    }

    public void Configure(int seed, int renderDistance, Node3D player, string? editPathOverride = null)
    {
        _epoch++;
        _editRevision = 0;
        _generator = new WorldGenerator(seed);
        _editPath = editPathOverride ?? ProjectSettings.GlobalizePath($"user://world_{seed}.json");
        try { _edits = WorldEdits.Load(_editPath); _editsWritable = true; }
        catch (Exception error)
        {
            GD.PushError($"Could not load world edits: {error}");
            _edits = new WorldEdits();
            _editsWritable = false;
        }
        RenderDistance = Math.Clamp(renderDistance, 2, 6);
        _player = player;
        _pending.Clear();
        _fallCandidates.Clear();
        foreach (var chunk in _loaded.Values) chunk.QueueFree();
        _loaded.Clear();
        _lastCenter = new Vector2I(int.MinValue, int.MinValue);

        _player.GlobalPosition = FindSpawn();
        if (_player is CharacterBody3D body) body.Velocity = Vector3.Zero;
        var center = PlayerChunk();
        BuildNow(center);
    }

    public Vector3 FindSpawn()
    {
        Vector3? landFallback = null;
        Vector3? treelessFallback = null;
        for (var pass = 0; pass < 2; pass++)
        for (var radius = 0; radius <= 512; radius += 8)
        for (var dz = -radius; dz <= radius; dz += 8)
        for (var dx = -radius; dx <= radius; dx += 8)
        {
            if (radius > 0 && Math.Abs(dx) != radius && Math.Abs(dz) != radius) continue;
            var height = _generator.SurfaceHeight(dx, dz);
            if (height <= WorldGenerator.SeaLevel + 2) continue;
            var biome = _generator.BiomeAt(dx, dz);
            var candidate = new Vector3(dx, height + 3, dz);
            landFallback ??= candidate;
            if (biome is Biome.Desert or Biome.Beach or Biome.Mountains or Biome.Snow)
                treelessFallback ??= candidate;
            if (pass == 0 && biome != Biome.Plains || pass == 1 && biome != Biome.Forest) continue;
            var data = _generator.Generate(FloorDiv(dx, ChunkData.Size), FloorDiv(dz, ChunkData.Size));
            var clear = true;
            for (var z = dz - 1; z <= dz + 1 && clear; z++)
            for (var x = dx - 1; x <= dx + 1 && clear; x++)
            for (var y = height + 1; y <= height + 3; y++)
            {
                if (data.GetWorld(x, y, z) is BlockType.Wood or BlockType.Leaves) { clear = false; break; }
            }
            if (clear) return candidate;
        }
        if (treelessFallback.HasValue) return treelessFallback.Value;
        if (landFallback.HasValue) return landFallback.Value;
        var fallbackHeight = _generator.SurfaceHeight(0, 0);
        return new Vector3(0, Math.Max(fallbackHeight, WorldGenerator.SeaLevel) + 3, 0);
    }

    public BlockType GetBlock(int x, int y, int z)
    {
        var key = new Vector2I(FloorDiv(x, ChunkData.Size), FloorDiv(z, ChunkData.Size));
        return _loaded.TryGetValue(key, out var chunk) ? chunk.Data.GetWorld(x, y, z) : BlockType.Air;
    }

    public BlockState GetState(int x, int y, int z)
    {
        var key = new Vector2I(FloorDiv(x, ChunkData.Size), FloorDiv(z, ChunkData.Size));
        return _loaded.TryGetValue(key, out var chunk) ? chunk.Data.GetWorldState(x, y, z) : BlockState.Empty;
    }

    public bool IsLoaded(int x, int z) => _loaded.ContainsKey(new Vector2I(FloorDiv(x, ChunkData.Size), FloorDiv(z, ChunkData.Size)));
    public StandardMaterial3D MaterialFor(BlockType type) => _materials[type];

    public bool ApplyChanges(params (CellKey Cell, BlockState State)[] changes)
    {
        if (changes.Length == 0 || !_editsWritable) return false;
        var timer = Stopwatch.StartNew();
        foreach (var change in changes)
            if (change.Cell.Y < 0 || change.Cell.Y >= ChunkData.Height || !IsLoaded(change.Cell.X, change.Cell.Z)) return false;
        var rebuild = new HashSet<Vector2I>();
        var previous = new List<(CellKey Cell, bool Had, BlockState State)>();
        foreach (var change in changes)
        {
            var had = _edits.TryGet(change.Cell, out var oldState);
            previous.Add((change.Cell, had, oldState));
            _edits.Record(change.Cell, change.State);
            var cx = FloorDiv(change.Cell.X, ChunkData.Size);
            var cz = FloorDiv(change.Cell.Z, ChunkData.Size);
            rebuild.Add(new Vector2I(cx, cz));
            if (change.Cell.X - cx * ChunkData.Size == 0) rebuild.Add(new Vector2I(cx - 1, cz));
            if (change.Cell.X - cx * ChunkData.Size == ChunkData.Size - 1) rebuild.Add(new Vector2I(cx + 1, cz));
            if (change.Cell.Z - cz * ChunkData.Size == 0) rebuild.Add(new Vector2I(cx, cz - 1));
            if (change.Cell.Z - cz * ChunkData.Size == ChunkData.Size - 1) rebuild.Add(new Vector2I(cx, cz + 1));
        }
        try { _edits.Save(_editPath); }
        catch (Exception error)
        {
            foreach (var item in previous)
            {
                if (item.Had) _edits.Record(item.Cell, item.State);
                else _edits.Remove(item.Cell);
            }
            GD.PushError($"Could not save world edits: {error}");
            return false;
        }
        foreach (var change in changes)
        {
            if (BlockRules.Falls(change.State.Type)) _fallCandidates.Add(change.Cell);
            _fallCandidates.Add(new CellKey(change.Cell.X, change.Cell.Y + 1, change.Cell.Z));
        }
        _editRevision++;
        foreach (var key in rebuild)
            if (_loaded.ContainsKey(key)) RebuildLoaded(key);
        LastEditMilliseconds = timer.ElapsedMilliseconds;
        return true;
    }

    public Biome GetBiome(int x, int z) => _generator.BiomeAt(x, z);

    public override void _Process(double delta)
    {
        if (_player == null) return;
        var center = PlayerChunk();
        if (center != _lastCenter)
        {
            _lastCenter = center;
            foreach (var pair in _loaded.ToArray())
            {
                if (Distance(pair.Key, center) <= RenderDistance + 1) continue;
                pair.Value.QueueFree();
                _loaded.Remove(pair.Key);
            }
        }

        // Godot resource/node creation stays on the main thread; one completed chunk per frame.
        if (_results.TryDequeue(out var result))
        {
            if (result.Epoch == _epoch)
            {
                _pending.Remove(result.Key);
                if (result.Error != null) GD.PushError($"Chunk {result.Key}: {result.Error}");
                else if (result.Data != null && result.Mesh != null && Distance(result.Key, center) <= RenderDistance && !_loaded.ContainsKey(result.Key))
                {
                    var prepared = result.Mesh;
                    if (result.EditRevision != _editRevision)
                    {
                        WorldEdits.Apply(result.Data, _edits.SnapshotForChunk(result.Key.X, result.Key.Y));
                        prepared = ChunkMesher.Build(result.Data);
                    }
                    var chunk = new VoxelChunk();
                    chunk.Build(result.Data, prepared, _materials);
                    AddChild(chunk);
                    _loaded.Add(result.Key, chunk);
                    LastGenerationMilliseconds = result.Milliseconds;
                    QueueFalling(result.Key);
                }
            }
        }

        if (_pending.Count >= MaxWorkers) return;
        var candidates = new List<Vector2I>();
        for (var z = center.Y - RenderDistance; z <= center.Y + RenderDistance; z++)
        for (var x = center.X - RenderDistance; x <= center.X + RenderDistance; x++)
        {
            var key = new Vector2I(x, z);
            if (Distance(key, center) <= RenderDistance && !_loaded.ContainsKey(key) && !_pending.Contains(key)) candidates.Add(key);
        }
        candidates.Sort((a, b) => Distance(a, center).CompareTo(Distance(b, center)));
        foreach (var key in candidates)
        {
            if (_pending.Count >= MaxWorkers) break;
            StartBuild(key);
        }
    }

    public override void _PhysicsProcess(double delta)
    {
        _fallTimer += delta;
        if (_fallTimer < .14 || _fallCandidates.Count == 0) return;
        _fallTimer = 0;
        foreach (var cell in _fallCandidates.ToArray())
        {
            _fallCandidates.Remove(cell);
            var state = GetState(cell.X, cell.Y, cell.Z);
            if (!BlockRules.Falls(state.Type) || cell.Y <= 0) continue;
            var below = new CellKey(cell.X, cell.Y - 1, cell.Z);
            if (!IsLoaded(below.X, below.Z) || !BlockRules.IsReplaceable(GetState(below.X, below.Y, below.Z).Type)) continue;
            ApplyChanges((cell, BlockState.Empty), (below, state));
            break; // One falling step per tick bounds remeshing cost.
        }
    }

    private void BuildNow(Vector2I key)
    {
        var data = _generator.Generate(key.X, key.Y);
        WorldEdits.Apply(data, _edits.SnapshotForChunk(key.X, key.Y));
        var mesh = ChunkMesher.Build(data);
        var chunk = new VoxelChunk();
        chunk.Build(data, mesh, _materials);
        AddChild(chunk);
        _loaded[key] = chunk;
        QueueFalling(key);
    }

    private void RebuildLoaded(Vector2I key)
    {
        var data = _loaded[key].Data;
        WorldEdits.Apply(data, _edits.SnapshotForChunk(key.X, key.Y));
        var prepared = ChunkMesher.Build(data);
        var replacement = new VoxelChunk();
        replacement.Build(data, prepared, _materials);
        var old = _loaded[key];
        RemoveChild(old);
        old.QueueFree();
        AddChild(replacement);
        _loaded[key] = replacement;
    }

    private void QueueFalling(Vector2I key)
    {
        foreach (var edit in _edits.SnapshotForChunk(key.X, key.Y))
            if (BlockRules.Falls(edit.Value.Type)) _fallCandidates.Add(edit.Key);
    }

    private void StartBuild(Vector2I key)
    {
        _pending.Add(key);
        var epoch = _epoch;
        var revision = _editRevision;
        var generator = _generator;
        var edits = _edits.SnapshotForChunk(key.X, key.Y);
        _ = Task.Run(() =>
        {
            var timer = Stopwatch.StartNew();
            try
            {
                var data = generator.Generate(key.X, key.Y);
                WorldEdits.Apply(data, edits);
                var mesh = ChunkMesher.Build(data);
                _results.Enqueue(new BuildResult(epoch, revision, key, data, mesh, timer.ElapsedMilliseconds, null));
            }
            catch (Exception error)
            {
                _results.Enqueue(new BuildResult(epoch, revision, key, null, null, timer.ElapsedMilliseconds, error));
            }
        });
    }

    private Vector2I PlayerChunk() => new(
        Mathf.FloorToInt(_player!.GlobalPosition.X / ChunkData.Size),
        Mathf.FloorToInt(_player.GlobalPosition.Z / ChunkData.Size));

    private static int Distance(Vector2I a, Vector2I b) => Math.Max(Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));
    private static int FloorDiv(int value, int divisor) => (int)Math.Floor(value / (double)divisor);
}
