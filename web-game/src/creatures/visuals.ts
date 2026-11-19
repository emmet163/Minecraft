import * as THREE from 'three';
import {cubeAtlasGeometry} from '../render/cubeAtlas';

// Animated parts use shared six-face atlases; small static details share one mesh.
// Skins are original and deterministic; no external textures are included.
const SIZE=16,ATLAS_WIDTH=SIZE*3,ATLAS_HEIGHT=SIZE*2;
const skins=new Map<string,THREE.MeshLambertMaterial>();
const detailsGeometry=new Map<string,THREE.BufferGeometry>();
const absentDetails=new Set<string>();
let detailsMaterial:THREE.MeshLambertMaterial|undefined;
let skinUsers=0;
export function retainCreatureSkins():void{skinUsers++;}
const color=(hex:string)=>new THREE.Color(hex);
export const creatureBoxGeometry=()=>cubeAtlasGeometry(1);
function face(base:THREE.Color,seed:number,front:boolean,head:boolean,kind:string):Uint8Array{
  const data=new Uint8Array(SIZE*SIZE*4);
  const part=Math.floor(seed/13),eye=color('#25333a').convertLinearToSRGB();
  const boneShadow=color('#484a47').convertLinearToSRGB();
  const emberEye=color('#e8a861').convertLinearToSRGB();
  const spiderEye=color('#d66d73').convertLinearToSRGB();
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const n=(Math.imul(x+11,73856093)^Math.imul(y+7,19349663)^Math.imul(seed+17,83492791))>>>0;
    let shade=.79+(n%29)/100;
    if((x+y*3+seed)%11===0)shade*=.82;
    if(kind==='mossback'&&y<4&&n%5===0)shade*=1.22;
    if(kind==='crag_guardian'&&n%17===0)shade*=.67;
    let ink:THREE.Color|null=null;
    if(kind==='cow'&&part===0&&((Math.floor(x/4)*11+Math.floor(y/3)*7+seed*3)%9)<3)ink=boneShadow;
    if(kind==='pig'&&part===0&&n%13===0)shade*=.82;
    if(kind==='sheep'&&part===0)shade*=.92+((x>>2)+(y>>2))%3*.045;
    if(kind==='chicken'&&part===0&&x%5===0&&y%4===0)shade*=.88;
    if(kind==='zombie'&&part===0&&((x+seed)%7===0||y===12&&x>3&&x<12))shade*=.72;
    if(kind==='skeleton'&&part===0&&(y===4||y===8||y===12)&&x>2&&x<13)ink=boneShadow;
    if(kind==='creeper'&&n%7<2)shade*=.65;
    if(kind==='spider'&&n%11<2)shade*=.72;
    if(front&&head){
      const eyeY=kind==='mossback'?6:5;
      if(y>=eyeY&&y<eyeY+2&&(x>=4&&x<6||x>=10&&x<12))ink=
        kind==='dusk_stalker'||kind==='creeper'?emberEye:kind==='spider'?spiderEye:kind==='skeleton'?boneShadow:
        kind==='veil_shade'?color('#9af6ed').convertLinearToSRGB():kind==='ember_spitter'?color('#ffe19a').convertLinearToSRGB():eye;
      if(kind==='spider'&&y>=7&&y<=8&&(x>=2&&x<=3||x>=12&&x<=13))ink=spiderEye;
      if(kind==='creeper'&&y>=10&&y<=12&&Math.abs(x-8)<=1+(y===11?1:0))ink=boneShadow;
      if(kind==='skeleton'&&y===11&&x>=6&&x<=9)ink=boneShadow;
      if(kind==='zombie'&&y===11&&x>=6&&x<=9)ink=boneShadow;
      if(!['creeper','skeleton','zombie','spider'].includes(kind)&&y===10&&x>=6&&x<=9)
        ink=color(kind==='ember_spitter'?'#492d23':'#4c3b34').convertLinearToSRGB();
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
  skinUsers=Math.max(0,skinUsers-1);if(skinUsers>0)return;
  for(const material of skins.values()){material.map?.dispose();material.dispose();}
  skins.clear();
  for(const geometry of detailsGeometry.values())geometry.dispose();detailsGeometry.clear();
  absentDetails.clear();
  detailsMaterial?.dispose();detailsMaterial=undefined;
}
export interface DetailPart{size:[number,number,number];offset:[number,number,number];color:string;role?:'head'}
export function creatureDetails(kind:string):DetailPart[]{
  const detail=(size:DetailPart['size'],offset:DetailPart['offset'],color:string,role?:'head'):DetailPart=>({size,offset,color,role});
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
    case 'cow':return [detail([.42,.23,.2],[0,1.18,-.94],'#d6a4a3','head'),
      detail([.19,.16,.16],[-.36,1.49,-.55],'#ddd3bf','head'),detail([.19,.16,.16],[.36,1.49,-.55],'#ddd3bf','head'),
      detail([.1,.13,.1],[-.22,1.63,-.52],'#c6b797','head'),detail([.1,.13,.1],[.22,1.63,-.52],'#c6b797','head')];
    case 'pig':return [detail([.34,.23,.17],[0,1.06,-.82],'#d98291','head'),
      detail([.14,.17,.13],[-.24,1.38,-.48],'#dd878f','head'),detail([.14,.17,.13],[.24,1.38,-.48],'#dd878f','head'),
      detail([.13,.13,.15],[0,.83,.5],'#c77d84')];
    case 'sheep':return [detail([1.12,.16,.68],[0,1.43,.06],'#f4ecda'),
      detail([.36,.2,.19],[0,1.16,-.91],'#908577','head'),
      detail([.19,.18,.16],[-.31,1.48,-.54],'#e8dfcb','head'),detail([.19,.18,.16],[.31,1.48,-.54],'#e8dfcb','head')];
    case 'chicken':return [detail([.17,.1,.13],[0,.75,-.34],'#dfaa49','head'),
      detail([.1,.1,.1],[0,.62,-.32],'#b6544d','head'),detail([.1,.1,.1],[0,.94,-.13],'#cb5c51','head'),
      detail([.14,.15,.13],[0,.56,.27],'#ede5d4')];
    case 'zombie':return [detail([.6,.12,.36],[0,.78,0],'#3b4b61'),
      detail([.18,.16,.12],[-.44,.77,-.04],'#799f69'),detail([.18,.16,.12],[.44,.77,-.04],'#799f69')];
    case 'skeleton':return [detail([.1,.55,.12],[.51,1.14,-.22],'#8e6747'),
      detail([.2,.12,.12],[.47,1.47,-.22],'#8e6747'),detail([.2,.12,.12],[.47,.82,-.22],'#8e6747'),
      detail([.4,.08,.08],[0,.75,-.03],'#a8a28e')];
    case 'creeper':return [detail([.19,.12,.16],[-.2,.12,-.2],'#345d43'),
      detail([.19,.12,.16],[.2,.12,-.2],'#345d43'),detail([.19,.12,.16],[-.2,.12,.2],'#345d43'),
      detail([.19,.12,.16],[.2,.12,.2],'#345d43')];
    case 'spider':return [detail([.13,.16,.18],[-.13,.35,-.74],'#9e6b64','head'),
      detail([.13,.16,.18],[.13,.35,-.74],'#9e6b64','head'),
      detail([.5,.1,.5],[0,.74,.55],'#55445b'),
      ...[-.51,-.2,.16,.49].flatMap(z=>[
        detail([.13,.48,.13],[-1.05,.26,z],'#302b35'),
        detail([.13,.48,.13],[1.05,.26,z],'#302b35')])];
    default:return [];
  }
}
export function creatureDetailMesh(kind:string,role:'body'|'head'='body',headOffset:[number,number,number]=[0,0,0]):THREE.Mesh|undefined{
  const key=`${kind}:${role}`;if(absentDetails.has(key))return;
  let geometry=detailsGeometry.get(key);
  if(!geometry){const parts=creatureDetails(kind).filter(part=>(part.role==='head')===(role==='head'));
    if(!parts.length){absentDetails.add(key);return;}
    const cube=new THREE.BoxGeometry(1,1,1).toNonIndexed();
    const base=cube.getAttribute('position'),normals=cube.getAttribute('normal');
    const positions:number[]=[],directions:number[]=[],colors:number[]=[];
    for(const part of parts){const tint=new THREE.Color(part.color);
      for(let i=0;i<base.count;i++){
        positions.push(base.getX(i)*part.size[0]+part.offset[0]-headOffset[0],
          base.getY(i)*part.size[1]+part.offset[1]-headOffset[1],base.getZ(i)*part.size[2]+part.offset[2]-headOffset[2]);
        directions.push(normals.getX(i),normals.getY(i),normals.getZ(i));colors.push(tint.r,tint.g,tint.b);
      }
    }
    cube.dispose();geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(directions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeBoundingSphere();detailsGeometry.set(key,geometry);
  }
  const mesh=new THREE.Mesh(geometry,detailsMaterial??=new THREE.MeshLambertMaterial({vertexColors:true}));mesh.castShadow=true;return mesh;
}
