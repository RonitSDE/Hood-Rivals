type Provider = { request: (args:any)=>Promise<any>; on?: (event:string,fn:(...args:any[])=>void)=>void };
const detected = new Map<string,{name:string;provider:Provider}>();
const wired = new WeakSet<object>();
window.addEventListener('eip6963:announceProvider',((event:CustomEvent)=>{
  const {info,provider}=event.detail||{};
  if(typeof info?.uuid==='string'&&typeof info?.name==='string'&&typeof provider?.request==='function')
    detected.set(info.uuid,{name:info.name.slice(0,60),provider});
}) as EventListener);
window.dispatchEvent(new Event('eip6963:requestProvider'));

function track(provider:Provider){
  if(!wired.has(provider)){
    wired.add(provider);
    for(const event of ['accountsChanged','chainChanged','disconnect']) provider.on?.(event,()=>window.dispatchEvent(new Event('outpost:wallet-change')));
  }
  return provider;
}

export async function chooseWallet(current?:Provider):Promise<Provider>{
  if(current) return current;
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  return new Promise((resolve,reject)=>{
    const dialog=document.createElement('dialog');dialog.className='experience-dialog wallet-picker';dialog.setAttribute('aria-label','Connect your wallet');
    const heading=document.createElement('h2');heading.textContent='Keep your captain.';
    const detail=document.createElement('p');detail.textContent='Choose a wallet to save your identity. Linking signs a message; it does not approve a payment.';
    const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');
    const list=document.createElement('div');list.className='wallet-options';
    const close=document.createElement('button');close.textContent='Continue without connecting';
    dialog.append(heading,detail,list,status,close);document.body.append(dialog);dialog.showModal();
    let done=false;
    function end(provider?:Provider){if(done)return;done=true;dialog.close();dialog.remove();if(provider)resolve(track(provider));else reject(Error('Wallet connection cancelled. Your game is still available.'));}
    close.onclick=()=>end();dialog.addEventListener('cancel',e=>{e.preventDefault();end()});
    const providers=[...detected.values()];
    if(window.ethereum&&!providers.some(x=>x.provider===window.ethereum))providers.push({name:'Browser wallet',provider:window.ethereum});
    for(const entry of providers){const b=document.createElement('button');b.textContent=entry.name+' →';b.onclick=()=>end(entry.provider);list.append(b)}
    if(!providers.length){const text=document.createElement('p');text.textContent='No browser wallet detected. Open this site inside your wallet’s mobile browser to connect.';list.append(text)}
    status.textContent='Use a browser extension or open this site inside your mobile wallet browser. QR connection is temporarily unavailable in this security release.';
  });
}
