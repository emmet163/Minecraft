using Stonewake.Items;
using Stonewake.World;

namespace Stonewake.Player;

// Slots 0-8 are the visible hotbar; slots 9-35 form the backpack.
public sealed class HotbarInventory
{
    private static readonly string[] Starter = { "dirt", "stone", "sand", "gravel", "glass", "slab", "stairs", "door", "fence" };
    public InventoryGrid Slots { get; } = new(36);
    public InventoryGrid Equipment { get; } = new(4); // tool, helmet, chestplate, weapon
    public int Selected { get; private set; }
    public ToolKind Tool { get; private set; } = ToolKind.Hand;
    public ItemStack SelectedStack => Slots[Selected];
    public BlockType SelectedBlock => SelectedStack.IsEmpty ? BlockType.Air : ItemCatalog.BlockOf(SelectedStack.Id);
    public HotbarInventory()
    {
        Reset();
    }
    public void Reset()
    {
        Slots.Load(System.Array.Empty<ItemStack>());
        Equipment.Load(System.Array.Empty<ItemStack>());
        for (var i = 0; i < Starter.Length; i++) Slots.Set(i, new ItemStack(Starter[i], 32));
        Selected = 0; Tool = ToolKind.Hand;
    }
    public BlockType Slot(int index) => Slots[index].IsEmpty ? BlockType.Air : ItemCatalog.BlockOf(Slots[index].Id);
    public int Count(BlockType type) => Slots.Count(ItemCatalog.ForBlock(type));
    public void Select(int index) => Selected = ((index % 9) + 9) % 9;
    public void Scroll(int direction) => Select(Selected + direction);
    public void CycleTool() => Tool = (ToolKind)(((int)Tool + 1) % 3);
    public int Add(BlockType type, int amount = 1) => type == BlockType.Air ? amount : Slots.Add(ItemCatalog.ForBlock(type), amount);
    public bool SpendSelected()
    {
        var stack = SelectedStack;
        if (stack.IsEmpty) return false;
        Slots.Set(Selected, stack.WithCount(stack.Count - 1));
        return true;
    }
    public float MiningSeconds(BlockType block)
    {
        var baseTime = BlockRules.MiningSeconds(block, Tool);
        var equipped = Equipment[0];
        if (equipped.IsEmpty || Tool == ToolKind.Hand) return baseTime;
        var definition = ItemCatalog.Get(equipped.Id);
        if (definition.Category != (Tool == ToolKind.Pickaxe ? "pickaxe" : "shovel")) return baseTime;
        return System.Math.Max(.08f, baseTime / System.Math.Max(1, definition.Speed / 2));
    }
    public void WearTool()
    {
        if (Tool != ToolKind.Hand) Equipment.DamageSlot(0, 1);
    }
    public bool EquipFromSlot(int slot, int equipmentSlot)
    {
        var item = Slots[slot];
        if (item.IsEmpty) return false;
        var category = ItemCatalog.Get(item.Id).Category;
        var valid = equipmentSlot switch
        {
            0 => category is "pickaxe" or "shovel",
            1 => item.Id.EndsWith("_helmet"),
            2 => item.Id.EndsWith("_chestplate"),
            3 => category == "weapon",
            _ => false
        };
        if (!valid) return false;
        var old = Equipment[equipmentSlot];
        Equipment.Set(equipmentSlot, item);
        Slots.Set(slot, old);
        return true;
    }
    public void Load(ItemStack[] slots, ItemStack[] equipment, int selected, int tool)
    {
        Slots.Load(slots);
        Equipment.Load(equipment);
        Select(selected);
        Tool = (ToolKind)System.Math.Clamp(tool, 0, 2);
    }
}
