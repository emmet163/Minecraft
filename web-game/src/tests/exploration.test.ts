import {expect,it} from 'vitest';
import * as THREE from 'three';
import {WorldGenerator,Biome} from '../world/generator';
import {ExplorationState} from '../exploration/state';
import {VillageLedger,tradeOffers} from '../villages/trades';
import {GameItems,stack} from '../items/items';
import {CreatureSystem,type CreatureWorld} from '../creatures/system';
import {Block,state} from '../world/blocks';
import type {StructureSite} from '../world/structures';

it('discovers landmarks once, tracks them, and restores map and cleared-enemy state',()=>{
  const planner=new WorldGenerator(12345).structures;
  const site=planner.nearby(0,0,2000)[0]!;expect(site).toBeTruthy();
  const progress=new ExplorationState();
  expect(progress.visit(planner,site.x,site.z).some(s=>s.id===site.id)).toBe(true);
  expect(progress.visit(planner,site.x,site.z)).toEqual([]);
  progress.tracked=site.id;progress.defeated.add(`${site.id}:0`);
  const restored=new ExplorationState();restored.load(progress.snapshot());
  expect(restored.target([site],false)?.id).toBe(site.id);
  expect(restored.defeated.has(`${site.id}:0`)).toBe(true);
});
it('trades atomically, enforces daily stock, and persists inhabitant records',()=>{
  expect(Object.keys(tradeOffers).sort()).toEqual(['cartographer','farmer','mason']);
  const items=new GameItems(),ledger=new VillageLedger();items.slots.set(9,stack('plant',32));
  const before=items.slots.count('plant');
  expect(ledger.trade(items,'village:0','farmer',0,1).ok).toBe(true);
  expect(items.slots.count('plant')).toBe(before-8);expect(items.slots.count('berries')).toBe(4);
  for(let i=0;i<3;i++)expect(ledger.trade(items,'village:0','farmer',0,1).ok).toBe(true);
  const count=items.slots.count('plant');expect(ledger.trade(items,'village:0','farmer',0,1).ok).toBe(false);
  expect(items.slots.count('plant')).toBe(count);
  items.slots.set(9,stack('plant',8));expect(ledger.trade(items,'village:0','farmer',0,2).ok).toBe(true);
  ledger.deceased.add('village:2');const loaded=new VillageLedger();loaded.load(ledger.snapshot());
  expect(loaded.used('village:0',0,2)).toBe(1);expect(loaded.deceased.has('village:2')).toBe(true);
  expect(loaded.trade(items,'village:2','farmer',0,2).ok).toBe(false);
});
it('uses the existing creature system for village occupations and dungeon guards',()=>{
  const world:CreatureWorld={get:(_x,y)=>y<=60?Block.Stone:Block.Air,
    getState:(_x,y)=>state(y<=60?Block.Stone:Block.Air),isLoaded:()=>true,
    generator:{surfaceHeight:()=>60,biomeAt:()=>Biome.Plains}};
  const creatures=new CreatureSystem(world);creatures.configure(4);
  const village:StructureSite={id:'0:0:village',kind:'village',x:0,y:60,z:0,biome:Biome.Plains,variant:0,
    homes:[{x:-8,y:60,z:-8},{x:8,y:60,z:-8}],work:{x:10,y:60,z:19},chests:[{x:-7,y:61,z:-9}]};
  creatures.ensureVillage(village,new Set());expect(creatures.creatures.length).toBe(2);
  expect(creatures.creatures.map(c=>c.inhabitant?.occupation)).toEqual(['farmer','mason']);
  const first=creatures.creatures[0]!;for(let i=0;i<10;i++)creatures.update(.05,new THREE.Vector3(0,60.51,0),1,false,10);
  expect(first.state).toBe('wander');
  creatures.clear();creatures.ensureVillage(village,new Set([`${village.id}:0`]));expect(creatures.creatures.length).toBe(1);
  creatures.clear();const dungeon={...village,id:'0:0:dungeon',kind:'dungeon' as const};
  creatures.ensureDungeon(dungeon,new Set());expect(creatures.creatures.map(c=>c.def.kind)).toEqual(['hostile','hostile']);
  creatures.clear();creatures.ensureDungeon(dungeon,new Set([`${dungeon.id}:0`]));expect(creatures.creatures.length).toBe(1);
  creatures.dispose();
});
