import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Wallet} from 'ethers';
import {createApp} from '../server/app';
import {config} from '../server/config';

test('saved outpost missions, beacon and wallet session survive server restart',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'hood-rivals-world-'));
  const path=join(folder,'outpost.sqlite');
  let cookie='',csrf='';
  async function serve(){
    const runtime=createApp({...config,db:path,origin:'http://world.test',production:false});
    const http=runtime.app.listen(0);
    await new Promise<void>(resolve=>http.once('listening',resolve));
    const base=`http://127.0.0.1:${(http.address() as any).port}`;
    const api=async(route:string,body?:unknown)=>{
      const response=await fetch(base+'/api'+route,{
        method:body===undefined?'GET':'POST',
        headers:{'content-type':'application/json',origin:'http://world.test',cookie,'x-csrf-token':csrf},
        body:body===undefined?undefined:JSON.stringify(body),
      });
      cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
      const data=await response.json();if(data.csrf)csrf=data.csrf;
      return {status:response.status,data};
    };
    return {runtime,base,api,close:async()=>{await new Promise<void>(resolve=>http.close(()=>resolve()));runtime.close()}};
  }
  let app:Awaited<ReturnType<typeof serve>>|null=null;
  try{
    app=await serve();
    assert.equal((await app.api('/missions')).status,401);
    assert.equal((await app.api('/session',{})).status,200);
    const wallet=Wallet.createRandom();
    const proof=await app.api('/wallet/challenge',{address:wallet.address});
    assert.equal((await app.api('/wallet/verify',{nonce:proof.data.nonce,signature:await wallet.signMessage(proof.data.message)})).status,200);
    assert.equal((await app.api('/onboarding',{name:'World Captain',faction:1,stance:'careful'})).status,200);
    async function finishMission(objective:string,role:string){
      const started=await app!.api('/missions',{objective,role,approach:'careful',maxFoodSpend:0});
      assert.equal(started.status,201,JSON.stringify(started.data));
      app!.runtime.db.prepare('UPDATE outpost_missions SET next_at=? WHERE id=?').run(Date.now()-61000,started.data.id);
      assert.equal((await app!.api('/missions')).data.missions[0].status,'finished');
      assert.equal((await app!.api(`/missions/${started.data.id}/proof`)).data.intact,true);
    }
    await finishMission('forest','quartermaster');
    await finishMission('quarry','engineer');
    const built=await app.api('/missions/beacon',{});
    assert.equal(built.status,200);assert.equal(built.data.store.beacon_level,1);
    assert.equal(built.data.store.wood,0);assert.equal(built.data.store.stone,0);
    await app.close();app=null;
    app=await serve();
    const restored=await app.api('/missions');
    assert.equal(restored.status,200);
    assert.equal(restored.data.store.beacon_level,1);
    assert.equal(restored.data.remaining,1);
    await finishMission('mine','engineer');
    assert.equal((await app.api('/missions')).data.store.ore,2);
    const world=await fetch(app.base+'/observatory.html?embedded=1');
    assert.equal(world.status,200);
    assert.match(await world.text(),/savedOutpost/);
  }finally{
    if(app)await app.close();
    rmSync(folder,{recursive:true,force:true});
  }
});
