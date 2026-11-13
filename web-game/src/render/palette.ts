import {Block} from '../world/blocks';

export const TILE=32,ATLAS_TILES=8,ATLAS_SIZE=TILE*ATLAS_TILES;
const colors=[
  '#53405c','#5d963e','#735039','#777b7f','#c9b47a','#d9e8ee','#4a5039','#356ba8',
  '#755037','#3b7739','#e47278','#5fa53d','#333438','#a9693c','#aaa192','#d5a339',
  '#705139','#777b7f','#777a73','#a7d8e8','#8d8d89','#7a5837','#87552e','#795338',
  '#90613b','#62666b','#9e6631','#78914d','#4d87b8','#df4d1f','#ff7a22','#8d4d37',
  '#805f43','#ae9264','#b79b73','#bd6b35','#f5dc6f','#817061','#694f35','#9fb93d',
  '#a74358','#766f67','#6b3cb1','#73d2d0','#bb84dd','#6a6f78','#b6986b','#69506b','#fff3a4',
];
const rgb=(hex:string)=>[1,3,5].map(i=>Number.parseInt(hex.slice(i,i+2),16)) as [number,number,number];
const hash=(b:number,x:number,y:number,salt=0)=>{let n=(Math.imul(b+41,0x9e3779b1)^Math.imul(x+salt,0x85ebca6b)^Math.imul(y+salt,0xc2b2ae35))>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d)>>>0;return (n^(n>>>15))>>>0;};
export function atlasPixels():Uint8Array{
  const pixels=new Uint8Array(ATLAS_SIZE*ATLAS_SIZE*4);
  for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  for(let b=0;b<colors.length;b++)for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
    let base=rgb(colors[b]!),shade=((hash(b,x>>1,y>>1)%29)-14)*.007;
    const grain=(hash(b,x,y,13)%100)/100;
    if(b===Block.GrassSide||b===Block.SnowSide){base=rgb(colors[y<5?b===Block.GrassSide?Block.Grass:Block.Snow:Block.Dirt]!);
      if(y>=5&&y<8&&grain<.45)base=rgb(colors[b===Block.GrassSide?Block.Grass:Block.Snow]!);}
    if(b===Block.Grass||b===Block.Plant||b===Block.Leaves||b===Block.WheatCrop){
      if(grain<.13)shade+=.16;if(grain>.89)shade-=.12;
      if(b===Block.Grass&&y>1&&grain<.08)base=rgb('#8dbb57');
    }
    if([Block.Stone,Block.Gravel,Block.Slab,Block.Furnace,Block.GlowOre,Block.Crystal].includes(b)||b>=Block.Coal&&b<=Block.Gold){
      shade+=((hash(b,x>>2,y>>2,4)%5)-2)*.035;
      if((x+y*3)%17===0)shade-=.12;
    }
    if(b>=Block.Coal&&b<=Block.Gold||b===Block.GlowOre||b===Block.Crystal){
      base=rgb(grain<.19?colors[b]!:colors[Block.Stone]!);
      if(grain<.065)shade+=.28;
    }
    if(b===Block.Wood||b===Block.Door||b===Block.Stairs||b===Block.Fence){shade+=Math.sin(x*.55+Math.sin(y*.24))*.075;
      if(x%9===0)shade-=.14;}
    if(b===Block.Sand||b===Block.Snow||b===Block.Water||b===Block.WaterFlow||b===Block.Lava||b===Block.LavaFlow){
      shade+=Math.sin(y*.44+x*.11)*.065;if(grain<.075)shade+=.12;}
    if(b===Block.Farmland||b===Block.Mud)shade+=Math.sin(x*.33)*.055;
    if(b===Block.Glass)shade+=x<3||y<3||x>28||y>28?.22:-.04;
    if(b===Block.Lamp||b===48)shade+=((x>>3)+(y>>3))%2===0?.08:-.07;
    if(x===0||y===0||x===TILE-1||y===TILE-1)shade-=.12;
    const index=((Math.floor(b/ATLAS_TILES)*TILE+y)*ATLAS_SIZE+(b%ATLAS_TILES)*TILE+x)*4;
    for(let c=0;c<3;c++)pixels[index+c]=Math.max(0,Math.min(255,Math.round(base[c]!*(1+shade))));pixels[index+3]=255;
  }
  return pixels;
}
