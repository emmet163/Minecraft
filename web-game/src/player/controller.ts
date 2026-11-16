import * as THREE from 'three';
import { Block, cellOf, collisionBoxes, state, type BlockState } from '../world/blocks';

export interface CollisionWorld { get(x:number,y:number,z:number): Block; getState?(x:number,y:number,z:number):BlockState; isLoaded(x:number,z:number): boolean }
export type WaterMode='land'|'wading'|'floating'|'swimming'|'diving'|'exiting';
export interface WaterContact {submersion:number;headUnder:boolean;surface:number}
const SWIM_STEP=1/120,PLAYER_HEIGHT=1.8,PLAYER_RADIUS=.34;
export function waterHeight(block:BlockState):number{
  return block.type===Block.Water?1:block.type===Block.WaterFlow?.92-Math.min(7,block.properties&7)*.08:0;
}
export class PlayerController {
  readonly object=new THREE.Group();
  readonly camera=new THREE.PerspectiveCamera(75,1,.05,700);
  readonly keys=new Set<string>();
  readonly velocity=new THREE.Vector3();
  readonly knockback=new THREE.Vector3();
  sensitivity=.18;
  flying=false;
  speedMultiplier=1;
  onLand:(distance:number)=>void=()=>{};
  onSplash:(surface:number)=>void=()=>{};
  private airborne=false;private peakY=0;
  private swimRemainder=0;waterMode:WaterMode='land';submersion=0;headSubmerged=false;
  yaw=0; pitch=0;
  grounded=false;
  private jumpHeld=false;
  constructor(readonly world: CollisionWorld) {
    this.object.add(this.camera); this.camera.position.y=1.62;
  }
  get position(): THREE.Vector3 { return this.object.position; }
  look(dx:number,dy:number): void {
    this.yaw-=dx*this.sensitivity*.01;
    this.pitch=Math.max(-Math.PI*.494,Math.min(Math.PI*.494,this.pitch-dy*this.sensitivity*.01));
    this.object.rotation.y=this.yaw; this.camera.rotation.x=this.pitch;
  }
  setFlight(value:boolean){this.flying=value;this.airborne=false;this.velocity.set(0,0,0);this.knockback.set(0,0,0);}
  private sampleWater():WaterContact{
    const p=this.position,headY=p.y+this.camera.position.y,minX=p.x-PLAYER_RADIUS,maxX=p.x+PLAYER_RADIUS;
    const minZ=p.z-PLAYER_RADIUS,maxZ=p.z+PLAYER_RADIUS;let submersion=0,surface=Number.NEGATIVE_INFINITY,headUnder=false;
    for(let bx=cellOf(minX);bx<=cellOf(maxX);bx++)for(let bz=cellOf(minZ);bz<=cellOf(maxZ);bz++){
      if(!this.world.isLoaded(bx,bz))continue;
      const width=Math.max(0,Math.min(maxX,bx+.5)-Math.max(minX,bx-.5));
      const depth=Math.max(0,Math.min(maxZ,bz+.5)-Math.max(minZ,bz-.5));
      if(width<=0||depth<=0)continue;
      const area=width*depth/(PLAYER_RADIUS*2)**2;
      for(let by=cellOf(p.y);by<=cellOf(p.y+PLAYER_HEIGHT);by++){
        const block=this.world.getState?.(bx,by,bz)??state(this.world.get(bx,by,bz)),height=waterHeight(block);
        if(!height)continue;
        const bottom=by-.5,top=bottom+height;
        const overlap=Math.max(0,Math.min(p.y+PLAYER_HEIGHT,top)-Math.max(p.y,bottom));
        submersion+=area*overlap/PLAYER_HEIGHT;surface=Math.max(surface,top);
        if(bx===cellOf(p.x)&&bz===cellOf(p.z)&&headY>=bottom&&headY<top-.025)headUnder=true;
      }
    }
    return {submersion:Math.min(1,submersion),headUnder,surface};
  }
  private updateWater(delta:number):void{
    this.camera.position.y=THREE.MathUtils.damp(this.camera.position.y,1.62,12,delta);
    this.swimRemainder=Math.min(this.swimRemainder+delta,.12);
    while(this.swimRemainder>=SWIM_STEP){this.swimRemainder-=SWIM_STEP;
      const contact=this.sampleWater();if(contact.submersion<=.001)break;
      const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
      const right=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),length=Math.hypot(forward,right)||1;
      const speed=contact.submersion<.45?3.7:2.9,blend=Math.min(1,SWIM_STEP*8);
      const targetX=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right)/length*speed*this.speedMultiplier;
      const targetZ=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right)/length*speed*this.speedMultiplier;
      this.velocity.x+=(targetX+this.knockback.x-this.velocity.x)*blend;
      this.velocity.z+=(targetZ+this.knockback.z-this.velocity.z)*blend;
      this.knockback.multiplyScalar(Math.max(0,1-7*SWIM_STEP));
      const up=this.keys.has('Space'),down=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||
        this.keys.has('ControlLeft')||this.keys.has('ControlRight');
      if(up&&this.grounded&&contact.submersion<.55){this.velocity.y=5.3;this.grounded=false;}
      const lookLift=forward*Math.sin(this.pitch)*4;
      this.velocity.y+=(-22+27.5*contact.submersion+(up?16:0)-(down?17:0)+lookLift-this.velocity.y*3.2)*SWIM_STEP;
      this.velocity.y=THREE.MathUtils.clamp(this.velocity.y,-3.6,3.2);
      this.moveAxis('x',this.velocity.x*SWIM_STEP,PLAYER_HEIGHT);
      this.moveAxis('z',this.velocity.z*SWIM_STEP,PLAYER_HEIGHT);
      this.grounded=false;this.moveAxis('y',this.velocity.y*SWIM_STEP,PLAYER_HEIGHT);
    }
    const contact=this.sampleWater(),wasWet=this.submersion>.015;
    this.submersion=contact.submersion;this.headSubmerged=contact.headUnder;
    if(!wasWet&&contact.submersion>.015&&Number.isFinite(contact.surface))this.onSplash(contact.surface);
    if(contact.submersion>.001){this.airborne=false;
      const down=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||this.keys.has('ControlLeft')||this.keys.has('ControlRight');
      this.waterMode=down?'diving':contact.headUnder?'swimming':this.grounded||contact.submersion<.45?'wading':'floating';
    }else{this.waterMode='exiting';this.velocity.y=Math.min(this.velocity.y,2.2);this.swimRemainder=0;}
    this.jumpHeld=this.keys.has('Space');
  }
  private collides(x:number,y:number,z:number,height:number): boolean {
    const radius=.34;
    for(let bz=cellOf(z-radius);bz<=cellOf(z+radius);bz++)
      for(let bx=cellOf(x-radius);bx<=cellOf(x+radius);bx++) {
        if(!this.world.isLoaded(bx,bz)) return true;
        for(let by=cellOf(y);by<=cellOf(y+height);by++) {
          const block=this.world.getState?.(bx,by,bz) ?? state(this.world.get(bx,by,bz));
          for(const box of collisionBoxes(block))
            if(x+radius>bx+box.minX && x-radius<bx+box.maxX && z+radius>bz+box.minZ && z-radius<bz+box.maxZ &&
              y+height>by+box.minY && y<by+box.maxY) return true;
        }
      }
    return false;
  }
  private moveAxis(axis:'x'|'y'|'z',amount:number,height:number): void {
    const steps=Math.max(1,Math.ceil(Math.abs(amount)/.2)),step=amount/steps;
    for(let i=0;i<steps;i++) {
      const x=this.position.x+(axis==='x'?step:0),y=this.position.y+(axis==='y'?step:0),z=this.position.z+(axis==='z'?step:0);
      if(this.collides(x,y,z,height)) {
        if(axis==='y' && step<0) this.grounded=true;
        this.velocity[axis]=0; return;
      }
      this.position[axis]+=step;
    }
  }
  update(delta:number): void {
    delta=Math.min(delta,.12);
    if(!this.world.isLoaded(cellOf(this.position.x),cellOf(this.position.z))) return;
    if(this.flying){
      const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
      const right=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
      const up=(this.keys.has('Space')?1:0)-(this.keys.has('ControlLeft')||this.keys.has('ControlRight')?1:0);
      const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?13:8;
      this.velocity.set(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right,up,-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right).normalize().multiplyScalar(speed);
      this.moveAxis('x',this.velocity.x*delta,1.8);this.moveAxis('z',this.velocity.z*delta,1.8);this.moveAxis('y',this.velocity.y*delta,1.8);
      const contact=this.sampleWater();this.submersion=contact.submersion;this.headSubmerged=contact.headUnder;return;
    }
    const water=this.sampleWater();
    if(water.submersion>.001){this.updateWater(delta);return;}
    this.waterMode=this.submersion>.001?'exiting':'land';this.submersion=0;this.headSubmerged=false;this.swimRemainder=0;
    if(!this.grounded){if(!this.airborne){this.airborne=true;this.peakY=this.position.y;}else this.peakY=Math.max(this.peakY,this.position.y);}
    const crouching=this.keys.has('ControlLeft')||this.keys.has('ControlRight');
    const height=crouching?1.15:!this.collides(this.position.x,this.position.y,this.position.z,1.8)?1.8:1.15;
    this.camera.position.y=THREE.MathUtils.damp(this.camera.position.y,height===1.15?1.02:1.62,12,delta);
    const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
    const right=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    const length=Math.hypot(forward,right)||1;
    const speed=crouching?2.5:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?8:5;
    this.velocity.x=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right)/length*speed*this.speedMultiplier+this.knockback.x;
    this.velocity.z=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right)/length*speed*this.speedMultiplier+this.knockback.z;
    this.knockback.multiplyScalar(Math.max(0,1-7*delta));
    const jump=this.keys.has('Space');
    if(jump && !this.jumpHeld && this.grounded) { this.velocity.y=7; this.grounded=false; }
    this.jumpHeld=jump;
    this.velocity.y=Math.max(-35,this.velocity.y-22*delta);
    this.moveAxis('x',this.velocity.x*delta,height);
    this.moveAxis('z',this.velocity.z*delta,height);
    this.grounded=false;
    this.moveAxis('y',this.velocity.y*delta,height);
    if(this.grounded&&this.airborne){this.airborne=false;this.onLand(Math.max(0,this.peakY-this.position.y));}
  }
  overlapsBlock(x:number,y:number,z:number,block:BlockState=state(Block.Stone)): boolean {
    const p=this.position,r=.34;
    return collisionBoxes(block).some(box=>p.x+r>x+box.minX && p.x-r<x+box.maxX && p.z+r>z+box.minZ &&
      p.z-r<z+box.maxZ && p.y+1.8>y+box.minY && p.y<y+box.maxY);
  }
}
