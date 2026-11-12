# Phase 4 test report

Date: 2026-11-11

## Environment

Godot 4.4.1 .NET and .NET SDK 8.0.428 ran from the ignored `.tools/` directory on Windows. The graphical UI capture used Godot's Compatibility renderer on an Intel Arc 140V GPU. Local toolchain and screenshot files are not part of the commit.

## Executed checks

| Check | Result |
| --- | --- |
| Full C# build | Passed, 0 warnings and 0 errors |
| Pure C# suite | Passed: Phase 2 seed and chunk checks, Phase 3 block rules and edit persistence, Phase 4 36-slot stacking, splitting, chest transfers, shaped and shapeless recipes, ingredient consumption, tool speed and durability, furnace fuel and output blocking, player/station/chest/furnace/cursor save and reload |
| Phase 1–2 headless regression | Passed: movement, jumping, gravity, sprint, crouch, camera, pause, chunk loading/unloading/revisit |
| Phase 3 headless regression | Passed: mining, drops, placement, shaped blocks, door, gravity blocks, chunk boundaries, persisted block edits |
| Phase 4 headless UI probe | Passed: 36 slots, E to open, Escape to close, movement disabled while open, right-click interaction with placed station/chest/furnace blocks, mouse release, targeting generated vegetation |
| Graphical launch | Passed: 31 inventory frames and 30 main-game frames; final 1280×720 frames inspected for layout and legibility |
| Source review | New and modified C#, JSON data, scenes, project files, generated script UIDs, and documentation reviewed; `git diff --check` clean |

The final pure logic suite completed in **199 ms**. A Phase 1–2 probe loaded 169 chunks at maximum distance with no pending jobs, last chunk generation **7 ms**, and approximately **4.43 MB** managed memory at default distance and **13.26 MB** at maximum after forced collection. The Phase 3 probe's last block edit took **13 ms**, with about **3.04 MB** managed memory after forced collection. The inventory capture reported about **1.83 ms CPU** and **4.97 ms GPU** per frame; the final main-game capture reported **1.64 ms CPU** and **4.30 ms GPU** per frame. These are movie-mode measurements from short runs and do not establish long-term frame time or native-memory behavior.

## Bugs found and fixed

- An initial save hit a transient Windows access-denied error while replacing the inventory file in the synced workspace. The save now uses a unique temporary file and retries the atomic replacement. Subsequent probe runs passed without the error.
- The crafting station's enum name did not initially map to its item ID. Mining one could have failed when spawning its drop. Explicit mapping and a regression assertion were added.
- An empty furnace input called the smelting registry with a null item ID and caused repeated runtime exceptions. The registry now treats empty input as no recipe; an empty-input assertion and the UI probe passed after the fix.
- Plants and flowers had no physics collision and could not be selected for collecting recipe ingredients. A short visual-volume ray check now targets them before the solid-block hit; the inventory probe exercised this against generated vegetation.
- The chest grid was too wide for the interface. Its slots now use compact labels and full hover tooltips; the recipe guide is hidden while viewing storage and furnaces.
- Long hotbar names overflowed their cards in the rendered game frame. The hotbar now uses smaller three-line labels; the final frame was inspected after the change.
- Headless Godot did not report recapture after setting captured mouse mode. The probe checks inventory close and movement resume, and records recapture as unverified rather than treating the headless result as a gameplay failure.

Godot printed `Failed to read the root certificate store` in this restricted environment; successful builds and probes exited normally. Physical mouse click-and-drag, audible feedback, actual recapture in an interactive window, layout at other resolutions, and long-duration memory behavior were not verified by a human play session.
