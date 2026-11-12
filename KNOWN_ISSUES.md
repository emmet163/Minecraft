# Known issues and limits — Phase 4

- **Inventory input verification:** Stack split, merge, swap, and transfer logic passed automated tests. Physical mouse click-and-drag and mouse recapture after closing the interface were not verified in a human play session.
- **Equipment use:** Equipped pickaxes and shovels improve mining and lose durability. Weapons and armor have tiers, durability, slots, recipes, and tooltips, but there is no combat or player-damage system for them to affect yet. Bandages and campfire kits are craftable supplies without use actions.
- **Dropped items:** Item drops are transient scene objects and are not saved. Removing a chest or furnace spills its contents into the world; quitting before collecting those drops loses them.
- **Save consistency:** Block edits and inventory/container data use separate per-seed files. Each file is replaced atomically, but an interruption between the two writes can leave a block and its stored contents out of sync. A corrupt inventory file is preserved and disables inventory writes for that loaded world.
- **Water:** Water has no swimming or buoyancy physics.
- **Crouch clearance:** Releasing crouch does not check for an overhead ceiling before expanding the collider.
- **World bounds and visuals:** Chunks cover vertical levels 0–95. Surface types can switch visibly at climate thresholds. Stair/fence selection outlines show cell bounds rather than exact geometry.
- **Performance:** Chunk quads are not greedily merged. Large inventories with many active furnaces and long play sessions have not been profiled for native-memory growth or save latency.
- **UI scale:** The 1280×720 inventory frame was inspected. Other resolutions and input devices were not visually tested.
