import * as THREE from 'three';

type Particle={life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number};
export class BurstParticles{
  readonly mesh:THREE.InstancedMesh;
  private readonly dummy=new THREE.Object3D();
  private readonly particles:Particle[]=Array.from({length:48},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));
  private cursor=0;
  constructor(){this.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.085,.085,.085),new THREE.MeshBasicMaterial({color:'#cbb791'}),48);
    this.mesh.frustumCulled=false;this.mesh.count=0;}
  burst(position:THREE.Vector3,count=12){
    for(let i=0;i<count;i++){const p=this.particles[this.cursor]!;this.cursor=(this.cursor+1)%this.particles.length;
      const angle=i*2.399963,spread=.7+(i%3)*.25;
      p.life=.35+(i%4)*.07;p.x=position.x;p.y=position.y;p.z=position.z;
      p.vx=Math.cos(angle)*spread;p.vy=1.8+(i%5)*.35;p.vz=Math.sin(angle)*spread;}
  }
  update(delta:number){let active=0;
    for(const p of this.particles){if(p.life<=0)continue;p.life=Math.max(0,p.life-delta);if(p.life===0)continue;
      p.vy-=delta*9;p.x+=p.vx*delta;p.y+=p.vy*delta;p.z+=p.vz*delta;
      this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(Math.min(1,p.life*4));this.dummy.updateMatrix();this.mesh.setMatrixAt(active++,this.dummy.matrix);}
    this.mesh.count=active;if(active)this.mesh.instanceMatrix.needsUpdate=true;}
  dispose(){this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}
