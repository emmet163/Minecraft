import {Block} from './blocks';
import {SIZE,type ChunkData} from './chunk';
import {Biome,type WorldGenerator} from './generator';

export type StructureKind='village'|'dungeon'|'mine'|'ruin'|'vault';
export interface SitePoint{x:number;y:number;z:number}
export interface StructureSite{id:string;kind:StructureKind;x:number;y:number;z:number;biome:Biome;variant:number;
  homes:SitePoint[];work:SitePoint;chests:SitePoint[]}
const REGION=96;
const hash=(seed:number,x:number,z:number,salt:number)=>{
  let n=(seed^Math.imul(x,0x85ebca6b)^Math.imul(z,0xc2b2ae35)^Math.imul(salt,0x27d4eb2f))>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d)>>>0;n=Math.imul(n^(n>>>15),0x846ca68b)>>>0;
  return (n^(n>>>16))>>>0;
};
export class StructurePlanner{
  private cache=new Map<string,StructureSite|null>();
  constructor(readonly seed:number,readonly terrain:WorldGenerator){}
  private remember(key:string,site:StructureSite|null){
    if(this.cache.size>=2048)this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key,site);
  }
  siteAtRegion(rx:number,rz:number):StructureSite|undefined{
    const key=`${rx},${rz}`;if(this.cache.has(key))return this.cache.get(key)??undefined;
    const roll=hash(this.seed,rx,rz,1)%100;
    const kind:StructureKind|undefined=roll<23?'village':roll<42?'ruin':roll<58?'mine':roll<72?'dungeon':roll<77?'vault':undefined;
    if(!kind){this.remember(key,null);return;}
    const x=rx*REGION+48+(hash(this.seed,rx,rz,2)%25)-12;
    const z=rz*REGION+48+(hash(this.seed,rx,rz,3)%25)-12;
    const y=this.terrain.surfaceHeight(x,z),biome=this.terrain.biomeAt(x,z),variant=hash(this.seed,rx,rz,4)%3;
    const land=y>=45&&y<=83&&biome!==Biome.Ocean&&biome!==Biome.Beach;
    const villageBiome=[Biome.Plains,Biome.Forest,Biome.Desert,Biome.Snow].includes(biome);
    const steep=Math.max(...[[16,0],[-16,0],[0,16],[0,-16]].map(([dx,dz])=>Math.abs(this.terrain.surfaceHeight(x+dx!,z+dz!)-y)));
    const allowed=land&&(kind!=='village'||villageBiome&&steep<=5)&&
      (kind!=='ruin'||[Biome.Desert,Biome.Mountains,Biome.Plains,Biome.Forest].includes(biome))&&
      (kind!=='vault'||[Biome.Desert,Biome.Mountains,Biome.Snow].includes(biome));
    if(!allowed){this.remember(key,null);return;}
    const offsets=variant===0?[[-10,-9],[10,-9]]:variant===1?[[-10,-9],[10,-9],[-10,9]]:[[-10,-9],[10,-9],[-10,9],[10,9]];
    const homes:SitePoint[]=kind==='village'?offsets.map(([dx,dz])=>({x:x+dx!,y:this.terrain.surfaceHeight(x+dx!,z+dz!),z:z+dz!})):[];
    const work={x:x+10,y:this.terrain.surfaceHeight(x+10,z+19),z:z+19};
    const chests:SitePoint[]=kind==='village'?[{x:homes[0]!.x+1,y:homes[0]!.y+1,z:homes[0]!.z-1}]:
      kind==='dungeon'?[{x,y:y-11,z}]:kind==='mine'?[{x,y:y-7,z:z+14}]:
      kind==='ruin'?[{x,y:y-2,z}]:[{x,y:y+1,z}];
    const site={id:`${rx}:${rz}:${kind}`,kind,x,y,z,biome,variant,homes,work,chests};
    this.remember(key,site);return site;
  }
  nearby(x:number,z:number,radius:number):StructureSite[]{const sites:StructureSite[]=[];
    const minX=Math.floor((x-radius)/REGION),maxX=Math.floor((x+radius)/REGION);
    const minZ=Math.floor((z-radius)/REGION),maxZ=Math.floor((z+radius)/REGION);
    for(let rz=minZ;rz<=maxZ;rz++)for(let rx=minX;rx<=maxX;rx++){
      const site=this.siteAtRegion(rx,rz);if(site&&Math.hypot(site.x-x,site.z-z)<=radius)sites.push(site);
    }
    return sites.sort((a,b)=>(a.x-x)**2+(a.z-z)**2-(b.x-x)**2-(b.z-z)**2);
  }
  lootSite(x:number,y:number,z:number):StructureSite|undefined{
    return this.nearby(x,z,45).find(site=>site.chests.some(chest=>chest.x===x&&chest.y===y&&chest.z===z));
  }
  decorate(data:ChunkData):void{
    const x=data.cx*SIZE+SIZE/2,z=data.cz*SIZE+SIZE/2;
    for(const site of this.nearby(x,z,64))this.paint(data,site);
  }
  private paint(data:ChunkData,site:StructureSite){
    const put=(x:number,y:number,z:number,b:Block,p=0)=>data.set(x-data.cx*SIZE,y,z-data.cz*SIZE,b,p);
    const fill=(x1:number,x2:number,y1:number,y2:number,z1:number,z2:number,b:Block)=>{
      for(let z=z1;z<=z2;z++)for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)put(x,y,z,b);
    };
    if(site.kind==='village'){
      const path=site.biome===Biome.Desert?Block.Sand:Block.Gravel;
      for(let d=-21;d<=21;d++)for(let side=-1;side<=1;side++)for(const [x,z] of [[site.x+d,site.z+side],[site.x+side,site.z+d]] as [number,number][]){
        const h=this.terrain.surfaceHeight(x,z);put(x,h,z,path);fill(x,x,h+1,h+3,z,z,Block.Air);
      }
      for(let i=0;i<site.homes.length;i++){
        const home=site.homes[i]!,roof=(i+site.variant)%2?Block.Stone:Block.Wood;
        fill(home.x-3,home.x+3,home.y-5,home.y,home.z-3,home.z+3,Block.Stone);
        fill(home.x-3,home.x+3,home.y+1,home.y+5,home.z-3,home.z+3,Block.Air);
        for(let h=1;h<=3;h++)for(let d=-3;d<=3;d++){
          put(home.x+d,home.y+h,home.z-3,Block.Wood);put(home.x+d,home.y+h,home.z+3,Block.Wood);
          put(home.x-3,home.y+h,home.z+d,Block.Wood);put(home.x+3,home.y+h,home.z+d,Block.Wood);
        }
        fill(home.x-4,home.x+4,home.y+4,home.y+4,home.z-4,home.z+4,roof);
        put(home.x-3,home.y+2,home.z,Block.Glass);put(home.x+3,home.y+2,home.z,Block.Glass);
        put(home.x,home.y+1,home.z+3,Block.Door,2);put(home.x,home.y+2,home.z+3,Block.Door,6);
        put(home.x-1,home.y+1,home.z-1,Block.Bed);
        for(let x=Math.min(site.x,home.x);x<=Math.max(site.x,home.x);x++){
          const z=home.z+4,h=this.terrain.surfaceHeight(x,z);put(x,h,z,path);fill(x,x,h+1,h+3,z,z,Block.Air);
        }
      }
      for(let z=site.z+16;z<=site.z+22;z++)for(let x=site.x+6;x<=site.x+14;x++){
        fill(x,x,site.work.y-5,site.work.y,z,z,Block.Dirt);
        fill(x,x,site.work.y+1,site.work.y+3,z,z,Block.Air);
        if(x===site.x+10)put(x,site.work.y,z,Block.Water);
        else if((x+z+site.variant)%3!==0)put(x,site.work.y+1,z,Block.Plant);
      }
      for(const chest of site.chests)put(chest.x,chest.y,chest.z,Block.Chest);
      return;
    }
    if(site.kind==='dungeon'){
      const floor=site.y-12;
      fill(site.x-6,site.x+6,floor,floor+5,site.z-6,site.z+6,Block.Stone);
      fill(site.x-5,site.x+5,floor+1,floor+4,site.z-5,site.z+5,Block.Air);
      for(let dz=-22;dz<=-6;dz++){
        const level=site.y-Math.round((dz+22)*12/16),z=site.z+dz;
        fill(site.x-1,site.x+1,level+1,level+3,z,z,Block.Air);
        fill(site.x-1,site.x+1,level,level,z,z,Block.Stone);
      }
      for(const [dx,dz] of [[-4,-4],[4,-4],[-4,4],[4,4]] as const)
        fill(site.x+dx,site.x+dx,floor+1,floor+3,site.z+dz,site.z+dz,Block.Wood);
      for(const chest of site.chests)put(chest.x,chest.y,chest.z,Block.Chest);
      return;
    }
    if(site.kind==='mine'){
      for(let dz=-20;dz<=20;dz++){
        const level=site.y-Math.min(8,Math.round((dz+20)*8/16)),z=site.z+dz;
        fill(site.x-1,site.x+1,level+1,level+3,z,z,Block.Air);
        fill(site.x-1,site.x+1,level,level,z,z,Block.Stone);
        if(dz%4===0){put(site.x-2,level+1,z,Block.Wood);put(site.x+2,level+1,z,Block.Wood);
          fill(site.x-2,site.x+2,level+4,level+4,z,z,Block.Wood);}
        if(dz>0&&dz%5===0)put(site.x+2,level+1,z,Block.Iron);
      }
      for(const chest of site.chests)put(chest.x,chest.y,chest.z,Block.Chest);
      return;
    }
    if(site.kind==='ruin'){
      fill(site.x-5,site.x+5,site.y-1,site.y,site.z-5,site.z+5,Block.Stone);
      for(let d=-5;d<=5;d++)for(let h=1;h<=3;h++)if(hash(this.seed,site.x+d,site.z+h,9)%5!==0){
        put(site.x+d,site.y+h,site.z-5,Block.Stone);put(site.x-5,site.y+h,site.z+d,Block.Stone);
      }
      put(site.x,site.y-1,site.z,Block.Stone);
      for(const chest of site.chests)put(chest.x,chest.y,chest.z,Block.Chest);
      return;
    }
    fill(site.x-5,site.x+5,site.y-2,site.y+5,site.z-5,site.z+5,Block.Stone);
    fill(site.x-4,site.x+4,site.y+1,site.y+4,site.z-4,site.z+4,Block.Air);
    for(const [dx,dz] of [[-5,-5],[5,-5],[-5,5],[5,5]] as const)
      fill(site.x+dx,site.x+dx,site.y+1,site.y+6,site.z+dz,site.z+dz,Block.Gold);
    put(site.x,site.y+1,site.z-5,Block.Door,0);put(site.x,site.y+2,site.z-5,Block.Door,4);
    for(const chest of site.chests)put(chest.x,chest.y,chest.z,Block.Chest);
  }
}
