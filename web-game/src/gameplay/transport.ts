import * as THREE from 'three';
import {Block,isSolid} from '../world/blocks';

export type VehicleKind='cart'|'boat';
export interface VehicleRecord{id:number;kind:VehicleKind;x:number;y:number;z:number;yaw:number}
export interface VehicleSave{vehicles:VehicleRecord[];mounted:number|null}
export interface VehicleWorld{get(x:number,y:number,z:number):Block;isLoaded(x:number,z:number):boolean}
const rail=(b:Block)=>b===Block.Rail;
const water=(b:Block)=>b===Block.Water||b===Block.WaterFlow;
export class VehicleSystem{
  readonly group=new THREE.Group();readonly vehicles:VehicleRecord[]=[];mounted:number|null=null;
  private meshes=new Map<number,THREE.Group>();private nextId=1;
  private box=new THREE.BoxGeometry(1,1,1);
  private cartMaterial=new THREE.MeshLambertMaterial({color:'#8d7659'});
  private boatMaterial=new THREE.MeshLambertMaterial({color:'#ad7950'});
  constructor(readonly world:VehicleWorld){}
  clear(){for(const mesh of this.meshes.values())this.group.remove(mesh);this.meshes.clear();this.vehicles.length=0;this.mounted=null;this.nextId=1;}
  dispose(){this.clear();this.box.dispose();this.cartMaterial.dispose();this.boatMaterial.dispose();}
  private mesh(record:VehicleRecord){const group=new THREE.Group(),material=record.kind==='cart'?this.cartMaterial:this.boatMaterial;
    const base=new THREE.Mesh(this.box,material);base.scale.set(record.kind==='cart'?.9:1.5,.35,record.kind==='cart'?.9:.9);group.add(base);
    for(const side of [-1,1]){const rail=new THREE.Mesh(this.box,material);rail.scale.set(record.kind==='cart'?.12:.13,.32,record.kind==='cart'?.9:1.35);
      rail.position.set(side*(record.kind==='cart'?.4:.68),.25,0);group.add(rail);}
    group.position.set(record.x,record.y,record.z);group.rotation.y=record.yaw;this.group.add(group);this.meshes.set(record.id,group);
  }
  place(kind:VehicleKind,x:number,y:number,z:number){if(this.vehicles.length>=32||!this.world.isLoaded(x,z))return false;
    const block=this.world.get(x,y,z);if(kind==='cart'?!rail(block):!water(block))return false;
    if(this.vehicles.some(v=>Math.hypot(v.x-x,v.z-z)<1.2))return false;
    const record={id:this.nextId++,kind,x,y:y+.58,z,yaw:0};this.vehicles.push(record);this.mesh(record);return true;
  }
  toggleMount(position:THREE.Vector3){if(this.mounted!==null){const vehicle=this.vehicles.find(v=>v.id===this.mounted);this.mounted=null;
      if(vehicle){const x=Math.round(vehicle.x+1),z=Math.round(vehicle.z);
        if(this.world.isLoaded(x,z)&&!isSolid(this.world.get(x,Math.floor(vehicle.y+1),z)))position.set(x,vehicle.y+.5,z);}
      return false;
    }
    const nearest=this.vehicles.find(v=>Math.hypot(v.x-position.x,v.z-position.z)<2.4&&Math.abs(v.y-position.y)<2.5);
    if(!nearest)return false;this.mounted=nearest.id;position.set(nearest.x,nearest.y+.35,nearest.z);return true;
  }
  tick(delta:number,keys:ReadonlySet<string>,yaw:number,position:THREE.Vector3){if(this.mounted===null)return false;
    const vehicle=this.vehicles.find(v=>v.id===this.mounted);if(!vehicle){this.mounted=null;return false;}
    const throttle=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),speed=vehicle.kind==='cart'?6:3.5;
    if(throttle){let dx=-Math.sin(yaw),dz=-Math.cos(yaw);
      if(vehicle.kind==='cart'){const cx=Math.round(vehicle.x),cz=Math.round(vehicle.z),by=Math.floor(vehicle.y);
        const east=rail(this.world.get(cx+1,by,cz))||rail(this.world.get(cx-1,by,cz));
        const north=rail(this.world.get(cx,by,cz+1))||rail(this.world.get(cx,by,cz-1));
        if(east&&!north){dx=Math.sign(dx)||1;dz=0;}else if(north&&!east){dx=0;dz=Math.sign(dz)||-1;}
      }
      const nx=vehicle.x+dx*speed*delta*throttle,nz=vehicle.z+dz*speed*delta*throttle,
        surface=this.world.get(Math.round(nx),Math.floor(vehicle.y),Math.round(nz));
      if(this.world.isLoaded(nx,nz)&&(vehicle.kind==='cart'?rail(surface):water(surface))){vehicle.x=nx;vehicle.z=nz;vehicle.yaw=Math.atan2(-dx,-dz);}
    }
    this.meshes.get(vehicle.id)?.position.set(vehicle.x,vehicle.y,vehicle.z);
    const mesh=this.meshes.get(vehicle.id);if(mesh)mesh.rotation.y=vehicle.yaw;
    position.set(vehicle.x,vehicle.y+.35,vehicle.z);return true;
  }
  snapshot():VehicleSave{return {vehicles:this.vehicles.map(v=>({...v})),mounted:this.mounted};}
  load(save?:VehicleSave){this.clear();for(const record of save?.vehicles||[]){if(!['cart','boat'].includes(record.kind)||![record.x,record.y,record.z].every(Number.isFinite))continue;
      this.vehicles.push({...record});this.mesh(record);this.nextId=Math.max(this.nextId,record.id+1);}
    this.mounted=save?.mounted&&this.vehicles.some(v=>v.id===save.mounted)?save.mounted:null;}
}
