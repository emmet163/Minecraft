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
    private sealed record BuildResult(int Epoch, Vector2I Key, ChunkData? Data, ChunkMeshData? Mesh, long Milliseconds, Exception? Error);
    private const int MaxWorkers = 2;
    private readonly Dictionary<Vector2I, VoxelChunk> _loaded = new();
    private readonly HashSet<Vector2I> _pending = new();
    private readonly ConcurrentQueue<BuildResult> _results = new();
    private Dictionary<BlockType, StandardMaterial3D> _materials = new();
    private WorldGenerator _generator = new(12345);
    private Node3D? _player;
    private int _epoch;
    private Vector2I _lastCenter = new(int.MinValue, int.MinValue);

    public int Seed => _generator.Seed;
    public int RenderDistance { get; private set; } = 2;
    public int LoadedCount => _loaded.Count;
    public int PendingCount => _pending.Count;
    public long LastGenerationMilliseconds { get; private set; }

    public override void _Ready()
    {
        for (var i = 1; i <= (int)BlockType.SnowSide; i++)
            _materials[(BlockType)i] = BlockPalette.Create((BlockType)i);
    }

    public void Configure(int seed, int renderDistance, Node3D player)
    {
        _epoch++;
        _generator = new WorldGenerator(seed);
        RenderDistance = Math.Clamp(renderDistance, 2, 6);
        _player = player;
        _pending.Clear();
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
                    var chunk = new VoxelChunk();
                    chunk.Build(result.Data, result.Mesh, _materials);
                    AddChild(chunk);
                    _loaded.Add(result.Key, chunk);
                    LastGenerationMilliseconds = result.Milliseconds;
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

    private void BuildNow(Vector2I key)
    {
        var data = _generator.Generate(key.X, key.Y);
        var mesh = ChunkMesher.Build(data);
        var chunk = new VoxelChunk();
        chunk.Build(data, mesh, _materials);
        AddChild(chunk);
        _loaded[key] = chunk;
    }

    private void StartBuild(Vector2I key)
    {
        _pending.Add(key);
        var epoch = _epoch;
        var generator = _generator;
        _ = Task.Run(() =>
        {
            var timer = Stopwatch.StartNew();
            try
            {
                var data = generator.Generate(key.X, key.Y);
                var mesh = ChunkMesher.Build(data);
                _results.Enqueue(new BuildResult(epoch, key, data, mesh, timer.ElapsedMilliseconds, null));
            }
            catch (Exception error)
            {
                _results.Enqueue(new BuildResult(epoch, key, null, null, timer.ElapsedMilliseconds, error));
            }
        });
    }

    private Vector2I PlayerChunk() => new(
        Mathf.FloorToInt(_player!.GlobalPosition.X / ChunkData.Size),
        Mathf.FloorToInt(_player.GlobalPosition.Z / ChunkData.Size));

    private static int Distance(Vector2I a, Vector2I b) => Math.Max(Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));
    private static int FloorDiv(int value, int divisor) => (int)Math.Floor(value / (double)divisor);
}
