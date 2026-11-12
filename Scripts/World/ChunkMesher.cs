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
            var state = data.GetState(x, y, z);
            var block = state.Type;
            if (block == BlockType.Air) continue;
            if (BlockRules.IsShaped(block))
            {
                AddShaped(result, data, state, x, y, z);
                continue;
            }
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
                AddFace(surface, result.Collision, new Vector3(x, y, z), Vector3.One, side,
                    decorative, block != BlockType.Water && !decorative);
                result.VisibleFaces++;
            }
        }
        return result;
    }

    private static bool Exposed(BlockType block, BlockType neighbor, bool decorative)
    {
        if (decorative) return true;
        if (block == BlockType.Water) return neighbor == BlockType.Air;
        if (block == BlockType.Glass) return neighbor is BlockType.Air or BlockType.Water or BlockType.Leaves;
        if (neighbor == BlockType.Air || neighbor == BlockType.Water || neighbor is BlockType.Plant or BlockType.Flower) return true;
        if (neighbor == BlockType.Glass) return true;
        if (block == BlockType.Leaves) return neighbor != BlockType.Leaves;
        return neighbor == BlockType.Leaves;
    }

    private static void AddShaped(ChunkMeshData result, ChunkData data, BlockState state, int x, int y, int z)
    {
        var type = state.Type;
        if (!result.Surfaces.TryGetValue(type, out var buffer)) result.Surfaces[type] = buffer = new MeshBuffer();
        var origin = new Vector3(x, y, z);
        void Box(Vector3 offset, Vector3 size)
        {
            for (var side = 0; side < 6; side++)
            {
                AddFace(buffer, result.Collision, origin + offset, size, side, false, true);
                result.VisibleFaces++;
            }
        }
        switch (type)
        {
            case BlockType.Slab:
                Box(new Vector3(0, state.Upper ? .25f : -.25f, 0), new Vector3(1, .5f, 1));
                break;
            case BlockType.Stairs:
                Box(new Vector3(0, -.25f, 0), new Vector3(1, .5f, 1));
                var upper = state.Facing switch
                {
                    1 => new Vector3(.25f, .25f, 0),
                    2 => new Vector3(0, .25f, .25f),
                    3 => new Vector3(-.25f, .25f, 0),
                    _ => new Vector3(0, .25f, -.25f)
                };
                Box(upper, state.Facing % 2 == 0 ? new Vector3(1, .5f, .5f) : new Vector3(.5f, .5f, 1));
                break;
            case BlockType.Door:
                var facing = (state.Facing + (state.Open ? 1 : 0)) & 3;
                Box(Vector3.Zero, facing % 2 == 0 ? new Vector3(.18f, 1, 1) : new Vector3(1, 1, .18f));
                break;
            case BlockType.Fence:
                Box(Vector3.Zero, new Vector3(.25f, 1, .25f));
                for (var side = 0; side < 4; side++)
                {
                    var n = Neighbors[side == 0 ? 0 : side == 1 ? 1 : side == 2 ? 4 : 5];
                    if (!BlockRules.IsSolid(data.Get(x + n.X, y, z + n.Z))) continue;
                    var offset = new Vector3(n.X * .3f, 0, n.Z * .3f);
                    var size = n.X != 0 ? new Vector3(.6f, .16f, .16f) : new Vector3(.16f, .16f, .6f);
                    Box(offset + new Vector3(0, .2f, 0), size);
                    Box(offset + new Vector3(0, -.2f, 0), size);
                }
                break;
        }
    }

    private static void AddFace(MeshBuffer buffer, List<Vector3> collision, Vector3 origin, Vector3 size, int side, bool decorative, bool collide)
    {
        var start = buffer.Vertices.Count;
        var normal = new Vector3(Neighbors[side].X, Neighbors[side].Y, Neighbors[side].Z);
        var corners = Corners[side];
        for (var i = 0; i < 4; i++)
        {
            var corner = decorative
                ? new Vector3(corners[i].X * .35f, corners[i].Y * .6f, corners[i].Z * .35f)
                : new Vector3(corners[i].X * size.X, corners[i].Y * size.Y, corners[i].Z * size.Z);
            buffer.Vertices.Add(origin + corner);
            buffer.Normals.Add(normal);
            buffer.Uvs.Add(FaceUvs[i]);
        }
        buffer.Indices.Add(start); buffer.Indices.Add(start + 1); buffer.Indices.Add(start + 2);
        buffer.Indices.Add(start); buffer.Indices.Add(start + 2); buffer.Indices.Add(start + 3);
        if (!collide) return;
        Vector3 Scaled(int i) => origin + new Vector3(corners[i].X * size.X, corners[i].Y * size.Y, corners[i].Z * size.Z);
        collision.Add(Scaled(0)); collision.Add(Scaled(1)); collision.Add(Scaled(2));
        collision.Add(Scaled(0)); collision.Add(Scaled(2)); collision.Add(Scaled(3));
    }
}
