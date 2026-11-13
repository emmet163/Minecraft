import raw from './trades.json';
import {GameItems,InventoryGrid,catalog} from '../items/items';
import type {Occupation} from '../creatures/system';

export interface TradeOffer{give:string;giveCount:number;receive:string;receiveCount:number;limit:number}
export const tradeOffers=raw as Record<Occupation,TradeOffer[]>;
interface TradeRecord{day:number;uses:number[]}
export interface VillageSave{trades:[string,TradeRecord][];deceased:string[]}
export class VillageLedger{
  readonly trades=new Map<string,TradeRecord>();readonly deceased=new Set<string>();
  reset(){this.trades.clear();this.deceased.clear();}
  snapshot():VillageSave{return {trades:[...this.trades].map(([key,value])=>[key,{day:value.day,uses:[...value.uses]}]),deceased:[...this.deceased]};}
  load(save:VillageSave|undefined){this.reset();if(!save)return;
    for(const [key,value] of save.trades||[])if(typeof key==='string'&&Number.isFinite(value?.day)&&Array.isArray(value.uses))
      this.trades.set(key,{day:value.day,uses:value.uses.map(n=>Math.max(0,n|0))});
    for(const key of save.deceased||[])if(typeof key==='string')this.deceased.add(key);
  }
  used(key:string,index:number,day:number){const record=this.trades.get(key);return record?.day===day?record.uses[index]||0:0;}
  trade(items:GameItems,key:string,occupation:Occupation,index:number,day:number):{ok:boolean;message:string}{
    const offer=tradeOffers[occupation]?.[index];if(!offer||!catalog.has(offer.give)||!catalog.has(offer.receive))return {ok:false,message:'Offer unavailable'};
    if(this.deceased.has(key))return {ok:false,message:'Trader unavailable'};
    if(this.used(key,index,day)>=offer.limit)return {ok:false,message:'Sold out today'};
    const trial=new InventoryGrid(items.slots.size);trial.load(items.slots.snapshot());
    if(!trial.consume(offer.receive,offer.receiveCount))return {ok:false,message:'Missing trade items'};
    if(trial.add(offer.give,offer.giveCount)>0)return {ok:false,message:'Inventory full'};
    items.slots.load(trial.snapshot());
    const record=this.trades.get(key);const uses=record?.day===day?[...record.uses]:[];uses[index]=(uses[index]||0)+1;
    this.trades.set(key,{day,uses});return {ok:true,message:'Trade complete'};
  }
}
