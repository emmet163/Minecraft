import {Block,isSolid,state,type BlockState} from './blocks';
import type {Edit} from '../persistence/edits';
import type {FluidWorld} from './fluids';

const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
const neighbors=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]] as const;
const facingDirs:[[number,number],[number,number],[number,number],[number,number]]=[[0,-1],[1,0],[0,1],[-1,0]];
const power=(s:BlockState)=>s.type===Block.Wire?s.properties&15:
  [Block.Switch,Block.Button,Block.Plate,Block.Repeater].includes(s.type)&&s.properties&16?15:0;
export class AutomationSystem{
  private pending=new Set<string>();private buttons=new Map<string,number>();private repeaters=new Map<string,{value:boolean;due:number}>();
  private time=0;private clock=0;private busy=false;
  constructor(readonly world:FluidWorld){}
  clear(){this.pending.clear();this.buttons.clear();this.repeaters.clear();this.time=this.clock=0;}
  private touch(x:number,y:number,z:number){if(y>=0&&y<96&&this.world.isLoaded(x,z))this.pending.add(key(x,y,z));
    if(this.pending.size>4096)this.pending.delete(this.pending.values().next().value!);}
  changed(edits:ReadonlyArray<Edit>){for(const {x,y,z,state} of edits){const active=(b:Block)=>[Block.Wire,Block.Switch,Block.Button,Block.Plate,Block.Repeater,Block.Lamp,Block.Piston,Block.Door].includes(b);
    if(state.type!==Block.Repeater)this.repeaters.delete(key(x,y,z));
    if(!active(state.type)&&!neighbors.some(([dx,dy,dz])=>active(this.world.getState(x+dx,y+dy,z+dz).type)))continue;
    if(state.type===Block.Button&&state.properties&16&&!this.buttons.has(key(x,y,z)))this.buttons.set(key(x,y,z),this.time+1);
    this.touch(x,y,z);for(const [dx,dy,dz] of neighbors)this.touch(x+dx,y+dy,z+dz);}}
  toggle(x:number,y:number,z:number):Promise<boolean>{const current=this.world.getState(x,y,z);
    if(current.type!==Block.Switch&&current.type!==Block.Button)return Promise.resolve(false);
    const powered=!!(current.properties&16),next=state(current.type,current.type===Block.Button?current.properties|16:current.properties^16);
    if(current.type===Block.Button)this.buttons.set(key(x,y,z),this.time+1);
    if(current.type===Block.Switch&&powered)this.buttons.delete(key(x,y,z));
    return this.world.apply([{x,y,z,state:next}]);
  }
  private input(x:number,y:number,z:number){let strongest=0;
    for(const [dx,dy,dz] of neighbors)if(this.world.isLoaded(x+dx,z+dz))strongest=Math.max(strongest,power(this.world.getState(x+dx,y+dy,z+dz)));
    return strongest;
  }
  private desired(x:number,y:number,z:number,current:BlockState):BlockState|undefined{
    const b=current.type,signal=this.input(x,y,z);
    if(b===Block.Wire){const level=signal>0?signal===15?14:Math.max(0,signal-1):0;
      return level===(current.properties&15)?undefined:state(b,level);}
    if(b===Block.Repeater){const facing=current.properties&3,[dx,dz]=facingDirs[facing]!;
      const requested=power(this.world.getState(x-dx,y,z-dz))>0,active=!!(current.properties&16),k=key(x,y,z);
      if(requested===active){this.repeaters.delete(k);return;}
      const timer=this.repeaters.get(k);if(!timer||timer.value!==requested){this.repeaters.set(k,{value:requested,due:this.time+.35});return;}
      if(timer.due>this.time)return;
      this.repeaters.delete(k);return state(b,(current.properties&~16)|(requested?16:0));
    }
    if(b===Block.Lamp||b===Block.Piston){const active=signal>0,old=!!(current.properties&16);
      return active===old?undefined:state(b,(current.properties&~16)|(active?16:0));}
    if(b===Block.Door){const otherY=y+((current.properties&4)?-1:1);
      const active=signal>0||this.input(x,otherY,z)>0,automatic=!!(current.properties&32);
      if(!active&&!automatic)return;
      const properties=active?(current.properties|8|32):(current.properties&~(8|32));
      return properties===current.properties?undefined:state(b,properties);
    }
  }
  tick(delta:number,player?:{x:number;y:number;z:number}){this.time+=delta;this.clock+=delta;
    if(player){const x=Math.round(player.x),y=Math.round(player.y),z=Math.round(player.z),s=this.world.getState(x,y,z);
      if(s.type===Block.Plate&&!(s.properties&16))void this.world.apply([{x,y,z,state:state(Block.Plate,16)}]);
      // Only the active plate is checked every tick; powered plates are tracked in the queue below.
      if(s.type===Block.Plate)this.touch(x,y,z);
    }
    for(const [cell,due] of this.buttons)if(due<=this.time){this.buttons.delete(cell);const [x,y,z]=cell.split(',').map(Number) as [number,number,number];
      if(this.world.getState(x,y,z).type===Block.Button)void this.world.apply([{x,y,z,state:state(Block.Button,0)}]);}
    for(const [cell,timer] of this.repeaters)if(timer.due<=this.time){const [x,y,z]=cell.split(',').map(Number) as [number,number,number];this.touch(x,y,z);}
    if(this.clock<.1||this.busy||!this.pending.size)return;this.clock=0;
    const edits:Edit[]=[],expected:BlockState[]=[];
    for(let i=0;i<32&&this.pending.size;i++){const cell=this.pending.values().next().value!;this.pending.delete(cell);
      const [x,y,z]=cell.split(',').map(Number) as [number,number,number];if(!this.world.isLoaded(x,z))continue;
      const current=this.world.getState(x,y,z);
      if(current.type===Block.Plate&&current.properties&16&&player&&Math.round(player.x)===x&&Math.round(player.y)===y&&Math.round(player.z)===z){this.touch(x,y,z);continue;}
      const next=current.type===Block.Plate&&current.properties&16?state(Block.Plate,0):this.desired(x,y,z,current);
      if(next){edits.push({x,y,z,state:next});expected.push(current);
        if(current.type===Block.Piston&&next.properties&16){
          const [dx,dz]=facingDirs[current.properties&3]!;
          const front=this.world.getState(x+dx,y,z+dz),tx=x+dx*2,tz=z+dz*2;
          if(this.world.isLoaded(tx,tz)&&isSolid(front.type)&&![Block.Chest,Block.Furnace,Block.CraftingStation,Block.Piston,Block.Door].includes(front.type)&&this.world.getState(tx,y,tz).type===Block.Air){
            edits.push({x:x+dx,y,z:z+dz,state:state(Block.Air)},{x:tx,y,z:tz,state:front});
            expected.push(front,state(Block.Air));
          }
        }
      }
    }
    if(!edits.length)return;this.busy=true;
    void this.world.apply(edits,expected).then(ok=>{if(ok)this.changed(edits);else for(const edit of edits)this.touch(edit.x,edit.y,edit.z);}).finally(()=>{this.busy=false;});
  }
}
