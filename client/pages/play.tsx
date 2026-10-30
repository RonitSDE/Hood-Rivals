import { useEffect } from "react";
import { useApp } from "../app/AppState";
import { TacticsView } from "../components/TacticsView";
import { usePageTitle, useLocation } from "../router";

/** /play shows the lobby; /play?match=<id> opens that match, so a refresh or shared tab returns to it. */
export default function PlayPage() {
  const { match, setMatch } = useApp();
  const matchId = useLocation().searchParams.get("match") ?? "";
  usePageTitle(match ? "Match in progress" : "Play");
  useEffect(() => {
    if (matchId && matchId !== match) setMatch(matchId);
  }, [matchId]);
  return <TacticsView />;
}
