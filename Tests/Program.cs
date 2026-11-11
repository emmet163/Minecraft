using System;
using System.Collections.Generic;
using System.Diagnostics;
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

Console.WriteLine($"World logic passed: 4 chunks, {ChunkData.Size * ChunkData.Size * ChunkData.Height} revisit voxels, {caves} cave cells, {ores} ore cells, {biomes.Count} biomes, {timer.ElapsedMilliseconds} ms.");

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception($"Failed: {message}");
}
