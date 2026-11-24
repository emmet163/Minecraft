import {Block} from '../world/blocks';

export const TILE=32,ATLAS_TILES=8,ATLAS_SIZE=TILE*ATLAS_TILES;
const colors=[
  '#53405c','#63964b','#79553a','#858b8e','#d5c28d','#e7eff1','#515044','#3978ad',
  '#80583a','#4c8044','#e47278','#6ca74b','#333438','#a9693c','#aaa192','#d5a339',
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
  const palette=colors.map(rgb),grass=palette[Block.Grass]!,snow=palette[Block.Snow]!,dirt=palette[Block.Dirt]!;
  const ore=(b:number)=>b>=Block.Coal&&b<=Block.Gold||b===Block.GlowOre||b===Block.Crystal;
  for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  for(let b=0;b<colors.length;b++)for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){
    const fine=hash(b,x,y,13),cluster=hash(b,x>>2,y>>2,29),broad=hash(b,x>>3,y>>3,47);
    let base=palette[b]!,shade=((cluster%13)-6)*.008+((fine%9)-4)*.003;
    if(b===Block.GrassSide||b===Block.SnowSide){
      const cap=b===Block.GrassSide?grass:snow,edge=5+(hash(b,x>>2,0,17)%3);
      const top=y<edge||y<edge+3&&fine%5===0;
      base=top?cap:dirt;shade+=top?.015:-.025;
      if(!top&&y<edge+5&&cluster%5===0)shade-=.08;
    }
    if(b===Block.Grass||b===Block.Plant||b===Block.WheatCrop||b===Block.BerryCrop){
      shade+=(broad%5-2)*.018;
      if((x+2*y)%7===0&&fine%4===0)shade+=.08;
      if(cluster%9===0&&y%4<2)shade-=.065;
    }
    if(b===Block.Leaves){shade+=(broad%7-3)*.027;
      if(cluster%5===0)shade-=.1;if(fine%23===0)shade+=.09;}
    if(b===Block.Dirt||b===Block.Mud||b===Block.Farmland||b===Block.GrassSide||b===Block.SnowSide){
      if(broad%7===0)shade-=.065;
      if(y%9===0&&fine%3===0)shade-=.035;
    }
    if([Block.Stone,Block.Gravel,Block.Slab,Block.Furnace,Block.GlowOre,Block.Crystal].includes(b)||ore(b)){
      shade+=(broad%5-2)*.02;
      if(cluster%11===0)shade-=.085;
      if((x+y*3)%23===0&&fine%3===0)shade-=.07;
    }
    if(ore(b)){
      const vein=hash(b,x>>2,y>>2,5)%7<2&&fine%9!==0;
      base=vein?palette[b]!:palette[Block.Stone]!;
      if(vein)shade+=.07;
    }
    if(b===Block.Wood||b===Block.Door||b===Block.Stairs||b===Block.Fence||b===Block.Chest||b===Block.CraftingStation){
      shade+=Math.sin(x*.68+Math.sin(y*.18))*.045;
      if(x%9===0||x%9===1)shade-=.095;
      if(broad%11===0)shade-=.04;
    }
    if(b===Block.Sand||b===Block.Snow){
      shade+=Math.sin(y*.34+x*.09)*.025;
      if(fine%31===0)shade+=.075;
    }
    if(b===Block.Water||b===Block.WaterFlow){
      shade+=Math.sin(y*.38+x*.16)*.045;
      if(y%8===2&&x%11<6)shade+=.07;
    }
    if(b===Block.Lava||b===Block.LavaFlow){shade+=Math.sin(y*.5+x*.25)*.1;
      if(cluster%5===0)shade+=.1;}
    let alpha=255;
    if(b===Block.Plant){
      const stalk=Math.abs(x-16)<=2&&y>=12;
      const left=y>=9&&y<=28&&Math.abs(x-(7+Math.round((y-9)*.43)))<=2;
      const right=y>=7&&y<=28&&Math.abs(x-(25-Math.round((y-7)*.42)))<=2;
      alpha=stalk||left||right?255:0;
      shade+=left?.08:right?-.07:0;
    }
    if(b===Block.Flower){
      const petal=y>=3&&y<=15&&Math.abs(x-16)+Math.abs(y-9)<12;
      const stem=Math.abs(x-16)<=2&&y>=14;
      const leaf=y>=20&&y<=24&&Math.abs(x-(y<22?10:22))<=4;
      alpha=petal||stem||leaf?255:0;
      if(stem||leaf)base=palette[Block.Plant]!;
      else if(Math.abs(x-16)<=3&&y>=7&&y<=11)base=palette[Block.Gold]!;
    }
    if(b===Block.WheatCrop){
      const stalk=[8,16,24].some(cx=>Math.abs(x-cx)<=1&&y>=13);
      const head=[8,16,24].some(cx=>Math.abs(x-cx)<=3&&y>=4&&y<=17&&((x+y+cx)%5!==0));
      const leaf=y>=19&&y<=25&&Math.abs(x-(y<22?11:21))<=4;
      alpha=stalk||head||leaf?255:0;
      if(head)base=palette[Block.Sand]!;
    }
    if(b===Block.BerryCrop){
      const branch=Math.abs(x-16)<=2&&y>=13;
      const foliage=y>=6&&y<=24&&Math.abs(x-16)+Math.abs(y-16)<19&&cluster%5!==0;
      alpha=branch||foliage?255:0;
      base=fine%13===0&&foliage?palette[Block.Flower]!:palette[Block.Leaves]!;
    }
    if(b===Block.Glass)shade+=x<3||y<3||x>28||y>28?.22:-.04;
    if(b===Block.Lamp||b===48)shade+=((x>>3)+(y>>3))%2===0?.08:-.07;
    const index=((Math.floor(b/ATLAS_TILES)*TILE+y)*ATLAS_SIZE+(b%ATLAS_TILES)*TILE+x)*4;
    for(let c=0;c<3;c++)pixels[index+c]=Math.max(0,Math.min(255,Math.round(base[c]!*(1+shade))));pixels[index+3]=alpha;
  }
  return pixels;
}
