import { useEffect } from "react";
import { usePageTitle } from "../router";
import { api } from "../lib/api";
import { useApp } from "../app/AppState";

export default function ArmoryPage() {
  const { boot, busy, connect, pending, refresh, run, setNotice, setPending, setPreviewSkin, setQuote } =
    useApp();
  usePageTitle("Armory");
  useEffect(() => {
    run(refresh);
  }, []);
  return (
    <main id="main-content" className="content">
      <div className="eyebrow">Armory</div>
      <h1>Make your mark.</h1>
      <p className="intro">
        Distinctive looks. Equal strength. Every item is cosmetic, with no effect on combat, supply or ranked
        scoring.
      </p>
      <div className="status-panel">
        {boot.shop.enabled ? "Onchain checkout configured" : boot.shop.reason} ·{" "}
        {boot.chain.id === 46630
          ? "Testnet assets have no intended monetary value."
          : "Prices are merchant-set, not an exchange quote."}
      </div>
      <div className="shop-grid">
        {boot.shop.items.map((item: any) => (
          <section className="shop-card" key={item.id}>
            <div className={"item-art " + item.kind} style={{ color: item.color }}>
              <span>
                {item.kind === "banner"
                  ? "⚑"
                  : item.kind === "theme"
                    ? "☾"
                    : item.kind === "badge"
                      ? "✧"
                      : "♜"}
              </span>
            </div>
            <small>{item.category}</small>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <button className="preview-button" onClick={() => setPreviewSkin(item.id)}>
              Preview in the world
            </button>
            <div className="row shop-price">
              <b>{(item.priceCents / 100).toFixed(2)} USDG</b>
              <span>Cosmetic</span>
            </div>
            {boot.inventory.includes(item.id) ? (
              <button disabled>Owned · equip in Captain</button>
            ) : (
              <div className="row shop-buy">
                <button
                  disabled={busy || !boot.shop.enabled}
                  onClick={() =>
                    run(async () => {
                      if (!boot.profile.wallet) {
                        const linked = await connect();
                        if (!linked.profile.onboarded) return;
                      }
                      if (!boot.profile.onboarded && boot.profile.wallet)
                        throw Error("Create your captain before checkout");
                      setQuote(
                        await api("/shop/orders", {
                          sku: item.id,
                          asset: "stable",
                        }),
                      );
                    })
                  }
                >
                  Pay in USDG
                </button>
                <button
                  disabled={busy || !boot.shop.enabled || !boot.shop.rivalEnabled}
                  onClick={() =>
                    run(async () => {
                      if (!boot.profile.wallet) {
                        const linked = await connect();
                        if (!linked.profile.onboarded) return;
                      }
                      if (!boot.profile.onboarded && boot.profile.wallet)
                        throw Error("Create your captain before checkout");
                      setQuote(
                        await api("/shop/orders", {
                          sku: item.id,
                          asset: "rival",
                        }),
                      );
                    })
                  }
                >
                  Pay in RIVAL
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
      {pending && (
        <section className="panel">
          <h3>Purchase awaiting confirmation</h3>
          <p className="hash">{pending.hash}</p>
          <button
            onClick={() =>
              run(async () => {
                await api("/shop/orders/" + pending.id + "/confirm", {
                  hash: pending.hash,
                });
                setPending(null);
                localStorage.removeItem("pending-purchase");
                await refresh();
                setNotice("Purchase confirmed.");
              })
            }
          >
            Retry receipt confirmation
          </button>
        </section>
      )}
    </main>
  );
}
