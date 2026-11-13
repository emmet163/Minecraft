import {GameItems,item} from '../items/items';
import {Creature} from '../creatures/system';
import {VillageLedger,tradeOffers} from '../villages/trades';

export class TradeView{
  readonly overlay:HTMLElement;open=false;creature?:Creature;
  onClose:()=>void=()=>{};onChange:()=>void=()=>{};
  constructor(root:HTMLElement,readonly items:GameItems,readonly ledger:VillageLedger,readonly day:()=>number){
    this.overlay=document.createElement('div');this.overlay.id='trade';this.overlay.className='overlay hidden';root.append(this.overlay);
    this.overlay.addEventListener('click',event=>{
      const target=event.target as HTMLElement;if(target.id==='close-trade'){this.close();return;}
      const button=target.closest<HTMLElement>('[data-offer]');if(!button||!this.creature?.inhabitant)return;
      const {key,occupation}=this.creature.inhabitant;
      const result=this.ledger.trade(this.items,key,occupation,Number(button.dataset.offer),this.day());
      this.message=result.message;if(result.ok)this.onChange();this.render();
    });
  }
  message='';
  openPanel(creature:Creature){if(!creature.inhabitant||!creature.alive)return;
    this.creature=creature;this.open=true;this.message='';this.overlay.classList.remove('hidden');this.render();}
  close(){if(!this.open)return;this.open=false;this.creature=undefined;this.overlay.classList.add('hidden');this.onClose();}
  render(){if(!this.open||!this.creature?.inhabitant)return;
    const {key,occupation}=this.creature.inhabitant;
    this.overlay.innerHTML=`<section class="panel trade-panel"><h1>${occupation.toUpperCase()}</h1><p>Hearthfolk · Day ${this.day()}</p>
      <p>Trade using items in your 36-slot inventory. Offers restock on the next day.</p>
      ${tradeOffers[occupation].map((offer,index)=>{const used=this.ledger.used(key,index,this.day()),remaining=offer.limit-used;
        return `<button data-offer="${index}" ${remaining<=0?'disabled':''}>${item(offer.receive).name} ×${offer.receiveCount} → ${item(offer.give).name} ×${offer.giveCount} · ${remaining} left</button>`;}).join('')}
      <p id="trade-message">${this.message}</p><button id="close-trade">Close (E / Esc)</button></section>`;
  }
}
