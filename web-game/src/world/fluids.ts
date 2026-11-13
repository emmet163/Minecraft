import {Block,isFluid,isReplaceable,state,type BlockState} from './blocks';
import {HEIGHT,SIZE} from './chunk';
import type {Edit} from '../persistence/edits';

export interface FluidWorld{getState(x:number,y:number,z:number):BlockState;isLoaded(x:number,z:number):boolean;apply(edits:Edit[],expected?:BlockState[]):Promise<boolean>}
const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
const adjacent=[[1,0],[-1,0],[0,1],[0,-1]] as const;
const family=(b:Block)=>b===Block.Water||b===Block.WaterFlow?'water':b===Block.Lava||b===Block.LavaFlow?'lava':null;
export class FluidSystem{
  private pending=new Set<string>();private sources=new Set<string>();private clock=0;private busy=false;
  constructor(readonly world:FluidWorld){}
  get pendingCount(){return this.pending.size;}
  clear(){this.pending.clear();this.sources.clear();this.clock=0;}
  touch(x:number,y:number,z:number){if(y<0||y>=HEIGHT||!this.world.isLoaded(x,z))return;
    this.pending.add(key(x,y,z));if(this.pending.size>4096)this.pending.delete(this.pending.values().next().value!);
  }
  changed(edits:ReadonlyArray<Edit>){for(const {x,y,z,state} of edits){const cell=key(x,y,z);
    if(state.type===Block.Water||state.type===Block.Lava)this.sources.add(cell);else this.sources.delete(cell);
    if(!family(state.type)&&![[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]].some(([dx,dy,dz])=>family(this.world.getState(x+dx!,y+dy!,z+dz!).type)))continue;
    this.touch(x,y,z);this.touch(x,y-1,z);this.touch(x,y+1,z);
    for(const [dx,dz] of adjacent)this.touch(x+dx,y,z+dz);}}
  chunkInstalled(cx:number,cz:number){
    // Flowing cells at the newly loaded edge resume into this chunk.
    for(let y=0;y<HEIGHT;y++)for(let i=0;i<SIZE;i++)for(const [x,z] of [[cx*SIZE,i+cz*SIZE],[(cx+1)*SIZE-1,i+cz*SIZE],[i+cx*SIZE,cz*SIZE],[i+cx*SIZE,(cz+1)*SIZE-1]] as [number,number][]){
      for(const [dx,dz] of adjacent){const outsideX=x+dx,outsideZ=z+dz;
        if(Math.floor(outsideX/SIZE)===cx&&Math.floor(outsideZ/SIZE)===cz||!this.world.isLoaded(outsideX,outsideZ))continue;
        const outside=this.world.getState(outsideX,y,outsideZ);
        if(outside.type===Block.WaterFlow||outside.type===Block.LavaFlow||this.sources.has(key(outsideX,y,outsideZ)))this.touch(x,y,z);
      }
    }
  }
  private desired(x:number,y:number,z:number):BlockState|undefined{
    const current=this.world.getState(x,y,z),own=family(current.type);
    if(current.type===Block.Water)return;
    let water=9,lava=9;
    const sample=(b:BlockState,below:boolean)=>{const kind=family(b.type);if(!kind)return;
      const level=b.type===Block.Water||b.type===Block.Lava?0:(b.properties&7);
      const next=below?1:level+1;if(kind==='water')water=Math.min(water,next);else lava=Math.min(lava,next);};
    if(y+1<HEIGHT)sample(this.world.getState(x,y+1,z),true);
    for(const [dx,dz] of adjacent)if(this.world.isLoaded(x+dx,z+dz))sample(this.world.getState(x+dx,y,z+dz),false);
    if(own==='lava'&&water<=7)return state(Block.Stone);
    if(current.type===Block.Lava)return;
    if(own&&current.type!==Block.WaterFlow&&current.type!==Block.LavaFlow)return;
    if(!own&&!isReplaceable(current.type))return;
    const choice=water<=7?'water':lava<=7?'lava':null;
    if(!choice)return own?state(Block.Air):undefined;
    const next=state(choice==='water'?Block.WaterFlow:Block.LavaFlow,choice==='water'?water:lava);
    if(current.type===next.type&&current.properties===next.properties)return;
    return next;
  }
  tick(delta:number){this.clock+=delta;if(this.clock<.12||this.busy||!this.pending.size)return;this.clock=0;
    const edits:Edit[]=[],expected:BlockState[]=[];
    for(let i=0;i<24&&this.pending.size;i++){
      const cell=this.pending.values().next().value!;this.pending.delete(cell);
      const [x,y,z]=cell.split(',').map(Number) as [number,number,number];
      if(!this.world.isLoaded(x,z))continue;const next=this.desired(x,y,z);
      if(next){edits.push({x,y,z,state:next});expected.push(this.world.getState(x,y,z));}
    }
    if(!edits.length)return;this.busy=true;
    void this.world.apply(edits,expected).then(ok=>{if(ok)this.changed(edits);else for(const edit of edits)this.touch(edit.x,edit.y,edit.z);}).finally(()=>{this.busy=false;});
  }
}
