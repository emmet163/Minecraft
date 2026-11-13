import rawItems from './items.json';
import rawRecipes from './recipes.json';
import rawSmelting from './smelting.json';
import { Block, blockNames, miningSeconds, type Tool } from '../world/blocks';

export interface ItemDef { id:string;name:string;stack:number;category:string;block:string|null;durability:number;tier:number;speed:number;fuelSeconds:number;description:string;nutrition?:number;saturationGain?:number;healing?:number;attack?:number }
export interface Stack { id:string;count:number;damage:number }
export const empty=():Stack=>({id:'',count:0,damage:0});
export const stack=(id:string,count=1,damage=0):Stack=>count>0?{id,count,damage}:empty();
export const isEmpty=(s:Stack)=>!s.id||s.count<=0;
export const clone=(s:Stack):Stack=>({...s});
export const catalog=new Map<string,ItemDef>((rawItems as ItemDef[]).map(item=>[item.id,item]));
export function item(id:string):ItemDef {const value=catalog.get(id);if(!value)throw new Error(`Unknown item ${id}`);return value;}
export function blockItem(block:Block):string {
  return block===Block.CraftingStation?'crafting_station':blockNames[block]!.toLowerCase().replaceAll(' ','_');
}
export function itemBlock(id:string):Block {
  const name=item(id).block;
  if(!name)return Block.Air;
  const index=blockNames.findIndex(value=>value.replaceAll(' ','').toLowerCase()===name.toLowerCase());
  return index<0?Block.Air:index as Block;
}
export class InventoryGrid {
  readonly slots:Stack[];
  constructor(readonly size:number){this.slots=Array.from({length:size},empty);}
  get(i:number):Stack{return this.slots[i]!;}
  set(i:number,s:Stack):void {if(!isEmpty(s)&&(!catalog.has(s.id)||s.count>item(s.id).stack||s.count<1))throw new Error('Invalid stack');this.slots[i]=isEmpty(s)?empty():clone(s);}
  load(source:Stack[]|undefined):void {for(let i=0;i<this.size;i++){const s=source?.[i];this.slots[i]=s&&catalog.has(s.id)&&s.count>0?stack(s.id,Math.min(item(s.id).stack,s.count),Math.max(0,s.damage||0)):empty();}}
  snapshot():Stack[]{return this.slots.map(clone);}
  count(id:string):number{return this.slots.reduce((sum,s)=>sum+(s.id===id?s.count:0),0);}
  add(id:string,amount:number,damage=0):number {
    if(amount<=0)return 0;
    const cap=item(id).stack;
    for(const s of this.slots)if(s.id===id&&s.damage===damage&&s.count<cap){const take=Math.min(cap-s.count,amount);s.count+=take;amount-=take;if(!amount)return 0;}
    for(let i=0;i<this.size;i++)if(isEmpty(this.get(i))){const take=Math.min(cap,amount);this.set(i,stack(id,take,damage));amount-=take;if(!amount)return 0;}
    return amount;
  }
  consume(id:string,amount:number):boolean {
    if(this.count(id)<amount)return false;
    for(let i=this.size-1;i>=0&&amount>0;i--){const s=this.get(i);if(s.id!==id)continue;const take=Math.min(s.count,amount);this.set(i,stack(id,s.count-take,s.damage));amount-=take;}
    return true;
  }
  click(i:number,cursor:Stack,right=false):Stack {
    const held=this.get(i);
    if(right){
      if(isEmpty(cursor)){if(isEmpty(held))return empty();const take=Math.ceil(held.count/2);this.set(i,stack(held.id,held.count-take,held.damage));return stack(held.id,take,held.damage);}
      if(isEmpty(held)||held.id===cursor.id&&held.damage===cursor.damage&&held.count<item(cursor.id).stack){
        this.set(i,isEmpty(held)?stack(cursor.id,1,cursor.damage):stack(held.id,held.count+1,held.damage));return stack(cursor.id,cursor.count-1,cursor.damage);
      }
      return cursor;
    }
    if(isEmpty(cursor)){this.set(i,empty());return held;}
    if(isEmpty(held)){this.set(i,cursor);return empty();}
    if(held.id===cursor.id&&held.damage===cursor.damage){const take=Math.min(item(cursor.id).stack-held.count,cursor.count);this.set(i,stack(held.id,held.count+take,held.damage));return stack(cursor.id,cursor.count-take,cursor.damage);}
    this.set(i,cursor);return held;
  }
  damage(i:number,amount:number):boolean {const s=this.get(i);if(isEmpty(s)||item(s.id).durability<=0)return false;this.set(i,s.damage+amount>=item(s.id).durability?empty():stack(s.id,s.count,s.damage+amount));return true;}
}
export interface Recipe {id:string;kind:'shaped'|'shapeless';width:number;inputs:string[];output:string;count:number;station:boolean}
export interface Smelt {input:string;output:string;seconds:number}
export const recipes:Recipe[]=rawRecipes as Recipe[];
export const smelting=new Map<string,Smelt>((rawSmelting as Smelt[]).map(r=>[r.input,r]));
export function matchRecipe(grid:InventoryGrid,width:number,station:boolean):Recipe|undefined {
  for(const recipe of recipes){
    if(recipe.station&&!station||recipe.width>width)continue;
    if(recipe.kind==='shapeless'){
      const present=grid.slots.filter(s=>!isEmpty(s)).map(s=>s.id).sort().join('|');
      if(present===recipe.inputs.slice().sort().join('|'))return recipe;
    } else for(let oy=0;oy<=width-recipe.width;oy++)for(let ox=0;ox<=width-recipe.width;ox++){
      let valid=true;
      for(let y=0;y<width&&valid;y++)for(let x=0;x<width;x++){
        const rx=x-ox,ry=y-oy;
        const needed=rx>=0&&ry>=0&&rx<recipe.width&&ry<recipe.width?recipe.inputs[ry*recipe.width+rx]:'';
        if(grid.get(y*width+x).id!==needed){valid=false;break;}
      }
      if(valid)return recipe;
    }
  }
  return undefined;
}
export function craft(grid:InventoryGrid,width:number,station:boolean,output:InventoryGrid):Recipe|undefined {
  const recipe=matchRecipe(grid,width,station);if(!recipe)return;
  const trial=new InventoryGrid(output.size);trial.load(output.snapshot());
  if(trial.add(recipe.output,recipe.count)>0)return;
  for(let i=0;i<grid.size;i++){const s=grid.get(i);if(!isEmpty(s))grid.set(i,stack(s.id,s.count-1,s.damage));}
  output.load(trial.snapshot());return recipe;
}
export class Furnace {
  slots=new InventoryGrid(3);burn=0;progress=0;
  tick(seconds:number):boolean {
    if(seconds<=0)return false;
    const input=this.slots.get(0),recipe=smelting.get(input.id);
    if(!recipe){this.progress=0;return false;}
    const out=this.slots.get(2);
    if(!isEmpty(out)&&(out.id!==recipe.output||out.count>=item(out.id).stack))return false;
    if(this.burn<=0){const fuel=this.slots.get(1);if(isEmpty(fuel)||item(fuel.id).fuelSeconds<=0)return false;this.burn=item(fuel.id).fuelSeconds;this.slots.set(1,stack(fuel.id,fuel.count-1,fuel.damage));}
    const active=Math.min(seconds,this.burn);this.burn-=active;this.progress+=active;
    if(this.progress>=recipe.seconds){this.progress-=recipe.seconds;this.slots.set(0,stack(input.id,input.count-1,input.damage));this.slots.set(2,isEmpty(out)?stack(recipe.output):stack(out.id,out.count+1,out.damage));}
    return true;
  }
  snapshot(){return {slots:this.slots.snapshot(),burn:this.burn,progress:this.progress};}
  load(value:{slots:Stack[];burn:number;progress:number}){this.slots.load(value.slots);this.burn=Math.max(0,value.burn||0);this.progress=Math.max(0,Math.min(60,value.progress||0));}
}
const starter=['dirt','stone','sand','gravel','glass','slab','stairs','door','fence'];
export interface ItemsSave {slots:Stack[];equipment:Stack[];selected:number;tool:Tool;cursor:Stack;personal:Stack[];stations:[string,Stack[]][];chests:[string,Stack[]][];furnaces:[string,ReturnType<Furnace['snapshot']>][]}
export class GameItems {
  slots=new InventoryGrid(36);equipment=new InventoryGrid(4);personal=new InventoryGrid(4);
  stations=new Map<string,InventoryGrid>();chests=new Map<string,InventoryGrid>();furnaces=new Map<string,Furnace>();
  selected=0;tool:Tool='hand';cursor=empty();
  constructor(){this.reset();}
  reset(){this.slots.load([]);this.equipment.load([]);this.personal.load([]);this.stations.clear();this.chests.clear();this.furnaces.clear();this.cursor=empty();this.selected=0;this.tool='hand';starter.forEach((id,i)=>this.slots.set(i,stack(id,32)));}
  select(i:number){this.selected=((i%9)+9)%9;}
  cycleTool(){this.tool=this.tool==='hand'?'pickaxe':this.tool==='pickaxe'?'shovel':'hand';}
  selectedStack(){return this.slots.get(this.selected);}
  selectedBlock(){const s=this.selectedStack();return isEmpty(s)?Block.Air:itemBlock(s.id);}
  miningTime(block:Block){const base=miningSeconds(block,this.tool),s=this.equipment.get(0);if(isEmpty(s)||this.tool==='hand')return base;const def=item(s.id);return def.category===this.tool?Math.max(.08,base/Math.max(1,def.speed/2)):base;}
  wearTool(){if(this.tool!=='hand')this.equipment.damage(0,1);}
  spendSelected(){const s=this.selectedStack();if(isEmpty(s))return false;this.slots.set(this.selected,stack(s.id,s.count-1,s.damage));return true;}
  station(key:string){if(!this.stations.has(key))this.stations.set(key,new InventoryGrid(9));return this.stations.get(key)!;}
  chest(key:string){if(!this.chests.has(key))this.chests.set(key,new InventoryGrid(27));return this.chests.get(key)!;}
  furnace(key:string){if(!this.furnaces.has(key))this.furnaces.set(key,new Furnace());return this.furnaces.get(key)!;}
  snapshot():ItemsSave{return {slots:this.slots.snapshot(),equipment:this.equipment.snapshot(),selected:this.selected,tool:this.tool,cursor:clone(this.cursor),personal:this.personal.snapshot(),stations:[...this.stations].map(([k,v])=>[k,v.snapshot()]),chests:[...this.chests].map(([k,v])=>[k,v.snapshot()]),furnaces:[...this.furnaces].map(([k,v])=>[k,v.snapshot()])};}
  load(save:ItemsSave|undefined){this.reset();if(!save)return;this.slots.load(save.slots);this.equipment.load(save.equipment);this.personal.load(save.personal);this.selected=((save.selected%9)+9)%9;this.tool=['hand','pickaxe','shovel'].includes(save.tool)?save.tool:'hand';this.cursor=save.cursor&&catalog.has(save.cursor.id)?clone(save.cursor):empty();for(const [k,v] of save.stations||[])this.station(k).load(v);for(const [k,v] of save.chests||[])this.chest(k).load(v);for(const [k,v] of save.furnaces||[])this.furnace(k).load(v);}
}
