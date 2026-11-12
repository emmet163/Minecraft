# Phase 5 test report

Date: 2026-11-12

## Environment

Godot 4.4.1 .NET and .NET SDK 8.0.428 ran from the ignored `.tools/` directory on Windows. Godot's user data and NuGet cache were directed into `.tools/` for sandboxed tests. Graphical captures used Godot's Compatibility renderer at 1280×720. Logs and images in `.tools/` are local test artifacts and are not committed.

## Executed checks

| Check | Result |
| --- | --- |
| Full C# build | Passed, 0 warnings and 0 errors |
| Pure C# suite | Passed in 221 ms on the final run: earlier seed, block, inventory, recipe, tool, and storage tests plus Phase 5 health, hunger, saturation, hazards, food, creative immunity, time, weather, sleep, and persistence |
| Phase 1–2 headless regression | Passed: movement, jump, gravity, sprint, crouch, camera, pause, chunk loading/unloading/revisit; 169 chunks at maximum distance |
| Phase 3 headless regression | Passed: mining, drops, placement, shapes, doors, falling blocks, chunk boundaries, edit persistence; last block edit 23 ms, managed memory 3.17 MB |
| Phase 4 headless regression | Passed: 36 slots, inventory open/close, station/chest/furnace interaction, vegetation targeting, mouse release |
| Phase 5 headless scene probe | Passed: actual fall landing damage, eating, bandage healing, death/item drops, bed spawn and sleep, destroyed-bed fallback, Creative flight/immunity/placement/mining, rain/snow rendering flags, lightning, night lighting, and save reload |
| Graphical launch | Passed: 130 night/storm frames and 55 pause-menu frames; final images inspected for HUD, rain, moonlit environment, and pause layout |
| Source review | Modified/new C#, JSON, test scenes, UIDs, and documentation reviewed; `git diff --check` clean |

The Phase 1–2 probe measured approximately 4.61 MB managed memory at default distance and 13.35 MB at maximum distance after forced collection; its last chunk generation took 22 ms. The short night/storm movie capture averaged 12.46 ms CPU and 1.93 ms GPU per frame while chunks were streaming. The paused capture averaged 2.13 ms CPU and 1.92 ms GPU per frame. These measurements include movie capture and do not establish steady-state or long-session performance.

## Bugs found and fixed

- Environmental damage could be healed in the same large simulation tick used by tests, masking cold and heat damage. Damage now delays natural regeneration; the pure suite passed after the fix.
- A snow visual assertion waited for the main scene to replace a forced snowy condition with the player's actual biome. The probe now checks the weather renderer directly for snow and passed.
- The headless survival probe initially left an audio playback object alive at exit. Scene cleanup now stops audio before shutdown; a verbose rerun did not print the leak warning.
- A sandboxed regression launch initially tried writing Godot data outside the workspace and crashed. Rerunning with `APPDATA` and `LOCALAPPDATA` set to `.tools/` passed; this was a test-environment failure, not a project build failure.

Godot printed `Failed to read the root certificate store` in the restricted environment. Builds and probes exited successfully despite that message. Physical mouse interactions, audible thunder, real-time 20-minute cycling, weather transitions during an extended play session, snow in a naturally reached snowy biome, and long-term native-memory behavior were not verified by a human play session. The tests exercise the underlying time and weather transitions with controlled simulation time.
