import { FACTIONS } from "../../shared/game";
import { AGENT_COLORS } from "../lib/constants";

export function CaptainPortrait({ faction = 0 }: { faction?: number }) {
  return (
    <svg
      className="captain-portrait"
      viewBox="0 0 32 32"
      role="img"
      aria-label="Pixel captain portrait"
      shapeRendering="crispEdges"
    >
      <rect width="32" height="32" fill="#172a29" />
      <path d="M0 26L16 18 32 26V32H0" fill="#263d34" />
      <path d="M8 23H24V32H8Z" fill={FACTIONS[faction].color} />
      <path d="M11 9H21V21H11Z" fill="#e6b889" />
      <path d="M9 7H23V12H9ZM11 5H21V7H11Z" fill="#e3ca88" />
      <path d="M9 12H12V18H9ZM20 12H23V18H20Z" fill="#514033" />
      <path d="M13 14H15V16H13ZM18 14H20V16H18Z" fill="#182b29" />
      <path d="M14 20H19V23H14Z" fill="#ba8b68" />
      <path d="M14 24H19V32H14Z" fill="#e3ca88" />
    </svg>
  );
}

export function AgentPortrait({ look = [0, 0, 0] }: { look?: number[] }) {
  const color = AGENT_COLORS[look[0]] || AGENT_COLORS[0];
  return (
    <svg
      className="agent-portrait"
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Pixel Agent ID, palette ${look[0] + 1}, crest ${look[1] + 1}, accessory ${look[2] + 1}`}
    >
      <rect width="32" height="32" fill="#0d1a18" />
      <path d="M2 28 16 18 30 28V32H2Z" fill="#29412f" />
      <path d="M8 10H24V25H8Z" fill={color} />
      <path d="M10 7H22V11H10ZM12 5H20V7H12Z" fill="#fbf2d5" />
      <path d="M11 13H21V22H11Z" fill="#13251c" />
      <text
        x="16"
        y="20"
        fill={color}
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="bold"
        fontSize="7"
      >
        {["H", "X", "V", "O"][look[1]] || "H"}
      </text>
      <text x="16" y="29" fill="#fbf2d5" textAnchor="middle" fontFamily="monospace" fontSize="5">
        {["_", "*", "+", "^"][look[2]] || "_"}
      </text>
    </svg>
  );
}
