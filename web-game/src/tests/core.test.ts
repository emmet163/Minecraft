import { describe,expect,it } from 'vitest';
import * as THREE from 'three';
import { Block, floorDiv, miningSeconds, state } from '../world/blocks';
import { WorldGenerator, Biome } from '../world/generator';
import { ChunkData } from '../world/chunk';
import { buildChunkMesh,disposeChunk,terrainTexture } from '../render/terrain';
import { MemoryEditStore, type EditStore } from '../persistence/edits';
import { VoxelWorld } from '../world/world';
import { traceBlocks } from '../world/raycast';
import { PlayerController } from '../player/controller';

describe('seeded terrain migration',()=>{
  it('finds a playable spawn for the default seed',async()=>{
    const world=new VoxelWorld(new MemoryEditStore(),false);
    await world.configure(12345,2);
    const spawn=world.spawn();
    expect(spawn.y).toBeGreaterThan(44);
    const data=world.generator.generate(floorDiv(spawn.x,16),floorDiv(spawn.z,16));
    for(let z=spawn.z-1;z<=spawn.z+1;z++)for(let x=spawn.x-1;x<=spawn.x+1;x++)
      for(let y=spawn.y-2;y<=spawn.y;y++)expect([Block.Wood,Block.Leaves]).not.toContain(data.world(x,y,z));
    world.dispose();
  });
  it('repeats generation and connects negative chunk borders',()=>{
    const gen=new WorldGenerator(741852);
    const a=gen.generate(-1,0), b=gen.generate(0,0), revisit=gen.generate(-1,0);
    expect(a.blocks).toEqual(revisit.blocks);
    for(let z=0;z<16;z++) for(let y=0;y<96;y++) {
      expect(a.get(16,y,z)).toBe(b.get(0,y,z));
      expect(b.get(-1,y,z)).toBe(a.get(15,y,z));
    }
    expect(floorDiv(-1,16)).toBe(-1);
    expect(new WorldGenerator(741853).generate(-1,0).blocks).not.toEqual(a.blocks);
    let caves=0,ores=0;
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){
      const h=gen.surfaceHeight(x,z);
      expect(Math.abs(h-gen.surfaceHeight(x+1,z))).toBeLessThanOrEqual(8);
      expect(Math.abs(h-gen.surfaceHeight(x,z+1))).toBeLessThanOrEqual(8);
      for(let y=6;y<h-5;y++){
        if(b.get(x,y,z)===Block.Air)caves++;
        if([Block.Coal,Block.Copper,Block.Iron,Block.Gold].includes(b.get(x,y,z)))ores++;
      }
    }
    expect(caves).toBeGreaterThan(0);expect(ores).toBeGreaterThan(0);
    const biomes=new Set<Biome>();
    for(let z=-3000;z<=3000;z+=120)for(let x=-3000;x<=3000;x+=120)biomes.add(gen.biomeAt(x,z));
    expect(biomes.size).toBe(8);
  });
  it('keeps meshed hidden faces culled and resources disposable',()=>{
    const chunk=new ChunkData(0,0);
    chunk.set(0,10,0,Block.Stone);chunk.set(1,10,0,Block.Stone);
    const texture=terrainTexture(),material=new THREE.MeshBasicMaterial({map:texture});
    const mesh=buildChunkMesh(chunk,material,material);
    const geometry=(mesh.children[0] as THREE.Mesh).geometry;
    expect(geometry.index!.count).toBe(60); // ten exposed faces
    disposeChunk(mesh);material.dispose();texture.dispose();
  });
});
describe('block interactions',()=>{
  it('targets centered cells at negative coordinates with correct placement face',()=>{
    const world={getState:(x:number,y:number,z:number)=>x===-1&&y===3&&z===-2?state(Block.Stone):state(Block.Air)};
    const hit=traceBlocks(world,new THREE.Vector3(-1,3,0),new THREE.Vector3(0,0,-1));
    expect([hit?.x,hit?.y,hit?.z]).toEqual([-1,3,-2]);
    expect(hit?.normal.toArray()).toEqual([0,0,1]);
    const slab={getState:(x:number,y:number,z:number)=>x===0&&y===0&&z===-2?state(Block.Slab):state(Block.Air)};
    expect(traceBlocks(slab,new THREE.Vector3(0,.35,0),new THREE.Vector3(0,0,-1))).toBeNull();
    expect(traceBlocks(slab,new THREE.Vector3(0,-.3,0),new THREE.Vector3(0,0,-1))?.state.type).toBe(Block.Slab);
  });
  it('persists edits across unload and reload, including chunk-border padding',async()=>{
    const store=new MemoryEditStore(),world=new VoxelWorld(store,false);
    await world.configure(555,2,-1,0);
    expect(world.isLoaded(-1,0)).toBe(true);
    expect(await world.apply([{x:-1,y:60,z:0,state:state(Block.Glass)}])).toBe(true);
    expect(world.get(-1,60,0)).toBe(Block.Glass);
    await world.configure(555,2,-1,0);
    expect(world.get(-1,60,0)).toBe(Block.Glass);
    world.update(0,0,.016);
    expect(world.get(0,60,0)).toBeDefined();
    const adjacent=(world as unknown as {chunks:Map<string,{data:ChunkData}>}).chunks.get('0,0')!.data;
    expect(adjacent.get(-1,60,0)).toBe(Block.Glass);
    world.update(160,0,.016);
    expect(world.isLoaded(-1,0)).toBe(false);
    world.update(-1,0,.016);
    expect(world.get(-1,60,0)).toBe(Block.Glass);
    expect(miningSeconds(Block.Stone,'pickaxe')).toBeLessThan(miningSeconds(Block.Stone,'hand'));
    world.dispose();
  });
  it('ignores an old seed load that finishes after a newer configuration',async()=>{
    let release:()=>void=()=>{};
    const held=new Promise<void>(resolve=>{release=resolve;});
    const store:EditStore={load:async seed=>{if(seed===1)await held;return [];},putMany:async()=>{}};
    const world=new VoxelWorld(store,false);
    const old=world.configure(1,2);
    await world.configure(2,2);
    release();await old;
    expect(world.seed).toBe(2);expect(world.loadedCount).toBe(1);
    world.dispose();
  });
  it('blocks movement through stone and permits a jump from the floor',()=>{
    const world={isLoaded:()=>true,get:(x:number,y:number,z:number)=>y===0||x===2&&y===1?Block.Stone:Block.Air};
    const player=new PlayerController(world);
    player.position.set(0,.5,0);
    player.keys.add('KeyD');
    for(let i=0;i<60;i++)player.update(1/60);
    expect(player.position.x).toBeLessThan(1.2);
    expect(player.grounded).toBe(true);
    player.keys.delete('KeyD');player.keys.add('Space');player.update(1/60);
    expect(player.velocity.y).toBeGreaterThan(0);
  });
});
