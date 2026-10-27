import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app';
import { config } from '../server/config';
import { createGame, viewGame, validateOrder, type GameEvent } from '../shared/game';
import { trainingMove, matchRecap } from '../shared/experience';

test('guidance uses legal player-visible orders and recaps count reciprocal pacts once',()=>{
  for(let seed=0;seed<40;seed++)for(let you=0;you<3;you++){
    const state=createGame('guide:'+seed),visible=viewGame(state,you);
    const hint=trainingMove(visible as any,you);
    assert.equal(validateOrder(state,you,hint.order),null);
  }
  const events:GameEvent[]=[{round:1,kind:'pact',text:'A and B kept their pact.',actors:[0,1]},{round:1,kind:'pact',text:'B and A kept their pact.',actors:[1,0]},{round:2,kind:'betrayal',text:'B raided A.',actors:[0,1]}];
  assert.equal(matchRecap(events,0).pacts,1);
  assert.equal(matchRecap(events,0).moment?.text,'B raided A.');
  assert.equal(matchRecap([],0).moment,null);
});

test('practice waits without a timer, earns nothing, can be left; rival memory restores only in solo',async()=>{
  const runtime=createApp({...config,db:':memory:',production:false,origin:'http://test',roundMs:1000});
  const server=runtime.app.listen(0);await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  let cookie='',csrf='';
  const call=async(path:string,body?:any)=>{
    const response=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',origin:'http://test',cookie,'x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});
    cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
    const data=await response.json();csrf=data.csrf||csrf;return {status:response.status,data};
  };
  try{
    await call('/session',{});const before=(await call('/bootstrap')).data;
    const id=(await call('/matches',{mode:'training'})).data.id;
    runtime.db.prepare('UPDATE matches SET deadline=0 WHERE id=?').run(id);
    let game=(await call('/matches/'+id)).data;assert.equal(game.round,1);
    while(game.status==='active'){
      assert.equal((await call(`/matches/${id}/orders`,{round:game.round,order:{type:'hold'}})).status,200);
      game=(await call('/matches/'+id)).data;
    }
    const after=(await call('/bootstrap')).data;
    assert.equal(after.profile.xp,before.profile.xp);assert.equal(after.profile.played,0);
    assert.equal((await call('/replays/'+id)).data.verified,true);
    const second=(await call('/matches',{mode:'training'})).data.id;
    assert.equal((await call(`/matches/${second}/leave`,{})).status,200);
    runtime.db.prepare('UPDATE users SET rival_memory=?,memory=? WHERE id=?').run('{"1":-2,"2":1}','{"1":-1}',before.profile.id);
    const solo=(await call('/matches',{mode:'solo'})).data.id;
    const state=JSON.parse((runtime.db.prepare('SELECT state FROM matches WHERE id=?').get(solo) as any).state);
    assert.equal(state.factions[1].memory['0'],-2);assert.equal(state.factions[2].memory['0'],1);
    assert.equal((await call(`/matches/${solo}/leave`,{})).status,403);
    runtime.db.prepare("UPDATE matches SET status='finished' WHERE id=?").run(solo);
    const ranked=(await call('/matches',{mode:'weekly'})).data.id;
    let rankedState=(await call('/matches/'+ranked)).data;
    while(rankedState.status==='active'){
      await call(`/matches/${ranked}/orders`,{round:rankedState.round,order:{type:'hold'}});
      rankedState=(await call('/matches/'+ranked)).data;
    }
    assert.deepEqual((await call('/bootstrap')).data.profile.memory,{'1':-1});
    assert.deepEqual((await call('/bootstrap')).data.profile.rivalMemory,{'1':-2,'2':1});
  }finally{await runtime.close();await new Promise<void>(r=>server.close(()=>r()))}
});

test('concurrent starts resume one match; campaign results are idempotent and private',async()=>{
  const runtime=createApp({...config,db:':memory:',production:false,origin:'http://test',roundMs:1000});
  const server=runtime.app.listen(0);await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  async function client(){
    const response=await fetch(base+'/session',{method:'POST',headers:{origin:'http://test','content-type':'application/json'},body:'{}'});
    const cookie=response.headers.get('set-cookie')!.split(';')[0],{csrf}=await response.json();
    return async(path:string,body?:any)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,origin:'http://test','content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
  }
  try{
    const call=await client(),other=await client();
    const starts=await Promise.all(Array.from({length:5},()=>call('/matches',{mode:'solo'})));
    const id=starts[0].data.id;
    assert.ok(starts.every(x=>x.status===200&&x.data.id===id));
    assert.equal((runtime.db.prepare('SELECT COUNT(*) n FROM matches').get() as any).n,1);
    assert.equal((await other(`/matches/${id}/orders`,{round:1,order:{type:'hold'}})).status,400);
    let game=(await call('/matches/'+id)).data;
    while(game.status==='active'){
      await call(`/matches/${id}/orders`,{round:game.round,order:{type:'hold'}});
      game=(await call('/matches/'+id)).data;
    }
    for(let i=0;i<3;i++)await call('/matches/'+id);
    const boot=(await call('/bootstrap')).data;
    assert.equal(boot.campaign.length,1);assert.equal(boot.campaign[0].match_id,id);
    assert.equal(boot.profile.played,1);assert.ok(boot.campaign[0].moment.length>0);
    assert.equal((await other('/bootstrap')).data.campaign.length,0);
    assert.equal((await call('/replays/'+id)).data.verified,true);
  }finally{await runtime.close();await new Promise<void>(r=>server.close(()=>r()))}
});

test('declined convoy offers do not count as successful pacts',()=>{
  assert.equal(matchRecap([{round:1,kind:'pact',actors:[0,1],text:"B did not accept A's convoy pact. Supplies returned."}],0).pacts,0);
});
