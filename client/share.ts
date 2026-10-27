export async function downloadBattleCard(game: any, moment: string) {
  const canvas = document.createElement('canvas'); canvas.width=1200;canvas.height=630;
  const ctx=canvas.getContext('2d'); if(!ctx) throw Error('Image export is unavailable in this browser. Copy the replay link instead.');
  const gradient=ctx.createLinearGradient(0,0,1200,630);gradient.addColorStop(0,'#142e29');gradient.addColorStop(1,'#080e14');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#365d4d';ctx.lineWidth=1;
  for(let x=620;x<1250;x+=100)for(let y=0;y<700;y+=90){ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i;const px=x+Math.cos(a)*52,py=y+Math.sin(a)*52;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.stroke()}
  ctx.fillStyle='#dfbd76';ctx.font='bold 22px sans-serif';ctx.fillText('HOOD RIVALS  /  THE FIRST FRONTIER',60,70);
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
