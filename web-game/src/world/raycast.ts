import * as THREE from 'three';
import { Block, collisionBoxes, isShaped, type BlockState, type Box } from './blocks';

export interface RayWorld { getState(x:number,y:number,z:number): BlockState }
export interface Hit { x:number;y:number;z:number;normal:THREE.Vector3;state:BlockState;distance:number }
// Grid coordinates use block centers at integers; +0.5 maps them to unit DDA cells.
export function traceBlocks(world: RayWorld,origin: THREE.Vector3,direction: THREE.Vector3,maxDistance=6): Hit|null {
  const ox=origin.x+.5,oy=origin.y+.5,oz=origin.z+.5;
  let x=Math.floor(ox),y=Math.floor(oy),z=Math.floor(oz),distance=0;
  const dx=direction.x,dy=direction.y,dz=direction.z;
  const sx=Math.sign(dx),sy=Math.sign(dy),sz=Math.sign(dz);
  let tx=sx ? ((sx>0?x+1:x)-ox)/dx : Infinity;
  let ty=sy ? ((sy>0?y+1:y)-oy)/dy : Infinity;
  let tz=sz ? ((sz>0?z+1:z)-oz)/dz : Infinity;
  const stepx=sx ? Math.abs(1/dx):Infinity,stepy=sy?Math.abs(1/dy):Infinity,stepz=sz?Math.abs(1/dz):Infinity;
  let normal=new THREE.Vector3();
  for(let i=0;i<96 && distance<=maxDistance;i++) {
    const s=world.getState(x,y,z);
    if(s.type!==Block.Air && s.type!==Block.Water) {
      const decorative=s.type===Block.Plant||s.type===Block.Flower;
      const shapes:Box[]=decorative?[{minX:-.2,maxX:.2,minY:-.35,maxY:.35,minZ:-.2,maxZ:.2}]:
        isShaped(s.type)?collisionBoxes(s):[];
      const shapeHit=shapes.length ? shapes.some(box=>rayBox(origin,direction,x,y,z,distance,Math.min(tx,ty,tz),box)) : true;
      if(shapeHit) return {x,y,z,normal:normal.clone(),state:s,distance};
    }
    if(tx<=ty && tx<=tz) { x+=sx; distance=tx; tx+=stepx; normal.set(-sx,0,0); }
    else if(ty<=tz) { y+=sy; distance=ty; ty+=stepy; normal.set(0,-sy,0); }
    else { z+=sz; distance=tz; tz+=stepz; normal.set(0,0,-sz); }
  }
  return null;
}
function rayBox(o:THREE.Vector3,d:THREE.Vector3,x:number,y:number,z:number,start:number,end:number,box:Box): boolean {
  let lo=Math.max(0,start),hi=end;
  for(const [origin,dir,min,max] of [[o.x,d.x,x+box.minX,x+box.maxX],[o.y,d.y,y+box.minY,y+box.maxY],
    [o.z,d.z,z+box.minZ,z+box.maxZ]]) {
    if(Math.abs(dir!)<1e-9) { if(origin!<min!||origin!>max!) return false; continue; }
    const a=(min!-origin!)/dir!,b=(max!-origin!)/dir!;
    lo=Math.max(lo,Math.min(a,b)); hi=Math.min(hi,Math.max(a,b));
    if(lo>hi) return false;
  }
  return true;
}
