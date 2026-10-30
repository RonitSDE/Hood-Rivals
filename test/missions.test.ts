import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../server/db';
import { advanceMissions, buildBeacon, launchMission, missionBoard, MISSION_STEP_MS, verifyMission } from '../server/missions';
import { createApp } from '../server/app';
import { config } from '../server/config';
import { Wallet } from 'ethers';

test('offline mission resolves once, honors spend limit, persists a useful project and detects a damaged receipt',()=>{
  const db=database(':memory:');
  try{
    db.prepare('INSERT INTO users(id,name,wallet,onboarded) VALUES (?,?,?,1)').run('captain','Mira','0x0000000000000000000000000000000000000001');
    const now=Date.UTC(2026,9,29,10);
    const a=launchMission(db,'captain','forest','careful',0,null,now);
    assert.throws(()=>launchMission(db,'captain','quarry','bold',0,null,now));
    advanceMissions(db,now+MISSION_STEP_MS*3+1);
    advanceMissions(db,now+MISSION_STEP_MS*4);
    let board=missionBoard(db,'captain',now+MISSION_STEP_MS*4);
    assert.equal(board.missions[0].events.length,3);
    assert.equal(board.store.wood,1);
    assert.equal(board.store.food,1);
    assert.equal(verifyMission(db,'captain',a)?.intact,true);
    assert.equal(verifyMission(db,'another',a),null);
    const b=launchMission(db,'captain','quarry','careful',0,null,now+MISSION_STEP_MS*5);
    advanceMissions(db,now+MISSION_STEP_MS*9);
    board=missionBoard(db,'captain',now+MISSION_STEP_MS*9);
    assert.equal(board.store.stone,1);
    assert.equal(verifyMission(db,'captain',b)?.complete,true);
    // A third assignment may gather extra food; the fourth must wait for the UTC reset.
    launchMission(db,'captain','lookout','careful',0,null,now+MISSION_STEP_MS*10);
    advanceMissions(db,now+MISSION_STEP_MS*14);
    assert.throws(()=>launchMission(db,'captain','forest','careful',0,null,now+MISSION_STEP_MS*15));
    assert.throws(()=>buildBeacon(db,'captain'));
    db.prepare('UPDATE outpost_stores SET wood=3,stone=3 WHERE user_id=?').run('captain');
    buildBeacon(db,'captain');
    board=missionBoard(db,'captain',now+MISSION_STEP_MS*16);
    assert.equal(board.store.beacon_level,1);
    assert.equal(board.store.wood,1);
    assert.equal(board.store.stone,1);
    assert.throws(()=>buildBeacon(db,'captain'));
    db.prepare('UPDATE outpost_mission_events SET detail=? WHERE mission_id=? AND seq=2').run('changed',a);
    assert.equal(verifyMission(db,'captain',a)?.intact,false);
  }finally{db.close()}
});

test('specialists earn five saved materials, gated routes and old receipts remain valid',()=>{
  const db=database(':memory:');
  try{
    db.prepare('INSERT INTO users(id,name,wallet,onboarded) VALUES (?,?,?,1)').run('specialist','Jo','0x0000000000000000000000000000000000000002');
    const t=Date.UTC(2026,9,29,11);
    assert.throws(()=>launchMission(db,'specialist','mine','careful',0,null,t,'engineer'));
    const legacy=launchMission(db,'specialist','forest','careful',0,null,t);
    advanceMissions(db,t+MISSION_STEP_MS*3+1);
    assert.equal(verifyMission(db,'specialist',legacy)?.intact,true);
    db.prepare('UPDATE outpost_stores SET wood=4,stone=4 WHERE user_id=?').run('specialist');
    buildBeacon(db,'specialist');
    const ore=launchMission(db,'specialist','mine','careful',0,null,t+MISSION_STEP_MS*4,'engineer');
    advanceMissions(db,t+MISSION_STEP_MS*7+1);
    let board=missionBoard(db,'specialist',t+MISSION_STEP_MS*7+1);
    assert.equal(board.store.ore,2);
    assert.equal(verifyMission(db,'specialist',ore)?.intact,true);
    const intel=launchMission(db,'specialist','relay','careful',0,null,t+MISSION_STEP_MS*8,'scout');
    advanceMissions(db,t+MISSION_STEP_MS*11+1);
    board=missionBoard(db,'specialist',t+MISSION_STEP_MS*11+1);
    assert.equal(board.store.intel,2);
    db.prepare('UPDATE outpost_stores SET wood=3,stone=3 WHERE user_id=?').run('specialist');
    buildBeacon(db,'specialist');
    board=missionBoard(db,'specialist',t+MISSION_STEP_MS*12);
    assert.equal(board.store.beacon_level,2);
    assert.equal(board.store.ore,1);
    assert.equal(board.store.intel,1);
    assert.throws(()=>launchMission(db,'specialist','mine','careful',0,null,t+MISSION_STEP_MS*13,'engineer'));
    db.prepare('UPDATE outpost_mission_events SET ore=99 WHERE mission_id=? AND seq=3').run(ore);
    assert.equal(verifyMission(db,'specialist',ore)?.intact,false);
    assert.equal(verifyMission(db,'specialist',legacy)?.intact,true);
  }finally{db.close()}
});

test('authenticated mission API separates guest, owner, daily cap and private proof',async()=>{
  const runtime=createApp({...config,db:':memory:',origin:'http://mission.test',production:false});
  const server=runtime.app.listen(0);
  await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  function client(){let cookie='',csrf='';return async(path:string,body?:unknown)=>{
    const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',origin:'http://mission.test',cookie,'x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});
    cookie=r.headers.get('set-cookie')?.split(';')[0]||cookie;
    const data=await r.json();if(data.csrf)csrf=data.csrf;
    return {status:r.status,data};
  }}
  try{
    const a=client(),b=client();
    assert.equal((await a('/missions')).status,401);
    await a('/session',{});await b('/session',{});
    assert.equal((await a('/missions')).data.available,false);
    assert.equal((await a('/missions',{objective:'forest',approach:'careful',maxFoodSpend:0})).status,403);
    const wallet=Wallet.createRandom();
    const challenge=await a('/wallet/challenge',{address:wallet.address});
    await a('/wallet/verify',{nonce:challenge.data.nonce,signature:await wallet.signMessage(challenge.data.message)});
    await a('/onboarding',{name:'Runner Mira',faction:0,stance:'balanced'});
    const first=await a('/missions',{objective:'forest',approach:'careful',maxFoodSpend:0});
    assert.equal(first.status,201);
    const id=first.data.id;
    assert.equal((await b(`/missions/${id}/proof`)).status,404);
    assert.equal((await a('/missions',{objective:'quarry',approach:'bold',maxFoodSpend:0})).status,400);
    runtime.db.prepare('UPDATE outpost_missions SET next_at=? WHERE id=?').run(Date.now()-60001,id);
    const report=await a('/missions');
    assert.equal(report.data.missions[0].status,'finished');
    assert.equal(report.data.store.wood,1);
    assert.equal((await a(`/missions/${id}/proof`)).data.intact,true);
    const second=await a('/missions',{objective:'quarry',approach:'careful',maxFoodSpend:0});
    assert.equal(second.status,201);
    runtime.db.prepare('UPDATE outpost_missions SET next_at=? WHERE id=?').run(Date.now()-60001,second.data.id);
    await a('/missions');
    const third=await a('/missions',{objective:'lookout',approach:'careful',maxFoodSpend:0});
    assert.equal(third.status,201);
    runtime.db.prepare('UPDATE outpost_missions SET next_at=? WHERE id=?').run(Date.now()-60001,third.data.id);
    assert.equal((await a('/missions')).data.remaining,0);
    assert.equal((await a('/missions',{objective:'forest',approach:'careful',maxFoodSpend:0})).status,400);
  }finally{await new Promise<void>(r=>server.close(()=>r()));runtime.close()}
});
