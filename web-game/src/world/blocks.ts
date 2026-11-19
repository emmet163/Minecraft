export const enum Block {
  Air, Grass, Dirt, Stone, Sand, Snow, Mud, Water, Wood, Leaves, Flower, Plant,
  Coal, Copper, Iron, Gold, GrassSide, SnowSide, Gravel, Glass, Slab, Stairs,
  Door, Fence, CraftingStation, Furnace, Chest, Bed,
  WaterFlow, Lava, LavaFlow, Wire, Switch, Button, Plate, Repeater, Lamp, Piston,
  Farmland, WheatCrop, BerryCrop, Rail, RealmPortal, GlowOre, Crystal,
}
export const blockNames = [
  'Air','Grass','Dirt','Stone','Sand','Snow','Mud','Water','Wood','Leaves','Flower','Plant',
  'Coal','Copper','Iron','Gold','Grass Side','Snow Side','Gravel','Glass','Slab','Stairs',
  'Door','Fence','Crafting Station','Furnace','Chest','Bed',
  'Flowing Water','Lava','Flowing Lava','Signal Wire','Signal Switch','Signal Button','Pressure Plate','Repeater','Signal Lamp','Piston',
  'Farmland','Wheat Crop','Berry Crop','Rail','Realm Portal','Glow Ore','Crystal',
] as const;
export interface BlockState { type: Block; properties: number }
export const air: BlockState = { type: Block.Air, properties: 0 };
export const state = (type: Block, properties = 0): BlockState => ({ type, properties });
export const isFluid=(b:Block)=>b===Block.Water||b===Block.WaterFlow||b===Block.Lava||b===Block.LavaFlow;
export const isDecorative = (b: Block) => b === Block.Plant || b === Block.Flower || b===Block.Wire || b===Block.Plate || b===Block.Rail || b===Block.WheatCrop || b===Block.BerryCrop;
export const isSolid = (b: Block) => b !== Block.Air && !isFluid(b) && !isDecorative(b) && b!==Block.RealmPortal;
export const isReplaceable = (b: Block) => b === Block.Air || isFluid(b) || isDecorative(b);
export const isTransparent = (b: Block) => isFluid(b) || b === Block.Glass || b === Block.Leaves || b===Block.RealmPortal;
export const isShaped = (b: Block) => b >= Block.Slab && b <= Block.Fence || b === Block.Bed || [Block.Wire,Block.Switch,Block.Button,Block.Plate,Block.Repeater,Block.Lamp,Block.Piston,Block.Farmland,Block.WheatCrop,Block.BerryCrop,Block.Rail,Block.RealmPortal].includes(b);
export type Tool = 'hand' | 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'weapon';
export interface MiningRule { hardness:number; preferred:Tool; required?:Exclude<Tool,'hand'>; minTier:number; handHarvest:boolean; loot:'self'|'dirt'|'none'; unbreakable?:boolean }
const baseRule:MiningRule={hardness:1.8,preferred:'pickaxe',minTier:0,handHarvest:true,loot:'self'};
const miningRules:Partial<Record<Block,Partial<MiningRule>>>={
  [Block.Air]:{hardness:0,loot:'none'},
  [Block.Water]:{hardness:0,loot:'none'},[Block.WaterFlow]:{hardness:0,loot:'none'},
  [Block.Lava]:{hardness:0,loot:'none'},[Block.LavaFlow]:{hardness:0,loot:'none'},
  [Block.Dirt]:{hardness:.65,preferred:'shovel'},[Block.Grass]:{hardness:.65,preferred:'shovel',loot:'dirt'},
  [Block.Sand]:{hardness:.65,preferred:'shovel'},[Block.Gravel]:{hardness:.65,preferred:'shovel'},
  [Block.Mud]:{hardness:.65,preferred:'shovel'},[Block.Snow]:{hardness:.65,preferred:'shovel'},
  [Block.Wood]:{hardness:1.1,preferred:'axe'},[Block.Door]:{hardness:1.1,preferred:'axe'},
  [Block.Fence]:{hardness:1.1,preferred:'axe'},[Block.Stairs]:{hardness:1.1,preferred:'axe'},
  [Block.Bed]:{hardness:1.1,preferred:'axe'},[Block.Chest]:{preferred:'axe'},
  [Block.CraftingStation]:{preferred:'axe'},[Block.Leaves]:{hardness:.2,preferred:'hoe'},
  [Block.Flower]:{hardness:.12,preferred:'hand'},[Block.Plant]:{hardness:.12,preferred:'hand'},
  [Block.Wire]:{hardness:.12,preferred:'hand'},[Block.Plate]:{hardness:.12,preferred:'hand'},
  [Block.Rail]:{hardness:.12,preferred:'hand'},[Block.WheatCrop]:{hardness:.12,preferred:'hand'},
  [Block.BerryCrop]:{hardness:.12,preferred:'hand'},[Block.Glass]:{hardness:.35},
  [Block.Stone]:{required:'pickaxe',minTier:1,handHarvest:false},
  [Block.Slab]:{required:'pickaxe',minTier:1,handHarvest:false},
  [Block.Coal]:{required:'pickaxe',minTier:1,handHarvest:false},
  [Block.Copper]:{required:'pickaxe',minTier:2,handHarvest:false},
  [Block.Iron]:{required:'pickaxe',minTier:2,handHarvest:false,hardness:2.4},
  [Block.Gold]:{required:'pickaxe',minTier:4,handHarvest:false,hardness:2.4},
  [Block.GlowOre]:{required:'pickaxe',minTier:4,handHarvest:false},
  [Block.Crystal]:{required:'pickaxe',minTier:4,handHarvest:false},
  [Block.Furnace]:{required:'pickaxe',minTier:1,handHarvest:false},
};
export function miningRule(b:Block):MiningRule{return {...baseRule,...miningRules[b]};}
export function hardness(b:Block):number{return miningRule(b).hardness;}
export function canHarvest(b:Block,tool:Tool,tier:number):boolean{
  const rule=miningRule(b);
  if(rule.loot==='none')return false;
  if(tool==='hand')return rule.handHarvest;
  return !rule.required||tool===rule.required&&tier>=rule.minTier;
}
export function miningSeconds(b:Block,tool:Tool,speed=1):number{
  const rule=miningRule(b);
  if(rule.unbreakable)return Infinity;
  if(rule.hardness===0)return .12;
  const effective=tool===rule.preferred&&tool!=='hand';
  return Math.max(.08,rule.hardness/(effective?Math.max(1,speed)*1.75:rule.required?.28:1));
}
export function dropType(b: Block): Block { return b === Block.Grass ? Block.Dirt : b; }
export const selectableBlocks: Block[] = [Block.Grass,Block.Dirt,Block.Stone,Block.Sand,Block.Wood,Block.Leaves,Block.Glass,Block.Slab,Block.Stairs,Block.Water,Block.Lava,Block.Wire,Block.Switch,Block.Button,Block.Plate,Block.Repeater,Block.Lamp,Block.Piston,Block.Farmland,Block.WheatCrop,Block.BerryCrop,Block.Rail,Block.RealmPortal];
export interface Box { minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number }
export function collisionBoxes(s: BlockState): Box[] {
  const box=(minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number):Box=>({minX,maxX,minY,maxY,minZ,maxZ});
  if(!isSolid(s.type))return [];
  if(s.type===Block.Farmland)return [box(-.5,.5,-.5,.35,-.5,.5)];
  if(s.type===Block.Switch||s.type===Block.Button)return [box(-.25,.25,-.25,.25,-.25,.25)];
  if(s.type===Block.Slab)return [s.properties&4?box(-.5,.5,0,.5,-.5,.5):box(-.5,.5,-.5,0,-.5,.5)];
  if(s.type===Block.Bed)return [box(-.5,.5,-.5,0,-.5,.5)];
  if(s.type===Block.Door){
    const facing=((s.properties&3)+(s.properties&8?1:0))&3;
    return [facing%2===0?box(-.09,.09,-.5,.5,-.5,.5):box(-.5,.5,-.5,.5,-.09,.09)];
  }
  if(s.type===Block.Stairs){
    const facing=s.properties&3;
    const lower=box(-.5,.5,-.5,0,-.5,.5);
    const upper=facing===1?box(0,.5,0,.5,-.5,.5):facing===2?box(-.5,.5,0,.5,0,.5):
      facing===3?box(-.5,0,0,.5,-.5,.5):box(-.5,.5,0,.5,-.5,0);
    return [lower,upper];
  }
  return [box(-.5,.5,-.5,.5,-.5,.5)];
}
export function floorDiv(n: number, d: number): number { return Math.floor(n / d); }
export function cellOf(n: number): number { return Math.floor(n + .5); }
