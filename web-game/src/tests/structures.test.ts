import {expect,it} from 'vitest';
import {WorldGenerator} from '../world/generator';
import {Block,floorDiv,state} from '../world/blocks';
import {SIZE,HEIGHT} from '../world/chunk';
import {VoxelWorld} from '../world/world';
import {MemoryEditStore} from '../persistence/edits';
import type {StructureKind,StructureSite} from '../world/structures';
import {lootFor,lootTables} from '../exploration/loot';
import {GameItems} from '../items/items';

function examples(seed:number){const generator=new WorldGenerator(seed),found=new Map<StructureKind,StructureSite>();
  for(let rz=-12;rz<=12&&found.size<5;rz++)for(let rx=-12;rx<=12&&found.size<5;rx++){
    const site=generator.structures.siteAtRegion(rx,rz);if(site&&!found.has(site.kind))found.set(site.kind,site);
  }
  return {generator,found};
}
it('plans all five structure families deterministically with biome rules',()=>{
  const {generator,found}=examples(12345);expect([...found.keys()].sort()).toEqual(['dungeon','mine','ruin','vault','village']);
  const replay=new WorldGenerator(12345),different=new WorldGenerator(54321);
  for(const site of found.values()){
    const [rx,rz]=site.id.split(':').map(Number);
    expect(replay.structures.siteAtRegion(rx!,rz!)).toEqual(site);
    expect(different.structures.siteAtRegion(rx!,rz!)).not.toEqual(site);
    expect(site.chests.length).toBeGreaterThan(0);
  }
  const village=found.get('village')!;expect(village.homes.length).toBeGreaterThanOrEqual(2);
  const cx=floorDiv(village.x,SIZE),cz=floorDiv(village.z,SIZE),chunk=generator.generate(cx,cz);
  expect(chunk.world(village.x,generator.surfaceHeight(village.x,village.z),village.z)).toBe(Block.Gravel);
});
it('matches structure voxels and padded faces across neighboring chunk boundaries',()=>{
  const {generator,found}=examples(12345),site=found.get('village')!;
  const cx=floorDiv(site.x,SIZE),cz=floorDiv(site.z,SIZE);
  const center=generator.generate(cx,cz),east=generator.generate(cx+1,cz),south=generator.generate(cx,cz+1);
  for(let z=0;z<SIZE;z++)for(let y=0;y<HEIGHT;y++){
    expect(center.getState(SIZE,y,z)).toEqual(east.getState(0,y,z));
    expect(center.getState(SIZE-1,y,z)).toEqual(east.getState(-1,y,z));
  }
  for(let x=0;x<SIZE;x++)for(let y=0;y<HEIGHT;y++){
    expect(center.getState(x,y,SIZE)).toEqual(south.getState(x,y,0));
    expect(center.getState(x,y,SIZE-1)).toEqual(south.getState(x,y,-1));
  }
});
it('generates chest locations and preserves a player edit over regenerated structure blocks',async()=>{
  const {generator,found}=examples(12345),site=found.get('village')!,chest=site.chests[0]!;
  const store=new MemoryEditStore(),world=new VoxelWorld(store,false);
  await world.configure(generator.seed,2,chest.x,chest.z);
  expect(world.get(chest.x,chest.y,chest.z)).toBe(Block.Chest);
  expect(await world.apply([{...chest,state:state(Block.Air)}])).toBe(true);
  await world.configure(generator.seed,2,chest.x,chest.z);
  expect(world.get(chest.x,chest.y,chest.z)).toBe(Block.Air);
  expect(generator.generate(floorDiv(chest.x,SIZE),floorDiv(chest.z,SIZE)).world(chest.x,chest.y,chest.z)).toBe(Block.Chest);
  world.dispose();
});
it('materializes dungeon, mine, ruin, and vault treasure inside generated chunks',()=>{
  const {generator,found}=examples(12345);
  for(const kind of ['dungeon','mine','ruin','vault'] as const){
    const chest=found.get(kind)!.chests[0]!;
    const chunk=generator.generate(floorDiv(chest.x,SIZE),floorDiv(chest.z,SIZE));
    expect(chunk.world(chest.x,chest.y,chest.z),kind).toBe(Block.Chest);
  }
  const vault=found.get('vault')!;
  const chunk=generator.generate(floorDiv(vault.x+5,SIZE),floorDiv(vault.z+5,SIZE));
  expect(chunk.world(vault.x+5,vault.y+3,vault.z+5)).toBe(Block.Gold);
});
it('rolls deterministic treasure with rare vault rewards and remembers opened chests',()=>{
  const {found}=examples(12345);
  expect(Object.keys(lootTables).sort()).toEqual(['dungeon','mine','ruin','vault','village']);
  for(const site of found.values())expect(lootFor(site,12345)).toEqual(lootFor(site,12345));
  const vault=found.get('vault')!,loot=lootFor(vault,12345);
  expect(loot.some(s=>s.id==='sunstone')).toBe(true);
  const items=new GameItems(),key=`${vault.chests[0]!.x},${vault.chests[0]!.y},${vault.chests[0]!.z}`;
  items.chest(key).load(loot);items.generatedLoot.add(key);
  const loaded=new GameItems();loaded.load(items.snapshot());
  expect(loaded.generatedLoot.has(key)).toBe(true);expect(loaded.chest(key).snapshot()).toEqual(loot);
  loaded.chests.delete(key);expect(loaded.generatedLoot.has(key)).toBe(true);
});
