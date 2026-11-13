import {Block,state} from './blocks';
import type {Edit} from '../persistence/edits';
import type {FluidWorld} from './fluids';

const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
export class FarmingSystem{
  private crops=new Set<string>();private soils=new Set<string>();private clock=0;private busy=false;private cursor=0;
  constructor(readonly world:FluidWorld){}
  clear(){this.crops.clear();this.soils.clear();this.clock=this.cursor=0;}
  changed(edits:ReadonlyArray<Edit>){for(const {x,y,z,state:s} of edits){const cell=key(x,y,z);
    if(s.type===Block.WheatCrop||s.type===Block.BerryCrop)this.crops.add(cell);else this.crops.delete(cell);
    if(s.type===Block.Farmland)this.soils.add(cell);else this.soils.delete(cell);
  }}
  private irrigated(x:number,y:number,z:number){for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
    if(!this.world.isLoaded(x+dx,z+dz))continue;
    for(const dy of [-1,0,1])if([Block.Water,Block.WaterFlow].includes(this.world.getState(x+dx,y+dy,z+dz).type))return true;
  }return false;}
  tick(delta:number){this.clock+=delta;if(this.clock<8||this.busy)return;this.clock=0;
    const edits:Edit[]=[],expected:ReturnType<FluidWorld['getState']>[]=[];const soils=[...this.soils],crops=[...this.crops];
    for(let i=0;i<Math.min(8,soils.length);i++){const cell=soils[(this.cursor+i)%soils.length]!,[x,y,z]=cell.split(',').map(Number) as [number,number,number];
      if(!this.world.isLoaded(x,z))continue;const old=this.world.getState(x,y,z);
      if(old.type!==Block.Farmland){this.soils.delete(cell);continue;}
      const wet=this.irrigated(x,y,z)?1:0;if(old.properties!==wet){edits.push({x,y,z,state:state(Block.Farmland,wet)});expected.push(old);}
    }
    for(let i=0;i<Math.min(8,crops.length);i++){const cell=crops[(this.cursor+i)%crops.length]!,[x,y,z]=cell.split(',').map(Number) as [number,number,number];
      if(!this.world.isLoaded(x,z))continue;const old=this.world.getState(x,y,z),soil=this.world.getState(x,y-1,z);
      if(old.type!==Block.WheatCrop&&old.type!==Block.BerryCrop){this.crops.delete(cell);continue;}
      if(soil.type!==Block.Farmland){edits.push({x,y,z,state:state(Block.Air)});expected.push(old);continue;}
      if((old.properties&3)<3&&((soil.properties&1)!==0||this.cursor%3===0)){edits.push({x,y,z,state:state(old.type,(old.properties&3)+1)});expected.push(old);}
    }
    this.cursor+=8;if(!edits.length)return;this.busy=true;
    void this.world.apply(edits,expected).then(ok=>{if(ok)this.changed(edits);}).finally(()=>{this.busy=false;});
  }
}
