/** Real Robinhood testnet checkout via the public API. This spends test assets. */
import { JsonRpcProvider, Wallet, Contract, getAddress } from "ethers";
import { config } from "../server/config";
import { ERC20_ABI, STORE_ABI } from "../shared/checkout";

if (!process.argv.includes("--broadcast"))
  throw Error("Explicit --broadcast required: this sends a real testnet purchase");
if (config.chainId !== 46630 || !config.origin.startsWith("https://"))
  throw Error("Smoke run is restricted to Robinhood testnet and an HTTPS app URL");
if (!config.store || !config.stable || !config.signer)
  throw Error("Configure a deployed store, test stable asset and quote signer first");
const key = process.env.TEST_BUYER_PRIVATE_KEY;
if (!key) throw Error("TEST_BUYER_PRIVATE_KEY is required in the operator shell");
const provider = new JsonRpcProvider(config.rpc);
const buyer = new Wallet(key, provider);
const sku = process.env.TESTNET_SMOKE_SKU || "moss-crown";
let cookie = "", csrf = "";

async function request(path: string, body?: unknown) {
  const response = await fetch(config.origin + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { Origin: config.origin, "Content-Type": "application/json" }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const result = await response.json();
  if (!response.ok) throw Error(`${path}: ${result.error || response.status}`);
  return result;
}

try {
  if (Number((await provider.getNetwork()).chainId) !== 46630)
    throw Error("RPC is not Robinhood testnet");
  if ((await provider.getCode(config.store)) === "0x") throw Error("Store is not deployed");
  const store = new Contract(config.store, STORE_ABI, buyer);
  if (getAddress(await store.stable()) !== getAddress(config.stable))
    throw Error("The store stable asset does not match app config");
  if (getAddress(await store.quoteSigner()) !== new Wallet(config.signer).address)
    throw Error("The deployed quote signer does not match the app");
  if (await store.paused()) throw Error("Store is paused");
  if ((await provider.getBalance(buyer.address)) === 0n)
    throw Error("Fund this test buyer with testnet ETH for gas");

  const session = await request("/session", {}); csrf = session.csrf;
  const challenge = await request("/wallet/challenge", { address: buyer.address });
  const verified = await request("/wallet/verify", {
    nonce: challenge.nonce,
    signature: await buyer.signMessage(challenge.message),
  });
  csrf = verified.csrf;
  let boot = await request("/bootstrap");
  if (boot.chain.id !== 46630 || getAddress(boot.chain.store) !== getAddress(config.store))
    throw Error("The public app is configured for a different chain or store");
  if (!boot.profile.onboarded) {
    await request("/onboarding", { name: "Test Captain", faction: 0, stance: "balanced" });
    boot = await request("/bootstrap");
  }
  if (!boot.shop.enabled) throw Error("Public app checkout is disabled: " + boot.shop.reason);
  if (boot.inventory.includes(sku)) throw Error("Test wallet already owns this SKU; use a fresh wallet or TESTNET_SMOKE_SKU");

  const quote = await request("/shop/orders", { sku, asset: "stable" });
  if (getAddress(quote.order.payer) !== buyer.address ||
      getAddress(quote.order.asset) !== getAddress(config.stable) ||
      getAddress(quote.store) !== getAddress(config.store) ||
      quote.order.expires <= Math.floor(Date.now() / 1000))
    throw Error("API quote mismatches buyer, asset, store or expiry");
  const amount = BigInt(quote.order.amount);
  const token = new Contract(config.stable, ERC20_ABI, buyer);
  if ((await token.balanceOf(buyer.address)) < amount)
    throw Error(`Fund buyer with at least ${amount} smallest units of the configured test stable asset`);
  if ((await token.allowance(buyer.address, config.store)) < amount) {
    const approval = await token.approve(config.store, amount);
    if ((await approval.wait(config.confirmations))?.status !== 1)
      throw Error("Stable asset approval failed");
  }
  const purchase = await store.purchase(quote.order, quote.signature);
  const receipt = await purchase.wait(config.confirmations);
  if (!receipt || receipt.status !== 1) throw Error("Store purchase failed");
  await request(`/shop/orders/${quote.order.orderId}/confirm`, { hash: purchase.hash });
  boot = await request("/bootstrap");
  if (!boot.inventory.includes(sku)) throw Error("Receipt was not fulfilled in player inventory");
  let duplicateRejected = false;
  try { await request("/shop/orders", { sku, asset: "stable" }); }
  catch (error: any) { duplicateRejected = /Already owned|Already purchased/.test(error.message); }
  if (!duplicateRejected) throw Error("Duplicate purchase was not rejected");
  console.log(JSON.stringify({
    result: "testnet checkout and inventory verified",
    chainId: 46630, buyer: buyer.address, sku,
    store: config.store, orderId: quote.order.orderId,
    explorer: `https://explorer.testnet.chain.robinhood.com/tx/${purchase.hash}`,
    confirmations: config.confirmations,
    duplicateRejected,
  }, null, 2));
} finally {
  provider.destroy();
}
