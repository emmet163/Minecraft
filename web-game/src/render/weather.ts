import * as THREE from 'three';
import type {Weather} from '../survival/state';
export class WeatherVisual{
  readonly group=new THREE.Group();private rain:THREE.InstancedMesh;private snow:THREE.InstancedMesh;private time=0;private dummy=new THREE.Object3D();
  constructor(){
    const rainGeo=new THREE.BoxGeometry(.025,.32,.025),snowGeo=new THREE.BoxGeometry(.075,.075,.075);
    this.rain=new THREE.InstancedMesh(rainGeo,new THREE.MeshBasicMaterial({color:'#8eb8dc',transparent:true,opacity:.6,depthWrite:false}),180);
    this.snow=new THREE.InstancedMesh(snowGeo,new THREE.MeshBasicMaterial({color:'#e5f2ff',transparent:true,opacity:.9,depthWrite:false}),180);
    this.group.add(this.rain,this.snow);this.rain.visible=this.snow.visible=false;
  }
  update(position:THREE.Vector3,weather:Weather,snowing:boolean,intensity:number,delta:number){
    this.group.position.copy(position);this.time+=delta;
    const active=intensity>.02;
    this.rain.visible=active&&!snowing;this.snow.visible=active&&snowing;
    if(!active)return;
    const field=snowing?this.snow:this.rain,count=Math.floor(180*intensity);field.count=count;
    const hash=(n:number)=>{let v=(Math.imul(n,747796405)+2891336453)>>>0;v=Math.imul((v>>>(v>>>28)+4)^v,277803737)>>>0;return ((v>>>22)^v)/0xffffffff;};
    for(let i=0;i<count;i++){
      const x=hash(i*73+11)*24-12+(snowing?Math.sin(this.time+i*.31)*.5:0),z=hash(i*97+23)*24-12;
      const speed=snowing?2:12,y=((hash(i*47+7)*18-this.time*speed)%18+18)%18-5;
      this.dummy.position.set(x,y,z);this.dummy.updateMatrix();field.setMatrixAt(i,this.dummy.matrix);
    }
    field.instanceMatrix.needsUpdate=true;
  }
  dispose(){for(const mesh of [this.rain,this.snow]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
