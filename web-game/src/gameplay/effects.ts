export interface EffectSave{swift:number;guard:number}
export class EffectSystem{
  swift=0;guard=0;
  clear(){this.swift=this.guard=0;}
  tick(delta:number){this.swift=Math.max(0,this.swift-delta);this.guard=Math.max(0,this.guard-delta);}
  use(id:string):boolean{if(id==='swift_tonic'){this.swift=60;return true;}
    if(id==='guard_tonic'){this.guard=60;return true;}return false;}
  reduceDamage(amount:number){return this.guard>0?amount*.6:amount;}
  snapshot():EffectSave{return {swift:this.swift,guard:this.guard};}
  load(save?:EffectSave){this.swift=Math.max(0,Math.min(3600,save?.swift||0));this.guard=Math.max(0,Math.min(3600,save?.guard||0));}
}
