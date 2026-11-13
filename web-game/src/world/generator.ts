import { Block, floorDiv } from './blocks';
import { ChunkData, HEIGHT, SIZE } from './chunk';
import {StructurePlanner} from './structures';

export const enum Biome { Ocean, Beach, Plains, Forest, Desert, Mountains, Snow, Swamp }
export const biomeNames = ['Ocean','Beach','Plains','Forest','Desert','Mountains','Snow','Swamp'] as const;
const fade = (t: number) => t*t*(3-2*t);
const lerp = (a: number,b: number,t: number) => a+(b-a)*t;
const smooth = (a: number,b: number,x: number) => fade(Math.max(0,Math.min(1,(x-a)/(b-a))));
export class WorldGenerator {
  static readonly seaLevel = 42;
  readonly structures:StructurePlanner;
  constructor(readonly seed: number,readonly realm:'overworld'|'veil'='overworld') {this.structures=new StructurePlanner(seed,this);}
  private hash(x: number,y: number,z: number,salt: number): number {
    let h = (this.seed ^ Math.imul(salt,0x9e3779b9)) >>> 0;
    h = (h ^ Math.imul(x,0x85ebca6b)) >>> 0; h = Math.imul(h ^ (h >>> 16),0xc2b2ae35) >>> 0;
    h = (h ^ Math.imul(y,0x27d4eb2f)) >>> 0; h = Math.imul(h ^ (h >>> 13),0x165667b1) >>> 0;
    h = (h ^ Math.imul(z,0x9e3779b9)) >>> 0; return (h ^ (h >>> 16)) >>> 0;
  }
  private unit(x: number,y: number,z: number,salt: number): number { return this.hash(x,y,z,salt)/0xffffffff*2-1; }
  private noise2(x: number,z: number,salt: number): number {
    const ix=Math.floor(x), iz=Math.floor(z), tx=fade(x-ix), tz=fade(z-iz);
    return lerp(lerp(this.unit(ix,0,iz,salt),this.unit(ix+1,0,iz,salt),tx),
      lerp(this.unit(ix,0,iz+1,salt),this.unit(ix+1,0,iz+1,salt),tx),tz);
  }
  private noise3(x: number,y: number,z: number,salt: number): number {
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const tx=fade(x-ix),ty=fade(y-iy),tz=fade(z-iz);
    const layer=(dz: number) => lerp(
      lerp(this.unit(ix,iy,iz+dz,salt),this.unit(ix+1,iy,iz+dz,salt),tx),
      lerp(this.unit(ix,iy+1,iz+dz,salt),this.unit(ix+1,iy+1,iz+dz,salt),tx),ty);
    return lerp(layer(0),layer(1),tz);
  }
  private fractal(x: number,z: number,salt: number): number {
    let result=0, amplitude=1, total=0;
    for(let i=0;i<4;i++) { result+=this.noise2(x,z,salt+i*19)*amplitude; total+=amplitude; amplitude*=.5; x*=2; z*=2; }
    return result/total;
  }
  surfaceHeight(x: number,z: number): number {
    if(this.realm==='veil')return Math.max(35,Math.min(HEIGHT-9,Math.round(49+this.fractal(x*.009,z*.009,503)*21+this.fractal(x*.031,z*.031,521)*8)));
    const continent=this.fractal(x*.0035,z*.0035,11), hills=this.fractal(x*.012,z*.012,61);
    const ridges=1-Math.abs(this.fractal(x*.006,z*.006,79));
    const mountain=smooth(.16,.55,continent)*ridges*ridges*39;
    const river=Math.abs(this.fractal(x*.009,z*.009,109));
    const riverCut=(1-smooth(.018,.09,river))*12;
    const lake=this.fractal(x*.018,z*.018,127);
    const lakeCut=lake<-.52 ? smooth(-.52,-.72,lake)*8 : 0;
    return Math.max(4,Math.min(HEIGHT-7,Math.round(48+continent*24+hills*7+mountain-riverCut-lakeCut)));
  }
  biomeAt(x: number,z: number): Biome {
    if(this.realm==='veil')return Biome.Mountains;
    const continent=this.fractal(x*.0035,z*.0035,11);
    const temp=this.fractal(x*.0025,z*.0025,23)+.12*Math.sin(z*.0008);
    const moisture=this.fractal(x*.003,z*.003,37), height=this.surfaceHeight(x,z);
    if(height<40) return Biome.Ocean;
    if(height<=44) return Biome.Beach;
    if(height>68) return temp<.1 ? Biome.Snow : Biome.Mountains;
    if(temp<-.22) return Biome.Snow;
    if(continent<-.05 && moisture>.18) return Biome.Swamp;
    if(temp>.27 && moisture<-.08) return Biome.Desert;
    return moisture>.05 ? Biome.Forest : Biome.Plains;
  }
  private cave(x: number,y: number,z: number,ravine: boolean): boolean {
    const tunnel=Math.abs(this.noise3(x*.043,y*.055,z*.043,149));
    const chamber=this.noise3(x*.032,y*.035,z*.032,163);
    return tunnel<.075 && chamber>-.18 || chamber>.56 || ravine && y>18 && y<62;
  }
  private ore(x: number,y: number,z: number): Block {
    const value=this.hash(floorDiv(x,2),floorDiv(y,2),floorDiv(z,2),197)%1000;
    if(y<22 && value<3) return Block.Gold;
    if(y<48 && value<10) return Block.Iron;
    if(y<62 && value<18) return Block.Copper;
    if(value<28) return Block.Coal;
    return Block.Stone;
  }
  generate(cx: number,cz: number): ChunkData {
    if(this.realm==='veil')return this.generateVeil(cx,cz);
    const data=new ChunkData(cx,cz), ox=cx*SIZE,oz=cz*SIZE;
    for(let z=-1;z<=SIZE;z++) for(let x=-1;x<=SIZE;x++) {
      const wx=ox+x,wz=oz+z,surface=this.surfaceHeight(wx,wz),biome=this.biomeAt(wx,wz);
      const ravine=Math.abs(this.fractal(wx*.008,wz*.008,181))<.018;
      for(let y=0;y<HEIGHT;y++) {
        if(y>surface) { if(y<=42) data.set(x,y,z,Block.Water); continue; }
        if(y>3 && y<surface-4 && this.cave(wx,y,wz,ravine)) continue;
        let block: Block;
        if(y===surface) block=[Biome.Desert,Biome.Beach,Biome.Ocean].includes(biome) ? Block.Sand :
          biome===Biome.Snow ? Block.Snow : biome===Biome.Swamp ? Block.Mud :
          biome===Biome.Mountains && surface>78 ? Block.Stone : Block.Grass;
        else if(y>surface-4) block=[Biome.Desert,Biome.Beach,Biome.Ocean].includes(biome) ? Block.Sand : Block.Dirt;
        else block=this.ore(wx,y,wz);
        data.set(x,y,z,block);
      }
    }
    this.addPlants(data);
    this.structures.decorate(data);
    return data;
  }
  private generateVeil(cx:number,cz:number):ChunkData{const data=new ChunkData(cx,cz),ox=cx*SIZE,oz=cz*SIZE;
    for(let z=-1;z<=SIZE;z++)for(let x=-1;x<=SIZE;x++){
      const wx=ox+x,wz=oz+z,surface=this.surfaceHeight(wx,wz);
      for(let y=0;y<=surface;y++){
        if(y>4&&y<surface-3&&this.cave(wx,y,wz,false))continue;
        const chance=this.hash(floorDiv(wx,2),floorDiv(y,2),floorDiv(wz,2),601)%1000;
        const block=y===surface?Block.Mud:y>surface-4?Block.Stone:chance<10?Block.GlowOre:chance<14?Block.Crystal:Block.Stone;
        data.set(x,y,z,block);
      }
      if(surface<40)for(let y=surface+1;y<=40;y++)data.set(x,y,z,Block.Lava);
      if(surface>40&&this.hash(wx,0,wz,647)%31===0)data.set(x,surface+1,z,Block.Crystal);
    }
    return data;
  }
  private addPlants(data: ChunkData): void {
    const ox=data.cx*SIZE,oz=data.cz*SIZE;
    for(let wz=oz-4;wz<=oz+SIZE+3;wz++) for(let wx=ox-4;wx<=ox+SIZE+3;wx++) {
      const height=this.surfaceHeight(wx,wz);
      if(height<=43 || height>HEIGHT-8) continue;
      const biome=this.biomeAt(wx,wz), chance=this.hash(wx,0,wz,211)/0xffffffff;
      const place=(x: number,y: number,z: number,b: Block) => data.set(x-ox,y,z-oz,b);
      if(biome===Biome.Forest && chance<.018 || biome===Biome.Swamp && chance<.012) {
        const trunk=4+this.hash(wx,0,wz,223)%3;
        for(let y=height+1;y<=height+trunk;y++) place(wx,y,wz,Block.Wood);
        for(let dz=-2;dz<=2;dz++) for(let dx=-2;dx<=2;dx++) for(let dy=-2;dy<=1;dy++) {
          if(Math.abs(dx)+Math.abs(dz)+Math.abs(dy)>4) continue;
          const x=wx+dx,y=height+trunk+dy,z=wz+dz;
          if(data.world(x,y,z)===Block.Air) place(x,y,z,Block.Leaves);
        }
      } else if([Biome.Plains,Biome.Forest,Biome.Swamp].includes(biome) && chance<.12)
        place(wx,height+1,wz,chance<.035 ? Block.Flower : Block.Plant);
    }
  }
}
