import { cost, distance, validateOrder, viewGame, type GameState, type Order } from "../../shared/game";

export type Move = { order: Order; label: string };

const KIND_LABEL: Record<string, string> = {
  flag: "banner (+1 Renown each round held)",
  cache: "supply post",
  base: "home outpost",
  grass: "open ground",
  forest: "forest",
  rock: "rocky ground",
  fog: "unexplored",
};

/**
 * Every legal order for `slot` this round, described only with what that captain can see.
 * The AI picks from this list by number, so it cannot invent an illegal move.
 */
export function legalMoves(s: GameState, slot: number): Move[] {
  const me = s.factions[slot];
  const view = viewGame(s, slot);
  const name = (owner: number) =>
    owner === slot
      ? "yours"
      : owner >= 0
        ? `held by ${s.factions[owner].captain} (${s.factions[owner].name})`
        : "unclaimed";
  const moves: Move[] = [];
  const add = (order: Order, text: string) => {
    if (validateOrder(s, slot, order)) return;
    moves.push({ order, label: `${text} — costs ${cost(s, slot, order)} Supplies` });
  };
  const nearby = view.tiles
    .filter((t: any) => {
      const d = distance(me.pos, t.id);
      return d >= 1 && d <= 2;
    })
    .sort((a: any, b: any) => distance(me.pos, a.id) - distance(me.pos, b.id) || a.id.localeCompare(b.id));
  for (const t of nearby as any[]) {
    const where = `${t.id} (${KIND_LABEL[t.kind] ?? t.kind}, ${t.kind === "fog" ? "owner unknown" : name(t.owner)}, ${distance(me.pos, t.id)} step${distance(me.pos, t.id) > 1 ? "s" : ""} away)`;
    add({ type: "scout", target: t.id }, `Scout ${where}: move there and reveal the area`);
    if (t.kind !== "fog" && t.owner !== slot)
      add({ type: "contest", target: t.id }, `Contest ${where}: fight to claim it`);
  }
  add({ type: "develop", upgrade: "income" }, "Develop income: +1 Supply every round (max two upgrades)");
  add(
    { type: "develop", upgrade: "fortify" },
    "Develop fortify: strengthen one of your outposts against attack",
  );
  add({ type: "develop", upgrade: "heal" }, "Develop heal: restore squad strength");
  for (const other of s.factions)
    if (other.id !== slot)
      add(
        { type: "pact", partner: other.id },
        `Offer a pact to ${other.captain} (${other.name}): only works if they offer one to you this round`,
      );
  add({ type: "hold" }, "Hold position and save Supplies");
  return moves;
}

/** Short human-readable form of an order, for the reasoning feed and memory notes. */
export function describeOrder(s: GameState, order: Order) {
  switch (order.type) {
    case "scout":
      return `scouted ${order.target}`;
    case "contest":
      return `contested ${order.target}`;
    case "develop":
      return `developed ${order.upgrade}`;
    case "pact":
      return `offered a pact to ${s.factions[order.partner ?? -1]?.captain ?? "a rival"}`;
    default:
      return "held position";
  }
}
