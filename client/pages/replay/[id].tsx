import { useEffect } from "react";
import { useApp } from "../../app/AppState";
import { TacticsView } from "../../components/TacticsView";
import { api } from "../../lib/api";
import { usePageTitle, useParams } from "../../router";

export default function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const { replay, setReplay, setStep, run } = useApp();
  usePageTitle("Replay");
  useEffect(() => {
    setStep(0);
    run(async () => setReplay(await api("/replays/" + encodeURIComponent(id))));
  }, [id]);
  return <TacticsView isReplay key={replay?.id ?? id} />;
}
