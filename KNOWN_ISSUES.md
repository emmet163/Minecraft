# Known issues and limits — Phase 3

- **Water remains visual:** There is no buoyancy or swimming; the player can fall through deep water.
- **Crouch clearance:** Releasing crouch expands the collider without checking an overhead ceiling.
- **Biome edges:** Elevation is continuous, but surface block types can switch visibly at climate thresholds.
- **Finite vertical world:** Chunks cover levels 0–95. Terrain is clamped beneath the top.
- **Meshing and edit cost:** Hidden faces are culled, but quads are not greedily merged. A block edit rebuilds its chunk and any affected neighbor; long sessions with many edits have not been profiled.
- **Hotbar inventory:** Nine building types are selectable. Other collected block types are counted internally but cannot be equipped yet. Hotbar counts and tool choice are not persisted; block changes are.
- **Shape detail:** Doors have a simple two-cell open/closed shape; fences connect to adjacent solid blocks. The selection outline for stairs and fences shows the full cell bounds. Hinge side, stair corner shapes, and other variants are not implemented.
- **Interaction validation:** Headless probes call the same mining and placement methods used by input handling, but physical mouse clicks and the audible result of generated sounds were not tested by a person.
- **Audio and particles:** Sounds are generated PCM cues and particles are small transient cubes; quality and appearance need interactive review.
