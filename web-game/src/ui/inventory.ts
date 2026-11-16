import {Block,blockNames,selectableBlocks} from '../world/blocks';
import {GameItems,InventoryGrid,craft,craftToCursor,distributeCursor,transferSlot,transferWithin,isEmpty,item,matchRecipe,recipes,smelting,type Recipe,type Stack,empty} from '../items/items';
import {SurvivalState} from '../survival/state';
import {itemIconUrl} from '../render/drops';
export type InventoryMode='personal'|'station'|'chest'|'furnace';
export class InventoryView{
  readonly overlay:HTMLElement;
  mode:InventoryMode='personal';cell='';open=false;
  private dragging:{group:string;indexes:number[];right:boolean}|null=null;
  onClose:()=>void=()=>{};onChange:()=>void=()=>{};onCraft:(recipe:Recipe)=>void=()=>{};onDrop:(stack:Stack)=>void=()=>{};
  constructor(readonly root:HTMLElement,readonly items:GameItems,readonly life:SurvivalState){
    this.overlay=document.createElement('div');this.overlay.id='inventory';this.overlay.className='overlay hidden';root.append(this.overlay);
    this.overlay.addEventListener('contextmenu',event=>event.preventDefault());
    this.overlay.addEventListener('mousemove',event=>{const cursor=this.overlay.querySelector<HTMLElement>('#held-stack');if(cursor){cursor.style.left=`${event.clientX+14}px`;cursor.style.top=`${event.clientY+14}px`;}});
    this.overlay.addEventListener('mousedown',event=>{
      const button=(event.target as HTMLElement).closest<HTMLElement>('[data-grid]');
      if(!button||event.button>2)return;event.preventDefault();
      const group=button.dataset.grid!,index=Number(button.dataset.index);
      if(event.shiftKey){this.quickTransfer(group,index);return;}
      this.dragging={group,indexes:[index],right:event.button===2};
    });
    this.overlay.addEventListener('mouseover',event=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-grid]');
      if(!button||!this.dragging||button.dataset.grid!==this.dragging.group)return;
      const index=Number(button.dataset.index);if(!this.dragging.indexes.includes(index))this.dragging.indexes.push(index);
    });
    document.addEventListener('mouseup',event=>{const drag=this.dragging;if(!drag||event.button!==(drag.right?2:0))return;
      this.dragging=null;if(!this.open)return;
      if(drag.indexes.length===1||isEmpty(this.items.cursor))this.click(drag.group,drag.indexes[0]!,drag.right);
      else{const grid=this.grid(drag.group);this.items.cursor=distributeCursor(grid,drag.indexes,this.items.cursor,drag.right,
        i=>this.slotAccepts(drag.group,i,this.items.cursor));this.onChange();this.render();}
    });
    this.overlay.addEventListener('click',event=>{
      const target=(event.target as HTMLElement).closest<HTMLElement>('button');
      if(target?.id==='close-inventory')this.close();
      else if(target?.id==='craft-item')this.craftItem();
      else if(target?.id==='craft-output')this.takeOutput((event as MouseEvent).shiftKey);
      else if(target?.id==='drop-held')this.dropHeld();
    });
    this.overlay.addEventListener('change',event=>{
      const target=event.target as HTMLSelectElement;
      if(target.id==='creative-palette'){this.life.creativeBlock=Number(target.value) as Block;this.onChange();this.render();}
      if(target.id==='recipe-guide')this.showRecipe(target.value);
    });
  }
  openPanel(mode:InventoryMode='personal',cell=''){this.mode=mode;this.cell=cell;this.open=true;this.overlay.classList.remove('hidden');this.render();}
  close(){if(!this.open)return;this.dragging=null;if(!isEmpty(this.items.cursor)){
    const held=this.items.cursor,left=this.items.slots.add(held.id,held.count,held.damage);
    this.items.cursor=left?{...held,count:left}:empty();this.onChange();
  }this.open=false;this.overlay.classList.add('hidden');this.onClose();}
  private grid(group:string):InventoryGrid{return group==='bag'?this.items.slots:group==='equip'?this.items.equipment:group==='craft'?
    this.mode==='station'?this.items.station(this.cell):this.items.personal:this.mode==='chest'?this.items.chest(this.cell):this.items.furnace(this.cell).slots;}
  private click(group:string,index:number,right:boolean){
    const cursor=this.items.cursor;
    if(!this.slotAccepts(group,index,cursor))return;
    this.items.cursor=this.grid(group).click(index,cursor,right);this.onChange();this.render();
  }
  private slotAccepts(group:string,index:number,cursor:Stack):boolean{
    if(isEmpty(cursor))return true;
    if(group==='equip'){const def=item(cursor.id);return index===0?['pickaxe','shovel'].includes(def.category):index===1?cursor.id.endsWith('_helmet'):
      index===2?cursor.id.endsWith('_chestplate'):def.category==='weapon';}
    if(group==='storage'&&this.mode==='furnace')return index===0?smelting.has(cursor.id):index===1?item(cursor.id).fuelSeconds>0:false;
    return true;
  }
  private quickTransfer(group:string,index:number){const source=this.grid(group);let moved=0;
    if(group==='bag'){
      if(this.mode==='chest')moved=transferSlot(source,index,[this.items.chest(this.cell)]);
      else if(this.mode==='furnace')moved=transferSlot(source,index,[this.items.furnace(this.cell).slots],(target,i)=>this.slotAccepts('storage',i,source.get(index)));
      else moved=transferWithin(source,index,index<9?Array.from({length:27},(_,i)=>i+9):Array.from({length:9},(_,i)=>i));
    }else moved=transferSlot(source,index,[this.items.slots]);
    if(moved){this.onChange();this.render();}
  }
  private takeOutput(quick:boolean){const grid=this.grid('craft'),width=grid.size===9?3:2;
    if(quick){this.craftItem();return;}
    const result=craftToCursor(grid,width,this.mode==='station',this.items.cursor);
    if(result){this.items.cursor=result.cursor;this.onCraft(result.recipe);this.onChange();this.render();}
  }
  private craftItem(){const grid=this.grid('craft'),width=grid.size===9?3:2;const recipe=craft(grid,width,this.mode==='station',this.items.slots);
    if(recipe){this.onCraft(recipe);this.onChange();this.render();}}
  private dropHeld(){if(isEmpty(this.items.cursor))return;this.onDrop(this.items.cursor);this.items.cursor=empty();this.onChange();this.render();}
  private slots(grid:InventoryGrid,group:string):string{
    return grid.slots.map((s,i)=>`<button class="inv-slot" data-grid="${group}" data-index="${i}" title="${isEmpty(s)?'Empty':`${item(s.id).name} ×${s.count}\n${item(s.id).description}${item(s.id).attack?`\nAttack ${item(s.id).attack}`:''}${item(s.id).durability?`\nDurability ${item(s.id).durability-s.damage}/${item(s.id).durability} · Tier ${item(s.id).tier}`:''}`}">
      ${isEmpty(s)?'':`<img class="item-icon" src="${itemIconUrl(s.id)}" alt="">`}<b>${isEmpty(s)?'·':item(s.id).name}</b><em>${s.count||''}</em></button>`).join('');
  }
  private showRecipe(id:string){const recipe=recipes.find(value=>value.id===id);const label=this.overlay.querySelector('#recipe-details');if(!label||!recipe)return;
    const materials=[...new Set(recipe.inputs.filter(Boolean))].map(input=>`${item(input).name} ×${recipe.inputs.filter(value=>value===input).length}`).join(', ');
    label.textContent=`${recipe.kind==='shaped'?'Shape required':'Any order'} · ${materials}`;
  }
  render(){if(!this.open)return;
    const crafting=this.grid('craft'),width=crafting.size===9?3:2,ready=matchRecipe(crafting,width,this.mode==='station');
    const storage=this.mode==='chest'?this.items.chest(this.cell):this.mode==='furnace'?this.items.furnace(this.cell).slots:null;
    const furnace=this.mode==='furnace'?this.items.furnace(this.cell):null;
    const available=recipes.filter(recipe=>!recipe.station||this.mode==='station');
    this.overlay.innerHTML=`<section class="inventory-panel"><div class="inventory-left"><h2>${this.mode==='personal'?'INVENTORY':this.mode==='station'?'CRAFTING STATION':this.mode==='chest'?'STORAGE CHEST':'FURNACE'}</h2>
      <p>36 slots · first row is the hotbar</p><div class="inventory-grid bag-grid">${this.slots(this.items.slots,'bag')}</div>
      <p>Left: pick up/place · Right: split/place one · Shift: transfer · Drag: distribute</p><button id="drop-held">Drop held stack into world</button><button id="close-inventory">Close (E / Esc)</button></div>
      <div class="inventory-right"><h3>EQUIPMENT · TOOL / HEAD / BODY / WEAPON</h3><div class="inventory-grid equip-grid">${this.slots(this.items.equipment,'equip')}</div>
      <h3>${width}×${width} CRAFTING</h3><div class="craft-row"><div class="inventory-grid craft-grid" style="--columns:${width}">${this.slots(crafting,'craft')}</div>
      <span class="craft-arrow" aria-hidden="true">→</span><button id="craft-output" class="inv-slot" ${ready?'':'disabled'} title="Take crafted output">${ready?`<img class="item-icon" src="${itemIconUrl(ready.output)}" alt=""><b>${item(ready.output).name}</b><em>${ready.count}</em>`:''}</button></div>
      <button id="craft-item" ${ready?'':'disabled'}>Craft to inventory</button>
      ${storage?`<h3>${furnace?'INPUT / FUEL / OUTPUT':'STORAGE'}</h3><div class="inventory-grid ${furnace?'furnace-grid':'chest-grid'}">${this.slots(storage,'storage')}</div>`:''}
      ${furnace?`<p id="furnace-progress">Heat ${furnace.burn.toFixed(1)}s · Smelting ${Math.round(furnace.progress/(smelting.get(furnace.slots.get(0).id)?.seconds||4)*100)}%</p>`:''}
      ${this.mode==='personal'||this.mode==='station'?`<h3>RECIPE GUIDE</h3><select id="recipe-guide"><option value="">Select a recipe</option>${available.map(r=>`<option value="${r.id}">${item(r.output).name} ×${r.count}</option>`).join('')}</select><p id="recipe-details"></p>`:''}
      ${this.life.mode==='creative'?`<h3>CREATIVE BLOCK PALETTE</h3><select id="creative-palette">${selectableBlocks.map(i=>`<option value="${i}" ${this.life.creativeBlock===i?'selected':''}>${blockNames[i]}</option>`).join('')}</select>`:''}
      </div></section><div id="held-stack">${isEmpty(this.items.cursor)?'':`${item(this.items.cursor.id).name} ×${this.items.cursor.count}`}</div>`;
  }
  refreshFurnace(){if(!this.open||this.mode!=='furnace')return;
    const furnace=this.items.furnace(this.cell),progress=this.overlay.querySelector('#furnace-progress');
    if(progress)progress.textContent=`Heat ${furnace.burn.toFixed(1)}s · Smelting ${Math.round(furnace.progress/(smelting.get(furnace.slots.get(0).id)?.seconds||4)*100)}%`;
    for(let i=0;i<3;i++){const s=furnace.slots.get(i),button=this.overlay.querySelector<HTMLElement>(`[data-grid="storage"][data-index="${i}"]`);
      if(!button)continue;button.querySelector('b')!.textContent=isEmpty(s)?'·':item(s.id).name;
      button.querySelector('em')!.textContent=s.count?String(s.count):'';
      let icon=button.querySelector<HTMLImageElement>('.item-icon');if(isEmpty(s)){icon?.remove();continue;}
      if(!icon){icon=document.createElement('img');icon.className='item-icon';icon.alt='';button.prepend(icon);}
      const url=itemIconUrl(s.id);if(icon.src!==url)icon.src=url;
    }
  }
}
