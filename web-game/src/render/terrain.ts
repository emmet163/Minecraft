import * as THREE from 'three';
import { Block, isDecorative, isShaped } from '../world/blocks';
import { ChunkData, HEIGHT, SIZE } from '../world/chunk';

const colors = [
  '#ff00ff','#5d963e','#735039','#777b7f','#c9b47a','#d9e8ee','#4a5039','#356ba8',
  '#755037','#3b7739','#e47278','#5fa53d','#333438','#a9693c','#aaa192','#d5a339',
  '#705139','#777b7f','#777a73','#a7d8e8','#8d8d89','#7a5837','#87552e','#795338',
  '#90613b','#62666b','#9e6631','#78914d',
];
export function terrainTexture(): THREE.DataTexture {
  const pixels=new Uint8Array(128*64*4);
  for(let b=0;b<colors.length;b++) {
    const col=new THREE.Color(colors[b]!);
    for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
      const noise=((x*37+y*57+x*y*13)%17-8)/100;
      const base=b===Block.GrassSide && y<3 ? new THREE.Color(colors[Block.Grass]!) :
        b===Block.SnowSide && y<3 ? new THREE.Color(colors[Block.Snow]!) : col;
      const c=base.clone().offsetHSL(0,0,noise*.22).convertLinearToSRGB();
      const i=((Math.floor(b/8)*16+y)*128+(b%8)*16+x)*4;
      pixels[i]=Math.round(c.r*255); pixels[i+1]=Math.round(c.g*255);
      pixels[i+2]=Math.round(c.b*255); pixels[i+3]=255;
    }
  }
  const texture=new THREE.DataTexture(pixels,128,64,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.flipY=true; texture.needsUpdate=true;
  return texture;
}
type Buffer = { pos: number[]; normal: number[]; uv: number[]; index: number[] };
const buffer=(): Buffer => ({pos:[],normal:[],uv:[],index:[]});
const dirs: [number,number,number][] = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const corners: [number,number,number][][] = [
  [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
  [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],
  [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],
  [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],
  [[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]],
  [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]],
];
function emit(buf: Buffer, b: Block, origin: [number,number,number], offset: [number,number,number], size: [number,number,number], side: number): void {
  const start=buf.pos.length/3, tile=b as number, tx=tile%8,ty=Math.floor(tile/8), edge=.001;
  const uv: [number,number][]=[[0,1],[0,0],[1,0],[1,1]];
  for(let i=0;i<4;i++) {
    const c=corners[side]![i]!, u=uv[i]!;
    buf.pos.push(origin[0]+offset[0]+c[0]*size[0],origin[1]+offset[1]+c[1]*size[1],origin[2]+offset[2]+c[2]*size[2]);
    buf.normal.push(...dirs[side]!);
    buf.uv.push((tx+edge+(1-2*edge)*u[0])/8,1-(ty+edge+(1-2*edge)*u[1])/4);
  }
  buf.index.push(start,start+1,start+2,start,start+2,start+3);
}
function exposed(b: Block,n: Block): boolean {
  if(isDecorative(b)) return true;
  if(b===Block.Water) return n===Block.Air;
  if(b===Block.Glass) return n===Block.Air || n===Block.Water || n===Block.Leaves;
  if(n===Block.Air || n===Block.Water || isDecorative(n) || n===Block.Glass) return true;
  if(b===Block.Leaves) return n!==Block.Leaves;
  return n===Block.Leaves;
}
function makeGeometry(buf: Buffer): THREE.BufferGeometry {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(buf.pos,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(buf.normal,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(buf.uv,2));
  geometry.setIndex(buf.index); return geometry;
}
export function buildChunkMesh(data: ChunkData, opaque: THREE.Material, transparent: THREE.Material): THREE.Group {
  const solid=buffer(), alpha=buffer();
  const box=(buf: Buffer,b: Block,x: number,y: number,z: number,off: [number,number,number],size: [number,number,number]) => {
    for(let s=0;s<6;s++) emit(buf,b,[x,y,z],off,size,s);
  };
  for(let z=0;z<SIZE;z++) for(let x=0;x<SIZE;x++) for(let y=0;y<HEIGHT;y++) {
    const state=data.getState(x,y,z),b=state.type;
    if(b===Block.Air) continue;
    const buf=b===Block.Water || b===Block.Glass ? alpha : solid;
    if(isShaped(b)) {
      if(b===Block.Slab) box(buf,b,x,y,z,[0,(state.properties&4) ? .25 : -.25,0],[1,.5,1]);
      else if(b===Block.Bed) box(buf,b,x,y,z,[0,-.25,0],[1,.5,1]);
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
      box(buf,b,x,y,z,[0,0,0],[.35,.6,.35]);
      continue;
    }
    for(let s=0;s<6;s++) {
      const d=dirs[s]!;
      if(!exposed(b,data.get(x+d[0],y+d[1],z+d[2]))) continue;
      const material=b===Block.Grass && s!==2 ? Block.GrassSide : b===Block.Snow && s!==2 ? Block.SnowSide : b;
      emit(buf,material,[x,y,z],[0,0,0],[1,1,1],s);
    }
  }
  const group=new THREE.Group(); group.position.set(data.cx*SIZE,0,data.cz*SIZE);
  if(solid.index.length) group.add(new THREE.Mesh(makeGeometry(solid),opaque));
  if(alpha.index.length) group.add(new THREE.Mesh(makeGeometry(alpha),transparent));
  return group;
}
export function disposeChunk(group: THREE.Group): void {
  group.traverse(object=>{ if(object instanceof THREE.Mesh) object.geometry.dispose(); });
}
