using System.Collections.Generic;
using Godot;

namespace Stonewake.World;

public partial class VoxelChunk : Node3D
{
    public ChunkData Data { get; private set; } = null!;

    public void Build(ChunkData data, ChunkMeshData prepared, IReadOnlyDictionary<BlockType, StandardMaterial3D> materials)
    {
        Data = data;
        Name = $"Chunk_{data.X}_{data.Z}";
        Position = new Vector3(data.X * ChunkData.Size, 0, data.Z * ChunkData.Size);

        var mesh = new ArrayMesh();
        foreach (var pair in prepared.Surfaces)
        {
            var buffer = pair.Value;
            if (buffer.Vertices.Count == 0) continue;
            var arrays = new Godot.Collections.Array();
            arrays.Resize((int)Mesh.ArrayType.Max);
            arrays[(int)Mesh.ArrayType.Vertex] = buffer.Vertices.ToArray();
            arrays[(int)Mesh.ArrayType.Normal] = buffer.Normals.ToArray();
            arrays[(int)Mesh.ArrayType.TexUV] = buffer.Uvs.ToArray();
            arrays[(int)Mesh.ArrayType.Index] = buffer.Indices.ToArray();
            mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);
            mesh.SurfaceSetMaterial(mesh.GetSurfaceCount() - 1, materials[pair.Key]);
        }
        AddChild(new MeshInstance3D { Mesh = mesh });

        if (prepared.Collision.Count > 0)
        {
            var shape = new ConcavePolygonShape3D { BackfaceCollision = true };
            shape.SetFaces(prepared.Collision.ToArray());
            var body = new StaticBody3D();
            body.AddChild(new CollisionShape3D { Shape = shape });
            AddChild(body);
        }
    }
}
