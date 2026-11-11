using Godot;

namespace Stonewake.World;

public partial class VoxelWorld : Node3D
{
    public override void _Ready()
    {
        var materials = new[]
        {
            BlockPalette.Create(BlockType.Grass),
            BlockPalette.Create(BlockType.Dirt),
            BlockPalette.Create(BlockType.Stone)
        };

        for (var x = -1; x <= 0; x++)
        for (var z = -1; z <= 0; z++)
        {
            var chunk = new VoxelChunk();
            AddChild(chunk);
            chunk.Build(x, z, materials);
        }
    }
}
