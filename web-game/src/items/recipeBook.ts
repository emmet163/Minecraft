import {InventoryGrid,clone,isEmpty,item,matchRecipe,stack,type Recipe,type Stack} from './items';

export type RecipeCategory='all'|'building'|'equipment'|'provisions'|'exploration';
export const recipeCategories:ReadonlyArray<{id:RecipeCategory;label:string;symbol:string}>=[
  {id:'all',label:'All',symbol:'▦'},{id:'building',label:'Building',symbol:'▧'},
  {id:'equipment',label:'Equipment',symbol:'⚒'},{id:'provisions',label:'Provisions',symbol:'✦'},
  {id:'exploration',label:'Exploration',symbol:'✧'},
];
export function recipeCategory(recipe:Recipe):RecipeCategory{
  const type=item(recipe.output).category;
  if(['pickaxe','shovel','weapon','armor'].includes(type))return 'equipment';
  if(['food','survival','potion'].includes(type))return 'provisions';
  if(['navigation','treasure','vehicle'].includes(type)||['portal_frame','wayfinder','survey_map'].includes(recipe.output))return 'exploration';
  return 'building';
}
export function recipeIngredients(recipe:Recipe):Array<{id:string;count:number}>{
  const counts=new Map<string,number>();for(const id of recipe.inputs)if(id)counts.set(id,(counts.get(id)||0)+1);
  return [...counts].map(([id,count])=>({id,count}));
}
export interface RecipePlan{bag:Stack[];grid:Stack[]}
export function planRecipe(recipe:Recipe,grid:InventoryGrid,bag:InventoryGrid,width:number,station:boolean):RecipePlan|null{
  if(recipe.width>width||recipe.station&&!station||recipe.inputs.filter(Boolean).length>grid.size)return null;
  if(matchRecipe(grid,width,station)?.id===recipe.id)return {bag:bag.snapshot(),grid:grid.snapshot()};
  const trialBag=new InventoryGrid(bag.size),trialGrid=new InventoryGrid(grid.size);trialBag.load(bag.snapshot());
  for(const held of grid.slots)if(!isEmpty(held)&&trialBag.add(held.id,held.count,held.damage)>0)return null;
  const placements=recipe.kind==='shaped'?recipe.inputs.map((id,i)=>({id,index:Math.floor(i/recipe.width)*width+i%recipe.width})):
    recipe.inputs.map((id,index)=>({id,index}));
  for(const {id,index} of placements){if(!id)continue;
    let found=-1;for(let i=0;i<trialBag.size;i++)if(trialBag.get(i).id===id){found=i;break;}
    if(found<0)return null;
    const ingredient=trialBag.get(found);trialGrid.set(index,stack(id,1,ingredient.damage));
    trialBag.set(found,stack(id,ingredient.count-1,ingredient.damage));
  }
  if(matchRecipe(trialGrid,width,station)?.id!==recipe.id)return null;
  return {bag:trialBag.snapshot().map(clone),grid:trialGrid.snapshot().map(clone)};
}
export function populateRecipe(recipe:Recipe,grid:InventoryGrid,bag:InventoryGrid,width:number,station:boolean):boolean{
  const plan=planRecipe(recipe,grid,bag,width,station);if(!plan)return false;
  bag.load(plan.bag);grid.load(plan.grid);return true;
}
