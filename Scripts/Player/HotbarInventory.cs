using System.Collections.Generic;
using Stonewake.World;

namespace Stonewake.Player;

public sealed class HotbarInventory
{
    private readonly BlockType[] _slots =
    {
        BlockType.Dirt, BlockType.Stone, BlockType.Sand, BlockType.Gravel, BlockType.Glass,
        BlockType.Slab, BlockType.Stairs, BlockType.Door, BlockType.Fence
    };
    private readonly Dictionary<BlockType, int> _counts = new();
    public int Selected { get; private set; }
    public ToolKind Tool { get; private set; } = ToolKind.Hand;
    public BlockType SelectedBlock => _slots[Selected];

    public HotbarInventory()
    {
        foreach (var block in _slots) _counts[block] = 32;
    }

    public BlockType Slot(int index) => _slots[index];
    public int Count(BlockType type) => _counts.GetValueOrDefault(type);
    public void Select(int index) => Selected = ((index % 9) + 9) % 9;
    public void Scroll(int direction) => Select(Selected + direction);
    public void CycleTool() => Tool = (ToolKind)(((int)Tool + 1) % 3);
    public void Add(BlockType type, int amount = 1)
    {
        if (type == BlockType.Air) return;
        _counts[type] = Count(type) + amount;
    }
    public bool SpendSelected()
    {
        var type = SelectedBlock;
        if (Count(type) <= 0) return false;
        _counts[type]--;
        return true;
    }
}
