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
  const shadow=color('#484a47').convertLinearToSRGB();
  const emberEye=color('#f4bb70').convertLinearToSRGB();
  const spiderEye=color('#e47782').convertLinearToSRGB();
  const mouth=color('#59453e').convertLinearToSRGB();
  const pale=color('#f4eee0').convertLinearToSRGB();
  const moss=color('#426e4a').convertLinearToSRGB();
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const n=(Math.imul(x+11,73856093)^Math.imul(y+7,19349663)^Math.imul(seed+17,83492791))>>>0;
    const cell=(Math.imul((x>>2)+seed,1103515245)^Math.imul((y>>2)+17,12345))>>>0;
    let shade=.93+(cell%9)/100+(n%7)/250;
    if(y===0||x===0||x===SIZE-1)shade*=.85;
    if(y===SIZE-1)shade*=.9;
    if(kind==='mossback'&&part===0&&y<5&&cell%4<2)shade*=.78;
    if(kind==='crag_guardian'&&cell%11===0)shade*=.7;
    let ink:THREE.Color|null=null;
    if(kind==='cow'&&part===0&&cell%7<2&&x>1&&x<14&&y>1&&y<14)ink=shadow;
    if(kind==='pig'&&cell%13===0)shade*=.89;
    if(kind==='sheep'&&part===0)shade*=.95+((x>>2)+(y>>2))%3*.035;
    if(kind==='chicken'&&part===0&&y>9&&x%5===0)shade*=.9;
    if(kind==='zombie'&&part===0&&cell%10===0)shade*=.65;
    if(kind==='skeleton'&&part===0&&y>=4&&y<=12&&x>2&&x<13&&((y===5||y===8||y===11)&&x!==7&&x!==8||x===7||x===8))ink=shadow;
    if(kind==='creeper'&&cell%5===0)shade*=.78;
    if(kind==='spider'&&cell%7===0)shade*=.76;
    if(front&&head){
      const eyeY=kind==='mossback'?6:5;
      if(y>=eyeY&&y<eyeY+2&&(x>=4&&x<6||x>=10&&x<12))ink=
        kind==='dusk_stalker'||kind==='creeper'?emberEye:kind==='spider'?spiderEye:kind==='skeleton'?shadow:
        kind==='veil_shade'?color('#9af6ed').convertLinearToSRGB():kind==='ember_spitter'?color('#ffe19a').convertLinearToSRGB():eye;
      if(y===eyeY-1&&(x>=3&&x<=6||x>=9&&x<=12))shade*=.72;
      if(kind==='spider'&&y>=7&&y<=8&&(x>=2&&x<=3||x>=12&&x<=13))ink=spiderEye;
      if(kind==='creeper'&&y>=9&&y<=13&&Math.abs(x-8)<=1+(y===11?1:0))ink=shadow;
      if(kind==='skeleton'&&y>=10&&y<=12&&x>=6&&x<=9)ink=shadow;
      if(kind==='zombie'&&y===11&&x>=6&&x<=9)ink=mouth;
      if(kind==='cow'&&y>=9&&y<=10&&x>=5&&x<=10)ink=pale;
      if(!['creeper','skeleton','zombie','spider'].includes(kind)&&y===11&&x>=7&&x<=8)
        ink=kind==='ember_spitter'?shadow:mouth;
      if(kind==='hearthfolk'&&y>=2&&y<=3&&x>=2&&x<=13)shade*=.78;
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
      detail([.28,.08,.28],[0,1.4,.25],'#9abb62'),detail([.09,.13,.09],[-.3,1.47,.32],'#d8b179'),
      detail([.09,.13,.09],[.28,1.48,-.1],'#d8b179'),
      detail([.12,.18,.12],[-.18,1.52,-.53],'#d2c998'),detail([.12,.18,.12],[.18,1.52,-.53],'#d2c998')];
    case 'crag_guardian':return [detail([.18,.25,.18],[-.27,1.91,-.09],'#59716d'),detail([.18,.25,.18],[.27,1.91,-.09],'#59716d'),
      detail([.16,.32,.3],[-.59,1.17,0],'#9db2a0'),detail([.16,.32,.3],[.59,1.17,0],'#9db2a0'),
      detail([.09,.38,.04],[-.19,1.06,-.35],'#67a98e'),detail([.09,.3,.04],[.1,.98,-.35],'#67a98e')];
    case 'dusk_stalker':return [detail([.14,.57,.19],[-.47,1.02,-.03],'#413951'),detail([.14,.57,.19],[.47,1.02,-.03],'#413951'),
      detail([.15,.13,.21],[-.47,.68,-.12],'#b2a18d'),detail([.15,.13,.21],[.47,.68,-.12],'#b2a18d'),
      detail([.5,.09,.36],[0,1.36,.02],'#82718e'),detail([.18,.12,.04],[0,.95,-.3],'#b3686d')];
    case 'ember_spitter':return [detail([.22,.12,.22],[-.26,1.27,-.45],'#eabb72'),detail([.22,.12,.22],[.26,1.27,-.45],'#eabb72'),
      detail([.26,.2,.18],[0,1,-.71],'#734237'),detail([.2,.06,.22],[-.24,.96,.27],'#f3ae61'),
      detail([.2,.06,.22],[.24,.96,.27],'#f3ae61')];
    case 'hearthfolk':return [detail([.56,.1,.5],[0,1.88,0],'#4e533e'),detail([.4,.08,.5],[0,.83,-.24],'#bd9571'),
      detail([.08,.43,.04],[0,1.04,-.25],'#d0b68d'),detail([.09,.09,.04],[0,1.05,-.29],'#d6ad59')];
    case 'veil_shade':return [detail([.17,.24,.17],[-.23,1.92,-.04],'#b38ad0'),detail([.17,.24,.17],[.23,1.92,-.04],'#b38ad0'),
      detail([.12,.58,.17],[-.4,1.01,0],'#4b3867'),detail([.12,.58,.17],[.4,1.01,0],'#4b3867'),
      detail([.27,.06,.05],[0,1.07,-.26],'#a9f3ef')];
    case 'cow':return [detail([.42,.23,.2],[0,1.18,-.94],'#d6a4a3','head'),
      detail([.055,.055,.025],[-.12,1.19,-1.05],'#794e51','head'),detail([.055,.055,.025],[.12,1.19,-1.05],'#794e51','head'),
      detail([.19,.16,.16],[-.36,1.49,-.55],'#ddd3bf','head'),detail([.19,.16,.16],[.36,1.49,-.55],'#ddd3bf','head'),
      detail([.1,.13,.1],[-.22,1.63,-.52],'#c6b797','head'),detail([.1,.13,.1],[.22,1.63,-.52],'#c6b797','head'),
      detail([.09,.23,.09],[0,.91,.57],'#393a37'),detail([.15,.08,.13],[0,.79,.69],'#393a37')];
    case 'pig':return [detail([.34,.23,.17],[0,1.06,-.82],'#d98291','head'),
      detail([.045,.06,.025],[-.1,1.08,-.92],'#965b68','head'),detail([.045,.06,.025],[.1,1.08,-.92],'#965b68','head'),
      detail([.14,.17,.13],[-.24,1.38,-.48],'#dd878f','head'),detail([.14,.17,.13],[.24,1.38,-.48],'#dd878f','head'),
      detail([.13,.13,.15],[0,.83,.5],'#c77d84'),detail([.09,.1,.1],[.06,.9,.57],'#e3a5aa'),
      ...[-.35,.35].flatMap(x=>[-.2,.32].map(z=>detail([.2,.09,.2],[x,.055,z],'#ae7177')) )];
    case 'sheep':return [detail([1.12,.16,.68],[0,1.43,.06],'#f4ecda'),
      detail([.36,.2,.19],[0,1.16,-.91],'#908577','head'),
      detail([.19,.18,.16],[-.31,1.48,-.54],'#e8dfcb','head'),detail([.19,.18,.16],[.31,1.48,-.54],'#e8dfcb','head'),
      detail([.18,.12,.18],[-.17,1.65,-.6],'#f7f0df','head'),detail([.18,.13,.18],[.06,1.66,-.57],'#f7f0df','head'),
      detail([.19,.11,.18],[.24,1.61,-.49],'#f7f0df','head'),
      ...[-.62,.62].flatMap(x=>[-.17,.13,.38].map(z=>detail([.16,.2,.2],[x,1.11,z],'#f0e9d9')) )];
    case 'chicken':return [detail([.17,.1,.13],[0,.75,-.34],'#dfaa49','head'),
      detail([.1,.1,.1],[0,.62,-.32],'#b6544d','head'),detail([.1,.1,.1],[0,.94,-.13],'#cb5c51','head'),
      detail([.14,.15,.13],[0,.56,.27],'#ede5d4'),
      detail([.09,.16,.11],[-.1,.55,.23],'#f8f0dc'),detail([.09,.16,.11],[.1,.55,.23],'#f8f0dc')];
    case 'zombie':return [detail([.6,.12,.36],[0,.78,0],'#3b4b61'),
      detail([.18,.16,.12],[-.44,.77,-.04],'#799f69'),detail([.18,.16,.12],[.44,.77,-.04],'#799f69'),
      detail([.22,.06,.04],[-.13,1.36,-.2],'#a5b091'),detail([.12,.16,.04],[.15,1.05,-.2],'#364f50'),
      detail([.08,.08,.04],[-.13,.8,-.21],'#67464c')];
    case 'skeleton':return [detail([.1,.55,.12],[.51,1.14,-.22],'#8e6747'),
      detail([.2,.12,.12],[.47,1.47,-.22],'#8e6747'),detail([.2,.12,.12],[.47,.82,-.22],'#8e6747'),
      detail([.4,.08,.08],[0,.75,-.03],'#a8a28e'),
      detail([.38,.08,.05],[0,1.42,-.18],'#f0ead3'),detail([.42,.07,.05],[0,1.26,-.18],'#f0ead3'),
      detail([.37,.07,.05],[0,1.1,-.18],'#f0ead3')];
    case 'creeper':return [detail([.19,.12,.16],[-.2,.12,-.2],'#345d43'),
      detail([.19,.12,.16],[.2,.12,-.2],'#345d43'),detail([.19,.12,.16],[-.2,.12,.2],'#345d43'),
      detail([.19,.12,.16],[.2,.12,.2],'#345d43'),
      detail([.12,.06,.05],[-.13,.99,-.25],'#91bd67'),detail([.12,.06,.05],[.13,.9,-.25],'#91bd67')];
    case 'spider':return [detail([.13,.16,.18],[-.13,.35,-.74],'#9e6b64','head'),
      detail([.13,.16,.18],[.13,.35,-.74],'#9e6b64','head'),
      ...[-.17,-.06,.06,.17].flatMap(x=>[.52,.62].map(y=>detail([.055,.055,.035],[x,y,-.705],'#ed8a8e','head'))),
      detail([.5,.1,.5],[0,.74,.55],'#55445b'),detail([.3,.07,.36],[0,.77,.31],'#806072'),
      detail([.11,.06,.1],[-.2,.64,-.08],'#a87875'),detail([.11,.06,.1],[.2,.64,-.08],'#a87875'),
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
