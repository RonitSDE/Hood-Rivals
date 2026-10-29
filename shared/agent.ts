import {botOrder,distance,validateOrder,type GameState,type Order} from './game';
export type AgentStyle='balanced'|'explorer'|'fortifier'|'diplomat';
/** A transparent, deterministic tactical policy. Memory and experience change choices, never game stats. */
export function agentOrder(s:GameState,id:number,style:AgentStyle,played:number):Order {
  const f=s.factions[id],base=botOrder(s,id);
  const legal=(order:Order)=>validateOrder(s,id,order)===null;
  const reachable=s.tiles.filter(t=>distance(t.id,f.pos)<=2&&t.id!==f.pos&&!(t.kind==='base'&&t.owner!==id));
  if(played>=3){
    const banner=reachable.find(t=>t.kind==='flag'&&f.explored.includes(t.id)&&f.seen[t.id]!==id);
    if(banner){const order:Order={type:'contest',target:banner.id};if(legal(order))return order;}
  }
  if(style==='explorer'){
    const target=reachable.find(t=>!f.explored.includes(t.id));
    if(target){const order:Order={type:'scout',target:target.id};if(legal(order))return order;}
  }
  if(style==='fortifier'){
    for(const upgrade of [f.hp<4?'heal':'fortify','income'] as const){
      const order:Order={type:'develop',upgrade};if(legal(order))return order;
    }
  }
  if(style==='diplomat'){
    const partner=s.factions.filter(other=>other.id!==id&&(f.memory[String(other.id)]||0)>0)
      .sort((a,b)=>(f.memory[String(b.id)]||0)-(f.memory[String(a.id)]||0))[0];
    if(partner){const order:Order={type:'pact',partner:partner.id};if(legal(order))return order;}
  }
  return base;
}
