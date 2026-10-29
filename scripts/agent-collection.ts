import '../server/config';
import {JsonRpcProvider,Contract,Wallet,getAddress} from 'ethers';
const chain=Number(process.env.CHAIN_ID||46630);
const rpc=process.env.RPC_URL||'https://rpc.testnet.chain.robinhood.com';
const address=getAddress(process.env.AGENT_ID_ADDRESS||'');
const p=new JsonRpcProvider(rpc);
try{
  if(Number((await p.getNetwork()).chainId)!==chain)throw Error('Agent collection RPC chain mismatch');
  if(await p.getCode(address)==='0x')throw Error('Agent ID contract missing');
  const abi=['function owner() view returns(address)','function MAX_SUPPLY() view returns(uint256)','function minted() view returns(uint256)','function mintOpen() view returns(bool)','function setMintOpen(bool)'];
  const nft=new Contract(address,abi,p);
  if(await nft.MAX_SUPPLY()!==3333n)throw Error('Wrong Agent ID collection');
  const status={chain,address,owner:await nft.owner(),minted:Number(await nft.minted()),maxSupply:3333,mintOpen:await nft.mintOpen()};
  if(process.argv.includes('--open')){
    if(chain!==46630)throw Error('This helper opens mint only on testnet; use multisig governance for mainnet');
    if(!process.argv.includes('--broadcast'))throw Error('Explicit --broadcast required to open testnet mint');
    const key=process.env.OWNER_PRIVATE_KEY;
    if(!key)throw Error('Set OWNER_PRIVATE_KEY in an isolated operator shell');
    const owner=new Wallet(key,p);
    if(owner.address.toLowerCase()!==status.owner.toLowerCase())throw Error('Signer does not own collection');
    const tx=await (nft.connect(owner) as Contract).setMintOpen(true);
    const receipt=await tx.wait(Number(process.env.CONFIRMATIONS||3));
    if(!receipt||receipt.status!==1)throw Error('Mint open transaction failed');
    console.log({status:'testnet mint opened',transaction:`https://explorer.testnet.chain.robinhood.com/tx/${tx.hash}`});
  }else console.log(status);
}finally{p.destroy()}
