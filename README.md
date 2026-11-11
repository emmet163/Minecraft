# Stonewake — Phase 1

Stonewake is an original, Minecraft-inspired voxel prototype made with Godot 4 C#. This repository contains **Phase 1 only**: a small, fixed 3D test world for checking the controller, camera, targeting, and pause flow. It has no block editing, crafting, enemies, or survival loop yet.

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

The pause menu has a mouse sensitivity slider. Its setting is saved in Godot's `user://stonewake.cfg`. The upper-left label shows the grass, dirt, or stone block under the crosshair within six meters.

## Project layout

- `Scenes/` — entry scene
- `Scripts/Game/` — scene composition, lighting, input setup, and targeting
- `Scripts/Player/` — movement and control preferences
- `Scripts/World/` — block types, generated textures, chunks, and test terrain
- `Scripts/UI/` — crosshair, target label, pause menu
- `Scripts/Saving/` — versioned settings persistence boundary

The textures are generated from original colors and a deterministic pixel pattern at runtime. No proprietary game assets are included.

See `TEST_REPORT.md` for what was actually checked and `KNOWN_ISSUES.md` for current limits.
