# Part 1 test report

Date: 2026-11-12. Windows, Node.js 24.21.0, npm 11.19.0, Three.js 0.181.x, Vite 7.3.8, Vitest 4.1.12, installed Microsoft Edge. The existing Godot source was not changed or rebuilt for this migration; its earlier Phase 5 report is at the repository root.

| Check executed | Result |
| --- | --- |
| `npm run typecheck` | Passed with strict TypeScript settings |
| `npm run test` | Passed: 7 Vitest tests, 1.01 s final run |
| Terrain rules | Passed: same-seed replay, different seeds, negative/east border continuity, elevation continuity, all eight biomes, caves, ores, clear default spawn |
| Rendering and world rules | Passed: adjacent-face culling, geometry disposal, unload/revisit, edit and padded-border reload, stale seed-load rejection |
| Controls and interaction logic | Passed: stone collision, grounded jump, negative-coordinate DDA hit and face normal, slab volume selection, mining tool speed |
| `npm run build` | Passed; `dist/index.html`, worker, CSS, and JS emitted with relative asset paths |
| Playwright against Vite dev | Passed: 1280×720 Edge WebGL launch, 25 chunks loaded, pointer lock, movement key, hotbar selection, actual held-click mining, right-click placement, pause, no console/page errors |
| Playwright against built preview | Passed: same checks, two IndexedDB edits retained after page reload, sensitivity setting saved |
| Rendered frames | Pause and game screenshots inspected; corrected dark texture conversion and foliage-blocked spawn; final game frame inspected after fixes |
| Source review | Browser source, package/configuration, tests, and documentation reviewed; final Git checks recorded before commit |

The production JS bundle was 527.40 kB (139.93 kB gzip), CSS 2.86 kB (1.18 kB gzip), and worker 4.55 kB. Vite warned that the main chunk exceeds 500 kB. The 25-chunk browser test shows successful short-run streaming; frame times, long-session native memory, and the 6-chunk render-distance maximum were not profiled.

## Problems found and fixed

- npm registry fetch was denied in the restricted shell. Installation succeeded with an authorized network retry and a cache under `web-game/.npm-cache/`.
- Vite/Vitest config loading was denied in the restricted shell. Type checking worked there; build/tests passed when run with appropriate filesystem access.
- Vite initially rejected a UTF-8 BOM in `package.json`; the BOM was removed and the build passed.
- The first browser readiness check waited for world text that the paused frame did not render. Startup now updates the label immediately, and both browser targets passed.
- The first visual frame had overly dark colors and foliage around the spawn. Texture bytes now use the correct sRGB conversion, and spawn selection checks nearby leaves/wood; the new frame was inspected.
- A Playwright pointer move shifted the aim before the mining test. The test now preserves pointer-lock aim; actual mining and placement passed.

No critical or high-severity failure remains from the executed checks. Human mouse feel, audible effects, every biome in an interactive play session, very large worlds, and prolonged browser memory behavior are unverified.
