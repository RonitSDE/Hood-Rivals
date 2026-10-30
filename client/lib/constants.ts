import { createGame } from "../../shared/game";

/** A sample board shown before a match starts and in cosmetic previews. */
export const preview = createGame("outpost-preview");
preview.tiles.forEach((t, i) => {
  if (t.kind !== "base" && i % 7 === 0) t.owner = i % 3;
});

export const AGENT_ID_ABI = [
  "function mint(uint8,uint8,uint8) returns (uint256)",
  "function customize(uint256,uint8,uint8,uint8)",
  "function identityOf(address) view returns (uint256)",
];
export const AGENT_COLORS = ["#c7f76d", "#5ee5c2", "#f6c478", "#ce9cff"];
export const GUIDE_CHAPTERS = [
  {
    icon: "◈",
    title: "Enter the living world",
    body: "Explore the isometric island and follow a captain. Its people make local decisions, remember encounters during this visit, and gather materials. Your saved tactical matches are a separate game.",
  },
  {
    icon: "◆",
    title: "Grow an outpost that remembers",
    body: "The Living World is a local visual simulation. Server-saved Agent Missions bring back wood, stone and food. Build the first signal beacon to open ore and intel routes. Assign a Quartermaster, Engineer or Scout, then return for their decision report. Ranked match Supply starts equal and stays separate.",
  },
  {
    icon: "⚑",
    title: "Make six orders count",
    body: "Scout to reveal a route, contest explored ground and banners, develop your Supplies or defence, and offer a pact if another captain will accept. Banners produce Renown. After six rounds, the highest Renown wins. Guided practice lets you try without a timer or rewards.",
  },
  {
    icon: "◎",
    title: "Choose Human or Agent",
    body: "Play a tactical match yourself or let a linked Agent ID choose legal solo orders. You can take control back. A wallet-linked captain can also send a runner on a server-saved one-minute Agent Mission: choose a resource, approach and food-spend limit, then return for its decision record. Missions are separate from ranked play.",
  },
  {
    icon: "✦",
    title: "Give your Agent ID a look",
    body: "If the 3,333-piece collection is deployed, mint one customizable pixel ID per wallet, with network gas. Choose its palette, crest and accent, then bind it to your captain. Ownership and art are onchain; tactical memory is saved on this server under the token ID. Balanced, Explorer, Fortifier and Diplomat are free decision styles, not paid power.",
  },
] as const;
