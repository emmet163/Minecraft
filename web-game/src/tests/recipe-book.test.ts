import {expect,it} from 'vitest';
import {InventoryGrid,recipes,stack} from '../items/items';
import {planRecipe,populateRecipe,recipeCategory,recipeIngredients} from '../items/recipeBook';

const named=(id:string)=>recipes.find(recipe=>recipe.id===id)!;
it('derives categories and ingredient counts from the existing registry',()=>{
  expect(recipeCategory(named('wood_pickaxe'))).toBe('equipment');
  expect(recipeCategory(named('field_ration'))).toBe('provisions');
  expect(recipeCategory(named('survey_map'))).toBe('exploration');
  expect(recipeIngredients(named('crafting_station'))).toEqual([{id:'plank',count:4}]);
});
it('plans personal and station patterns without creating free output',()=>{
  const bag=new InventoryGrid(36),personal=new InventoryGrid(4);bag.set(9,stack('plank',4));
  const recipe=named('crafting_station');expect(planRecipe(recipe,personal,bag,2,false)).not.toBeNull();
  expect(bag.get(9).count).toBe(4);expect(populateRecipe(recipe,personal,bag,2,false)).toBe(true);
  expect(personal.slots.map(s=>s.id)).toEqual(['plank','plank','plank','plank']);
  expect(bag.get(9).id).toBe('');expect(personal.count('plank')).toBe(4);
  expect(populateRecipe(recipe,personal,bag,2,false)).toBe(true);
  expect(personal.count('plank')).toBe(4);
  const station=new InventoryGrid(9);bag.set(9,stack('plank',3));bag.set(10,stack('stick',2));
  expect(populateRecipe(named('wood_pickaxe'),station,bag,2,false)).toBe(false);
  expect(populateRecipe(named('wood_pickaxe'),station,bag,3,true)).toBe(true);
  expect(station.slots.map(s=>s.id)).toEqual(['plank','plank','plank','','stick','','','stick','']);
});
it('rejects unavailable recipes and preserves old grid contents when return capacity is missing',()=>{
  const bag=new InventoryGrid(36),grid=new InventoryGrid(4);const recipe=named('planks');
  expect(planRecipe(recipe,grid,bag,2,false)).toBeNull();
  bag.load(Array.from({length:36},()=>stack('stone',64)));grid.set(0,stack('wood',2));
  const before=bag.snapshot(),gridBefore=grid.snapshot();
  expect(populateRecipe(named('wayfinder'),grid,bag,2,false)).toBe(false);
  expect(bag.snapshot()).toEqual(before);expect(grid.snapshot()).toEqual(gridBefore);
});
it('keeps tool metadata when moving existing grid items and selecting another recipe',()=>{
  const bag=new InventoryGrid(36),grid=new InventoryGrid(9);
  grid.set(0,stack('iron_sword',1,14));bag.set(9,stack('wood'));
  expect(populateRecipe(named('planks'),grid,bag,3,true)).toBe(true);
  expect(bag.slots.some(s=>s.id==='iron_sword'&&s.damage===14)).toBe(true);
  expect(grid.get(0).id).toBe('wood');expect(bag.count('wood')).toBe(0);
});
