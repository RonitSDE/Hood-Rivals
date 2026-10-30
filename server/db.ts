import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function database(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL, faction INTEGER DEFAULT 0,stance TEXT DEFAULT 'balanced',wallet TEXT UNIQUE,xp INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,played INTEGER DEFAULT 0,skin TEXT DEFAULT '',memory TEXT DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT,expires INTEGER);
 CREATE TABLE IF NOT EXISTS nonces(id TEXT PRIMARY KEY,user_id TEXT,address TEXT,message TEXT,expires INTEGER);
 CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,code TEXT UNIQUE,host TEXT,mode TEXT,status TEXT,state TEXT,deadline INTEGER,created INTEGER,digest TEXT DEFAULT '');
 CREATE TABLE IF NOT EXISTS players(match_id TEXT REFERENCES matches(id),slot INTEGER,user_id TEXT REFERENCES users(id),order_json TEXT,PRIMARY KEY(match_id,slot),UNIQUE(match_id,user_id));
 CREATE TABLE IF NOT EXISTS snapshots(match_id TEXT,round INTEGER,state TEXT,orders TEXT,previous TEXT,digest TEXT,PRIMARY KEY(match_id,round));
 CREATE TABLE IF NOT EXISTS results(match_id TEXT,user_id TEXT,score INTEGER,won INTEGER,created INTEGER,PRIMARY KEY(match_id,user_id));
 CREATE INDEX IF NOT EXISTS results_ranked_time ON results(created DESC,match_id,user_id);
 CREATE INDEX IF NOT EXISTS matches_mode_status ON matches(mode,status);
 CREATE TABLE IF NOT EXISTS attempts(user_id TEXT,day TEXT,match_id TEXT,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS inventory(user_id TEXT,sku TEXT,order_id TEXT UNIQUE,PRIMARY KEY(user_id,sku));
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT,payload TEXT,signature TEXT,status TEXT DEFAULT 'pending',tx TEXT UNIQUE);
 CREATE TABLE IF NOT EXISTS campaign(user_id TEXT REFERENCES users(id),match_id TEXT REFERENCES matches(id),created INTEGER NOT NULL,won INTEGER NOT NULL,score INTEGER NOT NULL,moment TEXT NOT NULL,PRIMARY KEY(user_id,match_id));
 CREATE INDEX IF NOT EXISTS campaign_user_time ON campaign(user_id,created DESC);
 CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,value TEXT);
 CREATE TABLE IF NOT EXISTS agent_links(user_id TEXT PRIMARY KEY REFERENCES users(id),token_id INTEGER UNIQUE NOT NULL);
 CREATE TABLE IF NOT EXISTS agent_memories(token_id INTEGER PRIMARY KEY,memory TEXT NOT NULL DEFAULT '{}',style TEXT NOT NULL DEFAULT 'balanced',played INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS outpost_stores(user_id TEXT PRIMARY KEY REFERENCES users(id),wood INTEGER NOT NULL DEFAULT 0,stone INTEGER NOT NULL DEFAULT 0,food INTEGER NOT NULL DEFAULT 1,beacon_level INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS outpost_missions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),token_id INTEGER,objective TEXT NOT NULL,approach TEXT NOT NULL,max_food INTEGER NOT NULL,spent_food INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'active',step INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,created INTEGER NOT NULL,finished INTEGER,bonus INTEGER NOT NULL DEFAULT 0,previous_threat TEXT NOT NULL DEFAULT '',gain_wood INTEGER NOT NULL DEFAULT 0,gain_stone INTEGER NOT NULL DEFAULT 0,gain_food INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS outpost_missions_user_time ON outpost_missions(user_id,created DESC);
 CREATE INDEX IF NOT EXISTS outpost_missions_due ON outpost_missions(status,next_at);
 CREATE TABLE IF NOT EXISTS outpost_mission_events(mission_id TEXT NOT NULL REFERENCES outpost_missions(id),seq INTEGER NOT NULL,at INTEGER NOT NULL,kind TEXT NOT NULL,detail TEXT NOT NULL,wood INTEGER NOT NULL DEFAULT 0,stone INTEGER NOT NULL DEFAULT 0,food INTEGER NOT NULL DEFAULT 0,previous TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(mission_id,seq));
 `);
  const columns = db.prepare("PRAGMA table_info(users)").all() as {name:string}[];
  if(!columns.some(c=>c.name==="onboarded")){
    db.exec("ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0");
    // Legacy faction IDs had different names. Keep history and inventory, but
    // ask linked accounts to choose an identity in the new three-outpost world.
  }
  if(!columns.some(c=>c.name==="rival_memory")) db.exec("ALTER TABLE users ADD COLUMN rival_memory TEXT NOT NULL DEFAULT '{}'");
  if(!columns.some(c=>c.name==="guide_seen")) db.exec("ALTER TABLE users ADD COLUMN guide_seen INTEGER NOT NULL DEFAULT 0");
  const storeColumns=db.prepare('PRAGMA table_info(outpost_stores)').all() as {name:string}[];
  for(const name of ['ore','intel']) if(!storeColumns.some(c=>c.name===name))
    db.exec(`ALTER TABLE outpost_stores ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`);
  const missionColumns=db.prepare('PRAGMA table_info(outpost_missions)').all() as {name:string}[];
  for(const name of ['gain_ore','gain_intel']) if(!missionColumns.some(c=>c.name===name))
    db.exec(`ALTER TABLE outpost_missions ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`);
  if(!missionColumns.some(c=>c.name==='role')) db.exec("ALTER TABLE outpost_missions ADD COLUMN role TEXT NOT NULL DEFAULT 'runner'");
  const eventColumns=db.prepare('PRAGMA table_info(outpost_mission_events)').all() as {name:string}[];
  for(const name of ['ore','intel']) if(!eventColumns.some(c=>c.name===name))
    db.exec(`ALTER TABLE outpost_mission_events ADD COLUMN ${name} INTEGER NOT NULL DEFAULT 0`);
  const matchColumns=db.prepare('PRAGMA table_info(matches)').all() as {name:string}[];
  if(!matchColumns.some(c=>c.name==='control')) db.exec("ALTER TABLE matches ADD COLUMN control TEXT NOT NULL DEFAULT 'human'");
  if(!matchColumns.some(c=>c.name==='agent_token_id')) db.exec('ALTER TABLE matches ADD COLUMN agent_token_id INTEGER');
  return db;
}
export type DB = ReturnType<typeof database>;
export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
