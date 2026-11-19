import * as THREE from 'three';
import {item,itemBlock} from '../items/items';
import {Block,isFluid} from '../world/blocks';
import {atlasPixels,ATLAS_SIZE,ATLAS_TILES,TILE} from './palette';
import {cubeAtlasGeometry} from './cubeAtlas';

export function dropFaceTiles(block:Block):readonly [Block,Block,Block]{
  return block===Block.Grass?[Block.GrassSide,Block.Grass,Block.Dirt]:
    block===Block.Snow?[Block.SnowSide,Block.Snow,Block.Dirt]:[block,block,block];
}
export function visualBlockForItem(id:string):Block{
  const def=item(id),block=itemBlock(id);
  return block===Block.Air?def.category==='food'?Block.BerryCrop:def.category==='weapon'?Block.Iron:Block.Wood:block;
}
function lootPixels(id:string,transparentBackground=false):Uint8Array{
  const pixels=new Uint8Array(TILE*TILE*4),def=item(id);
  const metal=id.includes('gold')?[222,174,57]:id.includes('copper')?[195,117,70]:id.includes('iron')?[180,196,200]:
    id.includes('stone')?[126,135,139]:[151,113,75];
  const food=def.category==='food',tool=['pickaxe','axe','shovel','hoe','weapon'].includes(def.category);
  for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
    const mark=tool?(Math.abs(x-16)<=2&&y>=11&&y<=27||def.category==='pickaxe'&&y>=8&&y<=12&&x>=6&&x<=26||
      def.category==='axe'&&x>=6&&x<=21&&y>=7&&y<=15&&Math.abs(x-12)+Math.abs(y-11)<13||
      def.category==='hoe'&&y>=8&&y<=12&&x>=6&&x<=22||
      def.category==='weapon'&&Math.abs(x+y-27)<=2&&x>=7&&x<=21||def.category==='shovel'&&y>=5&&y<=12&&Math.abs(x-16)<5):
      food?((x-12)**2+(y-12)**2<36||(x-21)**2+(y-15)**2<36||(x-16)**2+(y-22)**2<36):
      (x>=7&&x<=24&&y>=11&&y<=22&&Math.abs(x-16)+Math.abs(y-16)<16);
    const index=(y*TILE+x)*4,shade=((x*13+y*7+id.length*17)%7)/30;
    const base=mark?food?[164,66,91]:metal:[40,56,64];
    for(let channel=0;channel<3;channel++)pixels[index+channel]=Math.min(255,Math.round(base[channel]!*(.87+shade)));
    pixels[index+3]=mark||!transparentBackground?255:0;
  }
  return pixels;
}
function blockPixels(block:Block,atlas:Uint8Array):Uint8Array{
  const tile=dropFaceTiles(block)[1],pixels=new Uint8Array(TILE*TILE*4),tx=tile%ATLAS_TILES,ty=Math.floor(tile/ATLAS_TILES);
  for(let y=0;y<TILE;y++){const source=((ty*TILE+y)*ATLAS_SIZE+tx*TILE)*4;
    pixels.set(atlas.subarray(source,source+TILE*4),y*TILE*4);}
  return pixels;
}
const iconCache=new Map<string,string>();
let iconAtlas:Uint8Array|undefined;
export function itemIconUrl(id:string):string{
  const found=iconCache.get(id);if(found)return found;
  const block=itemBlock(id),atlas=iconAtlas??=atlasPixels();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=TILE;
  const context=canvas.getContext('2d');if(!context)return '';
  const pixels=context.createImageData(TILE,TILE);pixels.data.set(block===Block.Air?lootPixels(id,true):blockPixels(block,atlas));
  context.putImageData(pixels,0,0);const url=canvas.toDataURL('image/png');iconCache.set(id,url);return url;
}
export class DropVisuals{
  readonly geometry=cubeAtlasGeometry(.3);
  private atlas=atlasPixels();
  private materials=new Map<string,THREE.MeshLambertMaterial>();
  private tile(block:Block):Uint8Array{
    const pixels=new Uint8Array(TILE*TILE*4),tx=block%ATLAS_TILES,ty=Math.floor(block/ATLAS_TILES);
    for(let y=0;y<TILE;y++){const source=((ty*TILE+y)*ATLAS_SIZE+tx*TILE)*4;
      pixels.set(this.atlas.subarray(source,source+TILE*4),y*TILE*4);}
    return pixels;
  }
  materialsFor(id:string):THREE.MeshLambertMaterial{
    let result=this.materials.get(id);if(result)return result;
    const block=itemBlock(id),visual=visualBlockForItem(id);
    const [side,top,bottom]=dropFaceTiles(visual),transparent=visual===Block.Glass||isFluid(visual)||visual===Block.RealmPortal;
    const pixels=new Uint8Array(TILE*3*TILE*2*4),loot=block===Block.Air?lootPixels(id):undefined;
    for(const [face,tile] of [side,side,top,bottom,side,side].entries()){
      const source=loot||this.tile(tile),column=face%3,row=Math.floor(face/3);
      for(let y=0;y<TILE;y++)pixels.set(source.subarray(y*TILE*4,(y+1)*TILE*4),((row*TILE+y)*TILE*3+column*TILE)*4);
    }
    const texture=new THREE.DataTexture(pixels,TILE*3,TILE*2,THREE.RGBAFormat);
    texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    result=new THREE.MeshLambertMaterial({map:texture,transparent,opacity:transparent?.72:1,
      depthWrite:!transparent,side:transparent?THREE.DoubleSide:THREE.FrontSide});
    this.materials.set(id,result);return result;
  }
  create(id:string):THREE.Mesh{const mesh=new THREE.Mesh(this.geometry,this.materialsFor(id));mesh.castShadow=true;return mesh;}
  dispose():void{this.geometry.dispose();for(const material of this.materials.values()){material.map?.dispose();material.dispose();}
    this.materials.clear();}
}
