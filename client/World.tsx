import { useEffect, useRef, useState } from "react";
import { FACTIONS, hash } from "../shared/game";

type WorldProps = {
  game: any;
  cosmetic?: string;
  selected?: string;
  reachable?: string[];
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
};
type Cam = { x: number; y: number; zoom: number };
type Controls = { reset: () => void; zoom: (direction: number) => void };
const HW = 32;
const HH = 16;
const LIFT = 8;
const place = (q: number, r: number) => ({ x: (q - r) * HW, y: (q + r) * HH });

function fillDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, hw = HW, hh = HH) {
  ctx.fillStyle = color;
  const top = Math.round(cy - hh);
  const bot = Math.round(cy + hh);
  for (let y = top; y <= bot; y++) {
    const span = Math.max(0, Math.round(hw * (1 - Math.abs(y - cy) / hh)));
    ctx.fillRect(Math.round(cx) - span, y, Math.max(1, span * 2), 1);
  }
}

function pine(ctx: CanvasRenderingContext2D, x: number, y: number, n: number) {
  const pal =
    n % 2 ? ["#1b3826", "#2a5634", "#3b743b", "#5a9348"] : ["#173424", "#24503a", "#33704a", "#4d8d5b"];
  ctx.fillStyle = "#4b3121";
  ctx.fillRect(x - 1, y - 6, 2, 6);
  ctx.fillStyle = "#36231a";
  ctx.fillRect(x, y - 6, 1, 6);
  for (let layer = 2; layer >= 0; layer--) {
    const top = y - 20 + layer * 5;
    for (let row = 0; row < 6; row++) {
      const width = Math.max(1, 3 + (2 - layer) * 2 - Math.floor(row / 2));
      ctx.fillStyle = row > 4 ? pal[0] : row < 2 ? pal[3] : row % 2 ? pal[1] : pal[2];
      ctx.fillRect(x - width, top + row, width * 2 + 1, 1);
    }
  }
}

function rocks(ctx: CanvasRenderingContext2D, x: number, y: number, n: number) {
  const cols = ["#8d877f", "#6e6963", "#a39c93"];
  for (let i = 0; i < 3; i++) {
    const w = 5 + ((n + i) % 3);
    const h = 4 + (i % 2);
    ctx.fillStyle = cols[(n + i) % 3];
    ctx.fillRect(x - 7 + i * 5, y - h - (i === 1 ? 2 : 0), w, h);
    ctx.fillStyle = "#534e49";
    ctx.fillRect(x - 7 + i * 5, y - 1, w, 1);
  }
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = "rgba(10,8,6,.35)";
  ctx.fillRect(x - 9, y - 1, 18, 3);
  ctx.fillStyle = "#6b5344";
  ctx.fillRect(x - 8, y - 16, 16, 14);
  ctx.fillStyle = "#4a3428";
  ctx.fillRect(x - 8, y - 16, 3, 14);
  ctx.fillStyle = color;
  ctx.fillRect(x - 10, y - 22, 20, 7);
  ctx.fillStyle = "#1a1412";
  ctx.fillRect(x - 10, y - 16, 20, 1);
  ctx.fillRect(x - 2, y - 8, 4, 6);
  ctx.fillStyle = "#f3e2b0";
  ctx.fillRect(x + 3, y - 13, 3, 3);
}

function banner(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, tall = false) {
  const pole = tall ? 28 : 20;
  ctx.fillStyle = "#4b3121";
  ctx.fillRect(x, y - pole, 2, pole);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y - pole + 2, tall ? 12 : 10, tall ? 8 : 6);
  ctx.fillStyle = "#1a1412";
  ctx.fillRect(x + 2, y - pole + 6, tall ? 12 : 10, 1);
}

function crystal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6b5344";
  ctx.fillRect(x - 6, y - 8, 12, 7);
  ctx.fillStyle = "#4a3428";
  ctx.fillRect(x - 6, y - 8, 2, 7);
  ctx.fillStyle = "#9fe7d8";
  ctx.fillRect(x - 2, y - 16, 4, 8);
  ctx.fillStyle = "#dff8f2";
  ctx.fillRect(x - 1, y - 15, 1, 4);
}

function captain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  look: { crown?: boolean; standard?: boolean; seal?: boolean },
) {
  ctx.fillStyle = "rgba(10,8,6,.38)";
  ctx.fillRect(x - 6, y - 1, 12, 3);
  if (look.seal) {
    ctx.fillStyle = "#e9b04b";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * 7), Math.round(y - 2 + Math.sin(a) * 3), 1, 1);
    }
  }
  ctx.fillStyle = color;
  ctx.fillRect(x - 3, y - 11, 6, 8);
  ctx.fillStyle = "#e7c4a2";
  ctx.fillRect(x - 2, y - 15, 4, 4);
  ctx.fillStyle = "#1a1412";
  ctx.fillRect(x - 1, y - 14, 1, 1);
  ctx.fillRect(x + 1, y - 14, 1, 1);
  if (look.crown) {
    ctx.fillStyle = "#5a9348";
    ctx.fillRect(x - 3, y - 17, 6, 2);
    ctx.fillRect(x - 3, y - 19, 1, 2);
    ctx.fillRect(x - 1, y - 19, 1, 2);
    ctx.fillRect(x + 2, y - 19, 1, 2);
  }
  if (look.standard) banner(ctx, x + 6, y, color);
}

function outline(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  const top = Math.round(y - HH);
  const bot = Math.round(y + HH);
  for (let py = top; py <= bot; py++) {
    const span = Math.max(0, Math.round(HW * (1 - Math.abs(py - y) / HH)));
    ctx.fillRect(Math.round(x) - span, py, 1, 1);
    ctx.fillRect(Math.round(x) + span, py, 1, 1);
  }
}

export function World({ game, cosmetic, selected, reachable, onSelect, onHover }: WorldProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onSelect);
  const hoverCallback = useRef(onHover);
  const selection = useRef(selected);
  const legal = useRef(reachable);
  const control = useRef<Controls | null>(null);
  const camera = useRef<Cam>({ x: 0, y: 8, zoom: 1.6 });
  const fitted = useRef(false);
  const previousActors = useRef<Record<number, string>>({});
  const [fallback, setFallback] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  callback.current = onSelect;
  hoverCallback.current = onHover;
  selection.current = selected;
  legal.current = reachable;

  useEffect(() => {
    const el = host.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (!el || !canvas || !ctx || !game?.tiles || !game?.factions) {
      if (game?.tiles && !ctx) setFallback(true);
      return;
    }
    setFallback(false);
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Isometric frontier. Drag to pan, scroll to zoom, click a hex to inspect.",
    );
    const night = cosmetic === "moonwatch";
    const grass = night
      ? ["#24384a", "#2c4658", "#1d3040", "#345066"]
      : ["#3b743b", "#4d8d4b", "#356e38", "#5a9348"];
    const side = night ? "#1a2c3c" : "#3d5c34";
    const points: Record<string, { x: number; y: number }> = {};
    for (const tile of game.tiles) points[tile.id] = place(tile.q, tile.r);
    const ordered = [...game.tiles].sort(
      (a, b) => points[a.id].y - points[b.id].y || points[a.id].x - points[b.id].x,
    );
    const you = game.you ?? 0;
    const actors = game.factions
      .filter((f: any) => f.pos && points[f.pos])
      .map((f: any) => {
        const destination = points[f.pos];
        const previous = previousActors.current[f.id];
        const origin = previous && points[previous] ? points[previous] : destination;
        return { id: f.id, origin, destination, you: f.id === you };
      });
    previousActors.current = Object.fromEntries(
      game.factions.filter((f: any) => f.pos && points[f.pos]).map((f: any) => [f.id, f.pos]),
    );
    const sparkles = Array.from({ length: 48 }, (_, i) => {
      const angle = i * 2.399;
      const radius = 150 + (hash(String(i)) % 90);
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.42, phase: hash(String(i)) % 7 };
    });

    const frameOf = () => {
      const width = Math.max(1, el.clientWidth);
      const height = Math.max(1, el.clientHeight);
      const zoom = Math.min(2.8, Math.max(1.05, Math.min(width / 540, height / 320)));
      return { x: 0, y: 6, zoom };
    };
    if (!fitted.current) {
      camera.current = frameOf();
      fitted.current = true;
    }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, el.clientWidth);
      const height = Math.max(1, el.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    let hoverId: string | null = null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const toWorld = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const cam = camera.current;
      return {
        x: (event.clientX - box.left - box.width / 2) / cam.zoom + cam.x,
        y: (event.clientY - box.top - box.height / 2) / cam.zoom + cam.y,
      };
    };
    const pick = (event: PointerEvent) => {
      const world = toWorld(event);
      let hit: string | null = null;
      let front = -Infinity;
      for (const tile of game.tiles) {
        const pos = points[tile.id];
        const dx = Math.abs(world.x - pos.x) / HW;
        const dy = Math.abs(world.y - (pos.y - LIFT)) / HH;
        if (dx + dy <= 1 && pos.y >= front) {
          front = pos.y;
          hit = tile.id;
        }
      }
      return hit;
    };
    let drag: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;
    const down = (event: PointerEvent) => {
      drag = {
        x: event.clientX,
        y: event.clientY,
        camX: camera.current.x,
        camY: camera.current.y,
        moved: false,
      };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        if (drag.moved) {
          camera.current.x = drag.camX - dx / camera.current.zoom;
          camera.current.y = drag.camY - dy / camera.current.zoom;
          canvas.style.cursor = "grabbing";
          return;
        }
      }
      const id = pick(event);
      if (id !== hoverId) {
        hoverId = id;
        setHovered(id);
        hoverCallback.current?.(id);
      }
      canvas.style.cursor = id ? "pointer" : "grab";
    };
    const up = (event: PointerEvent) => {
      if (drag && !drag.moved) {
        const id = pick(event);
        if (id) callback.current?.(id);
      }
      drag = null;
      canvas.style.cursor = hoverId ? "pointer" : "grab";
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      const before = toWorld(event as unknown as PointerEvent);
      const next = Math.min(3.2, Math.max(1, camera.current.zoom * (event.deltaY > 0 ? 0.9 : 1.11)));
      camera.current.zoom = next;
      camera.current.x = before.x - (event.clientX - box.left - box.width / 2) / next;
      camera.current.y = before.y - (event.clientY - box.top - box.height / 2) / next;
    };
    const keydown = (event: KeyboardEvent) => {
      const step = 28 / camera.current.zoom;
      if (event.key === "ArrowLeft") camera.current.x -= step;
      else if (event.key === "ArrowRight") camera.current.x += step;
      else if (event.key === "ArrowUp") camera.current.y -= step;
      else if (event.key === "ArrowDown") camera.current.y += step;
      else if (event.key === "+" || event.key === "=")
        camera.current.zoom = Math.min(3.2, camera.current.zoom * 1.12);
      else if (event.key === "-") camera.current.zoom = Math.max(1, camera.current.zoom * 0.9);
      else return;
      event.preventDefault();
    };
    control.current = {
      reset: () => {
        camera.current = frameOf();
      },
      zoom: (direction) => {
        camera.current.zoom = Math.min(3.2, Math.max(1, camera.current.zoom + direction * -0.18));
      },
    };
    const leave = () => {
      hoverId = null;
      setHovered(null);
      hoverCallback.current?.(null);
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("keydown", keydown);

    const started = performance.now();
    let frame = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden) return;
      const width = el.clientWidth;
      const height = el.clientHeight;
      const dpr = canvas.width / Math.max(1, width);
      const cam = camera.current;
      cam.x = Math.max(-260, Math.min(260, cam.x));
      cam.y = Math.max(-160, Math.min(160, cam.y));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = night ? "#14283c" : "#1e4a70";
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);
      if (!reduced) {
        for (const spark of sparkles) {
          const drift = Math.sin(time * 0.001 + spark.phase) * 4;
          ctx.fillStyle = night ? "rgba(186,214,232,.45)" : "rgba(214,236,246,.55)";
          ctx.fillRect(Math.round(spark.x + drift), Math.round(spark.y), 2, 1);
        }
      }
      ctx.fillStyle = night ? "rgba(6,14,24,.35)" : "rgba(8,28,18,.28)";
      ctx.beginPath();
      ctx.ellipse(0, 18, 236, 86, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const tile of ordered) {
        const pos = points[tile.id];
        const topY = pos.y - LIFT;
        const n = hash(tile.id);
        const fog = tile.kind === "fog";
        fillDiamond(ctx, pos.x, topY + 7, fog ? "#243246" : side);
        fillDiamond(ctx, pos.x, topY, fog ? "#44586c" : grass[n % grass.length]);
        if (!fog && n % 5 === 0) {
          ctx.fillStyle = night ? "#1a3144" : "#2a5634";
          ctx.fillRect(pos.x - 4 + (n % 7), topY - 2, 2, 1);
        }
        if (!fog && tile.owner >= 0 && tile.kind !== "base") {
          ctx.fillStyle = FACTIONS[tile.owner].color;
          ctx.fillRect(pos.x - 4, topY + HH - 3, 8, 2);
        }
        if (fog) {
          ctx.fillStyle = "rgba(214,226,236,.35)";
          ctx.fillRect(pos.x - 6, topY - 2, 4, 2);
          ctx.fillRect(pos.x + 3, topY + 1, 3, 2);
          continue;
        }
        if (tile.kind === "forest") {
          pine(ctx, pos.x - 8, topY + 4, n);
          pine(ctx, pos.x + 7, topY + 6, n + 1);
          if (n % 2) pine(ctx, pos.x, topY + 2, n + 2);
        } else if (tile.kind === "rock") rocks(ctx, pos.x, topY + 6, n);
        else if (tile.kind === "cache") crystal(ctx, pos.x, topY + 8);
        else if (tile.kind === "base") {
          const color = FACTIONS[Math.max(0, tile.owner)].color;
          house(ctx, pos.x, topY + 8, color);
          banner(ctx, pos.x + 12, topY + 6, color, true);
        } else if (tile.kind === "flag") {
          banner(ctx, pos.x - 2, topY + 8, tile.owner >= 0 ? FACTIONS[tile.owner].color : "#d9c195", true);
        }
      }

      if (night) {
        ctx.fillStyle = "rgba(12,18,52,.4)";
        ctx.fillRect(-800, -500, 1600, 1000);
        ctx.globalCompositeOperation = "lighter";
        for (const tile of game.tiles) {
          if (tile.kind !== "base" && tile.kind !== "cache") continue;
          const pos = points[tile.id];
          const light = ctx.createRadialGradient(pos.x, pos.y - 20, 2, pos.x, pos.y - 12, 54);
          light.addColorStop(0, "rgba(255,176,90,.55)");
          light.addColorStop(1, "rgba(255,140,50,0)");
          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 16, 54, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      const travel = reduced ? 1 : Math.min(1, (time - started) / 420);
      for (const actor of actors) {
        const x = actor.origin.x + (actor.destination.x - actor.origin.x) * travel;
        const y = actor.origin.y + (actor.destination.y - actor.origin.y) * travel - LIFT;
        const bob = reduced ? 0 : Math.sin(time * 0.004 + actor.id) * 1;
        const faction = FACTIONS[actor.id];
        captain(ctx, x + (actor.you ? -6 : 6), y + HH + bob, faction.color, {
          crown: actor.you && cosmetic === "moss-crown",
          standard: actor.you && cosmetic === "ember-standard",
          seal: actor.you && cosmetic === "founder-seal",
        });
      }

      const allowed = new Set(legal.current || []);
      const chosen = selection.current;
      for (const id of allowed) {
        if (!points[id] || id === chosen) continue;
        const pulse = reduced ? 0 : Math.sin(time * 0.004 + points[id].x) * 0.4;
        outline(ctx, points[id].x, points[id].y - LIFT, pulse > 0 ? "#e9b04b" : "#c6a15a");
      }
      const player = game.factions[you];
      if (player?.pos && chosen && points[chosen] && points[player.pos] && player.pos !== chosen) {
        const from = points[player.pos];
        const to = points[chosen];
        ctx.fillStyle = "#e7d7a7";
        const steps = 18;
        for (let i = 0; i < steps; i += 2) {
          const t = i / steps;
          ctx.fillRect(
            Math.round(from.x + (to.x - from.x) * t),
            Math.round(from.y - LIFT + (to.y - from.y) * t),
            2,
            2,
          );
        }
      }
      if (chosen && points[chosen]) {
        outline(
          ctx,
          points[chosen].x,
          points[chosen].y - LIFT - (reduced ? 0 : Math.sin(time * 0.005)),
          "#fff4cd",
        );
      }
      ctx.restore();

      ctx.imageSmoothingEnabled = true;
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "center";
      for (const tile of game.tiles) {
        if (tile.kind !== "base" || tile.owner < 0) continue;
        const pos = points[tile.id];
        const sx = (pos.x - cam.x) * cam.zoom + width / 2;
        const sy = (pos.y - LIFT - 36 - cam.y) * cam.zoom + height / 2;
        const label = FACTIONS[tile.owner].name.toUpperCase();
        const plateWidth = label.length * 7 + 14;
        ctx.fillStyle = "rgba(14,13,12,.86)";
        ctx.fillRect(sx - plateWidth / 2, sy - 11, plateWidth, 16);
        ctx.fillStyle = FACTIONS[tile.owner].color;
        ctx.fillRect(sx - plateWidth / 2, sy + 4, plateWidth, 2);
        ctx.fillStyle = "#ece6da";
        ctx.fillText(label, sx, sy + 1);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      control.current = null;
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keydown);
    };
  }, [game, cosmetic]);

  return (
    <div className={"world" + (cosmetic === "moonwatch" ? " world-night" : "")} ref={host}>
      {fallback ? (
        <div className="world-fallback" role="group" aria-label="Text map, use buttons to inspect a hex">
          {game.tiles.map((tile: any) => (
            <button
              key={tile.id}
              className={tile.id === selected ? "active" : ""}
              onClick={() => callback.current?.(tile.id)}
            >
              {tile.id} · {tile.kind}
            </button>
          ))}
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} />
          <div className="world-vignette" aria-hidden="true" />
          <div className="world-coordinate">N · 01 / FRONTIER</div>
          <div className="world-controls" aria-label="World camera controls">
            <button
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => control.current?.zoom(-1)}
            >
              +
            </button>
            <button
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => control.current?.zoom(1)}
            >
              −
            </button>
            <button
              type="button"
              title="Reset camera"
              aria-label="Reset camera"
              onClick={() => control.current?.reset()}
            >
              ⌕
            </button>
          </div>
          <div className="world-guide">
            PAN <span>·</span> ZOOM <span>·</span> SELECT A HEX
          </div>
          {hovered && (
            <div className="world-hover" aria-hidden="true">
              {hovered} <span>{game.tiles.find((tile: any) => tile.id === hovered)?.kind}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
