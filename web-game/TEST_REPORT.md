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
