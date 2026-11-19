# Known issues and verification limits

## Mining overhaul, Part 1

- The block and item registries have no diamond ore, diamond tool, obsidian, or bedrock counterpart. Their example harvest rules are therefore unavailable; iron is the highest required pickaxe tier for current ores, while copper, gold, and Sunsteel tools retain their existing tiers.
- Drop persistence covers the currently loaded realm when the world is saved. Changing realms still clears transient drops from the realm being left; cross-realm drop storage was outside this overhaul.
- Ten mining crack stages are rendered as original line marks on the targeted block. Their visual appearance was not manually inspected on a physical display. Headless Edge/SwiftShader browser performance measured 103.9 ms mean rAF in the general browser regression; native GPU performance remains unmeasured.

## Swimming physics fix (2026-11-18)

- The player now sinks without upward input, rises with Space, and can use one water-exit impulse at a reachable one-block ledge. This is a local collision probe, not general pathfinding or wall climbing. Complicated shapes such as stairs, fences, or unusual overhangs may still need manual testing; a solid test overhang blocks the exit as expected.
- The existing oxygen, water visuals, and save behavior are preserved. Water currents and pressure are not simulated. The player can still reach the pool floor and must swim upward to avoid drowning.
- Automated movement tests covered 30/60/120 FPS fixed-step updates, and headless Edge browser checks covered a generated deep pool and shoreline. Physical keyboard/mouse feel, other browser engines, mobile controls, native GPU frame rate, and extended-session physics stability were not verified.
- Historical sections below describe earlier behavior, including automatic surface floating before this fix.

## Crafting overhaul, Part 2

- The recipe book shows recipes from the existing registry and can fill a grid only when the ingredients can be transferred without losing its current contents. A full bag can prevent a different recipe from replacing grid contents; the book marks that recipe unavailable until space is made. Selecting a recipe places one craft's ingredients, then the output must be taken to consume them.
- The gray pixel-style panels and item art are original. Icons for blocks use the existing terrain atlas; non-block tools and supplies use procedural silhouettes. This is a functional visual interpretation of the supplied layout references, without Minecraft's proprietary interface textures, font, or character artwork.
- Automated visual checks covered 1280×720 and 1024×768 headless Edge screenshots. Native GPU performance, physical mouse feel, other browsers, touch input, keyboard-only inventory operation, and extended save/load stress remain unverified. The main JS bundle still exceeds Vite's 500 kB advisory.
- The earlier Part 1 section below described the recipe book as future work at that checkpoint. It is now implemented; the one-group-per-gesture drag limitation remains.

## Crafting overhaul, Part 1

- The 2×2 and 3×3 grids, output slot, transfers, and drag distribution are functional. Dragging distributes within one slot group per gesture; dragging from the bag into the crafting grid in the same gesture is not supported. Move the held stack between groups with a click first.
- When the bag has no room on closing, the held stack stays in the saved cursor state and appears again when the inventory opens. The explicit **Drop held stack into world** action creates a world drop; current-realm drops are now saved by the mining overhaul.
- The existing recipe guide is a simple list of available recipes. A graphical recipe book and final inventory visual redesign are reserved for Part 2. Keyboard-only item movement and touch drag controls were not verified.
- Headless Edge/SwiftShader browser checks passed, but physical mouse feel, other browsers, long-session persistence under rapid repeated saves, and native GPU performance were not measured. The production JS remains above Vite's 500 kB advisory.

## Physics improvement, Part 2

- Swimming and buoyancy now work for the player in loaded water. The model uses approximate body overlap and locally sampled water height; it does not simulate currents, wave forces, or water pressure. Creative flight overrides swimming. Creatures and vehicles retain their prior water behavior.
- The pixel-art water is original and translucent with subtle shader motion. It has no reflection or refraction, and underwater fog is a camera effect. Browser screenshots were inspected in headless Edge; actual monitor appearance and motion smoothness remain unverified.
- Fixed-step swimming and a 48-instance particle pool bound update work. Extended water flooding, long-session memory stability, native GPU performance, other browser engines, and mobile/touch controls were not measured. The main production JS remains above Vite's 500 kB advisory.
- Earlier historical sections below describe the state at their respective phases. Their statements that player swimming was absent no longer apply after this update.

## Visual improvement, Part 1

- The built-in mobs use original procedural voxel skins and simple state-driven motion. External GLB/glTF loading is available for authorized user assets but was not tested with a supplied file; imported clips are not yet mapped to AI animation states. A custom model factory must return a fresh object per creature. No Minecraft proprietary assets are included.
- Hitboxes now encompass each model's basic visual bounds and can make broad or long-headed creatures less nimble around narrow obstacles. Detailed per-limb collision is not simulated.
- Dropped non-block items are still small textured cubes, with distinct original item art rather than full 3D tool or food silhouettes. Transparent glass is approximate alpha blending. Drops and creature bodies do not use realistic physics or skeletal animation.
- Headless Edge/SwiftShader remained slow in the short browser samples. The main bundle exceeds Vite's 500 kB advisory. Native GPU performance, long-session GPU/JS memory stability, other browsers, and mobile/touch visuals were not measured.

## Phase 10 review

- **Frame rate:** The 60 FPS at 1080p target remains unverified. A 25-chunk built-preview run at 1920×1080 on headless Edge/SwiftShader averaged 250.8 ms between frames (487.1 ms maximum); 1280×720 averaged 133.1 ms. This is software rendering and cannot predict native GPU performance. Main-thread generation/meshing and advanced simulations can still stall frames. The main JS output is 666.00 kB and exceeds Vite's 500 kB advisory.
- **Save recovery:** The previous valid player snapshot can recover a corrupt current player save. Terrain edits are not in that backup, and terrain/player data use separate transactions, so a crash can leave slightly different save points. Saves remain local to one browser origin. Storage failure leaves only temporary in-memory progress and shows a warning.
- **Coverage:** Automated Edge checks exercised gameplay in separate scenarios. A single uninterrupted manual end-to-end playthrough, native GPU profiling, long-session memory stability, other browser engines, mobile/touch, assistive technology, and audible speaker quality remain unverified. No Vercel deployment was performed.
- **Browser test portability:** The hardcoded Windows Edge executable path noted in the earlier report was removed. Tests now select Playwright's Edge channel on Windows or Chromium elsewhere; only Windows Edge was actually run.

## Phase 9 additions

- **Performance:** Medium soft shadows averaged 193.1–210.4 ms between animation frames in short headless Edge/SwiftShader runs. A separate built-preview run had one unexplained 286-second frame wait, although the gameplay assertions passed; other 25-chunk runs measured about 124–126 ms mean. Low quality is the default; High quality shadow performance was not measured. Native GPU frame rates and long-session memory use remain unverified. The main Vite JS chunk is 657.14 kB and exceeds the 500 kB advisory.
- **Visual scope:** The new water material adds specular highlights but does not simulate waves, reflection, or refraction. Ambient shading samples the existing one-block chunk padding, so corner shade may vary subtly at chunk borders. Biome motes are a local visual effect; rain and snow can still appear under roofs. Four nearby powered lamps receive point lights, matching the existing light limit.
- **Audio and animation:** Audio is synthesized locally after a user gesture. Music is a short optional loop and starts muted. Audible sound quality, speaker balance, and browser audio behavior beyond headless Edge were not verified. Camera-local hand and creature animations are intentionally simple voxel motions, with distant creature animation already paused by the AI distance limit.
- **Browser coverage:** Quality and volume controls, screenshots, and rendering were checked in headless Edge at 1280×720. High quality was switched on but not profiled visually or for frame rate. Mobile layout, assistive technology, and other browser engines remain unverified.

## Phase 8 additions

- **Fluids:** Water and lava update in bounded batches around edits and continue when adjacent chunks load. Large open shafts can create many saved flow cells and may cause mesh rebuild spikes. Fluids do not model pressure, currents, swimming or buoyancy. Naturally generated seas and lava pools begin spreading when a nearby block changes.
- **Circuits:** Wires carry a 15-step fading signal, repeaters add a fixed delay, and only the player activates plates. Pistons push one movable block on activation and do not pull it back. There is no multi-block sticky piston, complex signal timing editor, or creature-triggered plate behavior.
- **Farming and vehicles:** Crop growth occurs while the loaded page is running; it does not catch up for offline time. Bred animals follow the existing transient creature lifecycle, so their exact positions and health do not persist. Carts use connected flat rails and simple direction choice; boats move on water cells. Sloped rails, junction routing, vehicle inventory, creature collisions and water currents are not simulated.
- **The Veil:** Gates are activated by right-click; they do not trigger from walking through them. The realm has a separate terrain-edit namespace and save position, while inventory and survival status are shared. The first arrival and gate placement can briefly stall the main thread because the destination chunk is generated synchronously. Villages and other Overworld structures do not appear in the Veil.
- **Performance and browser coverage:** Phase 8 was automated in headless Microsoft Edge with SwiftShader. The Vite JS bundle remains above its 500 kB advisory size. Native GPU frame rates, other browsers, mobile/touch input, extended water flooding, and long-session memory stability remain unverified.

## Phase 7 additions

- **Exploration performance:** The latest 25-chunk headless Edge/SwiftShader run averaged 155.0 ms between animation frames. A 24-creature stress fixture averaged 245.4 ms. Generated structures use the existing terrain worker for streamed chunks and the planner cache is bounded, but initial spawn-chunk generation and occasional meshing still run on the main thread. Native GPU performance and long-session memory growth have not been measured.
- **Structures:** Houses, farms, roads, dungeons, mines, ruins and vaults are voxel structures. Terrain slopes may leave sharp paths or partially buried entrances. Vegetation can remain beside paths and buildings. Structure edits take priority over procedural blocks; unedited structure blocks regenerate from the world seed.
- **Inhabitants:** Trades, daily stock and deaths are saved. Living villagers' exact positions, health and current schedules are reconstructed when their village loads, matching the broader creature lifecycle. Local obstacle avoidance can stall inhabitants around complicated terrain. Villages do not have complex social behavior.
- **Treasure and maps:** Generated chest loot is persisted when its chest is first opened or mined. The field map is a landmark list with coordinates and bearing, not a drawn terrain map. Survey tools reveal candidate landmarks within the current 320-block planning radius. Only the village exploration loop was exercised end to end in a browser; other structure kinds were checked through deterministic generation tests.

- **Performance:** Phase 6 headless Edge measured 54.6–62.1 ms mean frame intervals with one creature and 72.4–85.6 ms with 24 creatures using SwiftShader software rendering. The 588.17 kB production JS chunk exceeds Vite's 500 kB advisory threshold. Main-thread terrain meshing can still stall frames. Native GPU performance, maximum render distance, long-session memory use, and lower-end hardware remain unmeasured.
- **Save boundaries:** Browser IndexedDB saves are separate from Godot `user://` save files and no conversion tool is provided. Terrain edits and player state use separate transactions, so a browser crash between them could leave the two at slightly different save points. Dropped world items are transient and do not survive reload. If IndexedDB is unavailable, changes live only in memory until the page closes; the HUD warns the player.
- **Terrain and shapes:** Water is visual terrain without swimming or buoyancy, as in the Godot prototype. Stairs and fences have coarse selection outlines; fence collision conservatively fills its cell. Generated sand/gravel remain stable, while placed blocks fall. Weather particles can appear under roofs.
- **Creature scope:** Creature positions and health are transient and are not saved to IndexedDB; new creatures spawn after reload. Spawning currently uses surface biome and daylight, with no underground cave spawns. AI uses short local detours around obstacles rather than a full pathfinder, so complex mazes may trap a creature. Creatures do not swim. Ranged projectiles damage the player and stop at solid voxels; they do not hit other creatures. Player ranged weapons are not implemented.
- **Survival scope:** Furnace processing runs while the loaded page is active; it does not simulate elapsed time while the site is closed. Death drops are collectible and current-realm drops are saved. Creative mode places blocks from a palette and permits flight; it does not populate unlimited inventory stacks.
- **Browser support:** Automated interaction ran in headless Microsoft Edge at 1280×720. Other browsers, touch input, accessibility navigation, physical mouse feel, and audible sound quality were not verified. Browser tests use a Windows Edge path and need adjustment on other platforms.
- **Deployment:** Vercel settings and static build were prepared, but no deployment was made.
