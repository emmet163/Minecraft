import {expect,it} from 'vitest';
import * as THREE from 'three';
import {Block,state,type BlockState} from '../world/blocks';
import {FluidSystem} from '../world/fluids';
import {AutomationSystem} from '../world/automation';
import {FarmingSystem} from '../world/farming';
import {VehicleSystem} from '../gameplay/transport';
import {EffectSystem} from '../gameplay/effects';
import {WorldGenerator,Biome} from '../world/generator';
import {CreatureSystem,type CreatureWorld} from '../creatures/system';
import {VoxelWorld} from '../world/world';
import {MemoryEditStore,type Edit} from '../persistence/edits';
import {InventoryGrid,craft,recipes,catalog,stack} from '../items/items';
import {traceBlocks} from '../world/raycast';

class Grid{
  cells=new Map<string,BlockState>();loadedX=32;onChange:(edits:Edit[])=>void=()=>{};
  key(x:number,y:number,z:number){return `${x},${y},${z}`;}
  getState(x:number,y:number,z:number){return this.cells.get(this.key(x,y,z))||state(y===0?Block.Stone:Block.Air);}
  get(x:number,y:number,z:number){return this.getState(x,y,z).type;}
  isLoaded(x:number){return x<this.loadedX;}
  async apply(edits:Edit[]){if(edits.some(e=>!this.isLoaded(e.x)))return false;
    for(const {x,y,z,state:s} of edits)this.cells.set(this.key(x,y,z),s);this.onChange(edits);return true;}
}
async function steps(system:{tick(delta:number,...args:any[]):void},count=30,...args:any[]){for(let i=0;i<count;i++){system.tick(.2,...args);await new Promise(resolve=>setTimeout(resolve,0));}}
it('flows water across a newly loaded chunk, displaces lava, and drains after source removal',async()=>{
  const world=new Grid();world.loadedX=16;const fluid=new FluidSystem(world);world.onChange=e=>fluid.changed(e);
  await world.apply([{x:15,y:3,z:0,state:state(Block.Water)}]);await steps(fluid,12);
  expect(world.get(14,3,0)).toBe(Block.WaterFlow);expect(world.get(16,3,0)).toBe(Block.Air);
  world.loadedX=32;fluid.chunkInstalled(1,0);await steps(fluid,12);
  expect(world.get(16,3,0)).toBe(Block.WaterFlow);
  await world.apply([{x:17,y:3,z:0,state:state(Block.Lava)}]);await steps(fluid,18);
  expect(world.get(17,3,0)).toBe(Block.Stone);
  await world.apply([{x:15,y:3,z:0,state:state(Block.Air)}]);await steps(fluid,160);
  expect(world.get(15,3,0)).toBe(Block.Air);
});
it('propagates and removes signal through wire, powers a lamp and pushes one block',async()=>{
  const world=new Grid(),circuit=new AutomationSystem(world);world.onChange=e=>circuit.changed(e);
  await world.apply([{x:0,y:1,z:0,state:state(Block.Switch)},{x:1,y:1,z:0,state:state(Block.Wire)},
    {x:2,y:1,z:0,state:state(Block.Wire)},{x:3,y:1,z:0,state:state(Block.Lamp)},
    {x:1,y:1,z:2,state:state(Block.Piston,1)},{x:2,y:1,z:2,state:state(Block.Stone)},
    {x:0,y:1,z:2,state:state(Block.Switch)}]);
  expect(await circuit.toggle(0,1,0)).toBe(true);expect(await circuit.toggle(0,1,2)).toBe(true);
  await steps(circuit,35);
  expect(world.getState(1,1,0).properties&15).toBeGreaterThan(0);
  expect(world.getState(3,1,0).properties&16).toBe(16);
  expect(world.get(3,1,2)).toBe(Block.Stone);
  await circuit.toggle(0,1,0);await steps(circuit,60);
  expect(world.getState(3,1,0).properties&16).toBe(0);
});
it('pulses buttons through repeaters, senses pressure plates, and automates both door halves',async()=>{
  const world=new Grid(),circuit=new AutomationSystem(world);world.onChange=e=>circuit.changed(e);
  await world.apply([{x:0,y:1,z:0,state:state(Block.Button)},{x:1,y:1,z:0,state:state(Block.Repeater,1)},
    {x:2,y:1,z:0,state:state(Block.Lamp)},
    {x:0,y:1,z:3,state:state(Block.Plate)},{x:1,y:1,z:3,state:state(Block.Lamp)},
    {x:0,y:1,z:5,state:state(Block.Switch)},
    {x:1,y:1,z:5,state:state(Block.Door,1)},{x:1,y:2,z:5,state:state(Block.Door,5)}]);
  await circuit.toggle(0,1,0);await steps(circuit,4);
  expect(world.getState(2,1,0).properties&16).toBe(16);
  await steps(circuit,20);expect(world.getState(2,1,0).properties&16).toBe(0);
  await steps(circuit,4,{x:0,y:1,z:3});expect(world.getState(1,1,3).properties&16).toBe(16);
  await steps(circuit,4,{x:8,y:1,z:8});expect(world.getState(1,1,3).properties&16).toBe(0);
  await circuit.toggle(0,1,5);await steps(circuit,10);
  expect(world.getState(1,1,5).properties&8).toBe(8);
  expect(world.getState(1,2,5).properties&8).toBe(8);
  await circuit.toggle(0,1,5);await steps(circuit,10);
  expect(world.getState(1,1,5).properties&8).toBe(0);
});
it('irrigates soil and advances both crop varieties through persisted block stages',async()=>{
  const world=new Grid(),farm=new FarmingSystem(world);world.onChange=e=>farm.changed(e);
  await world.apply([{x:4,y:1,z:0,state:state(Block.Water)},
    {x:0,y:1,z:0,state:state(Block.Farmland)},{x:0,y:2,z:0,state:state(Block.WheatCrop)},
    {x:1,y:1,z:0,state:state(Block.Farmland)},{x:1,y:2,z:0,state:state(Block.BerryCrop)}]);
  for(let i=0;i<5;i++){farm.tick(8);await Promise.resolve();await Promise.resolve();}
  expect(world.getState(0,1,0).properties&1).toBe(1);
  expect(world.getState(0,2,0).properties&3).toBe(3);
  expect(world.getState(1,2,0).properties&3).toBe(3);
});
it('mounts rail and water vehicles and restores them from a save',()=>{
  const world=new Grid();for(let x=0;x<8;x++)world.cells.set(world.key(x,1,0),state(Block.Rail));
  for(let x=0;x<8;x++)world.cells.set(world.key(x,1,5),state(Block.Water));
  expect(traceBlocks(world,new THREE.Vector3(0,3,5),new THREE.Vector3(0,-1,0),6,true)?.state.type).toBe(Block.Water);
  const vehicles=new VehicleSystem(world);expect(vehicles.place('cart',0,1,0)).toBe(true);
  expect(vehicles.place('boat',0,1,5)).toBe(true);
  const position=new THREE.Vector3(0,1.5,0);expect(vehicles.toggleMount(position)).toBe(true);
  const before=position.x;vehicles.tick(.2,new Set(['KeyW']),-Math.PI/2,position);expect(position.x).toBeGreaterThan(before);
  expect(vehicles.toggleMount(position)).toBe(false);position.set(0,1.5,5);
  expect(vehicles.toggleMount(position)).toBe(true);const boatBefore=position.x;
  vehicles.tick(.2,new Set(['KeyW']),-Math.PI/2,position);expect(position.x).toBeGreaterThan(boatBefore);
  const save=vehicles.snapshot(),restored=new VehicleSystem(world);restored.load(save);
  expect(restored.vehicles).toEqual(save.vehicles);expect(restored.mounted).toBe(save.mounted);
  vehicles.dispose();restored.dispose();
});
it('persists effects and keeps Veil terrain edits separate from the Overworld',async()=>{
  const effects=new EffectSystem();expect(effects.use('swift_tonic')).toBe(true);effects.use('guard_tonic');
  const restored=new EffectSystem();restored.load(effects.snapshot());expect(restored.reduceDamage(10)).toBe(6);
  const veil=new WorldGenerator(12345,'veil'),normal=new WorldGenerator(12345);
  expect(veil.generate(0,0).blocks).not.toEqual(normal.generate(0,0).blocks);
  const world=new VoxelWorld(new MemoryEditStore(),false);await world.configure(12345,2,0,0,'veil');
  const y=veil.surfaceHeight(0,0)+1;expect(await world.apply([{x:0,y,z:0,state:state(Block.Crystal)}])).toBe(true);
  await world.configure(12345,2,0,0,'overworld');expect(world.get(0,y,0)).not.toBe(Block.Crystal);
  await world.configure(12345,2,0,0,'veil');expect(world.get(0,y,0)).toBe(Block.Crystal);world.dispose();
});
it('rejects a stale simulation edit instead of overwriting a newer player block',async()=>{
  const world=new VoxelWorld(new MemoryEditStore(),false);await world.configure(737,2,0,0);
  const y=world.generator.surfaceHeight(0,0)+3,cell={x:0,y,z:0};
  const before=world.getState(cell.x,cell.y,cell.z);
  expect(await world.apply([{...cell,state:state(Block.Lava)}])).toBe(true);
  expect(await world.apply([{...cell,state:state(Block.WaterFlow,2)}],[before])).toBe(false);
  expect(world.get(cell.x,cell.y,cell.z)).toBe(Block.Lava);world.dispose();
});
it('breeds peaceful animals with a cooldown and spawns Veil-specific enemies',()=>{
  const world:CreatureWorld={get:(_x,y)=>y<=60?Block.Stone:Block.Air,
    getState:(_x,y)=>state(y<=60?Block.Stone:Block.Air),isLoaded:()=>true,
    generator:{surfaceHeight:()=>60,biomeAt:()=>Biome.Mountains,realm:'veil'}};
  const creatures=new CreatureSystem(world);creatures.configure(82);
  const parent=creatures.spawnAt('mossback',0,60.51,0)!;
  expect(creatures.breed(parent)).toBeTruthy();expect(creatures.breed(parent)).toBeUndefined();
  for(let i=0;i<80;i++)creatures.update(.05,new THREE.Vector3(0,60.51,0),1,false);
  expect(creatures.creatures.some(c=>c.def.id==='veil_shade')).toBe(true);
  creatures.dispose();
});
it('registers valid Phase 8 recipes and crafts an upgraded sword',()=>{
  for(const recipe of recipes){expect(catalog.has(recipe.output),recipe.id).toBe(true);
    for(const input of recipe.inputs)if(input)expect(catalog.has(input),recipe.id).toBe(true);}
  const grid=new InventoryGrid(9),bag=new InventoryGrid(36);
  grid.set(0,stack('iron_sword'));grid.set(1,stack('sunstone'));grid.set(2,stack('crystal'));
  expect(craft(grid,3,true,bag)?.output).toBe('sunsteel_sword');
  expect(bag.count('sunsteel_sword')).toBe(1);expect(grid.count('sunstone')).toBe(0);
});
