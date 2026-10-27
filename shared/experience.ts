import { validateOrder, type GameState, type GameEvent, type Order } from './game';

// Receives the same fog-limited state as the player, never the server's secret seed.
export function trainingMove(state: GameState, you: number): { title: string; detail: string; order: Order } {
  const valid = (o: Order) => !validateOrder(state, you, o);
  if (state.round === 1) {
    const target = state.tiles.find(t => t.kind === 'flag' && valid({type:'scout',target:t.id}))
      || state.tiles.find(t => t.id !== state.factions[you].pos && valid({type:'scout',target:t.id}));
    if (target) return {title:'Find your route', detail:'Scout moves your captain and reveals terrain. It does not claim a banner. Select the suggested route, then seal your order.', order:{type:'scout',target:target.id}};
  }
  const banner = state.tiles.find(t => t.kind === 'flag' && t.owner !== you && valid({type:'contest',target:t.id}));
  if (banner) return {title:'Claim a banner', detail:'Contest claims explored ground. Every banner you hold adds one Renown after each round. Other captains choose at the same time, so an outcome is never guaranteed.',order:{type:'contest',target:banner.id}};
  if (state.factions[you].hp < 3 && valid({type:'develop',upgrade:'heal'})) return {title:'Regroup your squad',detail:'Clashes cost strength. Heal now to recover two strength, up to four.',order:{type:'develop',upgrade:'heal'}};
  const target = state.tiles.find(t => t.kind === 'cache' && t.owner !== you && valid({type:'contest',target:t.id}));
  if (target) return {title:'Secure a supply post',detail:'Supply posts help fund future orders. Banner control wins the match; supplies help you reach it.',order:{type:'contest',target:target.id}};
  return {title:'Read your rivals',detail:'Hold conserves supply. You can also choose another legal order. The highest Renown after six rounds wins; holding all three banners wins immediately.',order:{type:'hold'}};
}

export function matchRecap(events: GameEvent[], you: number) {
  const weight: Record<string,number> = {betrayal:6,battle:5,pact:4,capture:3,move:2,economy:1};
  const relevant = events.filter(e => e.kind !== 'end' && e.actors.includes(you));
  const moment = [...relevant].sort((a,b)=>(weight[b.kind]||0)-(weight[a.kind]||0)||b.round-a.round)[0];
  return {
    moment: moment ? {round:moment.round,kind:moment.kind,text:moment.text} : null,
    captures: relevant.filter(e=>e.kind==='capture'&&e.actors[0]===you).length,
    clashes: relevant.filter(e=>e.kind==='battle').length,
    pacts: new Set(relevant.filter(e=>e.kind==='pact'&&!e.text.includes('did not accept')).map(e=>`${e.round}:${[...e.actors].sort().join(',')}`)).size,
  };
}
