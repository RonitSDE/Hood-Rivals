import "../server/config";
import { JsonRpcProvider, Wallet, ContractFactory, getAddress } from "ethers";
import { mkdirSync, writeFileSync } from "node:fs";
import { compile } from "./compile";
const chain = Number(process.env.CHAIN_ID || 46630),
  rpc = process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com";
if (![4663, 46630].includes(chain)) throw Error("Unsupported chain");
const p = new JsonRpcProvider(rpc);
if (Number((await p.getNetwork()).chainId) !== chain)
  throw Error("RPC chain mismatch");
const compiled = compile(),
  mock = process.argv.includes("--testnet-mocks"),
  agentOnly = process.argv.includes("--agent-id-only");
if (mock && chain === 4663) throw Error("Mock assets are forbidden on mainnet");
const owner = getAddress(process.env.OWNER_ADDRESS || ""),
  treasury = agentOnly ? owner : getAddress(process.env.TREASURY_ADDRESS || ""),
  signer = agentOnly ? owner : getAddress(process.env.QUOTE_SIGNER_ADDRESS || "");
if (!process.argv.includes("--broadcast")) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        chain,
        owner,
        treasury,
        signer,
        mock,
        agentOnly,
        token: process.env.TOKEN_ADDRESS,
        stable: process.env.STABLE_ADDRESS,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY || "", p);
let token = process.env.TOKEN_ADDRESS || "",
  stable = process.env.STABLE_ADDRESS || "";
const explorer = chain === 46630
  ? "https://explorer.testnet.chain.robinhood.com"
  : "https://robinhoodchain.blockscout.com";
const confirmations = Number(process.env.CONFIRMATIONS || 3);
if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 100)
  throw Error("CONFIRMATIONS must be an integer from 1 to 100");
const transactions: Record<string, { hash: string; explorer: string }> = {};
async function deploy(name: string, args: any[], label = name) {
  const contract = await new ContractFactory(
    compiled[name].abi,
    compiled[name].bytecode,
    wallet,
  ).deploy(...args);
  const submitted = contract.deploymentTransaction();
  if (!submitted) throw Error("Deployment transaction was not created");
  console.log(`${label} submitted: ${explorer}/tx/${submitted.hash}`);
  await contract.waitForDeployment();
  const receipt = await submitted.wait(confirmations);
  if (!receipt || receipt.status !== 1) throw Error(`${label} deployment failed`);
  transactions[label] = { hash: submitted.hash, explorer: `${explorer}/tx/${submitted.hash}` };
  return await contract.getAddress();
}
if (agentOnly) {
  const agentId = await deploy("RivalAgentID", [owner], "RivalAgentID");
  mkdirSync("deployments", { recursive: true });
  const out = {chain,agentId,owner,transactions,created:new Date().toISOString(),mintOpen:false};
  writeFileSync(`deployments/${chain}-agent-id.json`,JSON.stringify(out,null,2));
  console.log(out);
  p.destroy();
  process.exit(0);
}
if (mock) {
  token = await deploy("MockToken", ["Test Hood Rivals", "tRIVAL", 18], "tRIVAL");
  stable = await deploy("MockToken", ["Test Dollar", "tUSDG", 6], "tUSDG");
}
const store = await deploy("OutpostStore", [
  getAddress(token),
  getAddress(stable),
  treasury,
  signer,
  owner,
]);
mkdirSync("deployments", { recursive: true });
const out = {
  chain,
  token,
  stable,
  store,
  owner,
  treasury,
  quoteSigner: signer,
  mock,
  transactions,
  created: new Date().toISOString(),
};
writeFileSync(`deployments/${chain}.json`, JSON.stringify(out, null, 2));
console.log(out);
p.destroy();
