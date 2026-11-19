export class MiningProgress{
  key='';elapsed=0;
  reset():void{this.key='';this.elapsed=0;}
  advance(key:string,seconds:number,duration:number):number{
    if(key!==this.key){this.key=key;this.elapsed=0;}
    this.elapsed+=Math.max(0,seconds);
    return duration===0?1:Math.min(1,this.elapsed/duration);
  }
}
