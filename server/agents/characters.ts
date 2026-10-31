import type { AgentStyle } from "../../shared/agent";

/** Who an AI captain is. The personality steers choices; it never changes game stats. */
export type Character = {
  /** Stable key for memory, e.g. `rival:1`, `agent:42`. */
  key: string;
  name: string;
  faction: number;
  style: AgentStyle;
  personality: string;
};

const FACTION_CAPTAINS: Omit<Character, "key" | "name">[] = [
  {
    faction: 0,
    style: "explorer",
    personality:
      "Emberhold pathfinder. Restless and curious: scouts first, strikes at banners the moment they are known, hates sitting still.",
  },
  {
    faction: 1,
    style: "fortifier",
    personality:
      "Tidewatch builder. Patient and stubborn: grows income early, fortifies what it owns, only fights for ground it can keep.",
  },
  {
    faction: 2,
    style: "diplomat",
    personality:
      "Sunreach trader. Charming dealmaker: offers pacts to whoever is weakest, keeps promises, never forgets a betrayal.",
  },
];

const STYLE_PERSONALITY: Record<AgentStyle, string> = {
  balanced: "Balanced commander: weighs scouting, banners and defence evenly and adapts to the board.",
  explorer: "Explorer: values knowing the map; scouts unknown ground, then contests banners it has seen.",
  fortifier: "Fortifier: protects squad strength and outposts first; avoids risky clashes.",
  diplomat: "Diplomat: builds trust with pacts, rewards allies, punishes betrayal.",
};

/** The AI rival captain for a faction (used in solo matches and the Arena). */
export function rivalCharacter(faction: number, name: string): Character {
  const base = FACTION_CAPTAINS[faction] ?? FACTION_CAPTAINS[0];
  return { ...base, faction, key: `rival:${faction}`, name };
}

/** A player's delegated Agent ID, playing their captain with its chosen decision style. */
export function agentCharacter(tokenId: number, faction: number, name: string, style: AgentStyle): Character {
  return {
    key: `agent:${tokenId}`,
    name,
    faction,
    style,
    personality: `Agent ID #${tokenId} serving ${name}. ${STYLE_PERSONALITY[style] ?? STYLE_PERSONALITY.balanced}`,
  };
}
