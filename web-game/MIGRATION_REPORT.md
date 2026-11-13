# Godot-to-browser migration report — Parts 1 and 2

## Phase 10 closure (2026-11-13)

The existing browser implementation remains the sole active game project. Phase 10 added named worlds with seed-based terrain and separate IndexedDB world identifiers, retaining legacy numeric-seed saves. It added world creation/loading and difficulty selection, backup recovery for player saves, and final performance/reliability checks. `web-game/vercel.json` and the relative-path Vite build prepare the static site for Vercel with `web-game` as the project root. No backend or deployment was added. The original Godot project was not changed; its saved files still are not imported. Current automated results and remaining limits are in [TEST_REPORT.md](TEST_REPORT.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

Date: 2026-11-12. Browser project: `web-game/`. Original Godot 4.4.1 .NET/C# Phase 5 project: repository root, protected at tag `godot-phase5-before-web-migration`. The separate `preview-site/` directory was left untouched. No deployment or Phase 6 work was performed.

## Source reviewed and migration map

Part 1's Three.js, TypeScript, and Vite foundation was freshly checked before Part 2 work. For Part 2, the original `InventoryGrid`, `HotbarInventory`, `ItemCatalog`, `RecipeBook`, `Workstations`, `InventoryPanel`, `SurvivalState`, `WorldCycle`, and `Main.Survival` C# code plus original item/recipe/smelting JSON were inspected. The three JSON data files were copied unmodified.

| Godot system | Browser counterpart |
| --- | --- |
| Seeded world generation, chunks, meshing and edits | `src/world/`, `src/render/terrain.ts`, terrain worker, IndexedDB edits |
| Player controller, camera, interaction and sounds | `src/player/controller.ts`, `src/main.ts`, `src/render/sounds.ts` |
| Item catalog, 36-slot inventory, hotbar, recipes, equipment, durability | `src/items/`, `src/ui/inventory.ts`, `src/ui/hud.ts` |
| Personal and station crafting, chests, furnaces | `src/items/items.ts`, `src/ui/inventory.ts`, world interaction in `src/main.ts` |
| Health, food, hazards, death, beds, modes, day/night, weather | `src/survival/state.ts`, `src/render/weather.ts`, `src/main.ts`, survival HUD |
| Block and player save data | `src/persistence/edits.ts` with IndexedDB version 2 and per-seed player records |

## Delivered browser gameplay

The seeded terrain and chunk streaming from Part 1 remain. Part 2 integrates pickups with the 36-slot inventory and its nine-slot hotbar, click transfers/splitting, 2×2 and 3×3 shaped/shapeless crafting, original recipe data, tool and armor tiers, equipment durability and tooltips, chest inventories, fuel-consuming furnaces and smelting. Survival includes health, hunger, saturation, food, fall and environmental damage, death drops and respawn, bed spawn points and sleeping, day/night lighting, rain/snow/storms, Survival and Creative modes, flight, a Creative block palette, and a status HUD. Terrain edits, player position/inventory/equipment, containers, seed, mode, status, spawn, and cycle state persist by seed. Save failures fall back to session memory with a visible warning.

## Verification

The final TypeScript check, 13 Vitest tests, Vite production build, and Edge browser gameplay/workstation checks are detailed in [TEST_REPORT.md](TEST_REPORT.md). The browser tests covered save/reload, world edits, mining, crafting, tool wear, fall damage, food, death, bed use, Creative flight, chest, furnace, and 3×3 crafting. The production site uses relative asset paths and needs no backend for single-player play. The short software-rendered performance measurement was slow; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for limits and incomplete behavior.

Run and Vercel configuration instructions are in [README.md](README.md). Browser saves do not import Godot save files. No actual Vercel deployment was performed.
