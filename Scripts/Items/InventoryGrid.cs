using System;
using System.Linq;

namespace Stonewake.Items;

public readonly record struct ItemStack(string Id, int Count, int Damage = 0)
{
    public static ItemStack Empty => new("", 0);
    public bool IsEmpty => string.IsNullOrEmpty(Id) || Count <= 0;
    public ItemStack WithCount(int count) => count <= 0 ? Empty : this with { Count = count };
}

public sealed class InventoryGrid
{
    private readonly ItemStack[] _slots;
    public int Size => _slots.Length;
    public InventoryGrid(int size) => _slots = new ItemStack[size];
    public ItemStack this[int slot] => _slots[slot];
    public ItemStack[] Snapshot() => _slots.ToArray();
    public void Load(ItemStack[] slots)
    {
        Array.Clear(_slots);
        for (var i = 0; i < Math.Min(slots.Length, Size); i++)
            if (!slots[i].IsEmpty && ItemCatalog.Exists(slots[i].Id))
                _slots[i] = slots[i] with { Count = Math.Clamp(slots[i].Count, 1, ItemCatalog.Get(slots[i].Id).Stack) };
    }
    public void Set(int slot, ItemStack stack)
    {
        if (!stack.IsEmpty && (!ItemCatalog.Exists(stack.Id) || stack.Count > ItemCatalog.Get(stack.Id).Stack || stack.Count < 1))
            throw new ArgumentException("Invalid stack");
        _slots[slot] = stack.IsEmpty ? ItemStack.Empty : stack;
    }
    public int Count(string id) => _slots.Where(slot => slot.Id == id).Sum(slot => slot.Count);
    public int Add(string id, int amount, int damage = 0)
    {
        if (amount <= 0) return 0;
        var cap = ItemCatalog.Get(id).Stack;
        for (var i = 0; i < Size && amount > 0; i++)
        {
            var slot = _slots[i];
            if (slot.Id != id || slot.Damage != damage || slot.Count >= cap) continue;
            var take = Math.Min(cap - slot.Count, amount);
            _slots[i] = slot.WithCount(slot.Count + take);
            amount -= take;
        }
        for (var i = 0; i < Size && amount > 0; i++)
        {
            if (!_slots[i].IsEmpty) continue;
            var take = Math.Min(cap, amount);
            _slots[i] = new ItemStack(id, take, damage);
            amount -= take;
        }
        return amount;
    }
    public bool Consume(string id, int amount)
    {
        if (Count(id) < amount) return false;
        for (var i = Size - 1; i >= 0 && amount > 0; i--)
        {
            if (_slots[i].Id != id) continue;
            var take = Math.Min(_slots[i].Count, amount);
            _slots[i] = _slots[i].WithCount(_slots[i].Count - take);
            amount -= take;
        }
        return true;
    }
    public ItemStack Click(int slot, ItemStack cursor, bool right)
    {
        var held = _slots[slot];
        if (right)
        {
            if (cursor.IsEmpty)
            {
                if (held.IsEmpty) return cursor;
                var take = (held.Count + 1) / 2;
                _slots[slot] = held.WithCount(held.Count - take);
                return held.WithCount(take);
            }
            if (held.IsEmpty || held.Id == cursor.Id && held.Damage == cursor.Damage && held.Count < ItemCatalog.Get(cursor.Id).Stack)
            {
                _slots[slot] = held.IsEmpty ? cursor.WithCount(1) : held.WithCount(held.Count + 1);
                return cursor.WithCount(cursor.Count - 1);
            }
            return cursor;
        }
        if (cursor.IsEmpty) { _slots[slot] = ItemStack.Empty; return held; }
        if (held.IsEmpty) { _slots[slot] = cursor; return ItemStack.Empty; }
        if (held.Id == cursor.Id && held.Damage == cursor.Damage)
        {
            var take = Math.Min(ItemCatalog.Get(cursor.Id).Stack - held.Count, cursor.Count);
            _slots[slot] = held.WithCount(held.Count + take);
            return cursor.WithCount(cursor.Count - take);
        }
        _slots[slot] = cursor;
        return held;
    }
    public bool DamageSlot(int slot, int amount)
    {
        var stack = _slots[slot];
        if (stack.IsEmpty || ItemCatalog.Get(stack.Id).Durability <= 0) return false;
        var damage = stack.Damage + amount;
        _slots[slot] = damage >= ItemCatalog.Get(stack.Id).Durability ? ItemStack.Empty : stack with { Damage = damage };
        return true;
    }
}
