# Stonewake — Phases 1–3

Stonewake is an original, Minecraft-inspired voxel prototype made with Godot 4 C#. Phase 3 adds mining, building, drops, a hotbar, shaped blocks, and saved world edits to the Phase 1 controller and Phase 2 streaming terrain. Crafting, enemies, and the survival loop are not implemented yet.

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

The pause menu has mouse sensitivity, signed integer world seed, and render distance controls (2–6 chunks). Applying world settings regenerates the terrain and moves the player to a clear spawn. Settings persist in Godot's `user://stonewake.cfg`. The upper-left labels show the targeted block, current biome, seed, and loaded/pending chunk counts.

## Terrain

The world uses 16×16 horizontal chunks with 96 block levels. Seeded noise shapes continents, hills, mountain ridges, river channels, and lake basins. Temperature and moisture select oceans, beaches, plains, forests, deserts, mountains, snow, and swamps. Caves, ravines, ore veins, trees, plants, and flowers use the same world-coordinate seed, so revisiting a location reproduces it. Chunk border samples cull hidden faces without depending on neighbor load order. Managed data and mesh preparation run on up to two worker tasks; mesh and collision resources are created on Godot's main thread.

Water is currently visual terrain without swimming physics. See `KNOWN_ISSUES.md`.

## Mining and building

Look at a block within six meters to see its selection outline. Hold left click through the block's hardness time to break it; the selected tool affects mining speed. Broken blocks burst into particles and drop a small collectible item. Right click places the selected hotbar block against the targeted face. Doors occupy two cells and can be toggled with right click. Slabs, stairs, glass, and fences use distinct mesh and collision geometry. Unsupported placed sand and gravel fall in steps. Edits are saved per seed under Godot's `user://world_<seed>.json` and survive chunk streaming and game relaunch.

The hotbar starts with 32 of each building block for Phase 3 testing. Collected blocks outside the nine assigned slots are counted internally but cannot yet be selected for placement.

## Tests

```powershell
dotnet run --project Tests/WorldLogicTests.csproj -c Release
dotnet build Stonewake.csproj -c Debug
godot --headless --path . res://Tests/RuntimeProbe.tscn
godot --headless --path . res://Tests/InteractionProbe.tscn
```

The runtime probes cover Phase 1 controls, Phase 2 streaming, and Phase 3 interaction and persistence. Executed results and rendered-frame inspection are recorded in `TEST_REPORT.md`.

## Project layout

- `Scenes/` — entry scene
- `Scripts/Game/` — scene composition, lighting, input setup, and targeting
- `Scripts/Player/` — movement and control preferences
- `Scripts/World/` — seeded terrain, biome logic, block data, mesh preparation, and chunk streaming
- `Scripts/UI/` — crosshair, target label, pause menu
- `Scripts/Saving/` — versioned control and world-setting persistence boundary
- `Scripts/World/WorldEdits.cs` — per-seed, world-coordinate edit persistence
- `Scripts/Player/HotbarInventory.cs` — nine building slots and mining tool choice
- `Tests/` and `Scripts/Tests/` — deterministic logic and headless Godot regression checks

The textures are generated from original colors and a deterministic pixel pattern at runtime. No proprietary game assets are included.

See `TEST_REPORT.md` for what was actually checked and `KNOWN_ISSUES.md` for current limits.
