# Known issues and limits — Phase 5

- **Water and weather:** Water has no swimming or buoyancy physics. Rain and snow follow the player and can appear under roofs; exposure checks use terrain height and do not consider tree canopies or player-built shelter. Precipitation does not accumulate or alter terrain.
- **Survival balance:** Food, damage, natural healing, and day length have automated rule checks but have not been tuned through a long human play session. Armor has durability and crafting tiers but does not yet reduce environmental damage.
- **Beds:** A bed occupies one block. Its spawn point is saved, but no clearance search is performed around a blocked bed; breaking the bed falls back to world spawn.
- **Drops:** Death and mining drops are transient scene objects, not saved. Quitting before collecting them loses them. Death removes carried and equipped items; items in placed chests remain stored.
- **Save consistency:** Block edits and inventory/survival data use separate per-seed files. Each file is replaced atomically, but an interruption between writes can leave the files out of sync. A corrupt inventory file is preserved and disables inventory writes for that loaded world.
- **Input verification:** Automated tests cover stack rules and mode/flight mechanics. Physical mouse dragging, Creative palette selection, mouse recapture, and audible effects were not verified by a human play session.
- **World and visuals:** Chunks cover levels 0–95. Surface types can switch visibly at climate thresholds. Stair/fence selection outlines show cell bounds. Crouch release does not check overhead clearance before expanding the collider.
- **Performance and scale:** Chunk quads are not greedily merged. Short captures and managed-memory probes passed; long-session native-memory behavior, save latency with many active furnaces, and layouts at other resolutions were not measured.
