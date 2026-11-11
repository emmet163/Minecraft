namespace Stonewake.World;

// One-block border makes face culling independent of chunk load order.
public sealed class ChunkData
{
    public const int Size = 16;
    public const int Height = 96;
    public const int Padded = Size + 2;
    public readonly int X;
    public readonly int Z;
    private readonly byte[] _blocks = new byte[Padded * Height * Padded];

    public ChunkData(int x, int z) { X = x; Z = z; }

    public BlockType Get(int x, int y, int z)
    {
        if (x < -1 || x > Size || z < -1 || z > Size || y < 0 || y >= Height) return BlockType.Air;
        return (BlockType)_blocks[((z + 1) * Padded + x + 1) * Height + y];
    }

    public void Set(int x, int y, int z, BlockType block)
    {
        if (x < -1 || x > Size || z < -1 || z > Size || y < 0 || y >= Height) return;
        _blocks[((z + 1) * Padded + x + 1) * Height + y] = (byte)block;
    }

    public BlockType GetWorld(int x, int y, int z) => Get(x - X * Size, y, z - Z * Size);
}
