import * as THREE from 'three';
import type {Weather} from '../survival/state';
import {Biome} from '../world/generator';
export class WeatherVisual{
  density=1;
  readonly group=new THREE.Group();private rain:THREE.InstancedMesh;private snow:THREE.InstancedMesh;private motes:THREE.InstancedMesh;private time=0;private dummy=new THREE.Object3D();
  constructor(){
    const rainGeo=new THREE.BoxGeometry(.025,.32,.025),snowGeo=new THREE.BoxGeometry(.075,.075,.075);
    this.rain=new THREE.InstancedMesh(rainGeo,new THREE.MeshBasicMaterial({color:'#8eb8dc',transparent:true,opacity:.6,depthWrite:false}),180);
    this.snow=new THREE.InstancedMesh(snowGeo,new THREE.MeshBasicMaterial({color:'#e5f2ff',transparent:true,opacity:.9,depthWrite:false}),180);
    this.motes=new THREE.InstancedMesh(new THREE.BoxGeometry(.055,.055,.055),new THREE.MeshBasicMaterial({color:'#ddc692',transparent:true,opacity:.55,depthWrite:false}),64);
    this.group.add(this.rain,this.snow,this.motes);this.rain.visible=this.snow.visible=this.motes.visible=false;
  }
  update(position:THREE.Vector3,weather:Weather,snowing:boolean,intensity:number,delta:number,biome:Biome=Biome.Plains){
    this.group.position.copy(position);this.time+=delta;
    const active=intensity>.02;
    this.rain.visible=active&&!snowing;this.snow.visible=active&&snowing;
    const hash=(n:number)=>{let v=(Math.imul(n,747796405)+2891336453)>>>0;v=Math.imul((v>>>(v>>>28)+4)^v,277803737)>>>0;return ((v>>>22)^v)/0xffffffff;};
    if(active){const field=snowing?this.snow:this.rain,count=Math.floor(180*intensity*this.density);field.count=count;
      for(let i=0;i<count;i++){
        const x=hash(i*73+11)*24-12+(snowing?Math.sin(this.time+i*.31)*.5:0),z=hash(i*97+23)*24-12;
        const speed=snowing?2:12,y=((hash(i*47+7)*18-this.time*speed)%18+18)%18-5;
        this.dummy.position.set(x,y,z);this.dummy.updateMatrix();field.setMatrixAt(i,this.dummy.matrix);}
      field.instanceMatrix.needsUpdate=true;
    }
    const climate=weather==='clear'&&(biome===Biome.Desert||biome===Biome.Forest||biome===Biome.Swamp);
    this.motes.visible=climate;if(!climate)return;
    (this.motes.material as THREE.MeshBasicMaterial).color.set(biome===Biome.Desert?'#dec392':biome===Biome.Swamp?'#8cbe9b':'#d0de8a');
    this.motes.count=Math.floor(64*this.density);
    for(let i=0;i<this.motes.count;i++){const x=hash(i*31+5)*18-9,z=hash(i*43+9)*18-9;
      const y=((hash(i*23+7)*12+this.time*.18)%12)-3;
      this.dummy.position.set(x+Math.sin(this.time*.3+i)*.4,y,z);this.dummy.updateMatrix();this.motes.setMatrixAt(i,this.dummy.matrix);}
    this.motes.instanceMatrix.needsUpdate=true;
  }
  dispose(){for(const mesh of [this.rain,this.snow,this.motes]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}}
}
