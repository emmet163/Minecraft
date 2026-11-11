# Known issues and limits — Phase 1

- **Build and runtime unverified:** The development environment has neither Godot .NET nor the .NET SDK available, so syntax, import, and gameplay behavior still require a real build and launch.
- **Crouch clearance:** The collider expands immediately when crouch is released. Under a future low ceiling this could overlap geometry. The Phase 1 world has no overhead blocks.
- **Finite world:** The 16 × 16 block test platform has no world boundary or respawn behavior. Walking off it causes the player to fall.
- **Terrain cost:** The prototype uses one body and mesh per visible block. A later scalable world will need chunk meshes and merged collision.
- **Audio:** No sound is authored or played in this phase; no audio feature was requested for Phase 1.
