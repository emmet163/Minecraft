import {Block,blockNames,selectableBlocks} from '../world/blocks';
import {GameItems,InventoryGrid,craft,isEmpty,item,matchRecipe,recipes,smelting,type Recipe,type Stack,empty} from '../items/items';
import {SurvivalState} from '../survival/state';
import {itemIconUrl} from '../render/drops';
export type InventoryMode='personal'|'station'|'chest'|'furnace';
export class InventoryView{
  readonly overlay:HTMLElement;
  mode:InventoryMode='personal';cell='';open=false;
  onClose:()=>void=()=>{};onChange:()=>void=()=>{};onCraft:(recipe:Recipe)=>void=()=>{};onDrop:(stack:Stack)=>void=()=>{};
  constructor(readonly root:HTMLElement,readonly items:GameItems,readonly life:SurvivalState){
    this.overlay=document.createElement('div');this.overlay.id='inventory';this.overlay.className='overlay hidden';root.append(this.overlay);
    this.overlay.addEventListener('contextmenu',event=>event.preventDefault());
    this.overlay.addEventListener('mousemove',event=>{const cursor=this.overlay.querySelector<HTMLElement>('#held-stack');if(cursor){cursor.style.left=`${event.clientX+14}px`;cursor.style.top=`${event.clientY+14}px`;}});
    this.overlay.addEventListener('mousedown',event=>{
      const button=(event.target as HTMLElement).closest<HTMLElement>('[data-grid]');
      if(!button||event.button>2)return;event.preventDefault();this.click(button.dataset.grid!,Number(button.dataset.index),event.button===2);
    });
    this.overlay.addEventListener('click',event=>{
      const target=event.target as HTMLElement;
      if(target.id==='close-inventory')this.close();
      else if(target.id==='craft-item')this.craftItem();
      else if(target.id==='drop-held')this.dropHeld();
    });
    this.overlay.addEventListener('change',event=>{
      const target=event.target as HTMLSelectElement;
      if(target.id==='creative-palette'){this.life.creativeBlock=Number(target.value) as Block;this.onChange();this.render();}
      if(target.id==='recipe-guide')this.showRecipe(target.value);
    });
  }
  openPanel(mode:InventoryMode='personal',cell=''){this.mode=mode;this.cell=cell;this.open=true;this.overlay.classList.remove('hidden');this.render();}
  close(){if(!this.open)return;if(!isEmpty(this.items.cursor)){const left=this.items.slots.add(this.items.cursor.id,this.items.cursor.count,this.items.cursor.damage);if(left)this.onDrop({...this.items.cursor,count:left});this.items.cursor=empty();this.onChange();}this.open=false;this.overlay.classList.add('hidden');this.onClose();}
  private grid(group:string):InventoryGrid{return group==='bag'?this.items.slots:group==='equip'?this.items.equipment:group==='craft'?
    this.mode==='station'?this.items.station(this.cell):this.items.personal:this.mode==='chest'?this.items.chest(this.cell):this.items.furnace(this.cell).slots;}
  private click(group:string,index:number,right:boolean){
    const cursor=this.items.cursor;
    if(group==='equip'&&!isEmpty(cursor)){
      const def=item(cursor.id);const valid=index===0?['pickaxe','shovel'].includes(def.category):index===1?cursor.id.endsWith('_helmet'):
        index===2?cursor.id.endsWith('_chestplate'):def.category==='weapon';if(!valid)return;
    }
    if(group==='storage'&&this.mode==='furnace'&&!isEmpty(cursor)){
      if(index===2||index===1&&item(cursor.id).fuelSeconds<=0||index===0&&!smelting.has(cursor.id))return;
    }
    this.items.cursor=this.grid(group).click(index,cursor,right);this.onChange();this.render();
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
      <p>Left click: pick up / place · Right click: split / place one</p><button id="drop-held">Drop held stack into world</button><button id="close-inventory">Close (E / Esc)</button></div>
      <div class="inventory-right"><h3>EQUIPMENT · TOOL / HEAD / BODY / WEAPON</h3><div class="inventory-grid equip-grid">${this.slots(this.items.equipment,'equip')}</div>
      <h3>${width}×${width} CRAFTING${ready?` · READY: ${item(ready.output).name} ×${ready.count}`:''}</h3><div class="inventory-grid craft-grid" style="--columns:${width}">${this.slots(crafting,'craft')}</div>
      <button id="craft-item" ${ready?'':'disabled'}>Craft</button>
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
