import {expect,it} from 'vitest';
import * as THREE from 'three';
import {Block,dropType,state} from '../world/blocks';
import {GameItems,blockItem,itemBlock,stack} from '../items/items';
import {DropVisuals,dropFaceTiles,visualBlockForItem} from '../render/drops';
import {CreatureSystem,creatureDefs,type CreatureWorld} from '../creatures/system';
import {Biome} from '../world/generator';
import {creatureMaterials} from '../creatures/visuals';
import {atlasPixels,ATLAS_SIZE,ATLAS_TILES,TILE} from '../render/palette';

const world:CreatureWorld={get:(_x,y)=>y<=60?Block.Stone:Block.Air,getState:(_x,y)=>state(y<=60?Block.Stone:Block.Air),
  isLoaded:()=>true,generator:{surfaceHeight:()=>60,biomeAt:()=>Biome.Plains}};
const pixels=(material:THREE.MeshLambertMaterial,face:number)=>{
  const source=(material.map!.image as {data:Uint8Array}).data,result=new Uint8Array(TILE*TILE*4);
  const column=face%3,row=Math.floor(face/3);
  for(let y=0;y<TILE;y++)result.set(source.subarray(((row*TILE+y)*TILE*3+column*TILE)*4,
    ((row*TILE+y)*TILE*3+(column+1)*TILE)*4),y*TILE*4);
  return result;
};
const palette=atlasPixels();
const paletteTile=(block:Block)=>{const result=new Uint8Array(TILE*TILE*4);
  const column=block%ATLAS_TILES,row=Math.floor(block/ATLAS_TILES);
  for(let y=0;y<TILE;y++)result.set(palette.subarray(((row*TILE+y)*ATLAS_SIZE+column*TILE)*4,
    ((row*TILE+y)*ATLAS_SIZE+(column+1)*TILE)*4),y*TILE*4);
  return result;
};

it('renders distinct original textured models within their hitbox widths and heights',()=>{
  const system=new CreatureSystem(world);
  for(const def of creatureDefs){const c=system.spawnAt(def.id,0,60.51,0)!;
    expect(c).toBeDefined();expect(c.group.children.length).toBeGreaterThan(def.parts.length);
    const bounds=new THREE.Box3().setFromObject(c.group).translate(new THREE.Vector3(0,-60.51,0));
    expect(bounds.max.y).toBeLessThanOrEqual(def.height+.02);
    expect(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z))).toBeLessThanOrEqual(def.radius+.02);
    expect(c.meshes[1]!.material).toHaveProperty('map');
  }
  system.dispose();
});
it('turns toward movement and blends stride, head, attack, hurt, and death feedback',()=>{
  const system=new CreatureSystem(world),c=system.spawnAt('mossback',0,60.51,3)!;
  c.heading=0;c.state='wander';c.thinkClock=1;system.update(.05,new THREE.Vector3(0,60.51,0),1,false);
  expect(Math.abs(c.group.rotation.y)).toBeGreaterThan(0);
  expect(c.legs.some(leg=>Math.abs(leg.rotation.x)>0)).toBe(true);
  const first=c.legs[0]!.rotation.x;c.state='idle';system.update(.05,new THREE.Vector3(0,60.51,0),1,false);
  expect(Math.abs(c.legs[0]!.rotation.x)).toBeLessThan(Math.abs(first));
  system.hit(c,100,new THREE.Vector3(0,60.51,0));expect(c.hurtClock).toBeGreaterThan(0);
  system.update(.05,new THREE.Vector3(0,60.51,0),1,false);expect(c.group.scale.x).toBeLessThan(1);
  system.dispose();
});
it('accepts external model factories with normalized placement and keeps creature AI data',()=>{
  const system=new CreatureSystem(world);
  system.registerModel('mossback',()=>new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial()));
  const c=system.spawnAt('mossback',0,60.51,0)!;
  expect(c.group.children.slice(0,-1).every(part=>!part.visible)).toBe(true);
  const bounds=new THREE.Box3().setFromObject(c.group).translate(new THREE.Vector3(0,-60.51,0));
  expect(bounds.min.y).toBeCloseTo(0);expect(bounds.max.y).toBeLessThanOrEqual(c.def.height+.01);
  expect(c.def.drop).toBe('berries');system.dispose();
});
it('uses the block registry and atlas faces for drops and preserves item identity',()=>{
  expect(blockItem(dropType(Block.Grass))).toBe('dirt');
  expect(dropFaceTiles(Block.Grass)).toEqual([Block.GrassSide,Block.Grass,Block.Dirt]);
  expect(dropFaceTiles(Block.Snow)).toEqual([Block.SnowSide,Block.Snow,Block.Dirt]);
  const visuals=new DropVisuals();
  for(const id of ['dirt','wood','stone','glass','grass']){
    const block=visualBlockForItem(id),faces=dropFaceTiles(block),mesh=visuals.create(id);
    expect(mesh.geometry).toBe(visuals.geometry);
    const material=mesh.material as THREE.MeshLambertMaterial;
    expect(mesh.geometry.groups).toHaveLength(0);
    expect(pixels(material,0)).toEqual(paletteTile(faces[0]));
    expect(pixels(material,2)).toEqual(paletteTile(faces[1]));
    expect(pixels(material,3)).toEqual(paletteTile(faces[2]));
    if(id==='grass')expect(pixels(material,2)).not.toEqual(pixels(material,0));
    if(id==='glass')expect(material.transparent).toBe(true);
    expect(faces[1]).toBe(block===Block.Grass?Block.Grass:block);
    const inventory=new GameItems();inventory.slots.set(0,stack(id));expect(itemBlock(inventory.slots.get(0).id)).toBe(block);
  }
  expect(creatureMaterials('mossback',1,'#a5b584',true).map).toBeTruthy();
  visuals.dispose();
});
