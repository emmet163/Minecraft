# Stonewake

Stonewake is a browser-based voxel survival game. The active project is in [`web-game/`](web-game/).

## Run locally

```powershell
cd web-game
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173/`. For controls, saves, testing, and deployment, see the [web game README](web-game/README.md).

## Checks

```powershell
cd web-game
npm run typecheck
npm run test
npm run build
```

The old Godot code is preserved in Git history at the `godot-phase5-before-web-migration` tag. Browser saves are stored by the browser and are separate from old Godot saves.
