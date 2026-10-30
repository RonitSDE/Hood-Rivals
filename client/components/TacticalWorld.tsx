import { lazy, Suspense, useMemo, type ComponentProps } from "react";

const LazyWorld = lazy(() => import("../World").then((m) => ({ default: m.World })));
type WorldProps = ComponentProps<typeof LazyWorld>;

/** The isometric tactical board, loaded on demand. Re-renders only when the game state actually changes. */
export function World(props: WorldProps) {
  const snapshot = JSON.stringify(props.game);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const game = useMemo(() => props.game, [snapshot]);
  return (
    <Suspense
      fallback={
        <div className="world world-loading" role="status">
          Preparing your tactical world…
        </div>
      }
    >
      <LazyWorld {...props} game={game} />
    </Suspense>
  );
}
