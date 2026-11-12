namespace Stonewake.World;

// Facing: 0 north, 1 east, 2 south, 3 west. Bit 2: upper slab/door; bit 3: open door.
public readonly record struct BlockState(BlockType Type, byte Properties = 0)
{
    public int Facing => Properties & 3;
    public bool Upper => (Properties & 4) != 0;
    public bool Open => (Properties & 8) != 0;
    public BlockState WithOpen(bool open) => new(Type, (byte)(open ? Properties | 8 : Properties & ~8));
    public static readonly BlockState Empty = new(BlockType.Air);
}
