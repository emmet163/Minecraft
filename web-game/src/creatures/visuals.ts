import * as THREE from 'three';
import {cubeAtlasGeometry} from '../render/cubeAtlas';

// One six-face atlas and material per part keeps each cube to one draw call.
// Skins are original and deterministic; no external textures are included.
const SIZE=16,ATLAS_WIDTH=SIZE*3,ATLAS_HEIGHT=SIZE*2;
const skins=new Map<string,THREE.MeshLambertMaterial>();
const color=(hex:string)=>new THREE.Color(hex);
export const creatureBoxGeometry=()=>cubeAtlasGeometry(1);
function face(base:THREE.Color,seed:number,front:boolean,head:boolean,kind:string):Uint8Array{
  const data=new Uint8Array(SIZE*SIZE*4);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const n=(Math.imul(x+11,73856093)^Math.imul(y+7,19349663)^Math.imul(seed+17,83492791))>>>0;
    let shade=.79+(n%29)/100;
    if((x+y*3+seed)%11===0)shade*=.82;
    if(kind==='mossback'&&y<4&&n%5===0)shade*=1.22;
    if(kind==='crag_guardian'&&n%17===0)shade*=.67;
    let ink:THREE.Color|null=null;
    if(front&&head){
      const eyeY=kind==='mossback'?6:5;
      if(y>=eyeY&&y<eyeY+2&&(x>=4&&x<6||x>=10&&x<12))ink=color(kind==='dusk_stalker'?'#ffc176':kind==='veil_shade'?'#9af6ed':kind==='ember_spitter'?'#ffe19a':'#243e39').convertLinearToSRGB();
      if(y===10&&x>=6&&x<=9)ink=color(kind==='ember_spitter'?'#492d23':'#4c3b34').convertLinearToSRGB();
    }
    const c=ink||base,index=(y*SIZE+x)*4;
    data[index]=Math.round(Math.min(255,c.r*255*shade));data[index+1]=Math.round(Math.min(255,c.g*255*shade));
    data[index+2]=Math.round(Math.min(255,c.b*255*shade));data[index+3]=255;
  }
  return data;
}
export function creatureMaterials(kind:string,part:number,hex:string,head:boolean):THREE.MeshLambertMaterial{
  const key=`${kind}:${part}:${hex}:${head}`;let result=skins.get(key);if(result)return result;
  const base=color(hex).convertLinearToSRGB();
  const pixels=new Uint8Array(ATLAS_WIDTH*ATLAS_HEIGHT*4);
  // BoxGeometry order: right, left, top, bottom, back, front (-Z).
  for(let side=0;side<6;side++){
    const tile=face(base,part*13+side,side===5,head,kind),tileX=side%3,tileY=Math.floor(side/3);
    for(let y=0;y<SIZE;y++)pixels.set(tile.subarray(y*SIZE*4,(y+1)*SIZE*4),((tileY*SIZE+y)*ATLAS_WIDTH+tileX*SIZE)*4);
  }
  const texture=new THREE.DataTexture(pixels,ATLAS_WIDTH,ATLAS_HEIGHT,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  result=new THREE.MeshLambertMaterial({map:texture});
  skins.set(key,result);return result;
}
export function disposeCreatureSkins():void{
  for(const material of skins.values()){material.map?.dispose();material.dispose();}
  skins.clear();
}
export interface DetailPart{size:[number,number,number];offset:[number,number,number];color:string}
export function creatureDetails(kind:string):DetailPart[]{
  const detail=(size:DetailPart['size'],offset:DetailPart['offset'],color:string):DetailPart=>({size,offset,color});
  switch(kind){
    case 'mossback':return [detail([.25,.15,.23],[-.36,1.37,-.1],'#315d40'),detail([.25,.15,.23],[.36,1.37,.15],'#315d40'),
      detail([.12,.18,.12],[-.18,1.52,-.53],'#d2c998'),detail([.12,.18,.12],[.18,1.52,-.53],'#d2c998')];
    case 'crag_guardian':return [detail([.18,.25,.18],[-.27,1.91,-.09],'#59716d'),detail([.18,.25,.18],[.27,1.91,-.09],'#59716d'),
      detail([.16,.32,.3],[-.59,1.17,0],'#9db2a0'),detail([.16,.32,.3],[.59,1.17,0],'#9db2a0')];
    case 'dusk_stalker':return [detail([.14,.57,.19],[-.47,1.02,-.03],'#413951'),detail([.14,.57,.19],[.47,1.02,-.03],'#413951'),
      detail([.15,.13,.21],[-.47,.68,-.12],'#b2a18d'),detail([.15,.13,.21],[.47,.68,-.12],'#b2a18d')];
    case 'ember_spitter':return [detail([.22,.12,.22],[-.26,1.27,-.45],'#eabb72'),detail([.22,.12,.22],[.26,1.27,-.45],'#eabb72'),
      detail([.26,.2,.18],[0,1,-.71],'#734237')];
    case 'hearthfolk':return [detail([.56,.1,.5],[0,1.88,0],'#4e533e'),detail([.4,.08,.5],[0,.83,-.24],'#bd9571')];
    case 'veil_shade':return [detail([.17,.24,.17],[-.23,1.92,-.04],'#b38ad0'),detail([.17,.24,.17],[.23,1.92,-.04],'#b38ad0'),
      detail([.12,.58,.17],[-.4,1.01,0],'#4b3867'),detail([.12,.58,.17],[.4,1.01,0],'#4b3867')];
    default:return [];
  }
}
