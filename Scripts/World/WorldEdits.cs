using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Stonewake.World;

public readonly record struct CellKey(int X, int Y, int Z);
public readonly record struct EditEntry(int X, int Y, int Z, BlockType Type, byte Properties);

// Stores only changes from deterministic generation, keyed by world coordinates.
public sealed class WorldEdits
{
    private readonly Dictionary<(int X, int Z), Dictionary<CellKey, BlockState>> _byChunk = new();
    public int Count => _byChunk.Values.Sum(group => group.Count);

    public void Record(CellKey cell, BlockState state)
    {
        var key = (FloorDiv(cell.X), FloorDiv(cell.Z));
        if (!_byChunk.TryGetValue(key, out var group)) _byChunk[key] = group = new();
        group[cell] = state;
    }

    public bool TryGet(CellKey cell, out BlockState state)
    {
        var key = (FloorDiv(cell.X), FloorDiv(cell.Z));
        if (_byChunk.TryGetValue(key, out var group)) return group.TryGetValue(cell, out state);
        state = BlockState.Empty;
        return false;
    }

    public void Remove(CellKey cell)
    {
        var key = (FloorDiv(cell.X), FloorDiv(cell.Z));
        if (!_byChunk.TryGetValue(key, out var group)) return;
        group.Remove(cell);
        if (group.Count == 0) _byChunk.Remove(key);
    }

    public Dictionary<CellKey, BlockState> SnapshotForChunk(int chunkX, int chunkZ)
    {
        var snapshot = new Dictionary<CellKey, BlockState>();
        var minX = chunkX * ChunkData.Size - 1;
        var maxX = (chunkX + 1) * ChunkData.Size;
        var minZ = chunkZ * ChunkData.Size - 1;
        var maxZ = (chunkZ + 1) * ChunkData.Size;
        for (var dz = -1; dz <= 1; dz++)
        for (var dx = -1; dx <= 1; dx++)
        {
            if (!_byChunk.TryGetValue((chunkX + dx, chunkZ + dz), out var group)) continue;
            foreach (var pair in group)
                if (pair.Key.X >= minX && pair.Key.X <= maxX && pair.Key.Z >= minZ && pair.Key.Z <= maxZ)
                    snapshot[pair.Key] = pair.Value;
        }
        return snapshot;
    }

    public static void Apply(ChunkData data, IReadOnlyDictionary<CellKey, BlockState> edits)
    {
        var ox = data.X * ChunkData.Size;
        var oz = data.Z * ChunkData.Size;
        foreach (var pair in edits)
            data.SetState(pair.Key.X - ox, pair.Key.Y, pair.Key.Z - oz, pair.Value);
    }

    public void Save(string path)
    {
        var entries = _byChunk.Values.SelectMany(group => group.Select(pair =>
            new EditEntry(pair.Key.X, pair.Key.Y, pair.Key.Z, pair.Value.Type, pair.Value.Properties))).ToArray();
        var json = JsonSerializer.Serialize(entries);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + ".tmp";
        File.WriteAllText(temporary, json);
        File.Move(temporary, path, true);
    }

    public static WorldEdits Load(string path)
    {
        var edits = new WorldEdits();
        if (!File.Exists(path)) return edits;
        foreach (var entry in JsonSerializer.Deserialize<EditEntry[]>(File.ReadAllText(path)) ?? Array.Empty<EditEntry>())
            if (entry.Y >= 0 && entry.Y < ChunkData.Height && Enum.IsDefined(entry.Type))
                edits.Record(new CellKey(entry.X, entry.Y, entry.Z), new BlockState(entry.Type, entry.Properties));
        return edits;
    }

    private static int FloorDiv(int value) => (int)Math.Floor(value / (double)ChunkData.Size);
}
