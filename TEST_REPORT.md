# Phase 2 test report

Date: 2026-11-11

## Tools

Godot 4.4.1 .NET and .NET SDK 8.0.428 were installed under ignored `.tools/` for this run. The tests used the Compatibility renderer on an Intel Arc 140V GPU. The workspace-local tools are not part of the commit.

## Executed results

| Check | Result |
| --- | --- |
| Full `Stonewake.csproj` Debug build | **Passed:** 0 warnings, 0 errors |
| Source and project-file review | **Passed:** all created/modified code, scenes, settings, and Godot UID files inspected; `git diff --check` clean |
| Pure world logic tests | **Passed:** same-seed revisit, different-seed terrain, positive and negative chunk seams, adjacent height continuity, caves, ores, all 8 biome types |
| Headless Godot runtime probe | **Passed:** walking, jump, gravity, floor collision, sprint, crouch camera and collider, direct camera rotation, block raycast, Escape pause/resume, pause freeze, chunk loading/unloading/revisit, collision mesh and face culling, seed/render-distance reset |
| Main scene launch with graphics | **Passed:** exited 0 on the Compatibility renderer; 30 frames recorded and final frame inspected |
| Repeated stream/unload cycles | **Passed:** loaded chunk count stayed within the configured retention bound; no fatal shutdown or native resource leak report on the final run |
| Maximum render distance (6) | **Passed:** 169 loaded chunks, 0 pending after 240 physics frames; count stayed at its configured bound |

The pure test generated four chunks, checked 24,576 voxel values on a revisit, and found 2,743 cave cells and 172 ore cells for test seed 741852. The final run completed in **27 ms** in Release. The headless probe's last background chunk generation and mesh preparation took **10 ms**. After two additional stream cycles and a forced collection, managed memory was **3,174,792 bytes** at the default distance of 2; at distance 6 it was **7,637,224 bytes** with 169 loaded chunks. These are single-run measurements on this machine, not frame-rate or native-memory benchmarks. The final 30-frame graphical capture reported about **1.68 ms CPU** and **4.77 ms GPU** per frame in movie mode; movie writing changes normal runtime timing.

## Fixes found during testing

- A simulated mouse event was not delivered by the headless display driver. Camera rotation is tested directly; real mouse capture still needs a human interactive check.
- A sprint probe ran into nearby terrain; the probe now moves in a clear direction and verifies the resulting speed.
- Immediate shutdown after seed regeneration produced Godot managed-resource finalizer errors. The per-frame ray query is now disposed, and the probe waits for chunk teardown before exit. The rerun exited cleanly.
- Rendered-frame review found the initial spawn inside tree foliage. Spawn selection now prefers clear plains terrain, with forest as fallback, and tree density was reduced.
- A compile error from a variable name collision in spawn selection was fixed, then the full build and regression tests were rerun.

Godot still prints `Failed to read the root certificate store` in this restricted environment. The project build, runtime probe, and graphical run exited successfully despite that environment warning. A human play session, UI layout at multiple resolutions, long-duration native-memory profiling, and graphical frame rate at maximum render distance were not verified.
