import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {atlasPixels,ATLAS_SIZE} from '../render/palette';
import {terrainTexture,buildChunkMesh,disposeChunk} from '../render/terrain';
import {parseQuality,qualityPreset} from '../render/quality';
import {audioLevel} from '../render/sounds';
import {BurstParticles} from '../render/particles';
import {ChunkData} from '../world/chunk';
import {Block} from '../world/blocks';

describe('Phase 9 visuals and controls',()=>{
  it('generates a deterministic original atlas with distinct block tiles',()=>{
    const a=atlasPixels(),b=atlasPixels();expect(a).toEqual(b);expect(a.length).toBe(ATLAS_SIZE*ATLAS_SIZE*4);
    const tile=(id:number)=>{const i=((Math.floor(id/8)*32+15)*ATLAS_SIZE+(id%8)*32+15)*4;return [...a.slice(i,i+3)];};
    expect(tile(Block.Grass)).not.toEqual(tile(Block.Stone));expect(tile(Block.Water)).not.toEqual(tile(Block.Lava));
    expect(a.every((value,index)=>index%4!==3||value===255)).toBe(true);
    const texture=terrainTexture();expect(texture.image.width).toBe(256);expect(texture.image.height).toBe(256);texture.dispose();
  });
  it('applies ambient shading and routes water to its own material',()=>{
    const chunk=new ChunkData(0,0);chunk.set(2,2,2,Block.Stone);chunk.set(3,3,2,Block.Stone);chunk.set(4,2,2,Block.Water);
    const opaque=new THREE.MeshBasicMaterial({vertexColors:true}),glass=new THREE.MeshBasicMaterial({vertexColors:true});
    const water=new THREE.MeshBasicMaterial({vertexColors:true}),lava=new THREE.MeshBasicMaterial({vertexColors:true});
    const group=buildChunkMesh(chunk,opaque,glass,water,lava),meshes=group.children as THREE.Mesh[];
    expect(meshes.some(mesh=>mesh.material===water)).toBe(true);
    const solid=meshes.find(mesh=>mesh.material===opaque)!;
    const colors=solid.geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(colors.count).toBe(solid.geometry.getAttribute('position').count);
    expect(Array.from(colors.array).some(value=>value<1)).toBe(true);
    disposeChunk(group);opaque.dispose();glass.dispose();water.dispose();lava.dispose();
  });
  it('bounds graphics, audio, and pooled burst work',()=>{
    expect(parseQuality('bogus')).toBe('low');expect(qualityPreset('low').shadows).toBe(false);
    expect(qualityPreset('high').shadowSize).toBe(2048);expect(audioLevel(-1)).toBe(0);
    expect(audioLevel(3)).toBe(1);expect(audioLevel(undefined)).toBe(0);
    const particles=new BurstParticles();particles.burst(new THREE.Vector3(),90);particles.update(.016);
    expect(particles.mesh.count).toBeLessThanOrEqual(48);particles.update(1);expect(particles.mesh.count).toBe(0);particles.dispose();
  });
});
