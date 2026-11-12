# Stonewake — Phases 1–4

Stonewake is an original voxel sandbox prototype made with Godot 4 C#. Phase 4 adds a 36-slot inventory, data-driven crafting and equipment, furnaces, storage chests, and per-world inventory saves to the existing movement, terrain, mining, and building systems.

## Requirements

- Godot **4.4.1 .NET** editor (the standard Godot build cannot run C#)
- .NET **8 SDK**

## Launch

1. Open `project.godot` in the Godot 4.4.1 .NET editor.
2. Let Godot restore and build the C# project. If necessary, use **Project → Tools → C# → Build Project**.
3. Press **F6** with `Scenes/Main.tscn` open, or **F5** to run the project.

Command-line alternative after installing both tools:

```powershell
dotnet build Stonewake.csproj
godot --path . --editor --quit
godot --path .
```

## Controls

| Action | Key |
| --- | --- |
| Move | W, A, S, D |
| Look | Mouse |
| Jump | Space |
| Sprint | Shift |
| Crouch | Ctrl |
| Pause / resume | Escape |
| Mine / break | Hold left mouse button |
| Place / use door | Right mouse button |
| Select hotbar slot | 1–9 or mouse wheel |
| Change mining tool | Q (hand, pickaxe, shovel) |
| Open inventory | E |

The pause menu has mouse sensitivity, signed integer world seed, and render distance controls (2–6 chunks). Applying world settings regenerates the terrain and moves the player to a clear spawn. Settings persist in Godot's `user://stonewake.cfg`. The upper-left labels show the targeted block, current biome, seed, and loaded/pending chunk counts.

## Terrain

The world uses 16×16 horizontal chunks with 96 block levels. Seeded noise shapes continents, hills, mountain ridges, river channels, and lake basins. Temperature and moisture select oceans, beaches, plains, forests, deserts, mountains, snow, and swamps. Caves, ravines, ore veins, trees, plants, and flowers use the same world-coordinate seed, so revisiting a location reproduces it. Chunk border samples cull hidden faces without depending on neighbor load order. Managed data and mesh preparation run on up to two worker tasks; mesh and collision resources are created on Godot's main thread.

Water is currently visual terrain without swimming physics. See `KNOWN_ISSUES.md`.

## Mining and building

Look at a block within six meters to see its selection outline. Hold left click through the block's hardness time to break it; the selected tool affects mining speed. Broken blocks burst into particles and drop a small collectible item. Right click places the selected hotbar block against the targeted face. Doors occupy two cells and can be toggled with right click. Slabs, stairs, glass, and fences use distinct mesh and collision geometry. Unsupported placed sand and gravel fall in steps. Edits are saved per seed under Godot's `user://world_<seed>.json` and survive chunk streaming and game relaunch.

The nine hotbar slots are the first row of the 36-slot inventory. The starter hotbar contains 32 of each Phase 3 building block. Move crafted stations, chests, furnaces, or other blocks into the hotbar to place them. Mining drops enter available inventory slots; full inventories leave drops in the world.

## Inventory and crafting

Press **E** to open the 36-slot inventory and personal 2×2 crafting grid. Left click picks up, merges, swaps, or places a stack; right click splits a stack or places one item. The held stack follows the cursor. Use **Drop held stack into world** to discard it. Equipment slots accept a pickaxe or shovel, a helmet, a chestplate, and a weapon. Press **Q** to choose hand, pickaxe, or shovel; an equipped matching tool improves mining speed and loses durability with each block broken. Hover over items for details and durability.

Craft four planks in the 2×2 grid to make a crafting station, then place and right click it for a 3×3 grid. The recipe guide lists available outputs and their materials. Recipes include five tool and weapon tiers, three armor tiers, building shapes, chests, furnaces, and survival supplies. Shaped recipes require the shown arrangement; shapeless recipes accept their ingredients in any positions. Mine wood for planks, stone for early tools, and ore for smelting.

Right click a chest for 27 storage slots. Right click a furnace to insert ore or sand, fuel, and collect the output. Coal, wood, planks, and some crafted wood items burn as fuel. Furnace progress, chest contents, crafting grids, equipment, and player inventory are saved per world seed in `user://items_<seed>.json` and restored on relaunch. The item, crafting, and smelting registries are in `Data/items.json`, `Data/recipes.json`, and `Data/smelting.json`.

## Tests

```powershell
dotnet run --project Tests/WorldLogicTests.csproj -c Release
dotnet build Stonewake.csproj -c Debug
godot --headless --path . res://Tests/RuntimeProbe.tscn
godot --headless --path . res://Tests/InteractionProbe.tscn
godot --headless --path . res://Tests/InventoryProbe.tscn
```

The runtime probes cover controls, streaming, block interaction, inventory opening, and station interfaces. The pure C# suite checks item transfers, recipes, durability, furnace fuel, and persistence. Executed results and rendered-frame inspection are recorded in `TEST_REPORT.md`.

## Project layout

- `Scenes/` — entry scene
- `Scripts/Game/` — scene composition, lighting, input setup, and targeting
- `Scripts/Player/` — movement and control preferences
- `Scripts/World/` — seeded terrain, biome logic, block data, mesh preparation, and chunk streaming
- `Scripts/UI/` — crosshair, hotbar, pause menu, and inventory interface
- `Scripts/Saving/` — versioned control and world-setting persistence boundary
- `Scripts/World/WorldEdits.cs` — per-seed, world-coordinate edit persistence
- `Scripts/Player/HotbarInventory.cs` — 36 player slots, nine-slot hotbar, and equipped gear
- `Scripts/Items/` and `Data/` — item stacks, recipes, furnace and chest state, and data-driven definitions
- `Tests/` and `Scripts/Tests/` — deterministic logic and headless Godot regression checks

The textures are generated from original colors and a deterministic pixel pattern at runtime. No proprietary game assets are included.

See `TEST_REPORT.md` for what was actually checked and `KNOWN_ISSUES.md` for current limits.
