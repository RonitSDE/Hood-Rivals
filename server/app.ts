import express from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { verifyMessage, getAddress, JsonRpcProvider, Contract, isAddress } from "ethers";
import { z } from "zod";
import { database, tx } from "./db";
import { config, type Config } from "./config";
import { market } from "./market";
import { shop } from "./shop";
import { ClientError } from "./errors";
import {
  createGame,
  resolveRound,
  validateOrder,
  viewGame,
  botOrder,
  FACTIONS,
  type GameState,
  type Order,
} from "../shared/game";
import { matchRecap } from "../shared/experience";
import { agentOrder, type AgentStyle } from "../shared/agent";
import { SHOP_ITEMS, ECONOMY } from "../shared/economy";
import { advanceMissions, buildBeacon, launchMission, missionBoard, verifyMission } from './missions';
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const uid = () => randomBytes(24).toString("hex");
const orderSchema = z
  .object({
    type: z.enum(["scout", "contest", "develop", "pact", "hold"]),
    target: z.string().max(20).optional(),
    upgrade: z.enum(["income", "fortify", "heal"]).optional(),
    partner: z.number().int().min(0).max(2).optional(),
  })
  .strict();
export function createApp(c: Config = config) {
  if(c.agentId && !isAddress(c.agentId)) throw Error('Invalid AGENT_ID_ADDRESS');
  const db = database(c.db),
    app = express(),
    store = shop(db, c);
  app.disable("x-powered-by");
  const proxyHops=Number(process.env.TRUST_PROXY_HOPS||0);
  if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>5) throw Error("Invalid TRUST_PROXY_HOPS");
  if(proxyHops)app.set('trust proxy',proxyHops);
  app.use(express.json({ limit: "32kb" }));
  const rate = new Map<string, { n: number; t: number }>();
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) res.set('Cache-Control','no-store');
    if (c.production) res.set('Strict-Transport-Security','max-age=31536000');
    res.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    const embeddedWorld = req.path === "/observatory.html";
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": embeddedWorld ? "SAMEORIGIN" : "DENY",
      "Content-Security-Policy":
        `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org; frame-ancestors ${embeddedWorld ? "'self'" : "'none'"}; object-src 'none'; base-uri 'self'`,
    });
    next();
  });
  function allowed(key:string,limit:number){
    const now=Date.now();let bucket=rate.get(key);
    if(!bucket||now-bucket.t>60000){bucket={n:0,t:now};rate.set(key,bucket)}
    if(rate.size>10000)for(const [k,v] of rate)if(now-v.t>60000)rate.delete(k);
    return ++bucket.n<=limit;
  }
  app.use('/api',(req,res,next)=>{
    // IP limiting is only for creating sessions. Gameplay is limited per account below.
    if(req.path==='/session'&&req.method==='POST'&&!allowed('session:'+req.ip,60))
      return res.status(429).set('Retry-After','60').json({error:'Too many new sessions. Please wait a minute.'});
    next();
  });
  const session = (req: any) => {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .find((s: string) => s.trim().startsWith("outpost="))
      ?.trim()
      .slice(8);
    if (!cookie) return null;
    return db
      .prepare(
        "SELECT s.*,u.name,u.faction,u.stance,u.wallet,u.xp,u.wins,u.played,u.skin,u.memory,u.rival_memory,u.onboarded,u.guide_seen FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?",
      )
      .get(digest(cookie), Date.now()) as any;
  };
  function issue(res: any, userId: string) {
    const secret = uid(),
      csrf = uid();
    db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
      digest(secret),
      userId,
      csrf,
      Date.now() + 30 * 86400000,
    );
    res.cookie("outpost", secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: c.production,
      maxAge: 30 * 86400000,
      path: "/",
    });
    return csrf;
  }
  app.get("/healthz", (_, res) => res.status(200).send("ok"));
  app.get("/readyz", (_, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ready: true });
  });
  app.use("/api", (req: any, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== c.origin)
        return res.status(403).json({ error: "Origin rejected" });
      if (c.production && !req.headers.origin)
        return res.status(403).json({ error: "Origin required" });
    }
    req.auth = session(req);
    if (req.path === "/session" && req.method === "POST") return next();
    if (!req.auth && req.method === "GET" && (req.path === "/leaderboard" || /^\/replays\/[0-9a-f-]{36}$/i.test(req.path))) {
      if(!allowed('public:'+req.ip,120)) return res.status(429).set('Retry-After','60').json({error:'Too many requests. Please try again.'});
      return next();
    }
    if (!req.auth)
      return res.status(401).json({ error: "Start a guest session" });
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== req.auth.csrf
    )
      return res.status(403).json({ error: "Session token required" });
    const read=['GET','HEAD'].includes(req.method);
    if(!allowed(`${read?'read':'write'}:${req.auth.user_id}`,read?300:100))
      return res.status(429).set('Retry-After','60').json({error:'Too many requests. Please wait a minute.'});
    next();
  });
  app.post("/api/session", (req: any, res) => {
    if (req.auth) return res.json({ csrf: req.auth.csrf });
    const id = randomUUID();
    db.prepare("INSERT INTO users(id,name) VALUES (?,?)").run(
      id,
      "Captain " + id.slice(0, 4),
    );
    res.json({ csrf: issue(res, id) });
  });
  app.post("/api/session/logout",(req:any,res)=>{
    db.prepare("DELETE FROM sessions WHERE id=?").run(req.auth.id);
    res.clearCookie("outpost",{path:"/"});
    res.json({ok:true});
  });
  const user = (req: any) => ({ ...req.auth, id: req.auth.user_id });
  app.get("/api/bootstrap", async (req: any, res) => {
    const u = user(req);
    res.json({
      profile: {
        id: u.id,
        name: u.name,
        faction: u.faction,
        stance: u.stance,
        wallet: u.wallet,
        onboarded: !!u.onboarded,
        guideSeen: !!u.guide_seen,
        xp: u.xp,
        wins: u.wins,
        played: u.played,
        skin: u.skin,
        memory: JSON.parse(u.memory),
        rivalMemory: JSON.parse(u.rival_memory || "{}"),
      },
      campaign: db.prepare("SELECT match_id,created,won,score,moment FROM campaign WHERE user_id=? ORDER BY created DESC LIMIT 8").all(u.id),
      inventory: db
        .prepare("SELECT sku FROM inventory WHERE user_id=?")
        .all(u.id)
        .map((x: any) => x.sku),
      history: db
        .prepare(
          "SELECT m.id,m.mode,m.status,m.created,r.score,r.won FROM matches m JOIN players p ON p.match_id=m.id LEFT JOIN results r ON r.match_id=m.id AND r.user_id=p.user_id WHERE p.user_id=? AND m.status!='cancelled' ORDER BY m.created DESC LIMIT 15",
        )
        .all(u.id),
      market: await market(db, c),
      shop: { ...store.status(), items: SHOP_ITEMS, rivalEnabled: !!c.tokenUnitsPerDollar },
      release: { version: "2.4.0", build: process.env.BUILD_SHA || "development" },
      economy: ECONOMY,
      chain: {
        id: c.chainId,
        store: c.store,
        token: c.token,
        stable: c.stable,
        agentId: c.agentId,
        explorer:
          c.chainId === 4663
            ? "https://robinhoodchain.blockscout.com"
            : "https://explorer.testnet.chain.robinhood.com",
        rpc:c.rpc,
      },
      payments: db
        .prepare(
          "SELECT payload,tx FROM orders WHERE user_id=? AND status='pending' ORDER BY rowid DESC LIMIT 5",
        )
        .all(u.id),
    });
  });
  app.post('/api/guide/complete',(req:any,res)=>{
    db.prepare('UPDATE users SET guide_seen=1 WHERE id=?').run(user(req).id);
    res.json({seen:true});
  });
  const agentAbi=['function identityOf(address) view returns (uint256)','function ownerOf(uint256) view returns (address)','function lookOf(uint256) view returns (uint8,uint8,uint8)','function minted() view returns (uint256)','function mintOpen() view returns (bool)'];
  async function ownedAgent(u:any){
    if(!c.agentId||!u.wallet||!u.onboarded)throw new ClientError('Link a wallet, create your captain and configure the Agent ID contract');
    const provider=new JsonRpcProvider(c.rpc);
    try{
      if(Number((await provider.getNetwork()).chainId)!==c.chainId||await provider.getCode(c.agentId)==='0x')throw new ClientError('Agent ID contract is unavailable on this chain');
      const nft=new Contract(c.agentId,agentAbi,provider);
      const tokenId=Number(await nft.identityOf(u.wallet));
      if(tokenId && getAddress(await nft.ownerOf(tokenId))!==getAddress(u.wallet))throw new ClientError('Agent ID ownership changed');
      const look=tokenId?Array.from(await nft.lookOf(tokenId)).map(Number):null;
      return {tokenId,look,minted:Number(await nft.minted()),mintOpen:!!(await nft.mintOpen())};
    } finally {provider.destroy()}
  }
  app.get('/api/agent',async(req:any,res)=>{
    if(!c.agentId||!user(req).wallet||!user(req).onboarded)return res.json({available:!!c.agentId,linked:false,tokenId:null});
    try{
      const owned=await ownedAgent(user(req));
      const link=owned.tokenId?db.prepare('SELECT token_id FROM agent_links WHERE user_id=?').get(user(req).id) as any:null;
      const memory=owned.tokenId?db.prepare('SELECT style,played,wins,memory FROM agent_memories WHERE token_id=?').get(owned.tokenId) as any:null;
      res.json({available:true,linked:link?.token_id===owned.tokenId,tokenId:owned.tokenId||null,look:owned.look,minted:owned.minted,mintOpen:owned.mintOpen,
        style:memory?.style||'balanced',played:memory?.played||0,wins:memory?.wins||0,memory:memory?JSON.parse(memory.memory):{}});
    }catch(e){res.status(503).json({error:e instanceof ClientError?e.message:'Agent ID RPC unavailable; try again later'})}
  });
  app.post('/api/agent/bind',async(req:any,res)=>{
    const tokenId=z.number().int().min(1).max(3333).parse(req.body.tokenId);
    const owned=await ownedAgent(user(req));
    if(owned.tokenId!==tokenId)return res.status(403).json({error:'This wallet does not own that Agent ID'});
    const otherActive=db.prepare("SELECT id FROM matches WHERE agent_token_id=? AND status='active' AND host<>? LIMIT 1").get(tokenId,user(req).id);
    if(otherActive)return res.status(409).json({error:'This Agent ID is still in an active match. Bind it after that match ends.'});
    tx(db,()=>{
      db.prepare('DELETE FROM agent_links WHERE user_id=? OR token_id=?').run(user(req).id,tokenId);
      db.prepare('INSERT INTO agent_links(user_id,token_id) VALUES (?,?)').run(user(req).id,tokenId);
      db.prepare('INSERT OR IGNORE INTO agent_memories(token_id) VALUES (?)').run(tokenId);
    });
    res.json({linked:true,tokenId});
  });
  app.post('/api/agent/style',async(req:any,res)=>{
    const style=z.enum(['balanced','explorer','fortifier','diplomat']).parse(req.body.style);
    const owned=await ownedAgent(user(req));
    const linked=db.prepare('SELECT token_id FROM agent_links WHERE user_id=?').get(user(req).id) as any;
    if(!owned.tokenId||linked?.token_id!==owned.tokenId)return res.status(403).json({error:'Bind your owned Agent ID first'});
    db.prepare('UPDATE agent_memories SET style=? WHERE token_id=?').run(style,owned.tokenId);
    res.json({style});
  });
  // The mission is server-owned and runs without browser or wallet access. A linked
  // NFT is an identity label only; missions never delegate transactions or ranked power.
  app.get('/api/missions',(req:any,res)=>{
    const u=user(req);
    if(!u.wallet||!u.onboarded)return res.json({available:false,reason:'Link a wallet and create your captain to save missions.'});
    res.json({available:true,...missionBoard(db,u.id)});
  });
  app.post('/api/missions',async(req:any,res)=>{
    const u=user(req);
    if(!u.wallet||!u.onboarded)return res.status(403).json({error:'Create a wallet-linked captain to assign missions.'});
    const b=z.object({objective:z.enum(['forest','quarry','lookout','mine','relay']),approach:z.enum(['careful','bold']),maxFoodSpend:z.number().int().min(0).max(1),role:z.enum(['quartermaster','engineer','scout','runner']).default('runner')}).strict().parse(req.body);
    let tokenId:null|number=null;
    if(c.agentId){
      const linked=db.prepare('SELECT token_id FROM agent_links WHERE user_id=?').get(u.id) as any;
      if(linked){
        const owned=await ownedAgent(u);
        if(owned.tokenId!==linked.token_id)return res.status(403).json({error:'Agent ID ownership changed. Rebind before assigning it.'});
        tokenId=owned.tokenId;
      }
    }
    const id=launchMission(db,u.id,b.objective,b.approach,b.maxFoodSpend,tokenId,Date.now(),b.role);
    res.status(201).json({id,board:missionBoard(db,u.id)});
  });
  app.post('/api/missions/beacon',(req:any,res)=>{
    const u=user(req);
    if(!u.wallet||!u.onboarded)return res.status(403).json({error:'Create a wallet-linked captain first.'});
    buildBeacon(db,u.id);
    res.json(missionBoard(db,u.id));
  });
  app.get('/api/missions/:id/proof',(req:any,res)=>{
    if(!/^[0-9a-f-]{36}$/i.test(req.params.id))return res.status(404).json({error:'Mission not found'});
    const result=verifyMission(db,user(req).id,req.params.id);
    if(!result)return res.status(404).json({error:'Mission not found'});
    res.json(result);
  });
  app.patch("/api/profile", (req: any, res) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(24).regex(/^[\w \-']+$/, "Use letters, numbers, spaces, hyphens or apostrophes"),
        faction: z.number().int().min(0).max(2),
        stance: z.enum(["balanced", "bold", "careful"]),
        skin: z.string().max(50).optional(),
      })
      .parse(req.body);
    if (
      p.skin &&
      !db
        .prepare("SELECT 1 FROM inventory WHERE user_id=? AND sku=?")
        .get(user(req).id, p.skin)
    )
      throw new ClientError("Cosmetic is not owned");
    db.prepare(
      "UPDATE users SET name=?,faction=?,stance=?,skin=? WHERE id=?",
    ).run(p.name, p.faction, p.stance, p.skin || "", user(req).id);
    res.json({ saved: true });
  });
  app.post("/api/onboarding", (req: any, res) => {
    const u = user(req);
    if (!u.wallet) return res.status(403).json({ error: "Connect a wallet to save your captain" });
    const p = z.object({
      name: z.string().trim().min(2).max(24).regex(/^[\w \-']+$/),
      faction: z.number().int().min(0).max(2),
      stance: z.enum(["balanced","bold","careful"]),
    }).strict().parse(req.body);
    const result = db.prepare(
      "UPDATE users SET name=?,faction=?,stance=?,onboarded=1 WHERE id=? AND onboarded=0"
    ).run(p.name,p.faction,p.stance,u.id);
    if (!result.changes) return res.status(409).json({error:"Captain already created"});
    res.json({created:true});
  });
  app.post("/api/wallet/challenge", (req: any, res) => {
    const address = getAddress(z.string().parse(req.body.address));
    const nonce = uid(),
      expires = Date.now() + 300000;
    const message = `${new URL(c.origin).host} requests a wallet link for Hood Rivals.\n\nAddress: ${address}\nChain ID: ${c.chainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}\nExpires: ${new Date(expires).toISOString()}\n\nThis signature only links your account. It authorizes no transfer.`;
    db.prepare("INSERT INTO nonces VALUES (?,?,?,?,?)").run(
      nonce,
      user(req).id,
      address.toLowerCase(),
      message,
      expires,
    );
    res.json({ nonce, message });
  });
  app.post("/api/wallet/verify", (req: any, res) => {
    const b = z
      .object({ nonce: z.string(), signature: z.string().max(200) })
      .parse(req.body);
    const row: any = db
      .prepare("SELECT * FROM nonces WHERE id=? AND user_id=? AND expires>?")
      .get(b.nonce, user(req).id, Date.now());
    if (
      !row ||
      verifyMessage(row.message, b.signature).toLowerCase() !== row.address
    )
      throw new ClientError("Invalid or expired wallet proof");
    let target = user(req).id;
    tx(db, () => {
      db.prepare("DELETE FROM nonces WHERE id=?").run(row.id);
      const existing: any = db
        .prepare("SELECT id FROM users WHERE wallet=?")
        .get(row.address);
      if (existing) target = existing.id;
      else {
        if(user(req).wallet && user(req).wallet!==row.address){
          target=randomUUID();
          db.prepare("INSERT INTO users(id,name) VALUES (?,?)").run(target,"Captain "+target.slice(0,4));
        }
        db.prepare("UPDATE users SET wallet=? WHERE id=?").run(
          row.address,
          target,
        );
      }
      db.prepare("DELETE FROM sessions WHERE id=?").run(req.auth.id);
    });
    res.json({ csrf: issue(res, target), restored: target !== user(req).id });
  });
  function finish(row: any, s: GameState) {
    if (row.mode === "training") return;
    const players = db
      .prepare("SELECT * FROM players WHERE match_id=?")
      .all(row.id) as any[];
    for (const p of players) {
      if (
        db
          .prepare("SELECT 1 FROM results WHERE match_id=? AND user_id=?")
          .get(row.id, p.user_id)
      )
        continue;
      const f = s.factions[p.slot],
        won = s.winner === p.slot ? 1 : 0;
      db.prepare("INSERT INTO results VALUES (?,?,?,?,?)").run(
        row.id,
        p.user_id,
        f.score,
        won,
        Date.now(),
      );
      db.prepare(
        "UPDATE users SET xp=xp+?,wins=wins+?,played=played+1,memory=? WHERE id=?",
      ).run(50 + f.score * 10, won, row.mode==='weekly'
        ? (db.prepare('SELECT memory FROM users WHERE id=?').get(p.user_id) as any).memory
        : JSON.stringify(f.memory), p.user_id);
      db.prepare("INSERT OR IGNORE INTO campaign(user_id,match_id,created,won,score,moment) VALUES (?,?,?,?,?,?)").run(p.user_id,row.id,Date.now(),won,f.score,matchRecap(s.events,p.slot).moment?.text || "A quiet expedition. Your result is recorded.");
      if(row.mode==='solo'){
        const remembered=JSON.parse((db.prepare('SELECT rival_memory FROM users WHERE id=?').get(p.user_id) as any).rival_memory || '{}');
        for(const rival of s.factions)if(rival.id!==p.slot)remembered[rival.id]=rival.memory[String(p.slot)]||0;
        db.prepare('UPDATE users SET rival_memory=? WHERE id=?').run(JSON.stringify(remembered),p.user_id);
      }
      if(row.mode==='solo'&&row.agent_token_id&&p.user_id===row.host){
        const link=db.prepare('SELECT token_id FROM agent_links WHERE user_id=?').get(p.user_id) as any;
        if(link?.token_id===row.agent_token_id)
          db.prepare('UPDATE agent_memories SET memory=?,played=played+1,wins=wins+? WHERE token_id=?')
            .run(JSON.stringify(f.memory),won,row.agent_token_id);
      }
    }
  }
  function advance(id: string) {
    return tx(db, () => {
      const row: any = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
      if (!row || row.status !== "active") return;
      const ps = db
        .prepare("SELECT * FROM players WHERE match_id=?")
        .all(id) as any[];
      if(row.control==='agent'&&Date.now()<row.deadline)return;
      if (ps.some((p) => !p.order_json && !(row.control==='agent'&&p.user_id===row.host)) && (row.mode === "training" || Date.now() < row.deadline)) return;
      const s: GameState = JSON.parse(row.state);
      const agent=row.agent_token_id?db.prepare('SELECT style,played FROM agent_memories WHERE token_id=?').get(row.agent_token_id) as any:null;
      const orders = s.factions.map((_, slot) => {
        const p = ps.find((p) => p.slot === slot);
        return p
          ? p.order_json
            ? JSON.parse(p.order_json)
            : row.control==='agent'&&p.user_id===row.host&&agent
              ? agentOrder(s,slot,agent.style as AgentStyle,agent.played)
              : { type: "hold" }
          : botOrder(s, slot);
      });
      const out = resolveRound(s, orders),
        previous = row.digest || "",
        serialized = JSON.stringify(out),
        proof = digest(previous + JSON.stringify(orders) + serialized);
      db.prepare("INSERT INTO snapshots VALUES (?,?,?,?,?,?)").run(
        id,
        s.round,
        serialized,
        JSON.stringify(orders),
        previous,
        proof,
      );
      db.prepare(
        "UPDATE matches SET state=?,status=?,deadline=?,digest=? WHERE id=?",
      ).run(serialized, out.status, Date.now() + (row.control==='agent'?1800:c.roundMs), proof, id);
      db.prepare("UPDATE players SET order_json=NULL WHERE match_id=?").run(id);
      if (out.status === "finished") finish(row, out);
    });
  }
  app.post("/api/matches", async (req: any, res) => {
    const b = z
      .object({ mode: z.enum(["solo", "weekly", "room", "training"]).default("solo"),control:z.enum(['human','agent']).default('human') })
      .parse(req.body);
    const u = user(req);
    if(b.control==='agent'&&b.mode!=='solo')return res.status(400).json({error:'Delegation is available only in solo play'});
    let agentTokenId:number|null=null;
    if(b.control==='agent'){
      const owned=await ownedAgent(u);
      const linked=db.prepare('SELECT token_id FROM agent_links WHERE user_id=?').get(u.id) as any;
      if(!owned.tokenId||linked?.token_id!==owned.tokenId)return res.status(403).json({error:'Mint and bind your owned Agent ID before delegating'});
      agentTokenId=owned.tokenId;
    }
    if (b.mode === "weekly" && (!u.wallet || !u.onboarded))
      return res.status(403).json({error:"Link a wallet and create your captain to enter ranked play"});
    if (u.wallet && !u.onboarded)
      return res.status(409).json({error:"Create your captain before entering a match"});
    const active: any = db
      .prepare(
        "SELECT m.id FROM matches m JOIN players p ON p.match_id=m.id WHERE p.user_id=? AND m.status IN ('active','lobby') ORDER BY m.created DESC LIMIT 1",
      )
      .get(u.id);
    if (active) return res.json({ id: active.id, resumed: true });
    const id = randomUUID(),
      day = new Date().toISOString().slice(0, 10);
    const snapshot = await market(db, c);
    const out = tx(db, () => {
      // Recheck after the asynchronous market lookup, inside the write transaction.
      const resumed = db.prepare("SELECT m.id FROM matches m JOIN players p ON p.match_id=m.id WHERE p.user_id=? AND m.status IN ('active','lobby') LIMIT 1").get(u.id) as any;
      if (resumed) return {id:resumed.id,resumed:true};
      if (
        b.mode === "weekly" &&
        db
          .prepare("SELECT 1 FROM attempts WHERE user_id=? AND day=?")
          .get(u.id, day)
      )
        throw new ClientError(
          "Ranked attempt already used today. Practice is unlimited.",
        );
      const s = createGame(
        b.mode === "weekly" ? "ranked:" + day : uid(),
        undefined,
        undefined,
        b.mode === "weekly"
          ? {
              ...snapshot,
              affected: "none",
              surcharge: 0,
              label: "Equal-start daily challenge",
              detail:
                "Identical daily seed and neutral costs for every ranked attempt.",
            }
          : snapshot,
      );
      const slot = b.mode === "weekly" ? 0 : u.faction;
      s.factions[slot].captain = u.name;
      if (b.mode !== "weekly") {
        s.factions[slot].stance = u.stance;
        const agentMemory=agentTokenId?db.prepare('SELECT memory FROM agent_memories WHERE token_id=?').get(agentTokenId) as any:null;
        s.factions[slot].memory = b.mode==='training'?{}:JSON.parse(agentMemory?.memory||u.memory);
        if(b.mode==='solo'){
          const remembered=JSON.parse(u.rival_memory||'{}');
          for(const rival of s.factions)if(rival.id!==slot)rival.memory[String(slot)]=remembered[String(rival.id)]||0;
        }
      }
      const code = randomBytes(4).toString("hex").toUpperCase();
      const status = b.mode === "room" ? "lobby" : "active";
      db.prepare(
        "INSERT INTO matches(id,code,host,mode,status,state,deadline,created,control,agent_token_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        code,
        u.id,
        b.mode,
        status,
        JSON.stringify(s),
        Date.now() + (b.control==='agent'?1800:c.roundMs),
        Date.now(),
        b.control,
        agentTokenId,
      );
      db.prepare(
        "INSERT INTO players(match_id,slot,user_id) VALUES (?,?,?)",
      ).run(id, slot, u.id);
      if (b.mode === "weekly")
        db.prepare("INSERT INTO attempts VALUES (?,?,?)").run(u.id, day, id);
      return { id, code };
    });
    res.json(out);
  });
  app.post("/api/rooms/join", (req: any, res) => {
    const code = z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-F0-9]{8}$/)
      .parse(req.body.code);
    const result = tx(db, () => {
      const row: any = db
        .prepare("SELECT * FROM matches WHERE code=? AND status='lobby'")
        .get(code);
      if (!row) throw new ClientError("Room is unavailable");
      const ps = db
        .prepare("SELECT * FROM players WHERE match_id=?")
        .all(row.id) as any[];
      if (ps.some((p) => p.user_id === user(req).id)) return { id: row.id };
      if (ps.length >= 3) throw new ClientError("Room is full");
      if (
        db
          .prepare(
            "SELECT 1 FROM matches m JOIN players p ON p.match_id=m.id WHERE p.user_id=? AND m.status IN ('active','lobby')",
          )
          .get(user(req).id)
      )
        throw new ClientError("Finish your current match before joining another room");
      const slot = [0, 1, 2].find((i) => !ps.some((p) => p.slot === i))!;
      const s: GameState = JSON.parse(row.state);
      s.factions[slot].captain = user(req).name;
      s.factions[slot].stance = user(req).stance;
      db.prepare(
        "INSERT INTO players(match_id,slot,user_id) VALUES (?,?,?)",
      ).run(row.id, slot, user(req).id);
      db.prepare("UPDATE matches SET state=? WHERE id=?").run(
        JSON.stringify(s),
        row.id,
      );
      return { id: row.id };
    });
    res.json(result);
  });
  app.post("/api/matches/:id/leave", (req: any, res) => {
    const result = db.prepare("UPDATE matches SET status='cancelled' WHERE id=? AND host=? AND (mode='training' OR status='lobby') AND status IN ('active','lobby')")
      .run(req.params.id,user(req).id);
    if (!result.changes) return res.status(403).json({error:"Only your practice or unstarted room can be closed"});
    res.json({closed:true});
  });
  app.post("/api/matches/:id/start", (req: any, res) => {
    const result = db
      .prepare(
        "UPDATE matches SET status='active',deadline=? WHERE id=? AND host=? AND status='lobby'",
      )
      .run(Date.now() + c.roundMs, req.params.id, user(req).id);
    if (!result.changes) throw new ClientError("Only the host can start a lobby");
    res.json({ started: true });
  });
  app.post('/api/matches/:id/control',async(req:any,res)=>{
    const control=z.enum(['human','agent']).parse(req.body.control);
    let tokenId:number|null=null;
    if(control==='agent'){
      const owned=await ownedAgent(user(req));
      const link=db.prepare('SELECT token_id FROM agent_links WHERE user_id=?').get(user(req).id) as any;
      if(!owned.tokenId||link?.token_id!==owned.tokenId)return res.status(403).json({error:'Mint and bind your owned Agent ID first'});
      tokenId=owned.tokenId;
    }
    const changed=tx(db,()=>{
      const row=db.prepare('SELECT * FROM matches WHERE id=? AND host=? AND mode=? AND status=?').get(req.params.id,user(req).id,'solo','active') as any;
      if(!row)return false;
      const p=db.prepare('SELECT * FROM players WHERE match_id=? AND user_id=?').get(row.id,user(req).id) as any;
      if(p?.order_json)throw new ClientError('Wait until the next round to change control');
      if(tokenId){
        const s:GameState=JSON.parse(row.state);
        const agent=db.prepare('SELECT memory FROM agent_memories WHERE token_id=?').get(tokenId) as any;
        s.factions[p.slot].memory=JSON.parse(agent?.memory||'{}');
        db.prepare('UPDATE matches SET state=? WHERE id=?').run(JSON.stringify(s),row.id);
      }
      db.prepare('UPDATE matches SET control=?,agent_token_id=?,deadline=? WHERE id=?')
        .run(control,tokenId||row.agent_token_id,Date.now()+(control==='agent'?1800:c.roundMs),row.id);
      return true;
    });
    if(!changed)return res.status(403).json({error:'Only the solo host can change control during an active round'});
    res.json({control});
  });
  app.get("/api/matches/:id", (req: any, res) => {
    advance(req.params.id);
    const row: any = db
      .prepare("SELECT * FROM matches WHERE id=?")
      .get(req.params.id);
    const p: any = db
      .prepare("SELECT * FROM players WHERE match_id=? AND user_id=?")
      .get(req.params.id, user(req).id);
    if (!row || !p) return res.status(404).json({ error: "Match not found" });
    const last=row.control==='agent'&&row.agent_token_id?db.prepare('SELECT orders,round FROM snapshots WHERE match_id=? ORDER BY round DESC LIMIT 1').get(row.id) as any:null;
    res.json({
      ...viewGame(JSON.parse(row.state), p.slot),
      id: row.id,
      code: row.code,
      status: row.status,
      mode: row.mode,
      control:row.control,
      agentTokenId:row.agent_token_id,
      lastAgentOrder:last?JSON.parse(last.orders)[p.slot]:null,
      host: row.host === user(req).id,
      deadline: row.deadline,
      submitted: !!p.order_json,
      players: db
        .prepare(
          "SELECT p.slot,u.name FROM players p JOIN users u ON u.id=p.user_id WHERE match_id=?",
        )
        .all(row.id),
      digest: row.status === "finished" ? row.digest : undefined,
    });
  });
  app.post("/api/matches/:id/orders", (req: any, res) => {
    const b = z
      .object({ round: z.number().int(), order: orderSchema })
      .parse(req.body);
    tx(db, () => {
      const row: any = db
          .prepare("SELECT * FROM matches WHERE id=?")
          .get(req.params.id),
        p: any = db
          .prepare("SELECT * FROM players WHERE match_id=? AND user_id=?")
          .get(req.params.id, user(req).id);
      if (!row || !p || row.status !== "active")
        throw new ClientError("Not an active participant");
      if(row.control==='agent'&&p.user_id===row.host)throw new ClientError('Agent controls this round. Switch to Human mode first.');
      const s: GameState = JSON.parse(row.state);
      if ((row.mode !== "training" && Date.now() >= row.deadline) || s.round !== b.round)
        throw new ClientError("Planning round has ended. Refresh the world.");
      if (p.order_json) throw new ClientError("Order already committed");
      const error = validateOrder(s, p.slot, b.order);
      if (error) throw new ClientError(error);
      db.prepare(
        "UPDATE players SET order_json=? WHERE match_id=? AND slot=?",
      ).run(JSON.stringify(b.order), row.id, p.slot);
    });
    advance(req.params.id);
    res.json({ committed: true });
  });
  app.get("/api/replays/:id", (req: any, res) => {
    const row: any = db
      .prepare("SELECT * FROM matches WHERE id=? AND status='finished'")
      .get(req.params.id);
    if (!row)
      return res
        .status(404)
        .json({ error: "Replay is available only after the match finishes" });
    const snapshots = db
      .prepare("SELECT * FROM snapshots WHERE match_id=? ORDER BY round")
      .all(row.id) as any[];
    let previous = "",
      valid = snapshots.length > 0;
    for (const p of snapshots) {
      valid &&=
        p.previous === previous &&
        digest(p.previous + p.orders + p.state) === p.digest;
      previous = p.digest;
    }
    res.json({
      id: row.id,
      verified: valid && previous === row.digest,
      verification:
        "Server hash-chain integrity only; not independent or onchain gameplay verification.",
      digest: row.digest,
      snapshots: snapshots.map((p) => ({
        round: p.round,
        state: JSON.parse(p.state),
        digest: p.digest,
      })),
    });
  });
  app.get("/api/leaderboard", (req: any, res) => {
    const since = Date.now() - 7 * 86400000;
    const source = `WITH eligible AS (
      SELECT r.user_id,r.match_id,r.score,r.won,r.created,
        ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.score DESC,r.won DESC,r.created ASC,r.match_id ASC) AS pick,
        COUNT(*) OVER (PARTITION BY r.user_id) AS attempts,
        SUM(r.won) OVER (PARTITION BY r.user_id) AS victories
      FROM results r JOIN matches m ON m.id=r.match_id JOIN users u ON u.id=r.user_id
      WHERE m.mode='weekly' AND m.status='finished' AND r.created>? AND u.wallet IS NOT NULL AND u.onboarded=1
    ), standings AS (
      SELECT u.id,u.name,e.match_id,e.created,e.score,e.attempts,e.victories,
        ROW_NUMBER() OVER (ORDER BY e.score DESC,e.won DESC,e.created ASC,u.id ASC) AS rank
      FROM eligible e JOIN users u ON u.id=e.user_id WHERE e.pick=1
    )`;
    const shown = db.prepare(`${source} SELECT rank,id,name,match_id AS matchId,created,score,attempts,victories FROM standings WHERE rank<=30 OR id=? ORDER BY rank`).all(since, req.auth?.user_id || '') as any[];
    const total = (db.prepare(`${source} SELECT COUNT(*) AS n FROM standings`).get(since) as any).n as number;
    res.json({entries:shown.filter(row=>row.rank<=30).map(({id,...rest})=>rest),
      me:shown.find(row=>row.id===req.auth?.user_id) || null,total,since,
      verification:'Rankings are computed from finished server-owned matches. Replays have a server hash chain; they are not independent or onchain proof.'});
  });
  app.post("/api/shop/orders", async (req: any, res) => {
    res.json(
      await store.quote(
        user(req),
        String(req.body.sku),
        String(req.body.asset),
      ),
    );
  });
  app.post("/api/shop/orders/:id/confirm", async (req: any, res) =>
    res.json(
      await store.confirm(user(req), req.params.id, String(req.body.hash)),
    ),
  );
  app.use(express.static(resolve("dist"), { index: false }));
  app.get('/rankings', (_req,res)=>{
    const html=readFileSync(resolve('dist/index.html'),'utf8')
      .replace('<title>Hood Rivals — A small world. A long memory.</title>','<title>Hood Rivals — Live Ranked Standings</title>')
      .replace('<meta property="og:title" content="Hood Rivals — A small world. A long memory." />','<meta property="og:title" content="Hood Rivals — Live Ranked Standings" />')
      .replace('<meta property="og:description" content="Lead your captain through a living pixel frontier. Free to play on Robinhood Chain testnet." />','<meta property="og:description" content="Seven-day rankings from completed matches. Explore the board and open each server replay." />')
      .replace('<meta property="og:image" content="/hood-rivals-logo.png" />',`<meta property="og:image" content="${c.origin}/hood-rivals-logo.png" /><meta property="og:url" content="${c.origin}/rankings" /><meta name="twitter:card" content="summary_large_image" />`);
    res.type('html').send(html);
  });
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({ error: "Unknown endpoint" });
    res.sendFile(resolve("dist/index.html"));
  });
  app.use((e: any, _req: any, res: any, _next: any) => {
    if (c.production && !(e instanceof ClientError) && !(e instanceof z.ZodError))
      console.error("Unexpected API error:", e?.name || "Error");
    res
      .status(e instanceof z.ZodError ? 422 : e instanceof ClientError ? 400 : 500)
      .json({
        error:
          e instanceof z.ZodError
            ? "Invalid request fields"
            : e instanceof ClientError ? e.message : "Request could not be completed. Try again.",
      });
  });
  const interval = setInterval(() => {
    try { advanceMissions(db); } catch(e) { console.error('Mission resolution failed',e); }
    for (const row of db
      .prepare("SELECT id FROM matches WHERE status='active' AND mode!='training' AND deadline<=?")
      .all(Date.now()) as any[]) {
      try {
        advance(row.id);
      } catch (e) {
        console.error("Round resolution failed", row.id, e);
      }
    }
  }, 1000);
  interval.unref();
  return {
    app,
    db,
    store,
    close() {
      clearInterval(interval);
      store.close();
      db.close();
    },
  };
}
