using System.Collections.Generic;
using Godot;

namespace Stonewake.World;

public sealed class MeshBuffer
{
    public readonly List<Vector3> Vertices = new();
    public readonly List<Vector3> Normals = new();
    public readonly List<Vector2> Uvs = new();
    public readonly List<int> Indices = new();
}

public sealed class ChunkMeshData
{
    public readonly Dictionary<BlockType, MeshBuffer> Surfaces = new();
    public readonly List<Vector3> Collision = new();
    public int VisibleFaces;
}

public static class ChunkMesher
{
    private static readonly (int X, int Y, int Z)[] Neighbors =
    {
        (1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)
    };

    private static readonly Vector3[][] Corners =
    {
        new[] { new Vector3(.5f,-.5f,-.5f), new Vector3(.5f,.5f,-.5f), new Vector3(.5f,.5f,.5f), new Vector3(.5f,-.5f,.5f) },
        new[] { new Vector3(-.5f,-.5f,.5f), new Vector3(-.5f,.5f,.5f), new Vector3(-.5f,.5f,-.5f), new Vector3(-.5f,-.5f,-.5f) },
        new[] { new Vector3(-.5f,.5f,-.5f), new Vector3(-.5f,.5f,.5f), new Vector3(.5f,.5f,.5f), new Vector3(.5f,.5f,-.5f) },
        new[] { new Vector3(-.5f,-.5f,.5f), new Vector3(-.5f,-.5f,-.5f), new Vector3(.5f,-.5f,-.5f), new Vector3(.5f,-.5f,.5f) },
        new[] { new Vector3(.5f,-.5f,.5f), new Vector3(.5f,.5f,.5f), new Vector3(-.5f,.5f,.5f), new Vector3(-.5f,-.5f,.5f) },
        new[] { new Vector3(-.5f,-.5f,-.5f), new Vector3(-.5f,.5f,-.5f), new Vector3(.5f,.5f,-.5f), new Vector3(.5f,-.5f,-.5f) }
    };

    private static readonly Vector2[] FaceUvs =
    {
        new(0, 1), new(0, 0), new(1, 0), new(1, 1)
    };

    public static ChunkMeshData Build(ChunkData data)
    {
        var result = new ChunkMeshData();
        for (var z = 0; z < ChunkData.Size; z++)
        for (var x = 0; x < ChunkData.Size; x++)
        for (var y = 0; y < ChunkData.Height; y++)
        {
            var block = data.Get(x, y, z);
            if (block == BlockType.Air) continue;
            var decorative = block is BlockType.Plant or BlockType.Flower;
            for (var side = 0; side < 6; side++)
            {
                var n = Neighbors[side];
                var neighbor = data.Get(x + n.X, y + n.Y, z + n.Z);
                if (!Exposed(block, neighbor, decorative)) continue;
                var material = block == BlockType.Grass && side != 2 ? BlockType.GrassSide
                    : block == BlockType.Snow && side != 2 ? BlockType.SnowSide : block;
                if (!result.Surfaces.TryGetValue(material, out var surface))
                {
                    surface = new MeshBuffer();
                    result.Surfaces.Add(material, surface);
                }
                AddFace(surface, result.Collision, x, y, z, side, decorative, block != BlockType.Water && !decorative);
                result.VisibleFaces++;
            }
        }
        return result;
    }

    private static bool Exposed(BlockType block, BlockType neighbor, bool decorative)
    {
        if (decorative) return true;
        if (block == BlockType.Water) return neighbor == BlockType.Air;
        if (neighbor == BlockType.Air || neighbor == BlockType.Water || neighbor is BlockType.Plant or BlockType.Flower) return true;
        if (block == BlockType.Leaves) return neighbor != BlockType.Leaves;
        return neighbor == BlockType.Leaves;
    }

    private static void AddFace(MeshBuffer buffer, List<Vector3> collision, int x, int y, int z, int side, bool decorative, bool collide)
    {
        var start = buffer.Vertices.Count;
        var normal = new Vector3(Neighbors[side].X, Neighbors[side].Y, Neighbors[side].Z);
        var origin = new Vector3(x, y, z);
        var corners = Corners[side];
        for (var i = 0; i < 4; i++)
        {
            var corner = decorative
                ? new Vector3(corners[i].X * .35f, corners[i].Y * .6f, corners[i].Z * .35f)
                : corners[i];
            buffer.Vertices.Add(origin + corner);
            buffer.Normals.Add(normal);
            buffer.Uvs.Add(FaceUvs[i]);
        }
        buffer.Indices.Add(start); buffer.Indices.Add(start + 1); buffer.Indices.Add(start + 2);
        buffer.Indices.Add(start); buffer.Indices.Add(start + 2); buffer.Indices.Add(start + 3);
        if (!collide) return;
        collision.Add(origin + corners[0]); collision.Add(origin + corners[1]); collision.Add(origin + corners[2]);
        collision.Add(origin + corners[0]); collision.Add(origin + corners[2]); collision.Add(origin + corners[3]);
    }
}
