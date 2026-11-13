import type {StructurePlanner,StructureSite} from '../world/structures';

export interface ExplorationSave{discovered:string[];tracked:string|null;defeated?:string[]}
export class ExplorationState{
  readonly discovered=new Set<string>();readonly defeated=new Set<string>();tracked:string|null=null;
  reset(){this.discovered.clear();this.defeated.clear();this.tracked=null;}
  snapshot():ExplorationSave{return {discovered:[...this.discovered],tracked:this.tracked,defeated:[...this.defeated]};}
  load(save:ExplorationSave|undefined){this.reset();if(!save)return;
    for(const id of save.discovered||[])if(typeof id==='string')this.discovered.add(id);
    for(const id of save.defeated||[])if(typeof id==='string')this.defeated.add(id);
    this.tracked=typeof save.tracked==='string'?save.tracked:null;
  }
  visit(planner:StructurePlanner,x:number,z:number):StructureSite[]{const fresh:StructureSite[]=[];
    for(const site of planner.nearby(x,z,30))if(!this.discovered.has(site.id)){
      this.discovered.add(site.id);fresh.push(site);
    }
    return fresh;
  }
  target(sites:StructureSite[],hasWayfinder:boolean):StructureSite|undefined{
    const selected=sites.find(site=>site.id===this.tracked);if(selected)return selected;
    return hasWayfinder?sites.find(site=>!this.discovered.has(site.id)):sites.find(site=>this.discovered.has(site.id));
  }
}
