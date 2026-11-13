import {expect,it} from 'vitest';
import * as THREE from 'three';
import {CreatureSystem,creatureDefs,type CreatureWorld} from '../creatures/system';
import {Block,state} from '../world/blocks';
import {Biome} from '../world/generator';
import {GameItems,stack} from '../items/items';
import {absorbCreatureDamage,meleeDamage,wearWeapon} from '../combat/rules';

function flatWorld(biome:Biome=Biome.Plains):CreatureWorld{return {
  get:(_x,y)=>y<=60?Block.Stone:Block.Air,
  getState:(_x,y)=>state(y<=60?Block.Stone:Block.Air),
  isLoaded:()=>true,
  generator:{surfaceHeight:()=>60,biomeAt:()=>biome},
};}
const player=new THREE.Vector3(0,60.51,0);
function advance(system:CreatureSystem,seconds:number,daylight:number,vulnerable=true){for(let t=0;t<seconds;t+=.05)system.update(.05,player,daylight,vulnerable);}

it('registers distinct original creatures and limits seeded spawning by day and population',()=>{
  expect(new Set(creatureDefs.map(def=>def.id)).size).toBe(6);
  expect(new Set(creatureDefs.map(def=>def.kind))).toEqual(new Set(['peaceful','neutral','hostile','friendly']));
  const day=new CreatureSystem(flatWorld());day.configure(71);advance(day,3.6,1);
  expect(day.creatures.length).toBeGreaterThan(0);expect(day.creatures.every(c=>c.def.kind!=='hostile')).toBe(true);
  const night=new CreatureSystem(flatWorld());night.configure(71);advance(night,3.6,0);
  expect(night.creatures.length).toBeGreaterThan(0);expect(night.creatures.some(c=>c.def.kind==='hostile')).toBe(true);
  for(let i=0;i<30;i++)night.spawnAt('mossback',i+100,60.51,0);
  expect(night.creatures.length).toBe(night.maxPopulation);
  day.dispose();night.dispose();
});
it('wanders, flees, retaliates, collides with ground, and despawns at distance',()=>{
  const system=new CreatureSystem(flatWorld());system.configure(10);
  const grazer=system.spawnAt('mossback',3,60.51,0)!;
  const guardian=system.spawnAt('crag_guardian',5,60.51,0)!;
  advance(system,.5,1);expect(guardian.state).not.toBe('chase');
  system.hit(grazer,1,player);expect(grazer.state).toBe('flee');
  system.hit(guardian,1,player);expect(guardian.aggression).toBeGreaterThan(0);
  advance(system,.5,1);expect(['chase','attack']).toContain(guardian.state);
  expect(grazer.position.y).toBeGreaterThanOrEqual(60.49);
  const far=new THREE.Vector3(200,60.51,200);system.update(.05,far,1,true);
  expect(system.creatures.length).toBe(0);system.dispose();
});
it('handles melee cooldown, ranged projectiles, death rewards, and ray targeting',()=>{
  const system=new CreatureSystem(flatWorld());system.configure(9);let hits=0,deaths=0;
  system.onPlayerHit=()=>hits++;system.onDeath=()=>deaths++;
  const melee=system.spawnAt('dusk_stalker',0,60.51,-1.5)!;
  advance(system,.3,0);expect(hits).toBe(1);
  advance(system,.3,0);expect(hits).toBe(1);
  const aim=system.target(new THREE.Vector3(0,62,0),new THREE.Vector3(0,-.3,-1).normalize(),5);
  expect(aim).toBe(melee);
  expect(system.hit(melee,100,player)).toBe(true);expect(deaths).toBe(1);
  expect(system.hit(melee,1,player)).toBe(false);expect(deaths).toBe(1);
  system.clear();const ranged=system.spawnAt('ember_spitter',0,60.51,-5)!;
  advance(system,1.5,0);expect(ranged.alive).toBe(true);expect(hits).toBeGreaterThan(1);
  system.dispose();
});
it('routes around a solid voxel without passing through it',()=>{
  const base=flatWorld(),blocked=(x:number,y:number,z:number)=>y>=61&&y<=62&&Math.round(x)===0&&Math.round(z)===-2;
  const world:CreatureWorld={...base,get:(x,y,z)=>blocked(x,y,z)?Block.Stone:base.get(x,y,z),
    getState:(x,y,z)=>state(blocked(x,y,z)?Block.Stone:base.get(x,y,z))};
  const system=new CreatureSystem(world);system.configure(12);
  const stalker=system.spawnAt('dusk_stalker',0,60.51,-4)!;advance(system,5,0);
  expect(stalker.position.z).toBeGreaterThan(-1.5);
  expect(!(Math.abs(stalker.position.x)<.86&&Math.abs(stalker.position.z+2)<.86&&stalker.position.y<63)).toBe(true);
  system.dispose();
});
it('respects attack elevation and blocks ranged attacks with voxel cover',()=>{
  const empty=new CreatureSystem(flatWorld());empty.configure(4);let meleeHits=0;
  empty.onPlayerHit=()=>meleeHits++;empty.spawnAt('dusk_stalker',0,60.51,-1);
  const highPlayer=new THREE.Vector3(0,70.51,0);
  for(let t=0;t<2;t+=.05)empty.update(.05,highPlayer,0,true);
  expect(meleeHits).toBe(0);empty.dispose();
  const base=flatWorld(),wall=(x:number,y:number,z:number)=>Math.round(z)===-3&&Math.abs(Math.round(x))<=4&&y>=61&&y<=63;
  const world:CreatureWorld={...base,get:(x,y,z)=>wall(x,y,z)?Block.Stone:base.get(x,y,z),
    getState:(x,y,z)=>state(wall(x,y,z)?Block.Stone:base.get(x,y,z))};
  const covered=new CreatureSystem(world);covered.configure(5);let rangedHits=0;
  covered.onPlayerHit=()=>rangedHits++;covered.spawnAt('ember_spitter',0,60.51,-6);
  advance(covered,2,0);expect(rangedHits).toBe(0);expect(covered.projectiles.length).toBe(0);
  covered.dispose();
});
it('uses sword tiers and durability while armor reduces damage and wears down',()=>{
  const items=new GameItems();expect(meleeDamage(items)).toBe(2);
  items.equipment.set(3,stack('iron_sword'));expect(meleeDamage(items)).toBe(8.5);
  wearWeapon(items);expect(items.equipment.get(3).damage).toBe(1);
  items.equipment.set(1,stack('iron_helmet'));items.equipment.set(2,stack('iron_chestplate'));
  const taken=absorbCreatureDamage(items,10);expect(taken).toBeGreaterThan(0);expect(taken).toBeLessThan(10);
  expect(items.equipment.get(1).damage).toBe(1);expect(items.equipment.get(2).damage).toBe(1);
});
