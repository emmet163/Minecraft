using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Stonewake.World;
using Stonewake.Items;
using Stonewake.Player;
using Stonewake.Survival;

var timer = Stopwatch.StartNew();
var generator = new WorldGenerator(741852);
var other = new WorldGenerator(741853);
var a = generator.Generate(0, 0);
var revisit = generator.Generate(0, 0);
var east = generator.Generate(1, 0);
var negative = generator.Generate(-1, 0);

for (var z = 0; z < ChunkData.Size; z++)
for (var y = 0; y < ChunkData.Height; y++)
{
    Check(a.Get(ChunkData.Size, y, z) == east.Get(0, y, z), "east seam");
    Check(a.Get(ChunkData.Size - 1, y, z) == east.Get(-1, y, z), "east border");
    Check(negative.Get(ChunkData.Size, y, z) == a.Get(0, y, z), "negative seam");
}

var differences = 0;
var caves = 0;
var ores = 0;
for (var z = 0; z < ChunkData.Size; z++)
for (var x = 0; x < ChunkData.Size; x++)
{
    var h = generator.SurfaceHeight(x, z);
    Check(Math.Abs(h - generator.SurfaceHeight(x + 1, z)) <= 8, "height continuity x");
    Check(Math.Abs(h - generator.SurfaceHeight(x, z + 1)) <= 8, "height continuity z");
    for (var y = 0; y < ChunkData.Height; y++)
    {
        Check(a.Get(x, y, z) == revisit.Get(x, y, z), "seed revisit");
        if (y < h - 5 && y > 5 && a.Get(x, y, z) == BlockType.Air) caves++;
        if (a.Get(x, y, z) is BlockType.Coal or BlockType.Copper or BlockType.Iron or BlockType.Gold) ores++;
    }
    if (generator.SurfaceHeight(x, z) != other.SurfaceHeight(x, z)) differences++;
}
Check(differences > 0, "different seeds change terrain");
Check(caves > 0, "caves generated");
Check(ores > 0, "ores generated");

var biomes = new HashSet<Biome>();
for (var z = -3000; z <= 3000; z += 120)
for (var x = -3000; x <= 3000; x += 120)
    biomes.Add(generator.BiomeAt(x, z));
foreach (Biome biome in Enum.GetValues<Biome>()) Check(biomes.Contains(biome), $"biome {biome} generated");

Check(BlockRules.MiningSeconds(BlockType.Stone, ToolKind.Pickaxe) < BlockRules.MiningSeconds(BlockType.Stone, ToolKind.Hand), "pickaxe speeds stone");
Check(BlockRules.MiningSeconds(BlockType.Sand, ToolKind.Shovel) < BlockRules.MiningSeconds(BlockType.Sand, ToolKind.Pickaxe), "shovel speeds sand");
Check(BlockRules.Falls(BlockType.Sand) && BlockRules.Falls(BlockType.Gravel), "gravity blocks");
Check(BlockRules.IsTransparent(BlockType.Glass) && BlockRules.IsShaped(BlockType.Stairs), "block properties");
Check(ItemCatalog.All.Count() >= 45 && RecipeBook.All.Count >= 30, "data-driven item and recipe registries");
Check(RecipeBook.Smelt("iron")?.Output == "iron_ingot", "data-driven smelting recipe");
Check(RecipeBook.Smelt(null) == null, "empty furnace input is safe");
Check(ItemCatalog.ForBlock(BlockType.CraftingStation) == "crafting_station", "station item mapping");
Check(ItemCatalog.Get("berries").Nutrition == 3 && ItemCatalog.Get("bandage").Healing == 6, "food and healing definitions");
var life = new SurvivalState();
Check(life.Health == 20 && life.Hunger == 20 && life.Saturation == 5, "initial survival values");
life.Tick(45, false, false, false, false, false);
Check(life.Saturation == 4 && life.Hunger == 20, "saturation absorbs hunger drain");
life.Damage(7, DamageKind.Fall);
Check(life.Health == 13, "damage reduces health");
Check(life.Eat(3, 1, 2) && life.Health == 15, "food can heal and restore saturation");
life.Tick(11, false, true, false, false, false);
Check(life.Oxygen == 0 && life.Health < 15, "drowning after oxygen depletion");
life.Tick(1, false, false, true, false, false);
Check(life.Health < 14, "suffocation damage");
var exposed = new SurvivalState();
exposed.Tick(15, false, false, false, true, false);
Check(exposed.Health == 19, "cold exposure damage");
exposed.Tick(15, false, false, false, false, true);
Check(exposed.Health == 18, "heat exposure damage");
var starving = new SurvivalState();
starving.Load(new SurvivalSave(20, 0, 0, 10, 0, GameMode.Survival, null, BlockType.Stone));
starving.Tick(4, false, false, false, false, false);
Check(starving.Health == 19, "starvation damage");
life.Damage(100, DamageKind.Fall);
Check(life.IsDead, "death at zero health");
life.Respawn();
Check(!life.IsDead && life.Health == 20 && life.Hunger == 18, "respawn restores survival state");
life.SetMode(GameMode.Creative);
Check(!life.Damage(100, DamageKind.Lightning) && life.Health == 20, "creative damage immunity");
life.SelectCreativeBlock(BlockType.Bed);
Check(life.CreativeBlock == BlockType.Bed, "creative block selection");
var cycle = new WorldCycle();
cycle.Configure(741852);
cycle.Tick(180);
Check(cycle.Snapshot().WeatherStep == 1, "deterministic weather period transition");
var initialDay = cycle.Day;
cycle.Tick(WorldCycle.DaySeconds);
Check(cycle.Day == initialDay + 1, "full day-night cycle");
cycle.SetWeather(WeatherKind.Storm);
cycle.Tick(18);
Check(cycle.WeatherIntensity > .9f, "storm transition reaches intensity");
cycle.SetTime(.75f);
Check(cycle.IsNight && cycle.Hour == 0, "midnight clock");
cycle.SleepToMorning();
Check(!cycle.IsNight && cycle.Weather == WeatherKind.Clear && cycle.Day >= 3, "sleep skips night and clears weather");
var savedCycle = cycle.Snapshot();
var restoredCycle = new WorldCycle();
restoredCycle.Load(savedCycle, 741852);
Check(restoredCycle.Day == cycle.Day && restoredCycle.Weather == cycle.Weather, "cycle persistence");
var inventory = new InventoryGrid(36);
Check(inventory.Add("stone", 130) == 0 && inventory.Count("stone") == 130, "stacking across inventory slots");
Check(inventory[0].Count == 64 && inventory[1].Count == 64 && inventory[2].Count == 2, "stack cap");
var held = inventory.Click(0, ItemStack.Empty, true);
Check(held.Count == 32 && inventory[0].Count == 32, "split stack");
held = inventory.Click(3, held, false);
Check(held.IsEmpty && inventory[3].Count == 32, "drag and place stack");
Check(inventory.Consume("stone", 65) && inventory.Count("stone") == 65, "material consumption");
var transferChest = new InventoryGrid(27);
var transferCursor = inventory.Click(0, ItemStack.Empty, false);
transferCursor = transferChest.Click(0, transferCursor, false);
Check(transferCursor.IsEmpty && transferChest[0].Count > 0, "player-to-chest transfer");
transferCursor = transferChest.Click(0, transferCursor, false);
transferCursor = inventory.Click(0, transferCursor, false);
Check(transferCursor.IsEmpty && transferChest[0].IsEmpty, "chest-to-player transfer");
var personal = new InventoryGrid(4);
personal.Set(0, new ItemStack("wood", 1));
var output = new InventoryGrid(36);
Check(RecipeBook.Match(personal, 2, false)?.Id == "planks", "shapeless recipe");
Check(RecipeBook.Craft(personal, 2, false, output) && output.Count("plank") == 4 && personal[0].IsEmpty, "shapeless craft consumes input");
var station = new InventoryGrid(9);
station.Set(0, new ItemStack("stone", 1)); station.Set(1, new ItemStack("stone", 1)); station.Set(2, new ItemStack("stone", 1));
station.Set(4, new ItemStack("stick", 1)); station.Set(7, new ItemStack("stick", 1));
Check(RecipeBook.Match(station, 3, true)?.Id == "stone_pickaxe", "shaped 3x3 recipe");
Check(RecipeBook.Craft(station, 3, true, output) && output.Count("stone_pickaxe") == 1, "tool crafting");
var playerInventory = new HotbarInventory();
playerInventory.Slots.Set(10, new ItemStack("stone_pickaxe", 1));
Check(playerInventory.EquipFromSlot(10, 0), "equip tiered tool");
playerInventory.CycleTool();
Check(playerInventory.MiningSeconds(BlockType.Stone) < BlockRules.MiningSeconds(BlockType.Stone, ToolKind.Pickaxe), "equipped tool speed");
for (var i = 0; i < 129; i++) playerInventory.WearTool();
Check(playerInventory.Equipment[0].Damage == 129, "equipment durability changes");
playerInventory.WearTool();
Check(playerInventory.Equipment[0].IsEmpty, "tool breaks at durability limit");
var furnace = new FurnaceState();
furnace.Slots.Set(0, new ItemStack("iron", 2)); furnace.Slots.Set(1, new ItemStack("coal", 1));
for (var i = 0; i < 8; i++) furnace.Tick(1);
Check(furnace.Slots[2].Id == "iron_ingot" && furnace.Slots[2].Count == 2 && furnace.Slots[0].IsEmpty, "fuel and smelting");
var blockedFurnace = new FurnaceState();
blockedFurnace.Slots.Set(0, new ItemStack("sand", 1));
blockedFurnace.Slots.Set(1, new ItemStack("coal", 1));
blockedFurnace.Slots.Set(2, new ItemStack("iron_ingot", 1));
blockedFurnace.Tick(1);
Check(blockedFurnace.Slots[1].Count == 1 && blockedFurnace.Progress == 0, "blocked output does not spend fuel");
var worldItems = new WorldItems();
worldItems.Survival.SetBedSpawn(new CellKey(12, 50, -2));
worldItems.Survival.AddExperience(29);
worldItems.Cycle.Configure(999);
worldItems.Cycle.SetTime(.75f);
worldItems.Cycle.SetWeather(WeatherKind.Rain);
worldItems.Cursor = new ItemStack("stone", 3);
var chestCell = new CellKey(12, 50, -2);
worldItems.Chest(chestCell).Set(0, new ItemStack("gold_ingot", 5));
worldItems.Station(chestCell).Set(0, new ItemStack("stick", 3));
worldItems.Furnace(chestCell).Slots.Set(2, new ItemStack("glass", 4));
worldItems.PersonalCraft.Set(0, new ItemStack("plank", 2));
var inventoryPath = Path.Combine(Path.GetTempPath(), $"stonewake-inventory-{Guid.NewGuid():N}.json");
try
{
    worldItems.Save(inventoryPath, playerInventory);
    var restoredItems = new WorldItems();
    var restoredPlayer = new HotbarInventory();
    restoredItems.Load(inventoryPath, restoredPlayer, 999);
    Check(restoredItems.Chest(chestCell)[0].Count == 5, "chest persistence");
    Check(restoredItems.Station(chestCell)[0].Count == 3, "station grid persistence");
    Check(restoredItems.Furnace(chestCell).Slots[2].Count == 4, "furnace persistence");
    Check(restoredItems.PersonalCraft[0].Count == 2, "personal grid persistence");
    Check(restoredItems.Cursor.Id == "stone" && restoredItems.Cursor.Count == 3, "held stack persistence");
    Check(restoredPlayer.Slots[0].Count == 32, "player inventory persistence");
    Check(restoredItems.Survival.Experience == 29 && restoredItems.Survival.BedSpawn == chestCell, "survival and bed save");
    Check(restoredItems.Cycle.IsNight && restoredItems.Cycle.Weather == WeatherKind.Rain, "time and weather save");
}
finally { if (File.Exists(inventoryPath)) File.Delete(inventoryPath); }
var edits = new WorldEdits();
var boundaryLeft = new CellKey(15, 50, 0);
var boundaryRight = new CellKey(16, 50, 0);
edits.Record(boundaryLeft, BlockState.Empty);
edits.Record(boundaryRight, new BlockState(BlockType.Stairs, 2));
var path = Path.Combine(Path.GetTempPath(), $"stonewake-edits-{Guid.NewGuid():N}.json");
try
{
    edits.Save(path);
    var restored = WorldEdits.Load(path);
    Check(restored.Count == 2, "edit save/load count");
    var left = generator.Generate(0, 0);
    var right = generator.Generate(1, 0);
    WorldEdits.Apply(left, restored.SnapshotForChunk(0, 0));
    WorldEdits.Apply(right, restored.SnapshotForChunk(1, 0));
    Check(left.GetWorldState(15, 50, 0) == BlockState.Empty, "mined edit restored");
    Check(left.GetWorldState(16, 50, 0) == right.GetWorldState(16, 50, 0), "edited border matches adjacent chunk");
    Check(right.GetWorldState(16, 50, 0).Facing == 2, "shape orientation restored");
}
finally { if (File.Exists(path)) File.Delete(path); }

Console.WriteLine($"World logic passed: seed/chunk seams, {biomes.Count} biomes, tool speeds, block states, persisted boundary edits, {timer.ElapsedMilliseconds} ms.");

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception($"Failed: {message}");
}
