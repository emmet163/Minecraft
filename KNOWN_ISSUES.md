# Known issues and limits — Phase 2

- **Visual water only:** Oceans, rivers, and lakes render water blocks, but there is no buoyancy, swimming, or underwater movement. The player can fall through deep water.
- **Crouch clearance:** Releasing crouch immediately expands the collider. An overhead cave ceiling may overlap it; a clearance query is still needed.
- **Finite vertical range:** Chunks cover levels 0–95. Terrain is clamped below the top; deeper geology and vertical chunk streaming are outside this phase.
- **Biome edges:** Terrain height is continuous across climate regions, but surface block types switch at biome thresholds and can form visible color edges.
- **Meshing cost:** Hidden faces are culled, but exposed quads are not greedily merged. Distance 6 loaded its full 169 chunks in the headless probe; its graphical frame rate and native memory use remain unmeasured.
- **Regeneration is destructive to position:** Applying a seed or render-distance change rebuilds loaded chunks and moves the player to a safe spawn. No terrain edits or player-position save exist yet.
- **Manual input and long soak testing:** Headless tests exercised the movement code and Escape path. Actual mouse capture, full UI interaction, and long-duration native-memory behavior require an interactive play session.
- **Audio:** No sounds are authored or played in this phase.
