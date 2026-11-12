import { Block, blockNames, selectableBlocks, type Tool } from '../world/blocks';
import { biomeNames, type Biome } from '../world/generator';

export interface Slot { block: Block; count: number }
export class Hud {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly slots: Slot[]=selectableBlocks.map(block=>({block,count:32}));
  selected=0; tool:Tool='hand';
  private hotbar: HTMLElement;
  private target: HTMLElement;
  private worldInfo: HTMLElement;
  private progress: HTMLElement;
  private notice: HTMLElement;
  private overlay: HTMLElement;
  private seedInput: HTMLInputElement;
  private distanceInput: HTMLInputElement;
  private sensitivityInput: HTMLInputElement;
  onResume:()=>void=()=>{};
  onSettings:(seed:number,distance:number,sensitivity:number)=>void=()=>{};
  constructor() {
    this.root=document.querySelector('#app')!;
    this.root.innerHTML=`<canvas id="game" aria-label="Stonewake 3D game"></canvas>
      <div class="topline"><strong>STONEWAKE</strong><span id="world-info"></span></div>
      <div id="target"></div><div id="crosshair">+</div><div id="mining"><div></div></div>
      <div id="notice"></div><div class="bottom"><div id="tool"></div><div id="hotbar"></div><small>WASD move · Space jump · Shift sprint · Ctrl crouch · Q tool · Esc pause</small></div>
      <div id="overlay" class="overlay"><section class="panel"><h1>Stonewake</h1><p>Explore and build a seeded voxel world.</p>
        <button id="resume">Enter world</button><label>World seed<input id="seed" type="number" step="1"></label>
        <label>Render distance <output id="distance-value">2</output><input id="distance" type="range" min="2" max="6" value="2"></label>
        <label>Mouse sensitivity <output id="sensitivity-value">0.18</output><input id="sensitivity" type="range" min="0.03" max="0.5" step="0.01" value="0.18"></label>
        <button id="apply">Apply world settings</button><p class="help">Click the game to capture the mouse. Hold left click to mine; right click to place or use a door. Select blocks with 1–9 or the wheel.</p>
        <p class="scope">Browser migration · Part 1</p></section></div>`;
    this.canvas=this.root.querySelector('#game')!;
    this.hotbar=this.root.querySelector('#hotbar')!;
    this.target=this.root.querySelector('#target')!;
    this.worldInfo=this.root.querySelector('#world-info')!;
    this.progress=this.root.querySelector('#mining > div')!;
    this.notice=this.root.querySelector('#notice')!;
    this.overlay=this.root.querySelector('#overlay')!;
    this.seedInput=this.root.querySelector('#seed')!;
    this.distanceInput=this.root.querySelector('#distance')!;
    this.sensitivityInput=this.root.querySelector('#sensitivity')!;
    this.root.querySelector('#resume')!.addEventListener('click',()=>this.onResume());
    this.root.querySelector('#apply')!.addEventListener('click',()=>this.onSettings(this.seed,this.distance,this.sensitivity));
    this.distanceInput.addEventListener('input',()=>{ this.root.querySelector('#distance-value')!.textContent=this.distanceInput.value; });
    this.sensitivityInput.addEventListener('input',()=>{ this.root.querySelector('#sensitivity-value')!.textContent=this.sensitivityInput.value; });
    this.renderHotbar();
  }
  get seed():number { return Number(this.seedInput.value)|0; }
  get distance():number { return Number(this.distanceInput.value)|0; }
  get sensitivity():number { return Number(this.sensitivityInput.value); }
  setSettings(seed:number,distance:number,sensitivity:number):void {
    this.seedInput.value=String(seed); this.distanceInput.value=String(distance); this.sensitivityInput.value=String(sensitivity);
    this.root.querySelector('#distance-value')!.textContent=String(distance);
    this.root.querySelector('#sensitivity-value')!.textContent=sensitivity.toFixed(2);
  }
  setPaused(value:boolean):void { this.overlay.classList.toggle('hidden',!value); }
  setTarget(value:string):void { this.target.textContent=value; }
  setProgress(value:number):void { this.progress.style.width=`${Math.round(value*100)}%`; this.progress.parentElement!.classList.toggle('active',value>0); }
  setWorld(seed:number,biome:Biome,loaded:number,pending:number):void {
    this.worldInfo.textContent=`Seed ${seed} · ${biomeNames[biome]} · ${loaded} chunks · ${pending} loading`;
  }
  showNotice(value:string):void { this.notice.textContent=value; this.notice.classList.add('show'); setTimeout(()=>this.notice.classList.remove('show'),2200); }
  select(index:number):void { this.selected=(index+9)%9; this.renderHotbar(); }
  cycleTool():void { this.tool=this.tool==='hand'?'pickaxe':this.tool==='pickaxe'?'shovel':'hand'; this.renderHotbar(); }
  add(block:Block,count:number):number {
    for(const slot of this.slots) if(slot.block===block && slot.count<64) { const n=Math.min(count,64-slot.count);slot.count+=n;count-=n; if(!count) break; }
    if(count) for(const slot of this.slots) if(slot.count===0) { slot.block=block; const n=Math.min(count,64);slot.count=n;count-=n;if(!count) break; }
    this.renderHotbar(); return count;
  }
  spendSelected():boolean { const slot=this.slots[this.selected]!; if(slot.count<=0)return false; slot.count--;this.renderHotbar();return true; }
  renderHotbar():void {
    this.hotbar.innerHTML=this.slots.map((slot,i)=>`<div class="slot ${i===this.selected?'selected':''}"><kbd>${i+1}</kbd><b>${slot.count?blockNames[slot.block]:'Empty'}</b><em>${slot.count||''}</em></div>`).join('');
    this.root.querySelector('#tool')!.textContent=`${this.tool.toUpperCase()} · ${blockNames[this.slots[this.selected]!.block]}`;
  }
}
