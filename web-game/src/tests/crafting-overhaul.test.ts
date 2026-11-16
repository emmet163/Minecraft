import {expect,it} from 'vitest';
import {GameItems,InventoryGrid,craft,craftToCursor,distributeCursor,empty,matchRecipe,stack,transferSlot,transferWithin} from '../items/items';

it('matches personal and station recipes, offsets shaped patterns, and rejects extra ingredients',()=>{
  const personal=new InventoryGrid(4);personal.set(0,stack('wood',3));
  expect(matchRecipe(personal,2,false)?.id).toBe('planks');
  personal.set(1,stack('stone'));expect(matchRecipe(personal,2,false)).toBeUndefined();
  const station=new InventoryGrid(9);
  station.set(1,stack('plank'));station.set(2,stack('plank'));
  station.set(4,stack('plank'));station.set(5,stack('plank'));
  expect(matchRecipe(station,3,true)?.id).toBe('crafting_station');
  expect(matchRecipe(station,3,false)?.id).toBe('crafting_station');
  station.set(8,stack('stone'));expect(matchRecipe(station,3,true)).toBeUndefined();
});
it('takes output repeatedly without duplicating ingredients or exceeding cursor capacity',()=>{
  const grid=new InventoryGrid(4);grid.set(0,stack('wood',2));let cursor=empty();
  expect(grid.get(0).count).toBe(2);expect(matchRecipe(grid,2,false)?.count).toBe(4);
  cursor=craftToCursor(grid,2,false,cursor)!.cursor;expect(cursor).toEqual(stack('plank',4));expect(grid.get(0).count).toBe(1);
  cursor=craftToCursor(grid,2,false,cursor)!.cursor;expect(cursor.count).toBe(8);expect(grid.get(0).id).toBe('');
  expect(craftToCursor(grid,2,false,cursor)).toBeUndefined();
  grid.set(0,stack('wood'));expect(craftToCursor(grid,2,false,stack('plank',62))).toBeUndefined();
  expect(grid.get(0).count).toBe(1);
  expect(craftToCursor(grid,2,false,stack('plank',60))?.cursor.count).toBe(64);
});
it('preserves metadata and stack limits for split, merge, quick transfer, and drags',()=>{
  const bag=new InventoryGrid(36),chest=new InventoryGrid(27);
  bag.set(0,stack('stone',60));bag.set(1,stack('stone',8));
  let cursor=bag.click(1,empty(),true);expect(cursor.count).toBe(4);
  cursor=bag.click(0,cursor);expect(bag.get(0).count).toBe(64);expect(cursor.id).toBe('');
  bag.set(2,stack('wood_pickaxe',1,17));
  expect(transferSlot(bag,2,[chest])).toBe(1);expect(chest.get(0).damage).toBe(17);
  expect(transferSlot(chest,0,[bag])).toBe(1);expect(bag.get(2).damage).toBe(17);
  bag.set(10,stack('stone',3));expect(transferWithin(bag,10,[0,1,2])).toBe(3);
  expect(bag.get(1).count).toBe(7);expect(bag.get(10).id).toBe('');
  cursor=distributeCursor(chest,[0,1,2],stack('plank',8),false);
  expect(chest.slots.slice(0,3).map(s=>s.count)).toEqual([3,3,2]);expect(cursor.id).toBe('');
  cursor=distributeCursor(chest,[0,1,2],stack('plank',5),true);
  expect(chest.slots.slice(0,3).map(s=>s.count)).toEqual([4,4,3]);expect(cursor.count).toBe(2);
});
it('handles full inventories, persistent grids and cursor, and rejects invalid crafting',()=>{
  const items=new GameItems();items.slots.load(Array.from({length:36},()=>stack('stone',64)));
  items.personal.set(0,stack('wood',2));expect(craft(items.personal,2,false,items.slots)).toBeUndefined();
  expect(items.personal.get(0).count).toBe(2);
  items.cursor=craftToCursor(items.personal,2,false,empty())!.cursor;
  items.station('a').set(0,stack('wood_pickaxe',1,31));
  const saved=items.snapshot(),restored=new GameItems();restored.load(saved);
  expect(restored.cursor).toEqual(stack('plank',4));expect(restored.personal.get(0).count).toBe(1);
  expect(restored.station('a').get(0).damage).toBe(31);
  const chest=new InventoryGrid(27);chest.load(Array.from({length:27},()=>stack('stone',64)));
  expect(transferSlot(items.slots,0,[chest])).toBe(0);expect(items.slots.get(0).count).toBe(64);
  chest.set(0,stack('stone',62));expect(transferSlot(items.slots,0,[chest])).toBe(2);
  expect(chest.get(0).count).toBe(64);expect(items.slots.get(0).count).toBe(62);
});
