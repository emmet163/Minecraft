# Stonewake — Phases 1–2

Stonewake is an original, Minecraft-inspired voxel prototype made with Godot 4 C#. Phase 2 adds a deterministic, streaming voxel world to the Phase 1 controller, camera, targeting, and pause flow. It has no block editing, crafting, enemies, or survival loop yet.

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

The pause menu has mouse sensitivity, signed integer world seed, and render distance controls (2–6 chunks). Applying world settings regenerates the terrain and moves the player to a clear spawn. Settings persist in Godot's `user://stonewake.cfg`. The upper-left labels show the targeted block, current biome, seed, and loaded/pending chunk counts.

## Terrain

The world uses 16×16 horizontal chunks with 96 block levels. Seeded noise shapes continents, hills, mountain ridges, river channels, and lake basins. Temperature and moisture select oceans, beaches, plains, forests, deserts, mountains, snow, and swamps. Caves, ravines, ore veins, trees, plants, and flowers use the same world-coordinate seed, so revisiting a location reproduces it. Chunk border samples cull hidden faces without depending on neighbor load order. Managed data and mesh preparation run on up to two worker tasks; mesh and collision resources are created on Godot's main thread.

Water is currently visual terrain without swimming physics. See `KNOWN_ISSUES.md`.

## Tests

```powershell
dotnet run --project Tests/WorldLogicTests.csproj -c Release
dotnet build Stonewake.csproj -c Debug
godot --headless --path . res://Tests/RuntimeProbe.tscn
```

The runtime probe runs the Phase 1 movement and pause checks alongside Phase 2 streaming checks. The automated run and rendered-frame inspection are recorded in `TEST_REPORT.md`.

## Project layout

- `Scenes/` — entry scene
- `Scripts/Game/` — scene composition, lighting, input setup, and targeting
- `Scripts/Player/` — movement and control preferences
- `Scripts/World/` — seeded terrain, biome logic, block data, mesh preparation, and chunk streaming
- `Scripts/UI/` — crosshair, target label, pause menu
- `Scripts/Saving/` — versioned control and world-setting persistence boundary
- `Tests/` and `Scripts/Tests/` — deterministic logic and headless Godot regression checks

The textures are generated from original colors and a deterministic pixel pattern at runtime. No proprietary game assets are included.

See `TEST_REPORT.md` for what was actually checked and `KNOWN_ISSUES.md` for current limits.
