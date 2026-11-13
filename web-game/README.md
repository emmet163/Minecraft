# Stonewake Web

Stonewake is a single-player voxel survival game built with Three.js, TypeScript, and Vite. The original Godot 4 C# project remains at the repository root. The `godot-phase5-before-web-migration` tag marks its Phase 5 checkpoint. Browser saves are separate from Godot saves.

## Run locally

Install Node.js 20.19+ or 22.12+ and npm. From `web-game/`:

```powershell
npm install
npm run dev
```

Open the printed address, normally `http://127.0.0.1:5173/`, then select **Enter world**. Escape releases the mouse and opens the pause menu.

```powershell
npm run typecheck
npm run test
npm run build
npm run preview
```

`npm run build` creates a static `dist/` directory. `npm run preview` serves it at `http://127.0.0.1:4173/` by default. The optional browser tests require Microsoft Edge at its standard Windows installation path and a running dev or preview server:

```powershell
npm run test:browser
npm run test:integration
npm run test:stations
npm run test:creatures
```

Set `STONEWAKE_URL=http://127.0.0.1:4173/` to run a browser test against the production preview.

## Controls

| Action | Control |
| --- | --- |
| Move and look | WASD and mouse |
| Jump / sprint / crouch | Space / Shift / Ctrl |
| Creative flight up / down | Space / Ctrl |
| Mine / place or use block | Hold left mouse / right mouse |
| Attack a targeted creature | Hold left mouse within melee reach |
| Select hotbar | 1–9 or mouse wheel |
| Cycle mining tool | Q |
| Open inventory | E |
| Eat selected food | F |
| Pause and release mouse | Escape |

The pause menu sets the world seed, render distance, mouse sensitivity, and Survival or Creative mode. In Creative mode, choose a block from the inventory palette. Right-click a crafting station, chest, furnace, door, or bed to use it. Inventory slots support left-click transfers and right-click splitting or placing one item. The first nine of 36 inventory slots form the hotbar. The inventory also contains equipment slots, a personal 2×2 grid, and a recipe guide; a crafting station provides a 3×3 grid.

## World and saves

Seeded 16×16×96 chunks stream around the player. The generator includes oceans, beaches, plains, forests, deserts, mountains, snow, swamps, caves, ravines, rivers, lakes, ores, trees, flowers, and vegetation. Mining and building use selection outlines, collision restrictions, tool speeds and wear, falling sand and gravel, pickups, and original procedural sounds. Survival adds health, hunger, food, drowning, suffocation, fall and weather damage, death and respawn, beds, day and night, rain, snow, thunderstorms, and a status HUD.

## Creatures and combat (Phase 6)

Four original voxel creatures inhabit the world: peaceful Mossbacks, neutral Crag Guardians, and hostile Dusk Stalkers and Ember Spitters. Peaceful creatures wander, graze, and flee when hit. Guardians retaliate. Hostiles pursue and use melee or ranged attacks. Spawns depend on biome and daylight; creatures despawn far from the player. Combat uses the existing sword equipment slot or a selected hotbar sword. Armor reduces creature damage and wears down, while defeated creatures award experience and drop collectible items. The crosshair displays a targeted creature's health and behavior. The creature browser test uses a Vite development-only test fixture, so run it against `npm run dev`.

## Saves

IndexedDB stores terrain edits and player data by seed, including position, inventory, equipment, containers, furnace progress, health, hunger, time, weather, and spawn point. The browser autosaves every five game seconds and on pause, inventory changes, and page visibility changes. Storage failure displays a warning and uses temporary in-memory data for the current page session. `localStorage` stores control and world settings. Saved Godot `user://` files are not imported.

## Deploy to Vercel

Create a Vercel project from this repository. Set **Root Directory** to `web-game`, **Build Command** to `npm run build`, and **Output Directory** to `dist`. The Vite base is relative, so the generated asset paths work on static hosting. Single-player play needs no persistent backend. No Phase 6 deployment was performed.

See [MIGRATION_REPORT.md](MIGRATION_REPORT.md), [TEST_REPORT.md](TEST_REPORT.md), and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for verified coverage and limits.
