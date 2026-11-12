namespace Stonewake.World;

public enum BlockType : byte
{
    Air, Grass, Dirt, Stone, Sand, Snow, Mud, Water,
    Wood, Leaves, Flower, Plant, Coal, Copper, Iron, Gold,
    GrassSide, SnowSide, // Materials only; never stored in chunk voxels.
    Gravel, Glass, Slab, Stairs, Door, Fence,
    CraftingStation, Furnace, Chest
}
