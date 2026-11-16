# Stonewake web test report

## Crafting overhaul, Part 1 (2026-11-16)

**Baseline:** Checkpoint `dd455b3`; only the unrelated `preview-site/` directory was untracked. Reviewed item definitions, the 36-slot bag and hotbar, crafting grids and recipes, inventory input, IndexedDB snapshots, existing reports, and relevant browser tests. Before changes, TypeScript checking, 52 Vitest tests in ten files, and the production build passed.

**Implemented:** Personal 2×2 and station 3×3 grids now show a separate recipe output slot beside the grid. Taking the output puts it on the cursor; Shift-click or the existing Craft button puts one output in the bag. Ingredients are consumed only after capacity is checked. Added validated cursor crafting, metadata-preserving quick transfers, hotbar/bag moves, left-drag distribution, right-drag single placement, full-bag cursor retention on close, and safe cursor restoration from saved data. Existing recipes, item IDs, equipment durability, chests, furnaces, and save structure remain in use. UI layout follows the provided grid/output arrangement without a recipe-book or final visual redesign.

| Executed check | Result |
| --- | --- |
| Baseline `npm run typecheck`, `npm test`, `npm run build` | Passed: 52 tests in ten files, production build. |
| Final `npm run typecheck` | Passed. |
| Final `npm test` | Passed: 56 tests in eleven files. Four new tests cover shaped offsets, shapeless and invalid recipes, 2×2/3×3, repeated crafting, capacity, stack splitting/merging, metadata, partial/full transfers, drag distribution, and saved grids/cursor. |
| Final `npm run build` | Passed: main JS 731.32 kB (197.04 kB gzip), CSS 9.90 kB (3.01 kB gzip). Vite's 500 kB advisory remains. |
| Playwright `test:crafting-overhaul` on Vite dev | Passed: personal/station output, repeated crafting, right-click split, Shift-transfer, left/right drag, closing, full-bag held item with durability, and IndexedDB reload. No page or console errors. Captured and inspected 1280×720 personal and station screenshots. |
| Playwright `test:integration` on Vite dev | Passed: movement, mining, inventory crafting/equipment, survival, flight, and reload; no browser errors. |
| Playwright `test:stations` on Vite dev | Passed: chest transfer/reload, furnace smelting, 3×3 crafting, bed, persistence; no browser errors. |
| Playwright `test:final` on Vite dev | Passed: named worlds, same-seed isolation, inventory/health/edit reload, backup recovery; no browser errors. |
| Playwright `test:browser` on built preview | Passed: WebGL, movement, mining, placement, saved edits, pause; no page or console errors. |

**Bugs found and fixed:** Initial browser testing found that clicking an output icon did not activate its parent button, leaving ingredients untouched; click delegation now resolves the button and the browser test passed. Review also found that closing with a full bag would drop the cursor stack into a transient, unsaved world drop; overflow now remains on the saved cursor. The failed output test and the final browser and automated checks were rerun.

**Performance and limits:** The final built-preview headless Edge/SwiftShader gameplay sample measured 259.6 ms mean/747.2 ms maximum requestAnimationFrame interval and 24.0 MB reported JS heap with seven chunks at the sample point. This short software-rendered run does not measure crafting UI latency or native GPU frame rate. Cross-group drag in one gesture, keyboard-only inventory navigation, touch controls, physical mouse feel, other browsers, and long-session save stress were not verified. No deployment occurred. The Godot project and unrelated `preview-site/` were untouched.

## Physics improvement, Part 2: swimming and water (2026-11-16)

**Baseline:** Checkpoint `56d896b`; only the unrelated `preview-site/` directory was untracked. Reviewed player physics, collision, world fluids and rendering, survival oxygen, and the previous reports. Before edits, TypeScript checking, 46 Vitest tests in nine files, and the production build passed.

**Implemented:** Body-overlap water detection, head submersion, fixed 120 Hz swim steps, buoyancy with gravity, drag, capped vertical speed, WASD movement, Space ascent, Shift/Ctrl dive, shallow-water jump, and land/wade/float/swim/dive/exit states. Water entry clears fall damage and triggers a pooled splash. The existing oxygen and drowning system now receives head-submersion status. Original pixel-art water atlas variation, tile-local shader animation, translucent water, blue underwater fog, smooth visibility transition, and capped pooled bubbles were integrated. Existing fluid edits and player state still use IndexedDB.

| Executed check | Result |
| --- | --- |
| Baseline `typecheck`, `test`, `build` | Passed before changes: 46 tests, nine files; production build. |
| Final `npm run typecheck` | Passed. |
| Final `npm test` | Passed: 52 tests in ten files, including six swimming tests for shallow/deep water, float stability, controls and exit, collision and chunk borders, oxygen/drowning, and 30/60/120 FPS physics consistency. |
| Final `npm run build` | Passed. Main JS 727.20 kB (195.88 kB gzip); Vite's 500 kB advisory remains. |
| Playwright `test:swimming` on Vite dev | Passed: ascent, dive, submersion, oxygen, fog, bubbles, water edit and player/oxygen state after IndexedDB reload; no page or console errors. Underwater and surface screenshots captured and inspected at 1280x720. |
| Playwright `test:integration` on Vite dev | Passed: movement, jump, mining, crafting, equipment, survival, respawn, flight, IndexedDB reload; no browser errors. |
| Playwright `test:advanced` on Vite dev | Passed: fluid reaction, automation, farming, cart, status effect, save/reload, Veil transition; no browser errors. |
| Playwright `test:browser` on Vite dev | Passed: WebGL scene, 23 chunks, pointer lock, movement, mining, placement, saved edits, pause; no browser errors. |
| Playwright `test:browser` on final built preview | Passed: WebGL scene, 11 chunks at the sample point, pointer lock, movement, mining, placement, two saved edits after reload, pause; no page or console errors. |
| Diff review | All changed source, test, and documentation files reviewed; `git diff --check` found no whitespace errors. |

**Bugs found and fixed:** The initial shallow-water test threshold was marginal at a water boundary; the assertion was corrected to match actual body overlap. A gradual water entry did not trigger a splash with the original threshold; the threshold was lowered and the failed test rerun. The first screenshot fixture left the pause menu open; it now captures the mouse and resumes before taking screenshots. The restricted sandbox blocked Vite/Vitest config reads in one attempt; rerunning outside that restriction passed.

**Performance:** The isolated built-preview headless Edge/SwiftShader gameplay run measured 111.3 ms mean and 130.1 ms maximum requestAnimationFrame interval with 11 chunks at the sample point and 29.7 MB reported JS heap. A concurrent dev regression measured 110.9 ms mean/128.4 ms maximum with 23 chunks and 36.4 MB heap; a different advanced scene measured 25.7 ms mean/66.8 ms maximum and 40.5 MB heap. These short software-rendered runs are not an isolated swim benchmark or native GPU frame rate. The water effect pool is capped at 48 instances. No 60 FPS or long-session memory claim is made.

**Unverified:** Physical keyboard and mouse feel, other browsers, mobile/touch, native GPU performance, extended-session memory stability, and every possible water/solid shape combination. Screenshots confirm rendering in the fixture but cannot establish perceived animation smoothness. No deployment occurred; the Godot project and unrelated `preview-site/` were untouched.

## Visual improvement, Part 1 (2026-11-16)

**Starting point:** Git checkpoint `1056512`; only unrelated `preview-site/` was untracked. Before edits, strict TypeScript checks, 42 Vitest tests in eight files, and the Vite production build passed. Creature definitions, models, animation and AI, block registry, loot mapping, drop rendering, inventory, persistence, and prior reports were inspected. No original Minecraft assets were found or imported.

**Implemented:** Original procedural six-face creature skins and additional silhouette details for all six existing species; aligned body bounds and collision/target sizes; blended gait, idle/head, facing, attack, hurt, and death visual feedback; optional factory and lazy GLB/glTF loader for user-provided authorized models. Dropped blocks and items use original textured miniature cubes with the correct block side/top/bottom atlas faces, transparent glass, distinct non-block item art, matching inventory/hotbar icons, and a small resting bob. Shared geometries, cached materials, and single-material cube atlases limit draw calls. Existing AI, mining loot, item identity, combat, and persistence behavior were retained.

| Executed check | Result |
| --- | --- |
| Baseline `npm run typecheck`, `npm test`, `npm run build` | Passed: 42 tests, eight files, production build. |
| Focused Vitest additions | Four new tests for all species' model bounds/texture, facing/animation/death, custom model factory, block-drop identity and face textures, inventory/placement identity. Total 46 passing tests in nine files on the latest run. |
| Browser `test:visual-improvement` on Vite dev | Passed: original animal and enemy models, dirt/wood/glass drops, cube face data, matching hotbar icon, screenshots; no console/page errors. Screenshots were inspected. |
| Browser `test:creatures` on Vite dev | Passed: night spawns, targeting, sword/armor, retaliation, ranged damage, drops/XP, 24-creature cap; no browser errors. |
| Browser `test:integration` on Vite dev | Passed: spawn, movement, jump, mine, craft, equip, damage, food, death/respawn, flight, IndexedDB reload; no browser errors. |
| Browser `test:browser` on final built preview | Passed: WebGL, 11 chunks at its early sample, pointer lock, movement, mining, placement, two saved edits after reload, pause; no browser errors. |
| Browser `test:stations` on Vite dev | Initial run timed out when a live furnace repeatedly replaced crafting-grid buttons. After the in-place furnace refresh fix, the final rerun passed chest, furnace, 3×3 crafting, bed, and persistence checks with no browser errors. |
| Browser `test:exploration` and `test:final` on Vite dev | Passed: village/trading/loot and named-world/inventory/health/edit/backup persistence; no browser errors. |
| Browser `test:advanced` on Vite dev | Passed: fluid reaction, circuit lamp, crop growth, cart, status effect, save/reload, and two-way Veil transition; no browser errors. |
| Final `npm run typecheck`, `npm test`, `npm run build` | Passed: 46 tests in nine files. `dist/` contains the main JS at 721.04 kB (193.95 kB gzip), CSS at 9.43 kB (2.91 kB gzip), and lazily loaded optional glTF module at 45.32 kB (13.40 kB gzip). Vite's 500 kB advisory remains. |

**Bugs fixed:** Existing mob geometry extended beyond its collision/target bounds; those definitions were aligned. The first visual test placed creatures above terrain and could let drops enter pickup range; the fixture now uses terrain height and positions drops farther away. The browser station test exposed periodic inventory DOM replacement while a furnace was active; furnace updates now keep slot buttons stable. Failed automated checks were rerun after fixes.

**Measured performance:** The creature regression's 24-creature headless Edge/SwiftShader run measured 136.9 ms mean and 170.8 ms maximum requestAnimationFrame interval, with 26.4 MB reported JS heap. Its one-creature sample measured 99.3 ms mean/113.3 ms maximum, 28.1 MB JS heap. The final built-preview gameplay sample measured 104.8 ms mean/115.8 ms maximum and 28.6 MB JS heap. These short software-rendered samples are not native GPU frame rates or total process memory; no 60 FPS claim is made. The main Vite JS bundle remains above its 500 kB advisory.

**Not verified:** Actual loading of a user-supplied GLB/glTF file or mapping imported animation clips, perceived audio, long-session memory stability, other browsers, native GPU frame rates, and every visual state in every biome. The factory path was unit tested; the optional external-asset parser was built but not exercised with a supplied asset. The glass-drop screenshot was inspected separately. No deployment occurred.

## Phase 10 — final reliability and deployment review (2026-11-13)

**Starting point:** Commit `22fae93` (Phase 9); the unrelated `preview-site/` was untracked and left untouched. Before edits, strict TypeScript checking, 39 Vitest tests in seven files, and the production build passed. The browser architecture, persistence, chunks, inventory, crafting, creatures, combat, UI, and prior reports were inspected.

**Changes reviewed:** Named worlds with isolated saves even for matching seeds; create/load menu; saved world name, seed, difficulty, and mode; Peaceful/Normal/Hard rules; stronger validation of player saves and recovery from the previous valid player snapshot; safe fallback for malformed local settings; indexed chunk edits and reduced chunk scan/temporary allocations; shared pickup rendering resources; lower-frequency HUD updates; cross-platform Playwright launcher; static Vercel configuration and original favicon. Existing realm, inventory, survival, and test fixtures remain in use. Diff and whitespace checks were reviewed.

| Executed check | Result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm test` | Passed: 42 tests in eight files, including named-world isolation, backup validation, chunk-boundary/realm edits, and difficulty. |
| `npm run build` | Passed: `dist/index.html` 0.47 kB, main JS 666.00 kB (178.04 kB gzip), CSS 9.26 kB (2.83 kB gzip), worker 10.83 kB. Vite's 500 kB chunk advisory remains. |
| `test:final` on dev | Passed: named world creation, same-seed isolation, difficulty, inventory/health/edit reload, world switching, corrupt-primary player-save recovery, malformed-settings fallback; no console/page errors. |
| `test:integration` on dev | Passed: movement, jump, mining, crafting, equipment, fall damage, food, death, bed respawn, Creative flight, IndexedDB reload; no browser errors. |
| `test:stations`, `test:creatures`, `test:exploration`, `test:advanced`, `test:visuals` on dev | All passed on final rerun. Covered chest/furnace/crafting/bed; spawns/AI/combat/drops/XP; village/loot/trading; fluids/circuits/farming/vehicles/Veil; quality/audio settings and scene captures. No console/page errors reported. |
| `test:browser` on built preview | Passed: WebGL launch, pointer lock, movement, mining, placement, saved edit reload, pause; no browser errors. An early sample observed 13 chunks; the separate performance test waited for 25. |
| `test:performance` on built preview | Passed with 25 chunks loaded and no browser errors. See measured frame intervals below. |
| Production assets | Built HTML, JS, CSS, and favicon served HTTP 200; HTML references `./assets/` paths. |

**Measured performance:** Headless Microsoft Edge using SwiftShader, Low quality, built preview, 25 chunks: at 1280×720, 20-frame mean requestAnimationFrame interval 133.1 ms, maximum 140.4 ms, JS heap 27.5 MB; at 1920×1080, mean 250.8 ms, maximum 487.1 ms, heap 21.3 MB. These are short software-rendered frame intervals, not FPS on a native GPU or total browser memory. The 60 FPS at 1080p target was not demonstrated. The final 24-creature dev stress run measured 163.3 ms mean/211.6 ms maximum and 22.2 MB JS heap; the advanced journey measured 32.8 ms mean/75.9 ms maximum and 41.1 MB JS heap in a different scene. Samples are workload dependent.

**Bugs found and fixed:** A fixed 2.6-second mining assertion and a 50 ms frame-delta cap were unreliable under slow headless rendering; the test now waits for the actual saved edit and gameplay uses a bounded 120 ms delta. Corrupt player saves now recover from a valid previous snapshot; malformed settings fall back to defaults. Chunk streaming no longer checks every edit on every chunk update. All failed browser checks were rerun successfully after fixes.

**Verification limits:** The complete 16-step user journey was covered across browser suites, not in one uninterrupted manual play session. No native GPU, sustained 60 FPS, long-session memory/leak, other browser engine, mobile/touch, speaker audio, or live Vercel deployment was verified. Backup covers player state only; terrain edits use separate transactions. The original Godot project was not changed.

## Phase 9 — graphics, animation, audio, and polish (2026-11-13)

**Baseline before edits:** Git showed only the unrelated untracked `preview-site/`; the latest Phase 8 checkpoint was `d946d44`. TypeScript type checking passed, 36 Vitest tests in six files passed, and the production build passed. The existing renderer, atlas, chunk disposal, weather particles, creature animation, audio, lighting, HUD, and settings were inspected before changes.

**Implemented and reviewed:** A deterministic original 256×256 procedural atlas with 32-pixel tiles; per-vertex ambient shading; separate specular water and emissive lava materials; a bright powered-lamp tile; adjustable soft sunlight shadows; a shader sky with day/night gradient and night stars; biome-tinted fog and clear-weather motes; camera-local hand/tool motion, swing, recoil, and pooled block/creature fragments; expanded nearby creature animation; synthesized footsteps, impact, creature, weather, and optional music audio; saved quality and audio controls; and refreshed, focus-visible menus and HUD. Terrain materials and chunk geometries remain shared/disposed through the existing world lifecycle. All new and changed source, browser tests, styles, and documentation were reviewed with `git diff --check` and targeted reads.

| Check | Result |
| --- | --- |
| Final `npm run build` (includes TypeScript) | Passed. `dist/` emitted: main JS 657.14 kB (175.62 kB gzip), CSS 8.85 kB (2.74 kB gzip), worker 10.83 kB. Vite's 500 kB advisory remains. |
| Final `npm test` | 39 passed in seven files, including three new graphics/settings tests. |
| `test:browser` on built preview | Passed: WebGL scene, 25 chunks, pointer lock, movement, mining, placement, IndexedDB edit reload, pause; no console/page errors. |
| `test:visuals` on dev | Passed: three quality selections, audio settings persistence, shader sky, shaded chunks, hand, and day/night/medium-shadow screenshots; no console/page errors. |
| Earlier browser regressions on dev | `test:integration`, `test:stations`, `test:creatures`, `test:exploration`, and `test:advanced` all passed with no console/page errors. |
| Visual review | Inspected 1280×720 pause, day, night, and medium-shadow screenshots. The pause controls fit; terrain, sky, stars, hand, UI, and shadows appeared. A daytime-star artifact was seen and fixed, then recaptured. |

**Bugs found and fixed:** The new atlas initially left unused tiles with zero alpha, caught by Vitest; all atlas texels now have opaque alpha. The production-preview browser fixture sometimes stopped before reaching a six-block raycast target; it now tilts toward nearby ground. Its placement check also assumed every new edit increases the record count, and its notice checks could be overwritten by pickup messages; it now compares IndexedDB edit contents directly. The final rerun passed. Daytime stars seen in the shadow screenshot were faded out in daylight; the final screenshot was checked. Code review also found that changing an audio slider would unnecessarily recreate the shadow map; graphics reconfiguration now runs only when the preset changes. Failed checks were rerun after fixes.

**Measured performance:** Headless Edge with SwiftShader measured 126.4 ms mean/146.2 ms maximum requestAnimationFrame interval and 25.3 MB JS heap in a 25-chunk built-preview gameplay journey. A later successful built-preview run stalled for about 287 seconds during its 60-frame sample, giving 4916.0 ms mean/286646.3 ms maximum and 18.5 MB heap. The cause of that outlier was not established. The final dev medium-shadow sample measured 193.1 ms mean across 20 frames with 23.1 MB heap; an earlier run measured 210.4 ms. A 24-creature stress fixture measured 179.2 ms mean/243.9 ms maximum and 23.3 MB heap; one creature measured 130.5 ms mean/140.8 ms maximum and 22.0 MB heap. The advanced journey measured 49.3 ms mean/72.6 ms maximum and 66.8 MB heap in a different scene. These short software-rendered samples vary by workload and are not native GPU frame rates or total process memory. Low quality is the default; medium/high shadows carry a clear cost in SwiftShader.

**Not verified:** Perceived audio quality and volume on speakers, long-session WebGL/JS memory stability, native GPU performance, High quality frame rate, all biome/weather combinations, accessibility with assistive technology, and browsers other than headless Edge. The available browser tests exercised audio settings and context startup, but did not listen to output. No deployment occurred.

Date: 2026-11-12. Windows, Node.js 24.21.0, npm 11.19.0, Three.js 0.181.x, Vite 7.3.8, Vitest 4.1.12, Microsoft Edge headless with SwiftShader. The Godot project was inspected but not modified or rebuilt in this phase.

## Part 1 checkpoint, freshly verified before Part 2

Latest checkpoint was `e753286`. `preview-site/` was the only untracked path at the start and was left alone. Read the previous migration and test reports. Type check passed, 7 Vitest tests passed, production build passed, and the existing Edge Playwright browser test launched and passed. Part 1 was not accepted solely from its report.

## Final checks

| Executed check | Result |
| --- | --- |
| `npm run typecheck` | Passed under strict TypeScript settings |
| `npm run test` | Passed: 13 Vitest tests in 2 files, including original terrain, streaming, collision, raycast and new inventory, crafting, furnace, survival, weather and storage-fallback tests |
| `npm run build` | Passed; Vite emitted relative-path `dist/index.html`, CSS, worker, and JS |
| `node tests/browser.mjs` against Vite dev | Passed: Edge WebGL launch, 25 chunks, pointer lock, movement, hotbar, mining, placement, 2 edited blocks across reload, pause, no console/page errors |
| `node tests/integration.mjs` against Vite dev | Passed on latest run: movement, jump, fall damage, food, 2×2 recipes, tool equipment/wear, mining, XP, IndexedDB reload, death, bed respawn, Creative flight, no console/page errors |
| `node tests/stations.mjs` against Vite dev | Passed: chest transfer and reload, furnace fuel and iron smelting, 3×3 pickaxe recipe, night bed sleep/spawn, container persistence, no console/page errors |
| `npm run test:browser` against built preview | Passed: same 25-chunk WebGL, interaction, persistence, and pause checks with no browser errors |
| Screenshots | Inventory and storm-night game frames inspected at 1280×720 |
| Code review | Reviewed changed source, new data/tests, Git diff and whitespace checks; final status checked before commit |

The final production output was 574.10 kB main JS (151.73 kB gzip), 5.25 kB CSS (1.77 kB gzip), and 4.55 kB terrain worker. Vite warned that main JS exceeds 500 kB. After reducing scene renders behind the pause/inventory UI, the final 25-chunk headless Edge test measured mean requestAnimationFrame intervals of 52.8 ms on dev and 53.0 ms on the built preview; maxima were 63.8 and 62.5 ms, with 21.6 and 18.5 MB JS heap at the measurement points. Earlier runs measured 163.9–192.5 ms means, so timing varies materially. These are short-run software-rendered browser measurements, not desktop GPU frame rates or total process memory. The 6-chunk render-distance maximum and sustained memory stability were not profiled.

## Bugs found and fixed

- Corrected a Part 1 browser test expectation to use the original Godot starter hotbar's Stone in slot 2.
- Fixed a pointer-lock race after closing inventory, reloading, and respawning: successful lock acquisition now explicitly resumes gameplay.
- Fixed hotbar Creative labels after loading a Creative save or changing mode.
- Added a guarded load path for malformed saved item/status records; it preserves the original save and prevents new writes to that seed until repaired.
- Adjusted the browser station target setup and Creative flight timing in tests after intermittent test failures. Creative flight passed on the latest executed integration run.
- Reduced scene rendering behind pause/inventory UI after headless Edge sometimes starved inventory clicks. The full gameplay and workstation browser tests passed on rerun.

All failed tests were rerun after their respective fixes.

## Unverified

Physical mouse feel and sound quality were not checked by a human. Edge was automated at 1280×720; other browsers, mobile/touch, low-end hardware, long sessions, all biome boundaries during interactive play, and Godot-to-browser save-file conversion were not verified. The browser did not run through a Vercel deployment.

## Closing verification

After the final code change: strict type check passed, 13 unit tests passed, dev Edge baseline/integration/station tests passed, production build passed, and the built preview Edge baseline test passed. Git commit is recorded in the final response.

---

# Phase 6 test report

Date: 2026-11-12. Windows, Node.js 24.21.0, Vite 7.3.8, Vitest 4.1.12, Microsoft Edge headless with SwiftShader. Only `web-game/` was changed. The original Godot project was not modified.

## Checkpoint and executed tests

Before writing Phase 6 code, Git HEAD was `dc26bd4`; only the unrelated `preview-site/` directory was untracked. The four existing project reports and browser architecture were inspected. Baseline strict type check, 13 Vitest tests, and production build all passed.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed with strict TypeScript checks |
| `npm run test` | Passed: 19 tests in 3 files, including all 13 existing tests and creature spawning, states, path detours, occlusion, elevation, melee/ranged combat, drops, weapon durability, and armor reduction |
| `npm run build` | Passed: static `dist/` output; main JS 588.17 kB (156.08 kB gzip), CSS 5.25 kB (1.77 kB gzip), terrain worker 4.55 kB |
| `npm run test:creatures` against Vite dev | Passed in Edge: natural night hostile spawn, crosshair targeting, sword damage/wear, neutral retaliation, armor, death/XP/drop, ranged player damage, 24-creature cap/clear, no console/page errors |
| `npm run test:browser` against Vite dev | Passed: 25 chunks, WebGL, pointer lock, movement, mining, placement, terrain edits after reload, pause, no browser errors |
| `npm run test:integration` against Vite dev | Passed: movement, jump, mining, crafting, equipment, fall damage, food, death, bed respawn, Creative flight, IndexedDB reload, no browser errors |
| `npm run test:stations` against Vite dev | Passed: chest persistence, fuel/smelting, 3×3 crafting, bed sleep/spawn, no browser errors |
| `npm run test:browser` against built preview | Passed: 25-chunk WebGL, interaction, terrain edit reload, pause, no browser errors |
| Visual inspection | 1280×720 Edge combat screenshot inspected: voxel guardian, target health/state, crosshair and survival HUD visible |

Two creature stress runs varied: one creature measured 54.6–62.1 ms mean frame intervals, 62.9–73.0 ms maximum, and 19.4–22.2 MB JS heap; 24 creatures measured 72.4–85.6 ms mean, 82.0–100.8 ms maximum, and 23.4–25.9 MB heap. The final built-preview baseline measured 58.5 ms mean/71.4 ms maximum and 18.5 MB heap. These are short software-rendered measurements, not native GPU frame rates or total browser memory. The 24-creature fixture checked group cleanup but did not profile a long play session. Vite still warns that the main bundle exceeds 500 kB.

## Bugs found and fixed

- The creature browser test initially imported a second Vite module instance and inspected the wrong game. It now uses a development-only test fixture bound to the live instance.
- A deeper obstacle test found that hostile pursuit stalled at a two-block wall. AI now follows a timed local detour; the test verifies it reaches the far side without passing through the voxel.
- The existing food regression intermittently read a stale hunger HUD immediately after consumption. The HUD now updates during the food and damage actions; the full browser regression passed on rerun.
- A death test confused a newly spawned guardian with the defeated one. It now checks the original creature ID.
- A narrow cover fixture allowed a ranged creature to walk around it. The occlusion test now uses a full wall and passes.
- Code review found that Creative combat could display an XP notice without awarding XP, and a second hit notice could overwrite the defeat reward. Both notices now reflect the actual result. Controller knockback now clears when changing flight mode.

All failed checks were rerun after fixes. Following the last source change, strict type checking, 19 Vitest tests, the Vite build, the live creature browser test, the built-preview browser regression, and the full gameplay regression passed. The workstation regression passed before the final notice/flight-reset edits. The final source and test changes were reviewed and `git diff --check` was run before commit.

## Unverified

Other browsers, touch controls, native GPU performance, sound quality, maximum render distance with creatures, long-session memory stability, complex maze navigation, and every biome's spawn balance were not verified. Creature state is transient across reload as documented in `KNOWN_ISSUES.md`. No deployment was performed.

---

# Phase 7 test report

Date: 2026-11-12. Windows, Node.js 24.21.0, Vite 7.3.8, Vitest 4.1.12, headless Microsoft Edge using SwiftShader. Work was limited to `web-game/`. The unrelated untracked `preview-site/` was preserved. Starting Git checkpoint: `84951f6`.

## Executed checks

| Check | Result |
| --- | --- |
| Baseline before implementation | TypeScript, 19 Vitest tests, and production build passed; architecture and existing project reports inspected |
| Final `npm run typecheck` | Passed with strict TypeScript settings |
| Final `npm run test` | Passed: 27 tests in 5 files |
| Final `npm run build` | Passed: worker and static assets emitted in `dist/` with relative paths |
| `npm run test:browser` against Vite dev | Passed: WebGL, 25 chunks, movement, hotbar, mining, placement, edited terrain after reload and pause; no console/page errors |
| `npm run test:integration` against Vite dev | Passed after making the mining wait event based: movement, jump, mining, crafting, equipment, damage, food, death, respawn, Creative flight and IndexedDB reload |
| `npm run test:stations` against Vite dev | Passed: chest transfer/reload, furnace fuel and smelting, 3x3 crafting, bed sleep and persistence |
| `npm run test:creatures` against Vite dev | Passed after stabilizing the target fixture: night spawning, combat, retaliation, armor, drops/XP, ranged damage and 24-creature cap |
| `npm run test:exploration` against Vite dev | Passed: seeded village, discovery/map/compass, chest loot, inventory transfer, farmer trade, IndexedDB reload without loot duplication; no browser errors |
| `npm run test:browser` against built preview | Passed: 25-chunk WebGL, interactions, edit reload and pause; no browser errors |
| Vitest structure and exploration tests | Seed determinism, five structure kinds, biome rules, chunk seams, player-edit priority, chest materialization, loot persistence, trades, schedules, guards and discovery passed |
| Visual check | Inspected 1280x720 village screenshot: houses, road, terrain and navigation HUD rendered |

The final production build emitted 609.15 kB main JS (162.19 kB gzip), 5.97 kB CSS (1.95 kB gzip), and a 9.63 kB terrain worker. Vite's 500 kB JS chunk advisory remains. The 25-chunk headless Edge baseline measured 155.0 ms mean/466.6 ms maximum requestAnimationFrame interval and 22.8 MB JS heap in dev; built preview measured 172.0 ms mean/509.0 ms maximum and 21.4 MB heap. The creature regression measured 174.3 ms mean/374.9 ms maximum with one creature (18.1 MB heap), and 245.4 ms mean/499.2 ms maximum with 24 creatures (23.7 MB heap). These are short SwiftShader software-rendered observations, not native GPU rates or total browser memory. The 24-creature stress fixture cleared its render group after testing.

## Bugs and fixes

- Fixed strict tuple typing errors found during early TypeScript/build checks.
- Updated the Phase 6 species count test for the new friendly Hearthfolk data.
- Bounded the structure planner cache to 2,048 region entries so extended exploration does not retain every visited region.
- Browser mining and creature regressions were intermittent under slow software rendering. The mining test now waits for the mined event. The creature test positions its target immediately before attacking and waits for actual damage/retaliation.

## Limits of verification

Long-session memory stability, native GPU frame rates, other browsers, mobile/touch input, and accessibility were not verified. Every structure kind's chest block and deterministic loot was unit tested, while the complete browser journey covered a village. Dungeon combat, mines, ruins and vaults were not manually played end to end. No deployment was performed.

---

# Phase 8 test report

Date: 2026-11-12. Windows, Node.js 24.21.0, Vite 7.3.8, Vitest 4.1.12, headless Microsoft Edge with SwiftShader. Only `web-game/` was changed. The unrelated `preview-site/` path was left untouched. Starting Git checkpoint: `f7d6c4b`.

## Verification

Before Phase 8 coding, strict TypeScript checking, all 27 Phase 7 Vitest tests, and the production Vite build passed. The world, chunk worker, block atlas, inventory, crafting, creature AI, survival, and IndexedDB paths were reviewed.

| Executed check | Result |
| --- | --- |
| Final `npm run typecheck` | Passed with strict TypeScript settings |
| Final `npm run test` | Passed: 36 Vitest tests in 6 files |
| Final `npm run build` | Passed: static `dist/` output with relative asset paths |
| `npm run test:browser` against Vite dev | Passed: WebGL scene, 25 chunks, movement, mining, placement, edited terrain after reload, pause; no browser errors |
| `npm run test:integration` against Vite dev | Passed: movement, jump, mining, crafting, tools, fall damage, food, death, respawn, Creative flight, IndexedDB reload |
| `npm run test:stations` against Vite dev | Passed: chest, furnace fuel/smelting, 3x3 crafting, bed sleep and persistence |
| `npm run test:creatures` against Vite dev | Passed: night spawning, combat, retaliation, armor, drops/XP, ranged damage and population cap |
| `npm run test:exploration` against Vite dev | Passed: village, loot, map, trade and IndexedDB reload |
| `npm run test:advanced` against Vite dev | Passed: fluid flow and stone reaction, powered lamp, crop growth, cart ride, effect and terrain persistence, Veil entry/return and Veil creature spawn; no browser errors |
| `npm run test:browser` against built preview | Passed: WebGL scene, 25 chunks, movement, mining, placement, edit reload and pause; no browser errors |
| New Vitest tests | Water across chunk edge and draining; lava reaction; wire, switches, lamp, piston, button, repeater, plate and door logic; irrigation and two crops; rail and water vehicles; effects; realm isolation; breeding; Veil spawning and data-driven recipes |
| Visual check | Inspected 1280x720 Veil screenshot: distinct purple sky, terrain and crystals, correct realm label and biome HUD |

The final production build emitted a 639.92 kB main JS bundle (170.13 kB gzip), 6.16 kB CSS (1.99 kB gzip) and a 10.83 kB terrain worker. Vite's 500 kB JS chunk advisory remains. The Phase 8 dev baseline browser run measured 92.6 ms mean/377.3 ms maximum requestAnimationFrame interval and 23.7 MB JS heap across 25 loaded chunks; the final built preview measured 100.5 ms mean/113.2 ms maximum and 21.9 MB heap. The creature regression measured 100.4 ms mean/108.0 ms maximum with one creature and 128.8 ms mean/145.1 ms maximum with 24 creatures, at 23.5/23.0 MB JS heap respectively. Across several advanced browser journeys, rendered-frame means were 26.1–26.9 ms, maximums 28.8–53.6 ms, and observed JS heap 25.8–57.2 MB; Veil entry took 22–59 ms and return 15–56 ms. These are short headless software-rendered observations and varied with workload. They are not native GPU frame rates or total browser process memory.

## Bugs found and fixed

- The first strict build found tuple typing and a class-field syntax error in new modules; both were corrected before integration.
- A new signal test found repeaters did not wake when their delay elapsed. Due repeaters are now queued at the scheduled time; the failed test passed on rerun.
- Initial Veil edit storage used a numeric seed transform, which could collide with another world seed. Veil terrain edits now use a string namespace, while existing numeric Overworld keys stay compatible.
- The first gate recipe required a Veil crystal, making the realm unreachable through normal progression. It now uses Overworld treasure.
- Chunk edits previously rebuilt up to nine meshes even when a change touched only one chunk. Rebuilds now occur only for chunks whose padded data changed.
- An advanced browser rerun found that a queued water update could overwrite a newer lava source, leaving a circuit fixture flooded. Simulation edits now carry expected prior block states and are rejected when a player or another system has changed the cell; the browser test passed on rerun. Fluid and circuit fixtures were also separated with a stone basin.
- Boat placement could not target water because the original raycast skipped source water. The raycast now includes fluids only when a boat is selected; a unit test checks the water hit.
- A browser fixture initially expected a Veil creature in an unloaded adjacent chunk. The fixture now loads that chunk before spawning it. Browser waits for fluid and circuit updates were increased after headless timing variability.
- The realm label now refreshes immediately after travel, including while paused.
- Visual inspection found that paused realm travel retained the old sky and biome HUD until gameplay resumed. Transition and saved-world loading now refresh lighting and the world readout immediately; the new Veil screenshot and browser assertions verified the fix.

## Limits

The complete browser journey covered one seeded terrain fixture and a two-way realm visit. Long-session memory stability, every circuit layout, extended fluid flooding, native GPU performance, other browsers, touch controls, physical input feel and audio quality were not verified. Automated checks do not establish balance or polished feel across all play styles. No deployment was performed.
