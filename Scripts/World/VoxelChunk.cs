using Godot;

namespace Stonewake.World;

public partial class VoxelChunk : Node3D
{
    public const int Size = 8;
    private static readonly BoxMesh CubeMesh = new() { Size = Vector3.One };
    private static readonly BoxShape3D CubeShape = new() { Size = Vector3.One };

    public void Build(int chunkX, int chunkZ, StandardMaterial3D[] materials)
    {
        Name = $"Chunk_{chunkX}_{chunkZ}";
        for (var localX = 0; localX < Size; localX++)
        for (var localZ = 0; localZ < Size; localZ++)
        {
            var x = chunkX * Size + localX;
            var z = chunkZ * Size + localZ;
            AddBlock(x, 0, z, BlockType.Grass, materials);

            // Reveal the soil and bedrock layers along the edge of the test world.
            if (x == -Size || x == Size - 1 || z == -Size || z == Size - 1)
            {
                AddBlock(x, -1, z, BlockType.Dirt, materials);
                AddBlock(x, -2, z, BlockType.Stone, materials);
            }
        }
    }

    private void AddBlock(int x, int y, int z, BlockType type, StandardMaterial3D[] materials)
    {
        var body = new StaticBody3D { Position = new Vector3(x, y, z) };
        body.SetMeta("block_type", type.ToString());
        body.SetMeta("block_position", new Vector3I(x, y, z));
        AddChild(body);
        body.AddChild(new MeshInstance3D
        {
            Mesh = CubeMesh,
            MaterialOverride = materials[(int)type],
            CastShadow = GeometryInstance3D.ShadowCastingSetting.On
        });
        body.AddChild(new CollisionShape3D { Shape = CubeShape });
    }
}
