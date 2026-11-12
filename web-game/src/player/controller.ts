import * as THREE from 'three';
import { Block, cellOf, collisionBoxes, state, type BlockState } from '../world/blocks';

export interface CollisionWorld { get(x:number,y:number,z:number): Block; getState?(x:number,y:number,z:number):BlockState; isLoaded(x:number,z:number): boolean }
export class PlayerController {
  readonly object=new THREE.Group();
  readonly camera=new THREE.PerspectiveCamera(75,1,.05,700);
  readonly keys=new Set<string>();
  readonly velocity=new THREE.Vector3();
  sensitivity=.18;
  flying=false;
  onLand:(distance:number)=>void=()=>{};
  private airborne=false;private peakY=0;
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
  setFlight(value:boolean){this.flying=value;this.airborne=false;this.velocity.set(0,0,0);}
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
      const next=this.position.clone(); next[axis]+=step;
      if(this.collides(next.x,next.y,next.z,height)) {
        if(axis==='y' && step<0) this.grounded=true;
        this.velocity[axis]=0; return;
      }
      this.position[axis]+=step;
    }
  }
  update(delta:number): void {
    delta=Math.min(delta,.05);
    if(!this.world.isLoaded(cellOf(this.position.x),cellOf(this.position.z))) return;
    if(this.flying){
      const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
      const right=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
      const up=(this.keys.has('Space')?1:0)-(this.keys.has('ControlLeft')||this.keys.has('ControlRight')?1:0);
      const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?13:8;
      this.velocity.set(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right,up,-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right).normalize().multiplyScalar(speed);
      this.moveAxis('x',this.velocity.x*delta,1.8);this.moveAxis('z',this.velocity.z*delta,1.8);this.moveAxis('y',this.velocity.y*delta,1.8);return;
    }
    if(!this.grounded){if(!this.airborne){this.airborne=true;this.peakY=this.position.y;}else this.peakY=Math.max(this.peakY,this.position.y);}
    const crouching=this.keys.has('ControlLeft')||this.keys.has('ControlRight');
    const height=crouching?1.15:!this.collides(this.position.x,this.position.y,this.position.z,1.8)?1.8:1.15;
    this.camera.position.y=THREE.MathUtils.damp(this.camera.position.y,height===1.15?1.02:1.62,12,delta);
    const forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0);
    const right=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    const length=Math.hypot(forward,right)||1;
    const speed=crouching?2.5:this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?8:5;
    this.velocity.x=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right)/length*speed;
    this.velocity.z=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right)/length*speed;
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
