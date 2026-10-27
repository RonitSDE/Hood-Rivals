import {
  Contract,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  id,
  randomBytes,
  hexlify,
  parseUnits,
  Interface,
  getAddress,
} from "ethers";
import { SHOP_ITEMS } from "../shared/economy";
import { ORDER_TYPES, STORE_ABI, ERC20_ABI } from "../shared/checkout";
import type { Config } from "./config";
import type { DB } from "./db";
import { tx } from "./db";
import { ClientError } from "./errors";
export function shop(db: DB, c: Config, injectedProvider?: JsonRpcProvider) {
  const provider =
    injectedProvider ||
    new JsonRpcProvider(c.rpc, c.chainId, { staticNetwork: true });
  let enabled = false,
    reason = "Shop is not configured. No payment is possible.";
  async function check() {
    enabled = false;
    try {
      if (!c.signer || !c.store || !c.token || !c.stable || !c.treasury)
        throw new ClientError("Shop deployment and quote signer are not configured");
      const network = Number(BigInt(await provider.send("eth_chainId", [])));
      if (network !== c.chainId) throw new ClientError("Wrong RPC chain");
      const s = new Contract(c.store, STORE_ABI, provider);
      if (
        (await s.token()).toLowerCase() !== c.token.toLowerCase() ||
        (await s.stable()).toLowerCase() !== c.stable.toLowerCase()
      )
        throw new ClientError("Asset mismatch");
      if (
        (await s.quoteSigner()).toLowerCase() !==
        new Wallet(c.signer).address.toLowerCase()
      )
        throw new ClientError("Quote signer mismatch");
      if ((await s.treasury()).toLowerCase() !== getAddress(c.treasury).toLowerCase())
        throw new ClientError("Treasury address mismatch");
      if (await s.paused()) throw new ClientError("Shop paused");
      // Older stores cannot prevent payment twice for the same cosmetic.
      if (typeof (await s.purchasedSku(ZeroAddress, id("outpost-store-preflight"))) !== "boolean")
        throw new ClientError("Store purchase guard unavailable");
      for (const [a, d] of [
        [c.token, c.tokenDecimals],
        [c.stable, c.stableDecimals],
      ] as const) {
        if (Number(await new Contract(a, ERC20_ABI, provider).decimals()) !== d)
          throw new ClientError("Asset decimals mismatch");
      }
      enabled = true;
      reason = "Deployment checked against RPC";
    } catch (e: any) {
      reason = e instanceof ClientError ? e.message : "Checkout deployment check failed";
    }
    return { enabled, reason };
  }
  async function quote(user: any, sku: string, asset: string) {
    const account = db.prepare("SELECT wallet,onboarded FROM users WHERE id=?").get(user.id) as any;
    if (!account?.wallet) throw new ClientError("Connect and verify your wallet first");
    if (!account.onboarded) throw new ClientError("Create your captain before checkout");
    await check();
    if (!enabled) throw new ClientError(reason);
    const item = SHOP_ITEMS.find((i) => i.id === sku);
    if (!item) throw new ClientError("Unknown cosmetic");
    if (
      db
        .prepare("SELECT 1 FROM inventory WHERE user_id=? AND sku=?")
        .get(user.id, sku)
    )
      throw new ClientError("Already owned");
    if (await new Contract(c.store, STORE_ABI, provider).purchasedSku(account.wallet, id(sku)))
      throw new ClientError("Already purchased onchain. Confirm the original receipt to restore your cosmetic.");
    if (!["stable", "rival"].includes(asset))
      throw new ClientError("Unsupported payment asset");
    if (asset === "rival" && !c.tokenUnitsPerDollar)
      throw new ClientError("Token pricing has not been configured");
    const amount =
      asset === "stable"
        ? (BigInt(item.priceCents) * 10n ** BigInt(c.stableDecimals)) / 100n
        : (parseUnits(c.tokenUnitsPerDollar, c.tokenDecimals) *
            BigInt(item.priceCents)) /
          100n;
    if (amount <= 0n) throw new ClientError("Invalid configured price");
    const order = {
      orderId: hexlify(randomBytes(32)),
      payer: getAddress(account.wallet),
      asset: asset === "stable" ? c.stable : c.token,
      amount: amount.toString(),
      sku: id(sku),
      creator: ZeroAddress,
      expires: Math.floor(Date.now() / 1000) + 300,
    };
    const domain = {
      name: "OutpostStore",
      version: "1",
      chainId: c.chainId,
      verifyingContract: c.store,
    };
    const signature = await new Wallet(c.signer).signTypedData(
      domain,
      ORDER_TYPES,
      order,
    );
    const payload = {
      order,
      sku,
      asset,
      domain,
      store: c.store,
      displayAmount:
        asset === "stable"
          ? `${item.priceCents / 100} USDG`
          : `${(Number(c.tokenUnitsPerDollar) * item.priceCents) / 100} RIVAL`,
    };
    db.prepare(
      "INSERT INTO orders(id,user_id,payload,signature) VALUES (?,?,?,?)",
    ).run(order.orderId, user.id, JSON.stringify(payload), signature);
    return { ...payload, signature };
  }
  async function confirm(user: any, orderId: string, hash: string) {
    const row: any = db
      .prepare("SELECT * FROM orders WHERE id=? AND user_id=?")
      .get(orderId, user.id);
    if (!row) throw new ClientError("Order not found");
    if (row.status === "confirmed") return { confirmed: true };
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
      throw new ClientError("Invalid transaction hash");
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt || receipt.status !== 1)
      throw new ClientError("Successful transaction not found");
    if ((await receipt.confirmations()) < c.confirmations)
      throw new ClientError(
        "Waiting for chain confirmations. Retry confirmation shortly.",
      );
    const block = await provider.getBlock(receipt.blockNumber);
    if (block?.hash !== receipt.blockHash)
      throw new ClientError("Receipt is not canonical");
    const p = JSON.parse(row.payload),
      iface = new Interface(STORE_ABI);
    const event = receipt.logs
      .filter((l) => l.address.toLowerCase() === c.store.toLowerCase())
      .map((l) => {
        try {
          return iface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((l) => l?.name === "Purchased" && l.args.orderId === orderId);
    if (
      !event ||
      event.args.payer.toLowerCase() !== p.order.payer.toLowerCase() ||
      event.args.asset.toLowerCase() !== p.order.asset.toLowerCase() ||
      event.args.amount.toString() !== p.order.amount ||
      event.args.sku !== p.order.sku
    )
      throw new ClientError("Receipt does not match the signed order");
    tx(db, () => {
      db.prepare("UPDATE orders SET status=?,tx=? WHERE id=?").run(
        "confirmed",
        hash,
        orderId,
      );
      db.prepare("INSERT OR IGNORE INTO inventory VALUES (?,?,?)").run(
        user.id,
        p.sku,
        orderId,
      );
    });
    return { confirmed: true };
  }
  return {
    check,
    quote,
    confirm,
    status: () => ({ enabled, reason }),
    close: () => provider.destroy(),
  };
}
