import * as THREE from 'three';
import {GameItems} from '../items/items';
import {ExplorationState} from '../exploration/state';
import type {StructurePlanner,StructureSite} from '../world/structures';

const names={village:'Village',dungeon:'Dungeon',mine:'Abandoned Mine',ruin:'Ruins',vault:'Ancient Vault'};
const arrows=['↑','↗','→','↘','↓','↙','←','↖'];
export class NavigationView{
  readonly overlay:HTMLElement;readonly readout:HTMLElement;open=false;onClose:()=>void=()=>{};onTrack:()=>void=()=>{};
  private sites:StructureSite[]=[];private position=new THREE.Vector3();private yaw=0;
  constructor(root:HTMLElement,readonly items:GameItems,readonly state:ExplorationState){
    this.readout=document.createElement('div');this.readout.id='navigation-info';root.append(this.readout);
    this.overlay=document.createElement('div');this.overlay.id='map';this.overlay.className='overlay hidden';root.append(this.overlay);
    this.overlay.addEventListener('click',event=>{
      const target=event.target as HTMLElement;if(target.id==='close-map'){this.close();return;}
      const button=target.closest<HTMLElement>('[data-track]');if(!button)return;
      this.state.tracked=button.dataset.track||null;this.onTrack();this.render();
    });
  }
  private has(id:string){return this.items.slots.count(id)>0;}
  update(position:THREE.Vector3,yaw:number,planner:StructurePlanner){this.position.copy(position);this.yaw=yaw;
    this.sites=planner.nearby(position.x,position.z,320);
    if(this.state.tracked&&!this.sites.some(site=>site.id===this.state.tracked)){
      const [rx,rz]=this.state.tracked.split(':').map(Number);
      if(Number.isFinite(rx)&&Number.isFinite(rz)){
        const tracked=planner.siteAtRegion(rx!,rz!);if(tracked?.id===this.state.tracked)this.sites.unshift(tracked);
      }
    }
    const target=this.state.target(this.sites,this.has('wayfinder'));
    const coordinates=`X ${Math.round(position.x)} · Y ${Math.round(position.y)} · Z ${Math.round(position.z)}`;
    if(!target){this.readout.textContent=coordinates;return;}
    const dx=target.x-position.x,dz=target.z-position.z,distance=Math.round(Math.hypot(dx,dz));
    const relative=Math.atan2(dx,-dz)+yaw,index=((Math.round(relative/(Math.PI/4))%8)+8)%8;
    this.readout.textContent=`${coordinates} · ${arrows[index]} ${names[target.kind]} ${distance}m`;
    if(this.open)this.render();
  }
  openPanel(){this.open=true;this.overlay.classList.remove('hidden');this.render();}
  close(){if(!this.open)return;this.open=false;this.overlay.classList.add('hidden');this.onClose();}
  render(){if(!this.open)return;
    const mapped=this.has('survey_map')||this.has('wayfinder');
    const visible=this.sites.filter(site=>this.state.discovered.has(site.id)||mapped).slice(0,20);
    this.overlay.innerHTML=`<section class="panel map-panel"><h1>FIELD MAP</h1><p>${this.readout.textContent}</p>
      <p>${this.state.discovered.size} landmarks discovered · ${mapped?'Survey tools reveal nearby sites':'Craft a Survey Map to reveal nearby sites'}</p>
      <div class="map-list">${visible.map(site=>{const known=this.state.discovered.has(site.id);
        const x=known?site.x:Math.round(site.x/16)*16,z=known?site.z:Math.round(site.z/16)*16;
        return `<button data-track="${site.id}" class="${this.state.tracked===site.id?'tracked':''}">${known?'●':'○'} ${names[site.kind]} · X ${x}, Z ${z}${known?'':' (approx.)'}</button>`;}).join('')||'<p>No landmarks mapped yet.</p>'}</div>
      <button id="close-map">Close (M / Esc)</button></section>`;
  }
}
