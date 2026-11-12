# Known issues and limits — browser migration Part 1

- **Part 2 scope:** The 36-slot inventory, crafting, furnaces, chests, equipment, health, hunger, damage, death, weather, day/night, beds, Survival/Creative modes, and their save data are still present only in the protected Godot project. The browser hotbar is a temporary nine-slot block supply and does not represent the Phase 4 inventory.
- **Save compatibility:** Browser block edits use IndexedDB and do not import Godot `user://world_<seed>.json` edits. Settings use `localStorage`. Neither browser hotbar counts nor dropped items are saved.
- **Block details:** Stairs and fences use coarse selection outlines. Fence collision conservatively occupies the whole cell. Decorative plants use small cuboids. Ore and crafted stations can be mined, but the nine-slot Part 1 hotbar has limited room for their drops.
- **Water and gravity:** Water is visual terrain without swimming or buoyancy, as in the Godot prototype. Placed sand/gravel fall one cell at a time; generated terrain is stable.
- **Audio:** Original procedural mining/placement effects play through Web Audio after a user gesture. They did not raise browser errors, but loudness and sound quality were not verified by listening. Browser pointer lock may behave differently across browsers.
- **Performance:** Hidden faces are culled, but faces are not greedily merged. Worker terrain data is meshed on the main thread and can cause short stalls. The main production JS chunk exceeds Vite's 500 kB warning threshold. Render distance 6 and long play sessions were not profiled.
- **Verification:** Edge at 1280×720 passed automated checks. Other browsers, touch controls, lower-end GPUs, physical mouse feel, and long-term memory behavior were not manually verified.
