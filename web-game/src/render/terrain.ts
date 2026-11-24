import * as THREE from 'three';
import { Block, isDecorative, isFluid, isShaped } from '../world/blocks';
import { ChunkData, HEIGHT, SIZE } from '../world/chunk';
import {atlasPixels,ATLAS_SIZE} from './palette';

export function terrainTexture(): THREE.DataTexture {
  const texture=new THREE.DataTexture(atlasPixels(),ATLAS_SIZE,ATLAS_SIZE,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.flipY=true; texture.needsUpdate=true;
  return texture;
}
type Buffer = { pos: number[]; normal: number[]; uv: number[]; color:number[]; index: number[] };
const buffer=(): Buffer => ({pos:[],normal:[],uv:[],color:[],index:[]});
const dirs: [number,number,number][] = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const corners: [number,number,number][][] = [
  [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
  [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],
  [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],
  [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],
  [[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]],
  [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]],
];
function emit(buf: Buffer, b: Block, origin: [number,number,number], offset: [number,number,number], size: [number,number,number], side: number, data?:ChunkData): void {
  const start=buf.pos.length/3, tile=b as number, tx=tile%8,ty=Math.floor(tile/8), edge=.001;
  const uv: [number,number][]=[[0,1],[0,0],[1,0],[1,1]];
  for(let i=0;i<4;i++) {
    const c=corners[side]![i]!, u=uv[i]!;
    buf.pos.push(origin[0]+offset[0]+c[0]*size[0],origin[1]+offset[1]+c[1]*size[1],origin[2]+offset[2]+c[2]*size[2]);
    buf.normal.push(...dirs[side]!);
    buf.uv.push((tx+edge+(1-2*edge)*u[0])/8,1-(ty+edge+(1-2*edge)*u[1])/8);
    let shade=1;
    if(data){
      const face=dirs[side]!,a=(side<2?1:0),d=(side>=4?1:2);
      const oa=[0,0,0],ob=[0,0,0],corner=corners[side]![i]!;
      oa[a]=corner[a]>0?1:-1;ob[d]=corner[d]>0?1:-1;
      const x=origin[0]+face[0],y=origin[1]+face[1],z=origin[2]+face[2];
      const solid=(dx:number,dy:number,dz:number)=>{const block=data.get(x+dx,y+dy,z+dz);return block!==Block.Air&&!isFluid(block)&&!isDecorative(block)&&block!==Block.Glass;};
      const sideA=solid(oa[0]!,oa[1]!,oa[2]!),sideB=solid(ob[0]!,ob[1]!,ob[2]!);
      const diagonal=solid(oa[0]!+ob[0]!,oa[1]!+ob[1]!,oa[2]!+ob[2]!);
      shade=1-(sideA&&sideB?3:Number(sideA)+Number(sideB)+Number(diagonal))*.16;
    }
    buf.color.push(shade,shade,shade);
  }
  buf.index.push(start,start+1,start+2,start,start+2,start+3);
}
function emitPlant(buf:Buffer,b:Block,x:number,y:number,z:number,height:number):void{
  const tile=b as number,tx=tile%8,ty=Math.floor(tile/8);
  const variation=(Math.imul(x+17,73856093)^Math.imul(z+31,19349663)^Math.imul(y+7,83492791))>>>0;
  const r=b===Block.Flower?.3:.34+(variation%5)*.015;
  const angle=((variation>>4)%9-4)*.065,cs=Math.cos(angle),sn=Math.sin(angle);
  const bottom=-.48,top=bottom+height*(b===Block.Plant?.88+(variation%7)*.025:b===Block.Flower?.94+(variation%5)*.015:1);
  const tint=.93+(variation%9)*.016,edge=.001;
  const planes:[number,number,number,number][]=[[-r,-r,r,r],[r,-r,-r,r]];
  for(const [startX,startZ,endX,endZ] of planes){
    const ax=startX*cs-startZ*sn,az=startX*sn+startZ*cs;
    const bx=endX*cs-endZ*sn,bz=endX*sn+endZ*cs;
    const vertices=[[ax,bottom,az],[ax,top,az],[bx,top,bz],[bx,bottom,bz]];
    const length=Math.hypot(az-bz,bx-ax),nx=(az-bz)/length,nz=(bx-ax)/length;
    for(let i=0;i<4;i++){
      const vertex=vertices[i]!,u=i>=2?1:0,v=i===0||i===3?1:0;
      buf.pos.push(x+vertex[0]!,y+vertex[1]!,z+vertex[2]!);
      buf.normal.push(nx,0,nz);
      buf.uv.push((tx+edge+(1-2*edge)*u)/8,1-(ty+edge+(1-2*edge)*v)/8);
      buf.color.push(tint,tint,tint);
    }
    const offset=buf.pos.length/3-4;
    buf.index.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
}
function exposed(b: Block,n: Block): boolean {
  if(isDecorative(b)) return true;
  if(isFluid(b))return n===Block.Air||isFluid(n)&&n!==b;
  if(b===Block.Glass) return n===Block.Air || n===Block.Water || n===Block.Leaves;
  if(n===Block.Air || isFluid(n) || isDecorative(n) || n===Block.Glass) return true;
  if(b===Block.Leaves) return n!==Block.Leaves;
  return n===Block.Leaves;
}
function makeGeometry(buf: Buffer): THREE.BufferGeometry {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(buf.pos,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(buf.normal,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(buf.uv,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(buf.color,3));
  geometry.setIndex(buf.index); return geometry;
}
export function buildChunkMesh(data: ChunkData, opaque: THREE.Material, transparent: THREE.Material, waterMaterial:THREE.Material=transparent, lavaMaterial:THREE.Material=transparent): THREE.Group {
  const solid=buffer(), alpha=buffer(),water=buffer(),lava=buffer();
  const box=(buf: Buffer,b: Block,x: number,y: number,z: number,off: [number,number,number],size: [number,number,number]) => {
    for(let s=0;s<6;s++) emit(buf,b,[x,y,z],off,size,s);
  };
  for(let z=0;z<SIZE;z++) for(let x=0;x<SIZE;x++) for(let y=0;y<HEIGHT;y++) {
    const state=data.getState(x,y,z),b=state.type;
    if(b===Block.Air) continue;
    const buf=b===Block.Water||b===Block.WaterFlow?water:b===Block.Lava||b===Block.LavaFlow?lava:b===Block.Glass||b===Block.RealmPortal?alpha:solid;
    if(isShaped(b)) {
      if(b===Block.Slab) box(buf,b,x,y,z,[0,(state.properties&4) ? .25 : -.25,0],[1,.5,1]);
      else if(b===Block.Bed) box(buf,b,x,y,z,[0,-.25,0],[1,.5,1]);
      else if([Block.Wire,Block.Plate,Block.Rail,Block.Farmland,Block.Repeater].includes(b))box(buf,b,x,y,z,[0,-.43,0],[1,.14,1]);
      else if(b===Block.WheatCrop||b===Block.BerryCrop)emitPlant(buf,b,x,y,z,.35+(state.properties&3)*.18);
      else if(b===Block.Switch||b===Block.Button)box(buf,b,x,y,z,[0,-.25,0],[.48,.5,.48]);
      else if(b===Block.Lamp||b===Block.Piston||b===Block.RealmPortal)box(buf,b===Block.Lamp&&(state.properties&16)?48 as Block:b,x,y,z,[0,0,0],[1,1,1]);
      else if(b===Block.Stairs) {
        box(buf,b,x,y,z,[0,-.25,0],[1,.5,1]);
        const facing=state.properties&3;
        box(buf,b,x,y,z,facing===1?[.25,.25,0]:facing===2?[0,.25,.25]:facing===3?[-.25,.25,0]:[0,.25,-.25],facing%2===0?[1,.5,.5]:[.5,.5,1]);
      } else if(b===Block.Door) {
        const facing=((state.properties&3)+(state.properties&8?1:0))&3;
        box(buf,b,x,y,z,[0,0,0],facing%2===0?[.18,1,1]:[1,1,.18]);
      } else if(b===Block.Fence) {
        box(buf,b,x,y,z,[0,0,0],[.25,1,.25]);
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) if(data.get(x+dx,y,z+dz)!==Block.Air) {
          for(const oy of [-.2,.2]) box(buf,b,x,y,z,[dx*.3,oy,dz*.3],dx!==0?[.6,.16,.16]:[.16,.16,.6]);
        }
      }
      continue;
    }
    if(isDecorative(b)) {
      if(b===Block.Plant||b===Block.Flower)emitPlant(buf,b,x,y,z,.85);
      else box(buf,b,x,y,z,[0,0,0],[.35,.6,.35]);
      continue;
    }
    if(b===Block.WaterFlow||b===Block.LavaFlow){const height=.92-Math.min(7,state.properties&7)*.08;
      box(buf,b,x,y,z,[0,(height-1)/2,0],[1,height,1]);continue;}
    for(let s=0;s<6;s++) {
      const d=dirs[s]!;
      if(!exposed(b,data.get(x+d[0],y+d[1],z+d[2]))) continue;
      const material=b===Block.Grass && s!==2 ? Block.GrassSide : b===Block.Snow && s!==2 ? Block.SnowSide :
        b===Block.Lamp&&(state.properties&16)?48 as Block:b;
      emit(buf,material,[x,y,z],[0,0,0],[1,1,1],s,data);
    }
  }
  const group=new THREE.Group(); group.position.set(data.cx*SIZE,0,data.cz*SIZE);
  if(solid.index.length) group.add(new THREE.Mesh(makeGeometry(solid),opaque));
  if(alpha.index.length) group.add(new THREE.Mesh(makeGeometry(alpha),transparent));
  if(water.index.length) group.add(new THREE.Mesh(makeGeometry(water),waterMaterial));
  if(lava.index.length) group.add(new THREE.Mesh(makeGeometry(lava),lavaMaterial));
  return group;
}
export function disposeChunk(group: THREE.Group): void {
  group.traverse(object=>{ if(object instanceof THREE.Mesh) object.geometry.dispose(); });
}
