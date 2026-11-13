import * as THREE from 'three';
import raw from './creatures.json';
import {Block,cellOf,collisionBoxes,isSolid,type BlockState} from '../world/blocks';
import {biomeNames,type Biome} from '../world/generator';
import {traceBlocks} from '../world/raycast';
import type {StructureSite,SitePoint} from '../world/structures';

export type CreatureKind='peaceful'|'neutral'|'hostile'|'friendly';
export type CreatureState='idle'|'wander'|'graze'|'chase'|'attack'|'flee';
export type Occupation='farmer'|'mason'|'cartographer';
export interface Inhabitant{key:string;occupation:Occupation;home:SitePoint;work:SitePoint;market:SitePoint}
interface PartDef{size:[number,number,number];offset:[number,number,number];color:string;role?:'head'|'leg'}
export interface CreatureDef{id:string;name:string;kind:CreatureKind;attackMode:'none'|'melee'|'ranged';biomes:string[];
  realm?:'veil';
  health:number;speed:number;damage:number;range:number;cooldown:number;experience:number;drop:string;dropCount:number;
  radius:number;height:number;parts:PartDef[]}
export const creatureDefs:CreatureDef[]=raw as CreatureDef[];
export interface CreatureWorld{get(x:number,y:number,z:number):Block;getState(x:number,y:number,z:number):BlockState;
  isLoaded(x:number,z:number):boolean;generator:{surfaceHeight(x:number,z:number):number;biomeAt(x:number,z:number):Biome;realm?:'overworld'|'veil'}}
export interface CreatureView{position:THREE.Vector3;health:number;maxHealth:number;name:string;state:CreatureState;kind:CreatureKind}
export class Creature{
  readonly group=new THREE.Group();readonly legs:THREE.Mesh[]=[];readonly heads:THREE.Mesh[]=[];readonly meshes:THREE.Mesh[]=[];
  health:number;state:CreatureState='idle';velocityY=0;grounded=false;knockX=0;knockZ=0;
  aggression=0;flee=0;attackClock=0;thinkClock=0;decisionClock=0;deadClock=0;hurtClock=0;age=0;phase=0;heading=0;
  avoidClock=0;avoidHeading=0;
  inhabitant?:Inhabitant;tunic?:string;dungeonKey?:string;
  breedCooldown=0;
  constructor(readonly id:number,readonly def:CreatureDef,geometry:THREE.BoxGeometry,material:(color:string)=>THREE.Material){
    this.health=def.health;
    for(const part of def.parts){const mesh=new THREE.Mesh(geometry,material(part.color));mesh.scale.set(...part.size);mesh.position.set(...part.offset);
      mesh.castShadow=true;this.group.add(mesh);this.meshes.push(mesh);if(part.role==='leg')this.legs.push(mesh);if(part.role==='head')this.heads.push(mesh);}
  }
  get position(){return this.group.position;}
  get alive(){return this.health>0;}
  get view():CreatureView{return {position:this.position,health:this.health,maxHealth:this.def.health,name:this.def.name,state:this.state,kind:this.def.kind};}
}
interface Projectile{mesh:THREE.Mesh;vx:number;vy:number;vz:number;age:number;damage:number}
const TWO_PI=Math.PI*2;
export class CreatureSystem{
  readonly group=new THREE.Group();readonly creatures:Creature[]=[];readonly projectiles:Projectile[]=[];
  readonly maxPopulation=24;readonly activeRadius=36;readonly despawnRadius=64;
  onDeath:(creature:Creature)=>void=()=>{};
  onPlayerHit:(damage:number,from:THREE.Vector3)=>void=()=>{};
  private box=new THREE.BoxGeometry(1,1,1);private shotBox=new THREE.BoxGeometry(.18,.18,.18);
  private shotMaterial=new THREE.MeshLambertMaterial({color:'#ffad68',emissive:'#773511'});
  private hitMaterial=new THREE.MeshLambertMaterial({color:'#ff655e',emissive:'#48100b'});
  private materials=new Map<string,THREE.Material>();private nextId=1;private randomState=1;private spawnClock=0;
  constructor(readonly world:CreatureWorld){this.materials.set('__hit',this.hitMaterial);}
  configure(seed:number){this.clear();this.randomState=((seed|0)^0x72ab4e33)>>>0;this.spawnClock=0;}
  private random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/0x100000000;}
  private material(color:string){let value=this.materials.get(color);if(!value){value=new THREE.MeshLambertMaterial({color});this.materials.set(color,value);}return value;}
  spawnAt(id:string,x:number,y:number,z:number):Creature|undefined{
    const def=creatureDefs.find(value=>value.id===id);if(!def||this.creatures.length>=this.maxPopulation||!this.world.isLoaded(x,z))return;
    const creature=new Creature(this.nextId++,def,this.box,color=>this.material(color));creature.position.set(x,y,z);
    creature.heading=this.random()*TWO_PI;creature.thinkClock=this.random()*.3;
    this.group.add(creature.group);this.creatures.push(creature);return creature;
  }
  ensureVillage(site:StructureSite,deceased:ReadonlySet<string>):void{
    if(site.kind!=='village')return;
    const jobs:Occupation[]=['farmer','mason','cartographer'];
    for(let i=0;i<site.homes.length;i++){
      const home=site.homes[i]!,key=`${site.id}:${i}`;
      if(deceased.has(key)||this.creatures.some(c=>c.inhabitant?.key===key)||this.creatures.length>=this.maxPopulation)continue;
      const porch={x:home.x,y:this.world.generator.surfaceHeight(home.x,home.z+5),z:home.z+5};
      const c=this.spawnAt('hearthfolk',porch.x,porch.y+.51,porch.z);if(!c)continue;
      c.inhabitant={key,occupation:jobs[i%jobs.length]!,home:porch,work:site.work,market:{x:site.x,y:site.y,z:site.z}};
      c.tunic=['#7d9857','#8a7772','#637f9c'][i%3]!;
    }
  }
  ensureDungeon(site:StructureSite,defeated:ReadonlySet<string>):void{
    if(site.kind!=='dungeon')return;
    for(let i=0;i<2;i++){
      const key=`${site.id}:${i}`;
      if(defeated.has(key)||this.creatures.some(c=>c.dungeonKey===key)||this.creatures.length>=this.maxPopulation)continue;
      const c=this.spawnAt(i?'ember_spitter':'dusk_stalker',site.x+(i?3:-3),site.y-11.49,site.z+2);
      if(c)c.dungeonKey=key;
    }
  }
  breed(c:Creature):Creature|undefined{if(c.def.kind!=='peaceful'||!c.alive||c.breedCooldown>0)return;
    const child=this.spawnAt(c.def.id,c.position.x+1,c.position.y,c.position.z+1);if(!child)return;
    child.group.scale.setScalar(.68);child.breedCooldown=120;c.breedCooldown=120;return child;
  }
  private removeAt(index:number){const creature=this.creatures[index]!;this.group.remove(creature.group);this.creatures.splice(index,1);}
  private removeShot(index:number){const shot=this.projectiles[index]!;this.group.remove(shot.mesh);this.projectiles.splice(index,1);}
  clear(){for(let i=this.creatures.length-1;i>=0;i--)this.removeAt(i);for(let i=this.projectiles.length-1;i>=0;i--)this.removeShot(i);}
  dispose(){this.clear();this.box.dispose();this.shotBox.dispose();for(const material of this.materials.values())material.dispose();this.shotMaterial.dispose();}
  private solid(x:number,y:number,z:number){return isSolid(this.world.get(cellOf(x),cellOf(y),cellOf(z)));}
  private collides(c:Creature,x:number,y:number,z:number):boolean{
    const r=c.def.radius,h=c.def.height;
    for(let bx=cellOf(x-r);bx<=cellOf(x+r);bx++)for(let bz=cellOf(z-r);bz<=cellOf(z+r);bz++){
      if(!this.world.isLoaded(bx,bz))return true;
      for(let by=cellOf(y);by<=cellOf(y+h);by++)for(const box of collisionBoxes(this.world.getState(bx,by,bz)))
        if(x+r>bx+box.minX&&x-r<bx+box.maxX&&z+r>bz+box.minZ&&z-r<bz+box.maxZ&&y+h>by+box.minY&&y<by+box.maxY)return true;
    }
    return false;
  }
  private supportAhead(x:number,y:number,z:number){for(let i=0;i<3;i++)if(this.solid(x,y-.55-i,z))return true;return false;}
  private walk(c:Creature,dx:number,dz:number,step:number){
    const nx=c.position.x+dx*step,nz=c.position.z+dz*step;
    if(!this.supportAhead(nx,c.position.y,nz))return false;
    if(!this.collides(c,nx,c.position.y,nz)){c.position.x=nx;c.position.z=nz;return true;}
    if(c.grounded&&!this.collides(c,nx,c.position.y+1,nz)&&this.supportAhead(nx,c.position.y+1,nz)){
      c.position.set(nx,c.position.y+1,nz);c.grounded=false;return true;
    }
    return false;
  }
  private navigate(c:Creature,angle:number,delta:number){const step=c.def.speed*delta;
    if(c.avoidClock>0){angle=c.avoidHeading;c.avoidClock=Math.max(0,c.avoidClock-delta);}
    for(const offset of [0,.55,-.55,1.15,-1.15]){
      const direction=angle+offset;if(this.walk(c,Math.sin(direction),Math.cos(direction),step)){
        c.heading=direction;c.phase+=delta*c.def.speed*7;return;
      }
    }
    if(c.avoidClock<=0){c.avoidClock=1.3;c.avoidHeading=angle+(c.id&1?1:-1)*1.95;}
    if(c.grounded)c.velocityY=5.2;
  }
  private vertical(c:Creature,delta:number){c.velocityY=Math.max(-24,c.velocityY-22*delta);
    const dy=c.velocityY*delta,steps=Math.max(1,Math.ceil(Math.abs(dy)/.2));c.grounded=false;
    for(let i=0;i<steps;i++){const next=c.position.y+dy/steps;if(this.collides(c,c.position.x,next,c.position.z)){
      if(c.velocityY<0)c.grounded=true;c.velocityY=0;break;
    }c.position.y=next;}
  }
  private canSee(c:Creature,player:THREE.Vector3){const origin=new THREE.Vector3(c.position.x,c.position.y+c.def.height*.75,c.position.z);
    const direction=new THREE.Vector3(player.x-origin.x,player.y+1.2-origin.y,player.z-origin.z),distance=direction.length();
    if(distance<.01)return true;direction.divideScalar(distance);const hit=traceBlocks(this.world,origin,direction,distance);
    return !hit||hit.distance>distance-.4;
  }
  private fire(c:Creature,player:THREE.Vector3){const start=new THREE.Vector3(c.position.x,c.position.y+c.def.height*.7,c.position.z);
    const direction=new THREE.Vector3(player.x-start.x,player.y+1.1-start.y,player.z-start.z).normalize();
    const mesh=new THREE.Mesh(this.shotBox,this.shotMaterial);mesh.position.copy(start);this.group.add(mesh);
    this.projectiles.push({mesh,vx:direction.x*9,vy:direction.y*9,vz:direction.z*9,age:0,damage:c.def.damage});
  }
  private think(c:Creature,player:THREE.Vector3,playerVulnerable:boolean,hour:number){const dx=player.x-c.position.x,dz=player.z-c.position.z,dist=Math.hypot(dx,dz);
    const vertical=Math.abs(player.y-c.position.y),inReach=dist<=c.def.range&&vertical<(c.def.attackMode==='melee'?2:8);
    if((c.def.kind==='peaceful'||c.def.kind==='friendly')&&c.flee>0){c.state='flee';c.heading=Math.atan2(-dx,-dz);return;}
    if(c.inhabitant){const waypoint=hour<6||hour>=20?c.inhabitant.home:hour<17?c.inhabitant.work:c.inhabitant.market;
      const wx=waypoint.x-c.position.x,wz=waypoint.z-c.position.z;
      c.state=Math.hypot(wx,wz)>1.3?'wander':hour>=6&&hour<17?'graze':'idle';
      if(c.state==='wander')c.heading=Math.atan2(wx,wz);return;
    }
    const aggressive=c.def.kind==='hostile'||c.def.kind==='neutral'&&c.aggression>0;
    if(aggressive&&playerVulnerable&&dist<16&&vertical<8){c.state=inReach&&this.canSee(c,player)?'attack':'chase';c.heading=Math.atan2(dx,dz);return;}
    if(c.state==='chase'||c.state==='attack'||c.state==='flee')c.state='idle';
    if(c.decisionClock<=0){const roll=this.random();c.state=roll<.3?'graze':roll<.74?'wander':'idle';
      c.heading=this.random()*TWO_PI;c.decisionClock=2+this.random()*4;}
  }
  private animate(c:Creature,delta:number){c.age+=delta;c.hurtClock=Math.max(0,c.hurtClock-delta);
    const walking=c.state==='wander'||c.state==='chase'||c.state==='flee';
    for(let i=0;i<c.legs.length;i++)c.legs[i]!.rotation.x=walking?Math.sin(c.phase+i*Math.PI)*.45:0;
    for(const head of c.heads){head.rotation.x=c.state==='graze'?.35+Math.sin(c.age*2)*.1:c.state==='attack'?-.22:Math.sin(c.age*1.5)*.045;
      head.rotation.y=Math.sin(c.age*.65+c.id)*.07;}
    const body=c.meshes[0];if(body&&!c.legs.includes(body)&&!c.heads.includes(body))body.position.y=c.def.parts[0]!.offset[1]+Math.sin(c.age*2.1)*.015;
    for(let i=0;i<c.meshes.length;i++)c.meshes[i]!.material=c.hurtClock>0?this.hitMaterial:this.material(i===0&&c.tunic?c.tunic:c.def.parts[i]!.color);
    c.group.rotation.y=c.heading;c.group.rotation.z=c.state==='attack'?Math.sin(c.age*12)*.055:0;
  }
  private spawnNear(player:THREE.Vector3,daylight:number){if(this.creatures.length>=this.maxPopulation)return;
    for(let attempt=0;attempt<12;attempt++){
      const angle=this.random()*TWO_PI,distance=14+this.random()*22;
      const x=Math.round(player.x+Math.cos(angle)*distance),z=Math.round(player.z+Math.sin(angle)*distance);
      if(!this.world.isLoaded(x,z))continue;
      const biome=biomeNames[this.world.generator.biomeAt(x,z)],h=this.world.generator.surfaceHeight(x,z);
      if(h<44||h>91||!isSolid(this.world.get(x,h,z))||this.world.get(x,h+1,z)!==Block.Air||this.world.get(x,h+2,z)!==Block.Air)continue;
      let crowded=false;for(const other of this.creatures)if((other.position.x-x)**2+(other.position.z-z)**2<36){crowded=true;break;}if(crowded)continue;
      const realm=this.world.generator.realm||'overworld';
      const eligible=creatureDefs.filter(def=>def.kind!=='friendly'&&(def.realm||'overworld')===realm&&def.biomes.includes(biome)&&
        (def.kind==='hostile'?(realm==='veil'||daylight<.25):def.kind==='peaceful'?daylight>.15:true));
      if(!eligible.length)continue;const choice=eligible[Math.floor(this.random()*eligible.length)]!;
      if(choice.kind==='hostile'&&this.creatures.filter(c=>c.def.kind==='hostile').length>=10)continue;
      this.spawnAt(choice.id,x,h+.51,z);return;
    }
  }
  update(delta:number,player:THREE.Vector3,daylight:number,playerVulnerable:boolean,hour=12){delta=Math.min(delta,.05);
    this.spawnClock+=delta;if(this.spawnClock>=3.5){this.spawnClock=0;this.spawnNear(player,daylight);}
    for(let i=this.creatures.length-1;i>=0;i--){const c=this.creatures[i]!,distanceSq=c.position.distanceToSquared(player);
      if(distanceSq>this.despawnRadius**2||!this.world.isLoaded(c.position.x,c.position.z)){this.removeAt(i);continue;}
      if(!c.alive){c.deadClock-=delta;c.group.scale.setScalar(Math.max(.001,c.deadClock/.3));if(c.deadClock<=0)this.removeAt(i);continue;}
      if(distanceSq>this.activeRadius**2)continue;
      c.breedCooldown=Math.max(0,c.breedCooldown-delta);
      c.aggression=Math.max(0,c.aggression-delta);c.flee=Math.max(0,c.flee-delta);c.attackClock=Math.max(0,c.attackClock-delta);
      c.decisionClock-=delta;c.thinkClock-=delta;
      if(c.thinkClock<=0){c.thinkClock=distanceSq<144?.15:.45;this.think(c,player,playerVulnerable,hour);}
      if(c.state==='wander'||c.state==='chase'||c.state==='flee')this.navigate(c,c.heading,delta);
      if(c.state==='attack'&&c.attackClock<=0&&playerVulnerable&&this.canSee(c,player)){
        c.attackClock=c.def.cooldown;c.hurtClock=.08;
        if(c.def.attackMode==='melee')this.onPlayerHit(c.def.damage,c.position);
        if(c.def.attackMode==='ranged')this.fire(c,player);
      }
      if(c.knockX||c.knockZ){const nx=c.position.x+c.knockX*delta,nz=c.position.z+c.knockZ*delta;
        if(!this.collides(c,nx,c.position.y,nz)){c.position.x=nx;c.position.z=nz;}else c.knockX=c.knockZ=0;
        c.knockX*=Math.max(0,1-7*delta);c.knockZ*=Math.max(0,1-7*delta);}
      this.vertical(c,delta);this.animate(c,delta);
    }
    for(let i=this.projectiles.length-1;i>=0;i--){const shot=this.projectiles[i]!;shot.age+=delta;shot.mesh.position.x+=shot.vx*delta;
      shot.mesh.position.y+=shot.vy*delta;shot.mesh.position.z+=shot.vz*delta;shot.vy-=1.5*delta;shot.mesh.rotation.y+=delta*8;
      if(shot.age>3||this.solid(shot.mesh.position.x,shot.mesh.position.y,shot.mesh.position.z)){this.removeShot(i);continue;}
      if(playerVulnerable&&(shot.mesh.position.x-player.x)**2+(shot.mesh.position.y-player.y-1.1)**2+
        (shot.mesh.position.z-player.z)**2<.55**2){
        this.onPlayerHit(shot.damage,shot.mesh.position);this.removeShot(i);
      }
    }
  }
  target(origin:THREE.Vector3,direction:THREE.Vector3,maxDistance:number):Creature|null{
    let found:Creature|null=null,nearest=maxDistance;
    for(const c of this.creatures){if(!c.alive)continue;
      let near=0,far=nearest;const r=c.def.radius;
      for(const [o,d,min,max] of [[origin.x,direction.x,c.position.x-r,c.position.x+r],
        [origin.y,direction.y,c.position.y,c.position.y+c.def.height],
        [origin.z,direction.z,c.position.z-r,c.position.z+r]]){
        if(Math.abs(d!)<1e-8){if(o!<min!||o!>max!){far=-1;break;}continue;}
        const a=(min!-o!)/d!,b=(max!-o!)/d!;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
        if(near>far)break;
      }
      if(near<=far&&far>=0&&near<nearest){found=c;nearest=near;}
    }
    return found;
  }
  hit(c:Creature,damage:number,source:THREE.Vector3):boolean{
    if(!c.alive||damage<=0)return false;c.health=Math.max(0,c.health-damage);c.hurtClock=.22;
    const dx=c.position.x-source.x,dz=c.position.z-source.z,length=Math.hypot(dx,dz)||1;
    c.knockX=dx/length*4;c.knockZ=dz/length*4;c.velocityY=Math.max(c.velocityY,2.5);
    if(c.def.kind==='peaceful'||c.def.kind==='friendly'){c.flee=7;c.state='flee';}
    if(c.def.kind==='neutral'){c.aggression=18;c.state='chase';}
    if(!c.alive){c.deadClock=.3;this.onDeath(c);}
    return true;
  }
}
