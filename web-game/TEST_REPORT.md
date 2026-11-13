# Phase 5.5B test report

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
