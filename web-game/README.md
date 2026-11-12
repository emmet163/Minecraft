# Stonewake Web — migration Part 1

This is the browser version of Stonewake, built with Three.js, TypeScript, and Vite. It lives entirely in `web-game/`; the original Godot 4 C# project at the repository root remains available. The Git tag `godot-phase5-before-web-migration` marks the original Phase 5 checkpoint.

## Run

Use Node.js 20.19+ or 22.12+ and npm. From `web-game/`:

```powershell
npm install
npm run dev
```

Open the local address Vite prints, normally `http://127.0.0.1:5173/`. Click **Enter world** to capture the mouse. Escape releases it and opens the pause/settings menu.

```powershell
npm run typecheck
npm run test
npm run build
npm run preview
```

`npm run build` writes the deployable static site to `dist/`. `npm run preview` serves that build locally, normally at `http://127.0.0.1:4173/`. Vite uses relative asset paths for static hosting. No Vercel deployment has been made.
For a future Vercel project, set the root directory to `web-game`, build command to `npm run build`, and output directory to `dist`.

For the optional Edge browser regression, start `npm run dev` in one terminal, then run `npm run test:browser` in another. The test uses the installed Microsoft Edge path on Windows. Set `STONEWAKE_URL=http://127.0.0.1:4173/` to test a running production preview instead.

## Controls

| Action | Control |
| --- | --- |
| Move / look | WASD / mouse |
| Jump / sprint / crouch | Space / Shift / Ctrl |
| Mine / place | Hold left mouse / right mouse |
| Toggle door | Right mouse |
| Hotbar | 1–9 or mouse wheel |
| Mining tool | Q cycles hand, pickaxe, shovel |
| Pause / release pointer | Escape |

The pause menu changes the signed world seed, render distance (2–6 chunks), and mouse sensitivity. World settings persist in `localStorage`; block edits persist by seed and world coordinate in IndexedDB. The nine-slot hotbar is a temporary Part 1 block supply and is not saved.

## Implemented in Part 1

- First-person movement, collision, jumping, sprinting, crouching, smooth mouse look, and pointer lock.
- The eight seeded biomes from the Godot terrain generator: ocean, beach, plains, forest, desert, mountains, snow, and swamp. The port includes terrain elevation, rivers/lakes, caves, ravines, ores, trees, plants, and flowers.
- 16×16×96 chunks with a padded border, hidden-face culling, two terrain workers, distance-based loading/unloading, and cleanup of old geometry. Seed changes ignore stale worker results.
- Block ray selection and outlines, hardness and tool speeds, mining, placement restrictions, door toggles, falling placed sand/gravel, dropped block pickups, and persistent edits.
- Original procedural mining and placement sounds generated with browser audio.
- Original procedural color textures generated at runtime; no proprietary assets.

Inventory, crafting, furnaces, chests, survival meters and hazards, day/night, weather, beds, Creative mode, and Phase 5 save data remain in the untouched Godot project for Part 2 migration. See [MIGRATION_REPORT.md](MIGRATION_REPORT.md), [TEST_REPORT.md](TEST_REPORT.md), and [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
