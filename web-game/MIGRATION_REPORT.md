# Godot-to-browser migration report — Part 1

Date: 2026-11-12

## Protected source and architecture

The original Godot Phase 5 project is committed at `161df55` and checkpointed by tag `godot-phase5-before-web-migration`. Its tracked source was not modified. The separate untracked `preview-site/` directory was also left alone.

The inspected Godot architecture has these dependencies:

| Original system | Depends on | Part 1 browser counterpart |
| --- | --- | --- |
| `WorldGenerator`, `ChunkData`, `BlockState` | Seeded world-coordinate noise and block IDs | `src/world/generator.ts`, `chunk.ts`, `blocks.ts` |
| `ChunkMesher`, `VoxelChunk`, `VoxelWorld` | Padded border samples, edits, Godot meshes, streaming | `src/render/terrain.ts`, `src/world/world.ts`, `terrain.worker.ts` |
| `WorldEdits` | Per-seed world-coordinate change records | `src/persistence/edits.ts` using IndexedDB |
| `FirstPersonPlayer`, `ControlSettings` | Godot input, collision, camera | `src/player/controller.ts`, pointer lock and settings in `main.ts` |
| `Main` interaction code, `BlockRules`, `DroppedBlock` | World, player, hotbar, save boundary | `src/world/raycast.ts`, `blocks.ts`, `main.ts`, `src/ui/hud.ts` |
| Phase 4 item/crafting/workstation code | Inventory grids and item catalog | Reserved for Part 2 |
| Phase 5 survival/world-cycle/weather code | Items, player, HUD, world state | Reserved for Part 2 |

The browser code uses the same integer-centered block coordinates as Godot, floor division for negative chunk coordinates, 16×16×96 chunks, and world-coordinate noise. A one-cell border lets neighboring chunk meshes cull shared faces independently of load order. Terrain workers return typed arrays; Three.js geometry is built on the main thread. Each asynchronous result carries a world epoch, and world edits are reapplied before a chunk is meshed.

## Delivered

Three.js rendering, sky and lighting; strict TypeScript and Vite; configurable player movement and pointer lock; eight seeded biomes and the inspected terrain features; chunk streaming and face culling; mining, placement, tool speeds, outlines, drops, door use, gravity blocks, procedural interaction sounds, a nine-slot interaction hotbar, and IndexedDB block-edit persistence. `package-lock.json` records compatible npm dependencies. Production output is in ignored `dist/`.

## Verification and remaining work

Seven Vitest tests passed. Edge browser checks passed against both Vite dev and the production `dist` preview, including WebGL rendering, 25 loaded chunks, pointer lock, movement input, mining, placement, pause, and two persisted edits after reload. Type checking and production build passed. No test failed on the final run. Detailed results and initial failures fixed during development are in `TEST_REPORT.md`.

Manual feel, audio, high render distances, and long-session memory/performance remain unverified. Other limits are in `KNOWN_ISSUES.md`. Inventory, crafting, survival systems, and their save migration are reserved for Part 2. No deployment was performed.
