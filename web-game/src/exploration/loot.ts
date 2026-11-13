import raw from './loot.json';
import {InventoryGrid,catalog,type Stack} from '../items/items';
import type {StructureKind,StructureSite} from '../world/structures';

interface Entry{id:string;min:number;max:number;weight:number}
interface Table{rolls:number;guaranteed:{id:string;count:number}[];entries:Entry[]}
export const lootTables=raw as Record<StructureKind,Table>;
export function lootFor(site:StructureSite,seed:number):Stack[]{
  const table=lootTables[site.kind],grid=new InventoryGrid(27);
  let n=(seed^0x4a7c15d3)>>>0;for(const char of site.id)n=Math.imul(n^char.charCodeAt(0),16777619)>>>0;
  const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/0x100000000;};
  for(const entry of table.guaranteed)if(catalog.has(entry.id))grid.add(entry.id,entry.count);
  const total=table.entries.reduce((sum,entry)=>sum+entry.weight,0);
  for(let i=0;i<table.rolls;i++){
    let roll=random()*total,selected=table.entries.at(-1)!;
    for(const entry of table.entries){roll-=entry.weight;if(roll<0){selected=entry;break;}}
    if(!catalog.has(selected.id))continue;
    const count=selected.min+Math.floor(random()*(selected.max-selected.min+1));grid.add(selected.id,count);
  }
  return grid.snapshot();
}
