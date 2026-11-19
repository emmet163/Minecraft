import {expect,it} from 'vitest';
import * as THREE from 'three';
import {Block,state} from '../world/blocks';
import {Biome} from '../world/generator';
import {catalog} from '../items/items';
import {CreatureSystem,creatureDefs,type CreatureWorld} from '../creatures/system';
import {creatureDetails,creatureMaterials} from '../creatures/visuals';

const world:CreatureWorld={get:(_x,y)=>y<=60?Block.Stone:Block.Air,
  getState:(_x,y)=>state(y<=60?Block.Stone:Block.Air),isLoaded:()=>true,
  generator:{surfaceHeight:()=>60,biomeAt:()=>Biome.Plains}};
const requested=['cow','pig','sheep','chicken','zombie','skeleton','creeper','spider'];

it('models all eight requested silhouettes with original pixel skins and bounded hitboxes',()=>{
  const system=new CreatureSystem(world);
  for(const id of requested){
    const def=creatureDefs.find(value=>value.id===id)!;
    expect(def).toBeDefined();expect(catalog.has(def.drop)).toBe(true);
    const c=system.spawnAt(id,0,60.51,0)!;
    expect(c.heads.length).toBeGreaterThan(0);
    expect(c.legs.length).toBe(id==='spider'?8:id==='chicken'||id==='zombie'||id==='skeleton'?2:4);
    expect(creatureDetails(id).length).toBeGreaterThan(0);
    const box=new THREE.Box3().setFromObject(c.group).translate(new THREE.Vector3(0,-60.51,0));
    expect(box.min.y).toBeGreaterThanOrEqual(-.02);
    expect(box.max.y).toBeLessThanOrEqual(def.height+.02);
    expect(Math.max(Math.abs(box.min.x),Math.abs(box.max.x),Math.abs(box.min.z),Math.abs(box.max.z))).toBeLessThanOrEqual(def.radius+.02);
    const material=creatureMaterials(id,1,def.parts[1]!.color,true);
    expect(material.map?.magFilter).toBe(THREE.NearestFilter);
    expect((material.map?.image as {data:Uint8Array}).data.length).toBe(16*3*16*2*4);
  }
  expect(creatureDefs.find(def=>def.id==='chicken')!.height).toBeLessThan(creatureDefs.find(def=>def.id==='cow')!.height*.7);
  expect(system.creatures.length).toBe(8);system.dispose();
});

it('animates chicken wings, spider legs, humanoid arms, grazing heads, and hurt/death feedback',()=>{
  const system=new CreatureSystem(world),player=new THREE.Vector3(0,60.51,0);
  const chicken=system.spawnAt('chicken',2,60.51,0)!,spider=system.spawnAt('spider',4,60.51,0)!;
  const zombie=system.spawnAt('zombie',0,60.51,-1.4)!,sheep=system.spawnAt('sheep',6,60.51,0)!;
  chicken.state='wander';spider.state='wander';sheep.state='graze';
  chicken.thinkClock=spider.thinkClock=sheep.thinkClock=1;
  system.update(.05,player,1,true,12);
  expect(chicken.wings.length).toBe(2);
  expect(chicken.wings.some(wing=>Math.abs(wing.rotation.z)>0)).toBe(true);
  expect(spider.legs.some(leg=>Math.abs(leg.rotation.y)>0)).toBe(true);
  expect(zombie.arms.length).toBe(2);
  expect(zombie.arms.every(arm=>arm.rotation.x>0)).toBe(true);
  expect(sheep.heads[0]!.rotation.x).toBeLessThan(0);
  expect(sheep.headDetails[0]!.rotation.x).toBeCloseTo(sheep.heads[0]!.rotation.x);
  system.hit(chicken,1,player);expect(chicken.state).toBe('flee');expect(chicken.hurtClock).toBeGreaterThan(0);
  system.hit(chicken,100,player);system.update(.05,player,1,true,12);
  expect(chicken.group.scale.x).toBeLessThan(1);
  system.dispose();
});

it('keeps spiders calm by day and hostile at night and gives skeletons ranged attacks',()=>{
  const system=new CreatureSystem(world),player=new THREE.Vector3(0,60.51,0);
  const spider=system.spawnAt('spider',0,60.51,-3)!;
  for(let t=0;t<.5;t+=.05)system.update(.05,player,1,true,12);
  expect(['chase','attack']).not.toContain(spider.state);
  for(let t=0;t<.5;t+=.05)system.update(.05,player,0,true,0);
  expect(['chase','attack']).toContain(spider.state);
  for(let t=0;t<.5;t+=.05)system.update(.05,player,0,true,0,'peaceful');
  expect(['chase','attack']).not.toContain(spider.state);
  system.clear();let hits=0;system.onPlayerHit=()=>hits++;
  const skeleton=system.spawnAt('skeleton',0,60.51,-5)!;
  for(let t=0;t<2;t+=.05)system.update(.05,player,0,true,0);
  expect(skeleton.arms.length).toBe(2);expect(hits).toBeGreaterThan(0);
  system.dispose();
});

it('warns before a Fuse Creeper burst and cancels the fuse when the player retreats',()=>{
  const system=new CreatureSystem(world),player=new THREE.Vector3(0,60.51,0);
  let bursts=0,hits=0,deaths=0;system.onExplosion=()=>bursts++;system.onPlayerHit=()=>hits++;system.onDeath=()=>deaths++;
  const creeper=system.spawnAt('creeper',0,60.51,-1.6)!;
  for(let t=0;t<.5;t+=.05)system.update(.05,player,0,true,0);
  expect(creeper.fuseClock).toBeGreaterThan(.3);expect(bursts).toBe(0);
  const far=new THREE.Vector3(20,60.51,0);
  for(let t=0;t<.4;t+=.05)system.update(.05,far,0,true,0);
  expect(creeper.fuseClock).toBe(0);
  for(let t=0;t<2;t+=.05)system.update(.05,player,0,true,0);
  expect(bursts).toBe(1);expect(hits).toBe(1);expect(deaths).toBe(0);
  expect(creeper.alive).toBe(false);system.dispose();
});

it('keeps shared creature textures alive until the last creature system is disposed',()=>{
  const first=new CreatureSystem(world),second=new CreatureSystem(world);
  const cow=second.spawnAt('cow',0,60.51,0)!;
  const material=cow.meshes[0]!.material as THREE.MeshLambertMaterial;
  let disposed=0;material.addEventListener('dispose',()=>disposed++);
  first.dispose();expect(disposed).toBe(0);
  second.dispose();expect(disposed).toBe(1);
});
