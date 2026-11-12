namespace Stonewake.World;

public enum ToolKind { Hand, Pickaxe, Shovel }

public static class BlockRules
{
    public static bool IsReplaceable(BlockType type) => type is BlockType.Air or BlockType.Water or BlockType.Plant or BlockType.Flower;
    public static bool IsSolid(BlockType type) => type is not (BlockType.Air or BlockType.Water or BlockType.Plant or BlockType.Flower);
    public static bool Falls(BlockType type) => type is BlockType.Sand or BlockType.Gravel;
    public static bool IsShaped(BlockType type) => type is BlockType.Slab or BlockType.Stairs or BlockType.Door or BlockType.Fence or BlockType.Bed;
    public static bool IsTransparent(BlockType type) => type is BlockType.Water or BlockType.Glass or BlockType.Leaves;

    public static float Hardness(BlockType type) => type switch
    {
        BlockType.Air or BlockType.Water or BlockType.Plant or BlockType.Flower => .12f,
        BlockType.Leaves => .2f,
        BlockType.Glass => .35f,
        BlockType.Dirt or BlockType.Grass or BlockType.Sand or BlockType.Gravel or BlockType.Mud or BlockType.Snow => .65f,
        BlockType.Wood or BlockType.Door or BlockType.Fence or BlockType.Stairs or BlockType.Bed => 1.1f,
        BlockType.Stone or BlockType.Slab or BlockType.Coal or BlockType.Copper => 1.8f,
        BlockType.Iron or BlockType.Gold => 2.4f,
        _ => 1f
    };

    public static float MiningSeconds(BlockType type, ToolKind tool)
    {
        var multiplier = tool switch
        {
            ToolKind.Pickaxe when type is BlockType.Stone or BlockType.Slab or BlockType.Coal or BlockType.Copper or BlockType.Iron or BlockType.Gold or BlockType.Gravel => 3.5f,
            ToolKind.Shovel when type is BlockType.Dirt or BlockType.Grass or BlockType.Sand or BlockType.Gravel or BlockType.Mud or BlockType.Snow => 3f,
            _ => 1f
        };
        return System.Math.Max(.08f, Hardness(type) / multiplier);
    }

    public static BlockType DropType(BlockType mined) => mined switch
    {
        BlockType.Grass => BlockType.Dirt,
        BlockType.Snow => BlockType.Snow,
        BlockType.GrassSide or BlockType.SnowSide => BlockType.Air,
        _ => mined
    };
}
