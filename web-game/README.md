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
npm run test:exploration
npm run test:advanced
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
| Use selected food or tonic | F |
| Mount or dismount nearby vehicle | V |
| Open field map | M |
| Trade with a targeted inhabitant | Right mouse |
| Pause and release mouse | Escape |

The pause menu sets the world seed, render distance, mouse sensitivity, and Survival or Creative mode. In Creative mode, choose a block from the inventory palette. Right-click a crafting station, chest, furnace, door, or bed to use it. Inventory slots support left-click transfers and right-click splitting or placing one item. The first nine of 36 inventory slots form the hotbar. The inventory also contains equipment slots, a personal 2×2 grid, and a recipe guide; a crafting station provides a 3×3 grid.

## World and saves

Seeded 16×16×96 chunks stream around the player. The generator includes oceans, beaches, plains, forests, deserts, mountains, snow, swamps, caves, ravines, rivers, lakes, ores, trees, flowers, and vegetation. Mining and building use selection outlines, collision restrictions, tool speeds and wear, falling sand and gravel, pickups, and original procedural sounds. Survival adds health, hunger, food, drowning, suffocation, fall and weather damage, death and respawn, beds, day and night, rain, snow, thunderstorms, and a status HUD.

## Creatures and combat (Phase 6)

Four original voxel creatures inhabit the world: peaceful Mossbacks, neutral Crag Guardians, and hostile Dusk Stalkers and Ember Spitters. Peaceful creatures wander, graze, and flee when hit. Guardians retaliate. Hostiles pursue and use melee or ranged attacks. Spawns depend on biome and daylight; creatures despawn far from the player. Combat uses the existing sword equipment slot or a selected hotbar sword. Armor reduces creature damage and wears down, while defeated creatures award experience and drop collectible items. The crosshair displays a targeted creature's health and behavior. The creature browser test uses a Vite development-only test fixture, so run it against `npm run dev`.

## Villages and exploration (Phase 7)

Seeded landmarks include villages with varied houses, paths and farms; underground dungeons and mines; ruins; and rare vaults. They use the existing chunk terrain and mesh pipeline and stay consistent across chunk borders. Player edits take precedence over generated blocks. Village Hearthfolk use the creature AI for daily movement between homes, work and the square. Farmers, masons and cartographers offer limited daily trades. Right-click one at close range to trade.

Structure chests contain deterministic loot. Treasure includes relic shards, sunstones, survey maps and wayfinders. Press **M** to view discovered landmarks and track one. The HUD shows coordinates and a compass bearing; a survey map reveals nearby landmarks, while a wayfinder also points toward an undiscovered one. Finding landmarks awards experience in Survival mode. Dungeon guards use the existing hostile combat system.

## Advanced systems (Phase 8)

Water and lava sources spread into nearby open cells in scheduled batches, continue across loaded chunk borders, and form stone when water reaches lava. Flowing cells and reactions are saved as terrain edits. Signal wire carries power from switches, timed buttons and player pressure plates. Repeaters delay and renew it; powered lamps glow, pistons push one block, and nearby doors open automatically. Right-click switches and buttons to operate them.

Place cultivated soil near water for irrigation, then plant Sungrain or Berry Seeds on top. Crops mature through four stages and mature crops yield food and seed when mined. Right-click a peaceful animal while holding berries to breed it; each parent has a cooldown. Place rails and an Ore Cart, or place a Reed Boat on water. Press **V** near a vehicle to mount or dismount; **W/S** drives it while mounted. Vehicles are saved per realm.

Sunsteel upgrades and three tonics extend equipment progression. Use a selected tonic with **F** for speed, damage reduction or immediate healing. A Veil Gate crafted from Overworld treasure opens the alternate **Veil** realm on right-click. The Veil has original terrain, Gleam Ore, Veil Crystals, lava pools and hostile Veil Shades. Right-click a gate to return. The Overworld and Veil keep separate terrain edits under the same world seed.

## Saves

IndexedDB stores terrain edits and player data by seed, including position, inventory, equipment, containers, furnace progress, health, hunger, time, weather, spawn point, discovered landmarks, generated treasure, trade stock, deceased inhabitants or dungeon guards, vehicles, effects and realm positions. The browser autosaves every five game seconds and on pause, inventory changes, and page visibility changes. Storage failure displays a warning and uses temporary in-memory data for the current page session. `localStorage` stores control and world settings. Saved Godot `user://` files are not imported.

## Deploy to Vercel

Create a Vercel project from this repository. Set **Root Directory** to `web-game`, **Build Command** to `npm run build`, and **Output Directory** to `dist`. The Vite base is relative, so the generated asset paths work on static hosting. Single-player play needs no persistent backend. No Phase 8 deployment was performed.

See [MIGRATION_REPORT.md](MIGRATION_REPORT.md), [TEST_REPORT.md](TEST_REPORT.md), and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for verified coverage and limits.
