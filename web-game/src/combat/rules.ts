import {GameItems,isEmpty,item} from '../items/items';

export function meleeDamage(items:GameItems):number{
  const equipped=items.equipment.get(3),selected=items.selectedStack();
  const weapon=!isEmpty(equipped)&&item(equipped.id).category==='weapon'?equipped:
    !isEmpty(selected)&&item(selected.id).category==='weapon'?selected:null;
  return weapon?item(weapon.id).attack??(2+item(weapon.id).tier*1.5):2;
}
export function wearWeapon(items:GameItems):void{
  const equipped=items.equipment.get(3);
  if(!isEmpty(equipped)&&item(equipped.id).category==='weapon')items.equipment.damage(3,1);
  else if(!isEmpty(items.selectedStack())&&item(items.selectedStack().id).category==='weapon')items.slots.damage(items.selected,1);
}
export function absorbCreatureDamage(items:GameItems,damage:number):number{
  let protection=0;
  for(const [slot,weight] of [[1,.075],[2,.12]] as const){
    const piece=items.equipment.get(slot);
    if(isEmpty(piece)||item(piece.id).category!=='armor')continue;
    protection+=item(piece.id).tier*weight;
    items.equipment.damage(slot,1);
  }
  return Math.max(.25,damage*(1-Math.min(.6,protection)));
}
