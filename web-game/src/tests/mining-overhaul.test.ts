import {expect,it} from 'vitest';
import {Block,canHarvest,miningRule} from '../world/blocks';
import {GameItems,InventoryGrid,craft,item,matchRecipe,miningDrops,stack} from '../items/items';
import {MiningProgress} from '../items/mining';
import {dropFaceTiles,visualBlockForItem} from '../render/drops';

it('harvests soil and logs by hand but not stone',()=>{
  expect(miningDrops(Block.Dirt,0,'hand',0)).toEqual([stack('dirt')]);
  expect(miningDrops(Block.Grass,0,'hand',0)).toEqual([stack('dirt')]);
  expect(miningDrops(Block.Wood,0,'hand',0)).toEqual([stack('wood')]);
  expect(miningDrops(Block.Stone,0,'hand',0)).toEqual([]);
  expect(miningDrops(Block.Stone,0,'pickaxe',1)).toEqual([stack('stone')]);
});

it('enforces ore tiers and category without creating unsupported ores',()=>{
  expect(miningDrops(Block.Coal,0,'pickaxe',1)).toEqual([stack('coal')]);
  expect(miningDrops(Block.Iron,0,'pickaxe',1)).toEqual([]);
  expect(miningDrops(Block.Iron,0,'shovel',5)).toEqual([]);
  expect(miningDrops(Block.Iron,0,'pickaxe',2)).toEqual([stack('iron')]);
  expect(miningDrops(Block.Gold,0,'pickaxe',2)).toEqual([]);
  expect(miningDrops(Block.Gold,0,'pickaxe',4)).toEqual([stack('gold')]);
  expect(miningDrops(Block.GlowOre,0,'pickaxe',4)).toEqual([stack('glow_ore')]);
  expect(miningDrops(Block.Water,0,'pickaxe',6)).toEqual([]);
  expect(miningRule(Block.Grass).loot).toBe('dirt');
});

it('uses held hotbar tools and equipped tools for speed, drops, and durability',()=>{
  const game=new GameItems();game.slots.set(0,stack('wood_pickaxe'));
  expect(game.activeMiningTool().source).toBe('hotbar');
  expect(game.miningTime(Block.Stone)).toBeLessThan(new GameItems().miningTime(Block.Stone));
  expect(game.miningDrops(Block.Stone)).toEqual([stack('stone')]);
  expect(game.miningDrops(Block.Iron)).toEqual([]);
  game.wearTool();expect(game.slots.get(0).damage).toBe(1);
  game.slots.set(0,stack('wood_pickaxe',1,item('wood_pickaxe').durability-1));
  game.wearTool();expect(game.slots.get(0).id).toBe('');
  game.equipment.set(0,stack('stone_pickaxe'));game.tool='pickaxe';
  expect(game.miningDrops(Block.Iron)).toEqual([stack('iron')]);
  game.wearTool();expect(game.equipment.get(0).damage).toBe(1);
  game.tool='shovel';expect(game.activeMiningTool().category).toBe('hand');
  expect(game.miningDrops(Block.Stone)).toEqual([]);
});

it('resets progress on target change and release; creative duration is instant',()=>{
  const progress=new MiningProgress();
  expect(progress.advance('a',.2,1)).toBeCloseTo(.2);
  expect(progress.advance('a',.3,1)).toBeCloseTo(.5);
  expect(progress.advance('b',.1,1)).toBeCloseTo(.1);
  progress.reset();expect(progress.advance('b',.1,1)).toBeCloseTo(.1);
  expect(progress.advance('b',0,0)).toBe(1);
  const game=new GameItems();game.slots.set(0,stack('wood_pickaxe'));
  expect(game.miningTime(Block.Dirt)).toBeGreaterThan(game.miningTime(Block.Stone));
  expect(game.miningTime(Block.Iron)).toBeGreaterThan(game.miningTime(Block.Stone));
});

it('preserves crop counts, unique drop identity, and the existing icon mapping',()=>{
  expect(miningDrops(Block.WheatCrop,3,'hand',0)).toEqual([stack('wheat_seed',2),stack('sungrain',2)]);
  expect(miningDrops(Block.WheatCrop,0,'hand',0)).toEqual([stack('wheat_seed')]);
  expect(miningDrops(Block.Stone,0,'hand',0)).toHaveLength(0);
  expect(miningDrops(Block.Stone,0,'pickaxe',1)).toHaveLength(1);
  expect(visualBlockForItem('stone')).toBe(Block.Stone);
  expect(dropFaceTiles(visualBlockForItem('dirt'))).toEqual([Block.Dirt,Block.Dirt,Block.Dirt]);
});

it('crafts axe and hoe tiers and preserves tool damage in saves and transfers',()=>{
  const grid=new InventoryGrid(9),bag=new InventoryGrid(36);
  for(const [index,id] of [[0,'plank'],[1,'plank'],[3,'plank'],[4,'stick'],[7,'stick']] as const)grid.set(index,stack(id));
  expect(matchRecipe(grid,3,true)?.output).toBe('wood_axe');
  expect(craft(grid,3,true,bag)?.output).toBe('wood_axe');
  expect(bag.count('wood_axe')).toBe(1);
  const game=new GameItems();game.slots.set(9,stack('iron_hoe',1,17));game.equipment.set(0,stack('stone_pickaxe',1,22));game.tool='pickaxe';
  const loaded=new GameItems();loaded.load(game.snapshot());
  expect(loaded.slots.get(9)).toEqual(stack('iron_hoe',1,17));
  expect(loaded.equipment.get(0)).toEqual(stack('stone_pickaxe',1,22));
  expect(canHarvest(Block.Stone,loaded.activeMiningTool().category,loaded.activeMiningTool().tier)).toBe(true);
});
