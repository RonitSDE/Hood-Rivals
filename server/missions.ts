import { createHash, randomUUID } from 'node:crypto';
import type { DB } from './db';
import { tx } from './db';
import { ClientError } from './errors';

export const MISSION_STEP_MS = 20_000;
export const MISSION_DAILY_CAP = 3;
type Objective = 'forest' | 'quarry' | 'lookout';
type Approach = 'careful' | 'bold';
const sha = (value:string) => createHash('sha256').update(value).digest('hex');
const dayStart = (now:number) => Math.floor(now / 86_400_000) * 86_400_000;

function append(db:DB, mission:any, seq:number, at:number, kind:string, detail:string, gain={wood:0,stone:0,food:0}) {
  const previous = (db.prepare('SELECT digest FROM outpost_mission_events WHERE mission_id=? ORDER BY seq DESC LIMIT 1').get(mission.id) as any)?.digest || sha(`hood-rivals-mission-v1:${mission.id}`);
  const record = JSON.stringify([mission.id,seq,at,kind,detail,gain.wood,gain.stone,gain.food]);
  const digest = sha(previous + record);
  db.prepare('INSERT INTO outpost_mission_events(mission_id,seq,at,kind,detail,wood,stone,food,previous,digest) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(mission.id,seq,at,kind,detail,gain.wood,gain.stone,gain.food,previous,digest);
}

export function launchMission(db:DB,userId:string,objective:Objective,approach:Approach,maxFood:number,tokenId:number|null,now=Date.now()) {
  return tx(db,()=>{
    db.prepare('INSERT OR IGNORE INTO outpost_stores(user_id) VALUES (?)').run(userId);
    const store = db.prepare('SELECT * FROM outpost_stores WHERE user_id=?').get(userId) as any;
    if(store.food<maxFood)throw new ClientError('You cannot authorize more provisions than your outpost has.');
    if(db.prepare("SELECT 1 FROM outpost_missions WHERE user_id=? AND status='active'").get(userId))throw new ClientError('Your runner is already on a mission.');
    const used=(db.prepare('SELECT count(*) AS n FROM outpost_missions WHERE user_id=? AND created>=?').get(userId,dayStart(now)) as any).n;
    if(used>=MISSION_DAILY_CAP)throw new ClientError('Three missions per UTC day. Return tomorrow.');
    const last=db.prepare("SELECT detail FROM outpost_mission_events e JOIN outpost_missions m ON m.id=e.mission_id WHERE m.user_id=? AND e.kind='encounter' ORDER BY m.created DESC LIMIT 1").get(userId) as any;
    const id=randomUUID();
    db.prepare('INSERT INTO outpost_missions(id,user_id,token_id,objective,approach,max_food,status,step,next_at,created,previous_threat) VALUES (?,?,?,?,?,?,\'active\',0,?,?,?)')
      .run(id,userId,tokenId,objective,approach,maxFood,now+MISSION_STEP_MS,now,last?.detail||'');
    return id;
  });
}

function advanceOne(db:DB,id:string,now:number) {
  tx(db,()=>{
    const m=db.prepare("SELECT * FROM outpost_missions WHERE id=? AND status='active' AND next_at<=?").get(id,now) as any;
    if(!m)return;
    const at=m.next_at;
    if(m.step===0){
      const place={forest:'the greenwood',quarry:'the stone ridge',lookout:'the eastern lookout'}[m.objective as Objective];
      const memory=m.previous_threat.startsWith('A rival patrol')?' The runner remembers its last rival patrol and checks another route.':'';
      append(db,m,1,at,'route',`The runner set out for ${place}.${memory}`);
    } else if(m.step===1){
      const rival=Number.parseInt(sha(m.id+':patrol').slice(0,2),16)%2===0;
      if(!rival)append(db,m,2,at,'encounter','The route is clear. The runner continues without spending provisions.');
      else if(m.approach==='careful')append(db,m,2,at,'encounter','A rival patrol appears. Standing order: avoid contact. The runner takes a slower route.');
      else if(m.previous_threat.startsWith('A rival patrol'))append(db,m,2,at,'encounter','A rival patrol appears. The runner recognizes the previous route, changes course and avoids spending food.');
      else if(m.max_food>0){
        const spent=db.prepare('UPDATE outpost_stores SET food=food-1 WHERE user_id=? AND food>=1').run(m.user_id);
        if(spent.changes){
          db.prepare('UPDATE outpost_missions SET spent_food=spent_food+1,bonus=1 WHERE id=?').run(id);
          append(db,m,2,at,'encounter','A rival patrol appears. The runner spends one authorized provision, slips past and finds extra supplies.',{wood:0,stone:0,food:-1});
        }else append(db,m,2,at,'refused','Rival patrol ahead. Provision spend refused: the outpost lacks food. The runner withdraws.');
      }else append(db,m,2,at,'refused','Rival patrol ahead. Provision spend refused by your zero-spend limit. The runner withdraws.');
    } else {
      const refused=(db.prepare("SELECT kind FROM outpost_mission_events WHERE mission_id=? AND seq=2").get(id) as any)?.kind==='refused';
      const bonus=m.bonus===1?1:0;
      const gain=refused?{wood:0,stone:0,food:0}:m.objective==='forest'?{wood:1+bonus,stone:0,food:0}:m.objective==='quarry'?{wood:0,stone:1+bonus,food:0}:{wood:0,stone:0,food:1+bonus};
      db.prepare('UPDATE outpost_stores SET wood=wood+?,stone=stone+?,food=food+? WHERE user_id=?').run(gain.wood,gain.stone,gain.food,m.user_id);
      db.prepare("UPDATE outpost_missions SET status='finished',finished=?,gain_wood=?,gain_stone=?,gain_food=? WHERE id=?")
        .run(at,gain.wood,gain.stone,gain.food,id);
      append(db,m,3,at,'return',refused?'The runner returned safely with no materials. No unauthorized action occurred.':`The runner returned with ${gain.wood} wood, ${gain.stone} stone and ${gain.food} food.`,gain);
    }
    db.prepare('UPDATE outpost_missions SET step=step+1,next_at=? WHERE id=?').run(at+MISSION_STEP_MS,id);
  });
}

export function advanceMissions(db:DB,now=Date.now()) {
  // Complete a mission after a server restart without granting more than its three scheduled actions.
  for(let phase=0;phase<3;phase++){
    const due=db.prepare("SELECT id FROM outpost_missions WHERE status='active' AND next_at<=? ORDER BY next_at LIMIT 500").all(now) as any[];
    if(!due.length)break;
    for(const row of due)advanceOne(db,row.id,now);
  }
}

export function missionBoard(db:DB,userId:string,now=Date.now()) {
  advanceMissions(db,now);
  db.prepare('INSERT OR IGNORE INTO outpost_stores(user_id) VALUES (?)').run(userId);
  const store=db.prepare('SELECT wood,stone,food,beacon_level FROM outpost_stores WHERE user_id=?').get(userId) as any;
  const missions=db.prepare('SELECT id,token_id,objective,approach,max_food,spent_food,status,step,next_at,created,finished,gain_wood,gain_stone,gain_food FROM outpost_missions WHERE user_id=? ORDER BY created DESC LIMIT 6').all(userId) as any[];
  const active=missions.find(m=>m.status==='active');
  const latest=missions.slice(0,3).map(m=>({...m,events:db.prepare('SELECT seq,at,kind,detail,wood,stone,food,digest FROM outpost_mission_events WHERE mission_id=? ORDER BY seq').all(m.id)}));
  const used=(db.prepare('SELECT count(*) AS n FROM outpost_missions WHERE user_id=? AND created>=?').get(userId,dayStart(now)) as any).n;
  return {store,missions:latest,activeId:active?.id||null,remaining:Math.max(0,MISSION_DAILY_CAP-used),projectCost:{wood:2+store.beacon_level,stone:2+store.beacon_level},nextReset:dayStart(now)+86_400_000,stepMs:MISSION_STEP_MS};
}

export function buildBeacon(db:DB,userId:string) {
  return tx(db,()=>{
    db.prepare('INSERT OR IGNORE INTO outpost_stores(user_id) VALUES (?)').run(userId);
    const r=db.prepare('UPDATE outpost_stores SET wood=wood-(2+beacon_level),stone=stone-(2+beacon_level),beacon_level=beacon_level+1 WHERE user_id=? AND beacon_level<3 AND wood>=2+beacon_level AND stone>=2+beacon_level').run(userId);
    if(!r.changes)throw new ClientError('The beacon needs more wood and stone, or is already complete.');
  });
}

export function verifyMission(db:DB,userId:string,id:string) {
  const mission=db.prepare('SELECT status,step FROM outpost_missions WHERE id=? AND user_id=?').get(id,userId) as any;
  if(!mission)return null;
  const events=db.prepare('SELECT * FROM outpost_mission_events WHERE mission_id=? ORDER BY seq').all(id) as any[];
  let previous=sha(`hood-rivals-mission-v1:${id}`);
  const intact=events.length===mission.step&&events.every((e,i)=>{
    const record=JSON.stringify([id,e.seq,e.at,e.kind,e.detail,e.wood,e.stone,e.food]);
    const valid=e.seq===i+1&&e.previous===previous&&e.digest===sha(previous+record);
    previous=e.digest;
    return valid;
  });
  return {intact,complete:mission.status==='finished'&&events.length===3,eventCount:events.length,head:events.length?previous:null,scope:'Server record integrity only; the server controls its own history. No onchain commitment or independent fairness proof.'};
}
