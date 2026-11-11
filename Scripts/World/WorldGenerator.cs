using System;

namespace Stonewake.World;

public enum Biome { Ocean, Beach, Plains, Forest, Desert, Mountains, Snow, Swamp }

// Pure managed generation: safe on worker threads and deterministic for a seed.
public sealed class WorldGenerator
{
    public const int SeaLevel = 42;
    public int Seed { get; }

    public WorldGenerator(int seed) { Seed = seed; }

    public Biome BiomeAt(int x, int z)
    {
        var continent = Fractal(x * .0035, z * .0035, 11);
        var temperature = Fractal(x * .0025, z * .0025, 23) + .12 * Math.Sin(z * .0008);
        var moisture = Fractal(x * .003, z * .003, 37);
        var height = SurfaceHeight(x, z);
        if (height < SeaLevel - 2) return Biome.Ocean;
        if (height <= SeaLevel + 2) return Biome.Beach;
        if (height > 68) return temperature < .1 ? Biome.Snow : Biome.Mountains;
        if (temperature < -.22) return Biome.Snow;
        if (continent < -.05 && moisture > .18) return Biome.Swamp;
        if (temperature > .27 && moisture < -.08) return Biome.Desert;
        return moisture > .05 ? Biome.Forest : Biome.Plains;
    }

    public int SurfaceHeight(int x, int z)
    {
        var continent = Fractal(x * .0035, z * .0035, 11);
        var hills = Fractal(x * .012, z * .012, 61);
        var ridges = 1.0 - Math.Abs(Fractal(x * .006, z * .006, 79));
        var mountain = Smooth(.16, .55, continent) * Math.Pow(ridges, 2.0) * 39.0;
        var baseHeight = SeaLevel + 6 + continent * 24 + hills * 7 + mountain;
        var river = Math.Abs(Fractal(x * .009, z * .009, 109));
        var riverCut = (1 - Smooth(.018, .09, river)) * 12;
        var lake = Fractal(x * .018, z * .018, 127);
        var lakeCut = lake < -.52 ? Smooth(-.52, -.72, lake) * 8 : 0;
        return Math.Clamp((int)Math.Round(baseHeight - riverCut - lakeCut), 4, ChunkData.Height - 7);
    }

    public ChunkData Generate(int chunkX, int chunkZ)
    {
        var data = new ChunkData(chunkX, chunkZ);
        var ox = chunkX * ChunkData.Size;
        var oz = chunkZ * ChunkData.Size;
        for (var z = -1; z <= ChunkData.Size; z++)
        for (var x = -1; x <= ChunkData.Size; x++)
        {
            var wx = ox + x;
            var wz = oz + z;
            var surface = SurfaceHeight(wx, wz);
            var biome = BiomeAt(wx, wz);
            var ravine = Math.Abs(Fractal(wx * .008, wz * .008, 181)) < .018;
            for (var y = 0; y < ChunkData.Height; y++)
            {
                if (y > surface)
                {
                    if (y <= SeaLevel) data.Set(x, y, z, BlockType.Water);
                    continue;
                }
                if (y > 3 && y < surface - 4 && IsCave(wx, y, wz, ravine)) continue;
                BlockType block;
                if (y == surface) block = biome switch
                {
                    Biome.Desert or Biome.Beach or Biome.Ocean => BlockType.Sand,
                    Biome.Snow => BlockType.Snow,
                    Biome.Swamp => BlockType.Mud,
                    Biome.Mountains when surface > 78 => BlockType.Stone,
                    _ => BlockType.Grass
                };
                else if (y > surface - 4) block = biome is Biome.Desert or Biome.Beach or Biome.Ocean ? BlockType.Sand : BlockType.Dirt;
                else block = OreAt(wx, y, wz);
                data.Set(x, y, z, block);
            }
        }
        AddPlants(data);
        return data;
    }

    private void AddPlants(ChunkData data)
    {
        var ox = data.X * ChunkData.Size;
        var oz = data.Z * ChunkData.Size;
        // Include origins outside the chunk so trees cross boundaries consistently.
        for (var wz = oz - 4; wz <= oz + ChunkData.Size + 3; wz++)
        for (var wx = ox - 4; wx <= ox + ChunkData.Size + 3; wx++)
        {
            var height = SurfaceHeight(wx, wz);
            if (height <= SeaLevel + 1 || height > ChunkData.Height - 8) continue;
            var biome = BiomeAt(wx, wz);
            var chance = Hash(wx, 0, wz, 211) / (double)uint.MaxValue;
            if ((biome == Biome.Forest && chance < .018) || (biome == Biome.Swamp && chance < .012))
            {
                var trunk = 4 + (int)(Hash(wx, 0, wz, 223) % 3);
                for (var y = height + 1; y <= height + trunk; y++) Place(data, wx, y, wz, BlockType.Wood);
                for (var dz = -2; dz <= 2; dz++)
                for (var dx = -2; dx <= 2; dx++)
                for (var dy = -2; dy <= 1; dy++)
                {
                    if (Math.Abs(dx) + Math.Abs(dz) + Math.Abs(dy) > 4) continue;
                    var tx = wx + dx; var ty = height + trunk + dy; var tz = wz + dz;
                    if (data.GetWorld(tx, ty, tz) == BlockType.Air) Place(data, tx, ty, tz, BlockType.Leaves);
                }
            }
            else if ((biome == Biome.Plains || biome == Biome.Forest || biome == Biome.Swamp) && chance < .12)
                Place(data, wx, height + 1, wz, chance < .035 ? BlockType.Flower : BlockType.Plant);
        }
    }

    private static void Place(ChunkData data, int x, int y, int z, BlockType block)
        => data.Set(x - data.X * ChunkData.Size, y, z - data.Z * ChunkData.Size, block);

    private bool IsCave(int x, int y, int z, bool ravine)
    {
        var tunnel = Math.Abs(Noise3(x * .043, y * .055, z * .043, 149));
        var chamber = Noise3(x * .032, y * .035, z * .032, 163);
        return (tunnel < .075 && chamber > -.18) || chamber > .56 || (ravine && y > 18 && y < 62);
    }

    private BlockType OreAt(int x, int y, int z)
    {
        var value = Hash(FloorDiv(x, 2), FloorDiv(y, 2), FloorDiv(z, 2), 197) % 1000;
        if (y < 22 && value < 3) return BlockType.Gold;
        if (y < 48 && value < 10) return BlockType.Iron;
        if (y < 62 && value < 18) return BlockType.Copper;
        if (value < 28) return BlockType.Coal;
        return BlockType.Stone;
    }

    private double Fractal(double x, double z, int salt)
    {
        double result = 0, amplitude = 1, total = 0;
        for (var i = 0; i < 4; i++)
        {
            result += Noise2(x, z, salt + i * 19) * amplitude;
            total += amplitude;
            amplitude *= .5; x *= 2; z *= 2;
        }
        return result / total;
    }

    private double Noise2(double x, double z, int salt)
    {
        var ix = (int)Math.Floor(x); var iz = (int)Math.Floor(z);
        var tx = Fade(x - ix); var tz = Fade(z - iz);
        var a = Lerp(Unit(ix, 0, iz, salt), Unit(ix + 1, 0, iz, salt), tx);
        var b = Lerp(Unit(ix, 0, iz + 1, salt), Unit(ix + 1, 0, iz + 1, salt), tx);
        return Lerp(a, b, tz);
    }

    private double Noise3(double x, double y, double z, int salt)
    {
        var ix = (int)Math.Floor(x); var iy = (int)Math.Floor(y); var iz = (int)Math.Floor(z);
        var tx = Fade(x - ix); var ty = Fade(y - iy); var tz = Fade(z - iz);
        double Layer(int dz)
        {
            var low = Lerp(Unit(ix, iy, iz + dz, salt), Unit(ix + 1, iy, iz + dz, salt), tx);
            var high = Lerp(Unit(ix, iy + 1, iz + dz, salt), Unit(ix + 1, iy + 1, iz + dz, salt), tx);
            return Lerp(low, high, ty);
        }
        return Lerp(Layer(0), Layer(1), tz);
    }

    private double Unit(int x, int y, int z, int salt) => Hash(x, y, z, salt) / (double)uint.MaxValue * 2 - 1;
    private uint Hash(int x, int y, int z, int salt)
    {
        unchecked
        {
            uint h = (uint)Seed ^ (uint)salt * 0x9e3779b9u;
            h ^= (uint)x * 0x85ebca6bu; h = (h ^ (h >> 16)) * 0xc2b2ae35u;
            h ^= (uint)y * 0x27d4eb2fu; h = (h ^ (h >> 13)) * 0x165667b1u;
            h ^= (uint)z * 0x9e3779b9u; return h ^ (h >> 16);
        }
    }

    private static double Fade(double t) => t * t * (3 - 2 * t);
    private static int FloorDiv(int value, int divisor) => (int)Math.Floor(value / (double)divisor);
    private static double Lerp(double a, double b, double t) => a + (b - a) * t;
    private static double Smooth(double a, double b, double x)
    {
        var t = Math.Clamp((x - a) / (b - a), 0, 1);
        return Fade(t);
    }
}
