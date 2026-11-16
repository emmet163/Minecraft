import {Block,blockNames,selectableBlocks} from '../world/blocks';
import {GameItems,InventoryGrid,craft,craftToCursor,distributeCursor,transferSlot,transferWithin,isEmpty,item,matchRecipe,recipes,smelting,type Recipe,type Stack,empty} from '../items/items';
import {SurvivalState} from '../survival/state';
import {itemIconUrl} from '../render/drops';
import {planRecipe,populateRecipe,recipeCategories,recipeCategory,recipeIngredients,type RecipeCategory} from '../items/recipeBook';
export type InventoryMode='personal'|'station'|'chest'|'furnace';
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export class InventoryView{
  readonly overlay:HTMLElement;
  mode:InventoryMode='personal';cell='';open=false;
  private dragging:{group:string;indexes:number[];right:boolean}|null=null;
  private bookOpen=false;private bookQuery='';private bookCategory:RecipeCategory='all';private bookMessage='';
  private pointerX=0;private pointerY=0;
  onClose:()=>void=()=>{};onChange:()=>void=()=>{};onCraft:(recipe:Recipe)=>void=()=>{};onDrop:(stack:Stack)=>void=()=>{};
  constructor(readonly root:HTMLElement,readonly items:GameItems,readonly life:SurvivalState){
    this.overlay=document.createElement('div');this.overlay.id='inventory';this.overlay.className='overlay hidden';root.append(this.overlay);
    this.overlay.addEventListener('contextmenu',event=>event.preventDefault());
    this.overlay.addEventListener('mousemove',event=>{this.pointerX=event.clientX;this.pointerY=event.clientY;
      const cursor=this.overlay.querySelector<HTMLElement>('#held-stack');if(cursor){cursor.style.left=`${event.clientX+14}px`;cursor.style.top=`${event.clientY+14}px`;}
      this.updateTooltip(event.target as HTMLElement,event.clientX,event.clientY);
    });
    this.overlay.addEventListener('mouseleave',()=>{const tooltip=this.overlay.querySelector<HTMLElement>('#item-tooltip');if(tooltip)tooltip.hidden=true;});
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
      else if(target?.id==='recipe-book-toggle'){this.bookOpen=!this.bookOpen;this.bookMessage='';this.render();}
      else if(target?.dataset.category){this.bookCategory=target.dataset.category as RecipeCategory;this.render();}
      else if(target?.dataset.recipe){this.selectRecipe(target.dataset.recipe);}
    });
    this.overlay.addEventListener('input',event=>{const target=event.target as HTMLInputElement;
      if(target.id==='recipe-search'){this.bookQuery=target.value;this.refreshBook();}
    });
    this.overlay.addEventListener('change',event=>{
      const target=event.target as HTMLSelectElement;
      if(target.id==='creative-palette'){this.life.creativeBlock=Number(target.value) as Block;this.onChange();this.render();}
    });
  }
  openPanel(mode:InventoryMode='personal',cell=''){if(mode!==this.mode){this.bookCategory='all';this.bookQuery='';this.bookMessage='';}
    this.mode=mode;this.cell=cell;this.open=true;this.overlay.classList.remove('hidden');this.render();}
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
  private slots(grid:InventoryGrid,group:string,indexes=grid.slots.map((_,i)=>i)):string{
    return indexes.map(i=>{const s=grid.get(i),def=isEmpty(s)?null:item(s.id);
      const durability=def?.durability?Math.max(0,Math.round((1-s.damage/def.durability)*100)):0;
      return `<button class="inv-slot" data-grid="${group}" data-index="${i}" ${def?`data-item-id="${s.id}" data-count="${s.count}" data-damage="${s.damage}"`:''} aria-label="${def?escapeHtml(`${def.name}, ${s.count}`):'Empty slot'}">
        ${def?`<img class="item-icon" src="${itemIconUrl(s.id)}" alt="">`:''}<b>${def?escapeHtml(def.name):'·'}</b><em>${s.count>1?s.count:''}</em>
        ${def?.durability?`<span class="slot-durability"><i style="width:${durability}%"></i></span>`:''}</button>`;
    }).join('');
  }
  private bookCards():string{
    const grid=this.grid('craft'),width=grid.size===9?3:2,query=this.bookQuery.trim().toLowerCase();
    const visible=recipes.filter(recipe=>(!recipe.station||this.mode==='station')&&recipe.width<=width&&
      (this.bookCategory==='all'||recipeCategory(recipe)===this.bookCategory)&&
      (!query||item(recipe.output).name.toLowerCase().includes(query)||recipe.id.includes(query)));
    if(!visible.length)return '<p class="book-empty">No recipes match this search.</p>';
    return visible.map(recipe=>{const can=!!planRecipe(recipe,grid,this.items.slots,width,this.mode==='station');
      const ingredients=recipeIngredients(recipe).map(part=>`${item(part.id).name} ×${part.count}`).join(' · ');
      return `<button class="book-recipe ${can?'craftable':'unavailable'}" data-recipe="${recipe.id}" data-item-id="${recipe.output}" aria-label="${escapeHtml(item(recipe.output).name)}: ${escapeHtml(ingredients)}; ${can?'craftable':'missing materials or bag space'}">
        <img class="item-icon" src="${itemIconUrl(recipe.output)}" alt=""><span><strong>${escapeHtml(item(recipe.output).name)}</strong><small>${escapeHtml(ingredients)}</small></span><em>${can?'Ready':'Missing'}</em></button>`;
    }).join('');
  }
  private refreshBook(){const results=this.overlay.querySelector<HTMLElement>('#recipe-results');if(results)results.innerHTML=this.bookCards();}
  private selectRecipe(id:string){const recipe=recipes.find(value=>value.id===id);if(!recipe)return;
    const grid=this.grid('craft'),width=grid.size===9?3:2;
    if(populateRecipe(recipe,grid,this.items.slots,width,this.mode==='station')){
      this.bookMessage=`Placed ${item(recipe.output).name} ingredients in the grid.`;this.onChange();
    }else this.bookMessage='Missing materials or space to return current ingredients.';
    this.render();
  }
  private updateTooltip(target:HTMLElement,x:number,y:number){const tip=this.overlay.querySelector<HTMLElement>('#item-tooltip');if(!tip)return;
    const slot=target.closest<HTMLElement>('[data-item-id]'),id=slot?.dataset.itemId;
    if(!id){tip.hidden=true;return;}
    const def=item(id),damage=Number(slot.dataset.damage||0),count=Number(slot.dataset.count||0);
    tip.innerHTML=`<strong>${escapeHtml(def.name)}</strong><span>${escapeHtml(def.description)}</span>${count>1?`<small>Stack: ${count}/${def.stack}</small>`:''}
      ${def.attack?`<small>Attack: ${def.attack}</small>`:''}${def.durability?`<small>Durability: ${Math.max(0,def.durability-damage)}/${def.durability} · Tier ${def.tier}</small>`:''}`;
    tip.hidden=false;tip.style.left=`${Math.min(x+18,window.innerWidth-245)}px`;tip.style.top=`${Math.min(y+18,window.innerHeight-110)}px`;
  }
  render(){if(!this.open)return;
    const crafting=this.grid('craft'),width=crafting.size===9?3:2,ready=matchRecipe(crafting,width,this.mode==='station');
    const storage=this.mode==='chest'?this.items.chest(this.cell):this.mode==='furnace'?this.items.furnace(this.cell).slots:null;
    const furnace=this.mode==='furnace'?this.items.furnace(this.cell):null;
    const canBook=this.mode==='personal'||this.mode==='station',showBook=canBook&&this.bookOpen;
    const title=this.mode==='personal'?'Inventory':this.mode==='station'?'Crafting Station':this.mode==='chest'?'Storage Chest':'Furnace';
    this.overlay.innerHTML=`<div class="crafting-shell ${showBook?'book-visible':''}">
      ${showBook?`<aside id="recipe-book" aria-label="Recipe book"><div class="book-heading"><span class="book-mark">▦</span><h2>Recipe Book</h2></div>
        <label class="book-search-label" for="recipe-search">Find a recipe</label><input id="recipe-search" type="search" placeholder="Search recipes…" value="${escapeHtml(this.bookQuery)}" autocomplete="off">
        <nav class="book-categories" aria-label="Recipe categories">${recipeCategories.map(category=>`<button data-category="${category.id}" class="${this.bookCategory===category.id?'selected':''}" aria-label="${category.label}" title="${category.label}">${category.symbol}</button>`).join('')}</nav>
        <div id="recipe-results" class="recipe-results">${this.bookCards()}</div><p id="book-message" role="status">${escapeHtml(this.bookMessage)}</p></aside>`:''}
      <section class="inventory-panel ${this.mode}"><header class="inventory-heading"><div><span class="panel-kicker">STONEWAKE · WORKBENCH</span><h2>${title}</h2></div>
        <div class="heading-actions">${canBook?`<button id="recipe-book-toggle" aria-expanded="${showBook}" aria-controls="recipe-book">${showBook?'Close recipes':'▦ Recipes'}</button>`:''}<button id="close-inventory" aria-label="Close inventory">✕</button></div></header>
      <div class="inventory-top"><div class="equipment-area"><h3>Equipment</h3><div class="inventory-grid equip-grid">${this.slots(this.items.equipment,'equip')}</div><p>Tool · Head · Body · Weapon</p></div>
        <div class="crafting-area"><h3>Crafting <span>${width} × ${width}</span></h3><div class="craft-row"><div class="inventory-grid craft-grid" style="--columns:${width}">${this.slots(crafting,'craft')}</div>
        <span class="craft-arrow" aria-hidden="true">➜</span><button id="craft-output" class="inv-slot" ${ready?'':'disabled'} ${ready?`data-item-id="${ready.output}" data-count="${ready.count}"`:''} aria-label="${ready?`Take ${escapeHtml(item(ready.output).name)}`:'No matching recipe'}">${ready?`<img class="item-icon" src="${itemIconUrl(ready.output)}" alt=""><b>${escapeHtml(item(ready.output).name)}</b><em>${ready.count>1?ready.count:''}</em>`:''}</button></div>
        <button id="craft-item" ${ready?'':'disabled'}>Craft to inventory</button></div></div>
      ${storage?`<div class="storage-area"><h3>${furnace?'Furnace · Input / Fuel / Output':'Storage · 27 slots'}</h3><div class="inventory-grid ${furnace?'furnace-grid':'chest-grid'}">${this.slots(storage,'storage')}</div>
        ${furnace?`<p id="furnace-progress">Heat ${furnace.burn.toFixed(1)}s · Smelting ${Math.round(furnace.progress/(smelting.get(furnace.slots.get(0).id)?.seconds||4)*100)}%</p>`:''}</div>`:''}
      <div class="inventory-left"><h3>Inventory <span>27 slots</span></h3><div class="bag-grid"><div class="inventory-grid inv-main-grid">${this.slots(this.items.slots,'bag',Array.from({length:27},(_,i)=>i+9))}</div>
        <div class="inventory-grid inv-hotbar-grid">${this.slots(this.items.slots,'bag',Array.from({length:9},(_,i)=>i))}</div></div></div>
      <footer class="inventory-footer"><span>Left: move · Right: split · Shift: transfer · Drag: distribute</span><button id="drop-held">Drop held stack</button>
        ${this.life.mode==='creative'?`<label>Creative block <select id="creative-palette">${selectableBlocks.map(i=>`<option value="${i}" ${this.life.creativeBlock===i?'selected':''}>${blockNames[i]}</option>`).join('')}</select></label>`:''}</footer>
      </section></div><div id="held-stack">${isEmpty(this.items.cursor)?'':`<img class="item-icon" src="${itemIconUrl(this.items.cursor.id)}" alt=""><em>${this.items.cursor.count>1?this.items.cursor.count:''}</em>`}</div><div id="item-tooltip" hidden></div>`;
    const cursor=this.overlay.querySelector<HTMLElement>('#held-stack');if(cursor){cursor.style.left=`${this.pointerX+14}px`;cursor.style.top=`${this.pointerY+14}px`;}
  }
  refreshFurnace(){if(!this.open||this.mode!=='furnace')return;
    const furnace=this.items.furnace(this.cell),progress=this.overlay.querySelector('#furnace-progress');
    if(progress)progress.textContent=`Heat ${furnace.burn.toFixed(1)}s · Smelting ${Math.round(furnace.progress/(smelting.get(furnace.slots.get(0).id)?.seconds||4)*100)}%`;
    for(let i=0;i<3;i++){const s=furnace.slots.get(i),button=this.overlay.querySelector<HTMLElement>(`[data-grid="storage"][data-index="${i}"]`);
      if(!button)continue;button.querySelector('b')!.textContent=isEmpty(s)?'·':item(s.id).name;
      if(isEmpty(s)){delete button.dataset.itemId;delete button.dataset.count;delete button.dataset.damage;button.setAttribute('aria-label','Empty slot');}
      else{button.dataset.itemId=s.id;button.dataset.count=String(s.count);button.dataset.damage=String(s.damage);button.setAttribute('aria-label',`${item(s.id).name}, ${s.count}`);}
      button.querySelector('em')!.textContent=s.count?String(s.count):'';
      let icon=button.querySelector<HTMLImageElement>('.item-icon');if(isEmpty(s)){icon?.remove();continue;}
      if(!icon){icon=document.createElement('img');icon.className='item-icon';icon.alt='';button.prepend(icon);}
      const url=itemIconUrl(s.id);if(icon.src!==url)icon.src=url;
    }
  }
}
