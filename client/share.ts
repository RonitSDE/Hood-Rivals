export async function downloadBattleCard(game: any, moment: string) {
  const canvas = document.createElement('canvas'); canvas.width=1200;canvas.height=630;
  const ctx=canvas.getContext('2d'); if(!ctx) throw Error('Image export is unavailable in this browser. Copy the replay link instead.');
  const gradient=ctx.createLinearGradient(0,0,1200,630);gradient.addColorStop(0,'#142e29');gradient.addColorStop(1,'#080e14');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#365d4d';ctx.lineWidth=1;
  for(let x=620;x<1250;x+=100)for(let y=0;y<700;y+=90){ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i;const px=x+Math.cos(a)*52,py=y+Math.sin(a)*52;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.stroke()}
  // Use the same unaltered artwork as the navigation and shared page preview.
  const logo = new Image();logo.src='/hood-rivals-logo.png';
  try {await logo.decode();ctx.drawImage(logo,60,20,205,82)} catch {ctx.fillStyle='#c9ef91';ctx.font='bold 22px sans-serif';ctx.fillText('HOOD RIVALS',60,70)}
  ctx.fillStyle='#dfbd76';ctx.font='bold 22px sans-serif';ctx.fillText('THE FIRST FRONTIER',285,70);
  ctx.fillStyle='#f2efe6';ctx.font='bold 64px sans-serif';ctx.fillText(game.winner===game.you?'THE FRONTIER IS YOURS.':game.winner===-1?'A FRONTIER DIVIDED.':'THE RIVALRY CONTINUES.',60,165);
  ctx.font='26px sans-serif';ctx.fillStyle='#a8beb1';ctx.fillText(`${game.factions[game.you].captain} · ${game.factions[game.you].score} Renown · ${game.mode==='training'?'Practice':'Six-round strategy'}`,60,220);
  ctx.fillStyle='#f2efe6';ctx.font='28px sans-serif';let line='',y=315;
  for(const word of moment.split(' ')){if(ctx.measureText(line+word).width>1040){ctx.fillText(line,60,y);y+=40;line=''}line+=word+' '}
  ctx.fillText(line,60,y);
  ctx.fillStyle='#dfbd76';ctx.font='bold 26px sans-serif';ctx.fillText('SCOUT. MAKE A PACT. SETTLE THE SCORE.',60,520);
  ctx.font='20px sans-serif';ctx.fillStyle='#a8beb1';ctx.fillText(location.host+' · Free to play',60,565);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image export failed.')),'image/png'));
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hood-rivals-battle.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function shareBattle(game:any, moment:string) {
  const url=location.origin+'/?replay='+encodeURIComponent(game.id);
  const text=`${moment} My Hood Rivals match: ${game.factions[game.you].score} Renown. Your move.`;
  if(navigator.share){try{await navigator.share({title:'Hood Rivals',text,url});return 'Shared your battle.'}catch(e:any){if(e.name==='AbortError')return 'Share cancelled.'}}
  if(navigator.clipboard){await navigator.clipboard.writeText(text+'\n'+url);return 'Battle story and replay link copied.'}
  return url;
}

export async function shareRankings(board:any) {
  const url=location.origin+'/rankings';
  const leader=board.entries?.[0];
  const text=`Hood Rivals ranked frontier: ${leader ? `${leader.name} leads with ${leader.score} Renown.` : 'The first captain can claim the board.'} Every listed score links to a completed match replay. Server-recorded results, not onchain proof.`;
  if(navigator.share){try{await navigator.share({title:'Hood Rivals rankings',text,url});return 'Rankings shared.'}catch(e:any){if(e.name==='AbortError')return 'Share cancelled.'}}
  if(navigator.clipboard){await navigator.clipboard.writeText(text+'\n'+url);return 'Social caption and public rankings link copied.'}
  return url;
}

export async function downloadRankingsCard(board:any) {
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export is unavailable in this browser. Copy the rankings link instead.');
  const gradient=ctx.createLinearGradient(0,0,1200,630);gradient.addColorStop(0,'#19352c');gradient.addColorStop(1,'#08151b');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#355d48';ctx.lineWidth=2;
  for(let x=790;x<1320;x+=96)for(let y=-40;y<700;y+=72){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+48,y+24);ctx.lineTo(x,y+48);ctx.lineTo(x-48,y+24);ctx.closePath();ctx.stroke()}
  const logo=new Image();logo.src='/hood-rivals-logo.png';
  try{await logo.decode();ctx.drawImage(logo,42,24,206,82)}catch{ctx.fillStyle='#d9fa9b';ctx.font='bold 28px sans-serif';ctx.fillText('HOOD RIVALS',42,70)}
  ctx.fillStyle='#d5efad';ctx.font='bold 20px sans-serif';ctx.fillText('THE RANKED FRONTIER',275,73);
  ctx.fillStyle='#f3f4e7';ctx.font='bold 54px sans-serif';ctx.fillText('EVERY SCORE HAS A STORY.',44,170);
  ctx.fillStyle='#b0c6b5';ctx.font='22px sans-serif';ctx.fillText('Top captains · best completed score in the last 7 days',46,210);
  const palette=['#ddf990','#efd6a0','#aac5bd'];
  board.entries.slice(0,3).forEach((p:any,i:number)=>{
    const x=45+i*377,y=254;
    ctx.fillStyle='#132b28';ctx.fillRect(x,y,355,222);ctx.strokeStyle=palette[i];ctx.lineWidth=2;ctx.strokeRect(x,y,355,222);
    ctx.fillStyle=palette[i];ctx.font='bold 62px sans-serif';ctx.fillText('#'+p.rank,x+20,y+70);
    ctx.fillStyle='#f4f4e9';ctx.font='bold 27px sans-serif';ctx.fillText(String(p.name).slice(0,20),x+20,y+120);
    ctx.fillStyle=palette[i];ctx.font='bold 34px sans-serif';ctx.fillText(`${p.score} RENOWN`,x+20,y+177);
  });
  if(!board.entries.length){ctx.fillStyle='#d8e5ce';ctx.font='bold 38px sans-serif';ctx.fillText('THE FIRST CAPTAIN HAS YET TO RISE.',46,350)}
  ctx.fillStyle='#9fbcad';ctx.font='18px sans-serif';ctx.fillText(`${location.host}/rankings · Scores from server-owned matches`,45,545);
  ctx.fillText('Open the public page to inspect each replay and its server hash chain.',45,574);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image export failed.')),'image/png'));
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hood-rivals-rankings.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
