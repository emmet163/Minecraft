import {expect,it} from 'vitest';
import {InventoryGrid,GameItems,Furnace,stack,empty,craft,matchRecipe,item,recipes} from '../items/items';
import {SurvivalState,WorldCycle} from '../survival/state';
import {Block} from '../world/blocks';
import {IndexedDbEditStore} from '../persistence/edits';
import {vi} from 'vitest';
it('ports 36-slot stacks, splitting, cursor transfers, and equipment durability',()=>{
  const game=new GameItems();expect(game.slots.size).toBe(36);expect(game.slots.get(0).count).toBe(32);
  const grid=new InventoryGrid(36);expect(grid.add('stone',130)).toBe(0);expect(grid.get(2).count).toBe(2);
  let cursor=grid.click(0,empty(),true);expect(cursor.count).toBe(32);cursor=grid.click(3,cursor,false);expect(grid.get(3).count).toBe(32);
  grid.set(4,stack('wood_pickaxe'));expect(grid.damage(4,59)).toBe(true);expect(grid.get(4).damage).toBe(59);grid.damage(4,1);expect(grid.get(4).id).toBe('');
  expect(item('berries').nutrition).toBe(3);
});
it('ports shaped and shapeless recipes and consumes material only when output fits',()=>{
  expect(recipes.length).toBeGreaterThan(30);
  const grid=new InventoryGrid(4),output=new InventoryGrid(36);
  grid.set(0,stack('wood'));expect(matchRecipe(grid,2,false)?.id).toBe('planks');
  expect(craft(grid,2,false,output)?.count).toBe(4);expect(output.count('plank')).toBe(4);expect(grid.get(0).id).toBe('');
  for(let i=0;i<4;i++)grid.set(i,stack('plank'));
  expect(craft(grid,2,false,output)?.output).toBe('crafting_station');
  const station=new InventoryGrid(9);station.set(0,stack('plank'));station.set(1,stack('plank'));station.set(2,stack('plank'));station.set(4,stack('stick'));station.set(7,stack('stick'));
  expect(craft(station,3,true,output)?.output).toBe('wood_pickaxe');
});
it('smelts with fuel and restores full item/container snapshots',()=>{
  const furnace=new Furnace();furnace.slots.set(0,stack('iron'));furnace.slots.set(1,stack('coal'));furnace.tick(4);
  expect(furnace.slots.get(2).id).toBe('iron_ingot');expect(furnace.slots.get(1).id).toBe('');
  const items=new GameItems();items.slots.set(9,stack('berries',5));items.equipment.set(0,stack('wood_pickaxe',1,3));items.chest('1,2,3').set(0,stack('iron_ingot',4));items.furnace('4,5,6').load(furnace.snapshot());
  const restored=new GameItems();restored.load(items.snapshot());expect(restored.slots.get(9).count).toBe(5);expect(restored.equipment.get(0).damage).toBe(3);expect(restored.chest('1,2,3').get(0).count).toBe(4);expect(restored.furnace('4,5,6').slots.get(2).id).toBe('iron_ingot');
});
it('ports health, hunger, hazards, food, creative immunity, and respawn',()=>{
  const life=new SurvivalState();life.tick(45,false,false,false,false,false);expect(life.saturation).toBe(4);
  life.damage(7);expect(life.health).toBe(13);expect(life.eat(3,1,2)).toBe(true);expect(life.health).toBe(15);
  life.tick(11,false,true,false,false,false);expect(life.oxygen).toBe(0);expect(life.health).toBeLessThan(15);
  life.damage(100);expect(life.dead).toBe(true);life.respawn();expect(life.health).toBe(20);
  life.setMode('creative');expect(life.damage(10)).toBe(false);life.creativeBlock=Block.Bed;
  const reload=new SurvivalState();reload.load(life.snapshot());expect(reload.mode).toBe('creative');expect(reload.creativeBlock).toBe(Block.Bed);
});
it('ports deterministic day, weather, sleep, and cycle persistence',()=>{
  const cycle=new WorldCycle();cycle.configure(741852);cycle.tick(180);expect(cycle.snapshot().step).toBe(1);
  cycle.tick(1200);expect(cycle.day).toBe(2);cycle.time=.75;expect(cycle.night).toBe(true);expect(cycle.sleep()).toBe(true);expect(cycle.night).toBe(false);
  const loaded=new WorldCycle();loaded.load(cycle.snapshot(),741852);expect(loaded.day).toBe(cycle.day);
});
it('keeps the game usable in memory when IndexedDB is unavailable',async()=>{
  vi.stubGlobal('indexedDB',undefined);
  try{
    const storage=new IndexedDbEditStore();storage.onFailure=()=>{};
    expect(await storage.load(9)).toEqual([]);expect(storage.durable).toBe(false);
    await storage.putMany(9,[{x:1,y:2,z:3,state:{type:Block.Stone,properties:0}}]);
    expect((await storage.load(9))[0]?.state.type).toBe(Block.Stone);
    const items=new GameItems(),life=new SurvivalState(),cycle=new WorldCycle();cycle.configure(9);
    await storage.saveGame(9,{version:1,position:[1,2,3],yaw:0,pitch:0,items:items.snapshot(),life:life.snapshot(),cycle:cycle.snapshot()});
    expect((await storage.loadGame(9))?.position).toEqual([1,2,3]);
  }finally{vi.unstubAllGlobals();}
});
