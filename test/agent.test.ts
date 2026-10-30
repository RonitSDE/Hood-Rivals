import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {ContractFactory,JsonRpcProvider,Wallet} from 'ethers';
import {createApp} from '../server/app';
import {config} from '../server/config';
import {compile} from '../scripts/compile';
import {agentOrder} from '../shared/agent';
import {createGame,resolveRound,validateOrder} from '../shared/game';

test('delegated agent styles choose legal orders and finish deterministic games',()=>{
  for(let i=0;i<90;i++)for(const style of ['balanced','explorer','fortifier','diplomat'] as const){
    let game=createGame('agent-policy-'+i);
    while(game.status==='active'){
      const order=agentOrder(game,0,style,i%5);
      assert.equal(validateOrder(game,0,order),null);
      game=resolveRound(game,[order,agentOrder(game,1,'balanced',0),agentOrder(game,2,'balanced',0)]);
    }
  }
});

test('3,333 capped Agent ID: onchain look, verified link, solo delegation, memory and transfer',async()=>{
  const node=ganache.server({logging:{quiet:true},chain:{chainId:46630,hardfork:'shanghai'},wallet:{totalAccounts:4}});
  await new Promise<void>(r=>node.listen(0,()=>r()));
  const port=(node.address() as any).port,rpc=`http://127.0.0.1:${port}`;
  const provider=new JsonRpcProvider(rpc);
  const accounts=Object.values(node.provider.getInitialAccounts()) as any[];
  const owner=new Wallet(accounts[0].secretKey,provider),buyer=new Wallet(accounts[1].secretKey,provider),next=new Wallet(accounts[2].secretKey,provider);
  const artifact=compile();
  let runtime:ReturnType<typeof createApp>|null=null,server:any;
  try{
    const nft:any=await new ContractFactory(artifact.RivalAgentID.abi,artifact.RivalAgentID.bytecode,owner).deploy(owner.address);
    await nft.waitForDeployment();
    assert.equal(await nft.MAX_SUPPLY(),3333n);
    await assert.rejects(()=>nft.connect(buyer).mint.staticCall(0,0,0));
    await (await nft.setMintOpen(true)).wait();
    await assert.rejects(()=>nft.connect(buyer).mint.staticCall(4,0,0));
    await (await nft.connect(buyer).mint(0,0,0)).wait();
    assert.equal(await nft.identityOf(buyer.address),1n);
    await assert.rejects(()=>nft.connect(buyer).mint.staticCall(1,1,1));
    await (await nft.connect(buyer).customize(1,2,3,1)).wait();
    assert.deepEqual(Array.from(await nft.lookOf(1)).map(Number),[2,3,1]);
    const metadata=JSON.parse(Buffer.from((await nft.tokenURI(1)).split(',')[1],'base64').toString());
    assert.match(metadata.name,/Agent #1/);assert.match(metadata.image,/data:image\/svg\+xml;base64/);
    runtime=createApp({...config,db:':memory:',origin:'http://test',production:false,rpc,chainId:46630,agentId:await nft.getAddress(),roundMs:60000});
    server=runtime.app.listen(0);await new Promise<void>(r=>server.once('listening',r));
    const base=`http://127.0.0.1:${server.address().port}/api`;
    function client(){let cookie='',csrf='';return async(path:string,body?:any)=>{
      const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{origin:'http://test','content-type':'application/json',cookie,'x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
      cookie=response.headers.get('set-cookie')?.split(';')[0]||cookie;
      const data=await response.json();csrf=data.csrf||csrf;return {status:response.status,data};
    }}
    async function link(call:ReturnType<typeof client>,wallet:Wallet,name:string){
      await call('/session',{});const challenge=await call('/wallet/challenge',{address:wallet.address});
      assert.equal((await call('/wallet/verify',{nonce:challenge.data.nonce,signature:await wallet.signMessage(challenge.data.message)})).status,200);
      assert.equal((await call('/onboarding',{name,faction:0,stance:'balanced'})).status,200);
    }
    const call=client();await link(call,buyer,'Pixel Agent');
    assert.equal((await call('/bootstrap')).data.profile.guideSeen,false);
    assert.equal((await call('/guide/complete',{})).status,200);
    assert.equal((await call('/bootstrap')).data.profile.guideSeen,true);
    const unlinked=await call('/agent');assert.equal(unlinked.data.tokenId,1);assert.equal(unlinked.data.linked,false);
    assert.deepEqual(unlinked.data.look,[2,3,1]);
    assert.equal((await call('/agent/bind',{tokenId:2})).status,403);
    assert.equal((await call('/matches',{mode:'solo',control:'agent'})).status,403);
    assert.equal((await call('/agent/bind',{tokenId:1})).status,200);
    assert.equal((await call('/agent/style',{style:'explorer'})).status,200);
    assert.equal((await call('/matches',{mode:'weekly',control:'agent'})).status,400);
    const started=await call('/matches',{mode:'solo',control:'agent'});assert.equal(started.status,200,JSON.stringify(started.data));
    const matchId=started.data.id;
    assert.equal((await call('/matches/'+matchId)).data.control,'agent');
    assert.equal((await call('/matches/'+matchId+'/control',{control:'human'})).status,200);
    assert.equal((await call('/matches/'+matchId)).data.control,'human');
    assert.equal((await call('/matches/'+matchId+'/orders',{round:1,order:{type:'hold'}})).status,200);
    assert.equal((await call('/matches/'+matchId+'/control',{control:'agent'})).status,200);
    assert.equal((await call('/matches/'+matchId+'/orders',{round:2,order:{type:'hold'}})).status,400);
    let game:any;
    for(let i=0;i<7;i++){
      runtime!.db.prepare('UPDATE matches SET deadline=0 WHERE id=?').run(matchId);
      game=(await call('/matches/'+matchId)).data;
      if(game.status==='finished')break;
    }
    assert.equal(game.status,'finished');assert.ok(game.lastAgentOrder);
    assert.equal((await call('/agent')).data.played,1);
    const transferred=await nft.connect(buyer).transferFrom(buyer.address,next.address,1);
    await transferred.wait();
    assert.equal(await nft.identityOf(buyer.address),0n);
    assert.equal(await nft.identityOf(next.address),1n);
    assert.equal((await call('/agent')).data.linked,false);
    assert.equal((await call('/matches',{mode:'solo',control:'agent'})).status,403);
    const receiving=client();await link(receiving,next,'Next Owner');
    assert.equal((await receiving('/agent/bind',{tokenId:1})).status,200);
    assert.equal((await receiving('/agent')).data.played,1);
    assert.equal((await receiving('/agent')).data.style,'explorer');
  }finally{
    if(server)await new Promise<void>(r=>server.close(()=>r()));
    runtime?.close();provider.destroy();await node.close();
  }
});
