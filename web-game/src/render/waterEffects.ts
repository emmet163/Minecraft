import * as THREE from 'three';

interface Bubble{life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number}
export class WaterEffects{
  readonly mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.08,.08,.08),
    new THREE.MeshBasicMaterial({color:'#c0eaff',transparent:true,opacity:.62,depthWrite:false}),48);
  private particles:Bubble[]=Array.from({length:48},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:1}));
  private dummy=new THREE.Object3D();private cursor=0;private clock=0;private randomState=93547;
  constructor(){this.mesh.count=0;this.mesh.frustumCulled=false;}
  private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  splash(x:number,y:number,z:number){for(let i=0;i<12;i++){
    const p=this.particles[this.cursor]!;this.cursor=(this.cursor+1)%this.particles.length;
    const angle=i*Math.PI*2/12;p.life=.35+this.random()*.3;p.x=x;p.y=y;p.z=z;
    p.vx=Math.cos(angle)*(1+this.random());p.vy=1+this.random()*1.4;p.vz=Math.sin(angle)*(1+this.random());p.size=.8;
  }}
  update(delta:number,position:THREE.Vector3,underwater:boolean){
    if(underwater){this.clock+=delta;while(this.clock>=.12){this.clock-=.12;
      const p=this.particles[this.cursor]!;this.cursor=(this.cursor+1)%this.particles.length;
      p.life=1.3+this.random();p.x=position.x+(this.random()-.5)*1.6;p.y=position.y+.35;
      p.z=position.z+(this.random()-.5)*1.6;p.vx=(this.random()-.5)*.2;p.vy=.55+this.random()*.35;
      p.vz=(this.random()-.5)*.2;p.size=.45+this.random()*.4;
    }}else this.clock=0;
    let active=0;for(const p of this.particles){if(p.life<=0)continue;p.life=Math.max(0,p.life-delta);if(!p.life)continue;
      p.x+=p.vx*delta;p.y+=p.vy*delta;p.z+=p.vz*delta;
      if(p.vy>1)p.vy-=delta*4;
      this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(p.size*Math.min(1,p.life*3));this.dummy.updateMatrix();
      this.mesh.setMatrixAt(active++,this.dummy.matrix);
    }this.mesh.count=active;if(active)this.mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}
