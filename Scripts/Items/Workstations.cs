using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using Stonewake.World;
using Stonewake.Survival;

namespace Stonewake.Items;

public sealed class FurnaceState
{
    public InventoryGrid Slots { get; } = new(3); // input, fuel, output
    public float BurnRemaining { get; set; }
    public float Progress { get; set; }
    public void Tick(float seconds)
    {
        if (seconds <= 0) return;
        var input = Slots[0];
        var recipe = RecipeBook.Smelt(input.Id);
        if (recipe == null) { Progress = 0; return; }
        var result = recipe.Output;
        var output = Slots[2];
        if (!output.IsEmpty && (output.Id != result || output.Count >= ItemCatalog.Get(result).Stack)) return;
        if (BurnRemaining <= 0)
        {
            var fuel = Slots[1];
            if (fuel.IsEmpty || ItemCatalog.Get(fuel.Id).FuelSeconds <= 0) return;
            BurnRemaining = ItemCatalog.Get(fuel.Id).FuelSeconds;
            Slots.Set(1, fuel.WithCount(fuel.Count - 1));
        }
        var active = Math.Min(seconds, BurnRemaining);
        BurnRemaining -= active;
        Progress += active;
        if (Progress < recipe.Seconds) return;
        Progress -= recipe.Seconds;
        Slots.Set(0, input.WithCount(input.Count - 1));
        Slots.Set(2, output.IsEmpty ? new ItemStack(result, 1) : output.WithCount(output.Count + 1));
    }
    public float ProgressFraction => RecipeBook.Smelt(Slots[0].Id) is { } recipe
        ? Math.Clamp(Progress / recipe.Seconds, 0, 1) : 0;
}

public sealed record FurnaceSave(ItemStack[] Slots, float Burn, float Progress);
public sealed record ContainerSave(int X, int Y, int Z, ItemStack[] Slots);
public sealed record FurnaceEntry(int X, int Y, int Z, FurnaceSave Furnace);
public sealed record PlayerSave(ItemStack[] Slots, ItemStack[] Equipment, int Selected, int Tool, ItemStack Cursor,
    ItemStack[] PersonalCraft, ContainerSave[] Stations, ContainerSave[] Chests, FurnaceEntry[] Furnaces,
    SurvivalSave? Survival = null, WorldCycleSave? Cycle = null);

public sealed class WorldItems
{
    public SurvivalState Survival { get; } = new();
    public WorldCycle Cycle { get; } = new();
    public ItemStack Cursor { get; set; } = ItemStack.Empty;
    public InventoryGrid PersonalCraft { get; } = new(4);
    public readonly Dictionary<CellKey, InventoryGrid> Stations = new();
    public readonly Dictionary<CellKey, InventoryGrid> Chests = new();
    public readonly Dictionary<CellKey, FurnaceState> Furnaces = new();
    public InventoryGrid Chest(CellKey cell)
    {
        if (!Chests.TryGetValue(cell, out var chest)) Chests[cell] = chest = new InventoryGrid(27);
        return chest;
    }
    public InventoryGrid Station(CellKey cell)
    {
        if (!Stations.TryGetValue(cell, out var grid)) Stations[cell] = grid = new InventoryGrid(9);
        return grid;
    }
    public FurnaceState Furnace(CellKey cell)
    {
        if (!Furnaces.TryGetValue(cell, out var furnace)) Furnaces[cell] = furnace = new FurnaceState();
        return furnace;
    }
    public void Clear() { Cursor = ItemStack.Empty; PersonalCraft.Load(Array.Empty<ItemStack>()); Stations.Clear(); Chests.Clear(); Furnaces.Clear(); Survival.Reset(); }
    public void Save(string path, Player.HotbarInventory player)
    {
        var save = new PlayerSave(player.Slots.Snapshot(), player.Equipment.Snapshot(), player.Selected,
            (int)player.Tool, Cursor, PersonalCraft.Snapshot(),
            Stations.Select(pair => new ContainerSave(pair.Key.X, pair.Key.Y, pair.Key.Z, pair.Value.Snapshot())).ToArray(),
            Chests.Select(pair => new ContainerSave(pair.Key.X, pair.Key.Y, pair.Key.Z, pair.Value.Snapshot())).ToArray(),
            Furnaces.Select(pair => new FurnaceEntry(pair.Key.X, pair.Key.Y, pair.Key.Z,
                new FurnaceSave(pair.Value.Slots.Snapshot(), pair.Value.BurnRemaining, pair.Value.Progress))).ToArray(),
            Survival.Snapshot(), Cycle.Snapshot());
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(save));
            for (var attempt = 0; ; attempt++)
            {
                try { File.Move(temporary, path, true); break; }
                catch (Exception error) when (attempt < 3 && error is IOException or UnauthorizedAccessException)
                { Thread.Sleep(25 * (attempt + 1)); }
            }
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    public void Load(string path, Player.HotbarInventory player, int seed = 12345)
    {
        Clear();
        Cycle.Configure(seed);
        player.Reset();
        if (!File.Exists(path)) return;
        var save = JsonSerializer.Deserialize<PlayerSave>(File.ReadAllText(path)) ?? throw new InvalidDataException("Empty inventory save");
        player.Load(save.Slots, save.Equipment, save.Selected, save.Tool);
        Survival.Load(save.Survival);
        Cycle.Load(save.Cycle, seed);
        Cursor = save.Cursor.IsEmpty || !ItemCatalog.Exists(save.Cursor.Id) ? ItemStack.Empty : save.Cursor;
        PersonalCraft.Load(save.PersonalCraft ?? Array.Empty<ItemStack>());
        foreach (var entry in save.Stations ?? Array.Empty<ContainerSave>())
            Station(new CellKey(entry.X, entry.Y, entry.Z)).Load(entry.Slots);
        foreach (var entry in save.Chests ?? Array.Empty<ContainerSave>())
            Chest(new CellKey(entry.X, entry.Y, entry.Z)).Load(entry.Slots);
        foreach (var entry in save.Furnaces ?? Array.Empty<FurnaceEntry>())
        {
            var furnace = Furnace(new CellKey(entry.X, entry.Y, entry.Z));
            furnace.Slots.Load(entry.Furnace.Slots);
            furnace.BurnRemaining = Math.Max(0, entry.Furnace.Burn);
            furnace.Progress = Math.Clamp(entry.Furnace.Progress, 0, 60);
        }
    }
}
