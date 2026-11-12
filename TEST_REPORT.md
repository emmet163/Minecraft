# Phase 3 test report

Date: 2026-11-11

## Environment

Godot 4.4.1 .NET and .NET SDK 8.0.428 were run from ignored `.tools/`. The graphical launch used Godot's Compatibility renderer on an Intel Arc 140V GPU. No downloaded toolchain files are included in the commit.

## Executed checks

| Check | Result |
| --- | --- |
| Full C# project build | Passed with 0 warnings and 0 errors |
| Pure world logic suite | Passed: seed consistency, positive/negative chunk seams, eight biomes, caves, ores, tool-speed rules, block properties, serialized edits, edited border continuity |
| Phase 1–2 headless regression probe | Passed: movement, jumping, gravity, sprint, crouch, camera rotation, raycast, pause, loading/unloading/revisit, maximum render distance |
| Phase 3 headless interaction probe | Passed: hardness timer, mining, particle burst, drop spawn/pickup, slot keys and wheel, tool cycling, placement, occupied/player collision restrictions, slab/stair/door/fence geometry, slab physics ray collision, glass culling, sand/gravel gravity, boundary remesh, unload/revisit, disk reload |
| Graphical main-scene launch | Passed: 30 rendered frames, final frame inspected; hotbar and world visible |
| Source review | All new and modified code, scenes, tests, project settings, and generated Godot script UIDs inspected; `git diff --check` clean |

The final pure logic run completed in **90 ms**. The interaction probe's last saved edit and chunk rebuild took **14 ms** in a headless run, with about **2.87 MB** of managed memory after forced collection. The Phase 1–2 regression probe loaded 169 chunks with no pending jobs at exit; its last chunk took 9 ms, and managed memory was about 4.18 MB at default distance and 13.01 MB at maximum distance after forced collection. These are individual measurements, not long-run frame-time or native-memory benchmarks. The graphical capture reported about **1.46 ms CPU** and **3.57 ms GPU** per frame in movie mode; movie writing changes normal runtime timing.

## Bugs found and fixed

- The first selection-outline implementation used a `StandardMaterial3D` property that Godot 4.4.1 does not have. It was replaced with an `ImmediateMesh` line outline; the project was rebuilt.
- Saving edits now completes before the visible chunk changes. On a save failure, the in-memory edit is rolled back and the action returns failure. A corrupt edit file is preserved and blocks further edits for that loaded world.
- Edit rebuilds now reuse loaded voxel data instead of regenerating terrain. Background chunk results detect edit revisions and apply new edits before becoming visible.
- The world process mode is pausable, so falling blocks and chunk streaming stop with the game.

An initial probe launch without the local `APPDATA` override could not create Godot's user data directory in this restricted environment and exited with a crash. Rerunning with `APPDATA` and `LOCALAPPDATA` pointed inside the workspace passed both probes. Godot also printed `Failed to read the root certificate store`; the successful runs exited normally despite that environment warning. A human play session was not performed: actual mouse-button delivery, audible sound quality, UI layout at other resolutions, and long-duration native-memory behavior remain unverified.
