using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using Stonewake.World;

var timer = Stopwatch.StartNew();
var generator = new WorldGenerator(741852);
var other = new WorldGenerator(741853);
var a = generator.Generate(0, 0);
var revisit = generator.Generate(0, 0);
var east = generator.Generate(1, 0);
var negative = generator.Generate(-1, 0);

for (var z = 0; z < ChunkData.Size; z++)
for (var y = 0; y < ChunkData.Height; y++)
{
    Check(a.Get(ChunkData.Size, y, z) == east.Get(0, y, z), "east seam");
    Check(a.Get(ChunkData.Size - 1, y, z) == east.Get(-1, y, z), "east border");
    Check(negative.Get(ChunkData.Size, y, z) == a.Get(0, y, z), "negative seam");
}

var differences = 0;
var caves = 0;
var ores = 0;
for (var z = 0; z < ChunkData.Size; z++)
for (var x = 0; x < ChunkData.Size; x++)
{
    var h = generator.SurfaceHeight(x, z);
    Check(Math.Abs(h - generator.SurfaceHeight(x + 1, z)) <= 8, "height continuity x");
    Check(Math.Abs(h - generator.SurfaceHeight(x, z + 1)) <= 8, "height continuity z");
    for (var y = 0; y < ChunkData.Height; y++)
    {
        Check(a.Get(x, y, z) == revisit.Get(x, y, z), "seed revisit");
        if (y < h - 5 && y > 5 && a.Get(x, y, z) == BlockType.Air) caves++;
        if (a.Get(x, y, z) is BlockType.Coal or BlockType.Copper or BlockType.Iron or BlockType.Gold) ores++;
    }
    if (generator.SurfaceHeight(x, z) != other.SurfaceHeight(x, z)) differences++;
}
Check(differences > 0, "different seeds change terrain");
Check(caves > 0, "caves generated");
Check(ores > 0, "ores generated");

var biomes = new HashSet<Biome>();
for (var z = -3000; z <= 3000; z += 120)
for (var x = -3000; x <= 3000; x += 120)
    biomes.Add(generator.BiomeAt(x, z));
foreach (Biome biome in Enum.GetValues<Biome>()) Check(biomes.Contains(biome), $"biome {biome} generated");

Check(BlockRules.MiningSeconds(BlockType.Stone, ToolKind.Pickaxe) < BlockRules.MiningSeconds(BlockType.Stone, ToolKind.Hand), "pickaxe speeds stone");
Check(BlockRules.MiningSeconds(BlockType.Sand, ToolKind.Shovel) < BlockRules.MiningSeconds(BlockType.Sand, ToolKind.Pickaxe), "shovel speeds sand");
Check(BlockRules.Falls(BlockType.Sand) && BlockRules.Falls(BlockType.Gravel), "gravity blocks");
Check(BlockRules.IsTransparent(BlockType.Glass) && BlockRules.IsShaped(BlockType.Stairs), "block properties");
var edits = new WorldEdits();
var boundaryLeft = new CellKey(15, 50, 0);
var boundaryRight = new CellKey(16, 50, 0);
edits.Record(boundaryLeft, BlockState.Empty);
edits.Record(boundaryRight, new BlockState(BlockType.Stairs, 2));
var path = Path.Combine(Path.GetTempPath(), $"stonewake-edits-{Guid.NewGuid():N}.json");
try
{
    edits.Save(path);
    var restored = WorldEdits.Load(path);
    Check(restored.Count == 2, "edit save/load count");
    var left = generator.Generate(0, 0);
    var right = generator.Generate(1, 0);
    WorldEdits.Apply(left, restored.SnapshotForChunk(0, 0));
    WorldEdits.Apply(right, restored.SnapshotForChunk(1, 0));
    Check(left.GetWorldState(15, 50, 0) == BlockState.Empty, "mined edit restored");
    Check(left.GetWorldState(16, 50, 0) == right.GetWorldState(16, 50, 0), "edited border matches adjacent chunk");
    Check(right.GetWorldState(16, 50, 0).Facing == 2, "shape orientation restored");
}
finally { if (File.Exists(path)) File.Delete(path); }

Console.WriteLine($"World logic passed: seed/chunk seams, {biomes.Count} biomes, tool speeds, block states, persisted boundary edits, {timer.ElapsedMilliseconds} ms.");

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception($"Failed: {message}");
}
