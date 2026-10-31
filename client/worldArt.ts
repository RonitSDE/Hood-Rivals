/**
 * Pixel art for the tactical board, ported from the living island (public/observatory.js) so
 * matches look like the same world: the same colour ramps, 2×2 pixel texture, trees, rocks,
 * halls and banners. Everything is drawn once into small canvases and reused every frame.
 */

/* ---------- toolkit (same maths as the living island) ---------- */
export const hash2 = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
export const shade = (h: string, a: number) =>
  rgbHex(...(hexRgb(h).map((v) => (a < 0 ? v * (1 + a) : v + (255 - v) * a)) as [number, number, number]));

type Painter = {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
  px(x: number, y: number, col: string): void;
  rect(x: number, y: number, w: number, h: number, col: string): void;
  poly(p: number[][], col: string): void;
  line(x0: number, y0: number, x1: number, y1: number, col: string): void;
};
export type Sprite = { c: HTMLCanvasElement; ax: number; ay: number };

function inPoly(x: number, y: number, p: number[][]) {
  let s = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i],
      [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s;
  }
  return s;
}

function spr(w: number, h: number, fn: (P: Painter) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const P: Painter = {
    g,
    w,
    h,
    px(x, y, col) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      g.fillStyle = col;
      g.fillRect(x | 0, y | 0, 1, 1);
    },
    rect(x, y, ww, hh, col) {
      g.fillStyle = col;
      g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
    },
    poly(p, col) {
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      for (const [a, b] of p) {
        x0 = Math.min(x0, a);
        x1 = Math.max(x1, a);
        y0 = Math.min(y0, b);
        y1 = Math.max(y1, b);
      }
      g.fillStyle = col;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
        for (let x = Math.floor(x0); x <= Math.ceil(x1); x++)
          if (inPoly(x + 0.5, y + 0.5, p)) g.fillRect(x, y, 1, 1);
    },
    line(x0, y0, x1, y1, col) {
      g.fillStyle = col;
      x0 = Math.round(x0);
      y0 = Math.round(y0);
      x1 = Math.round(x1);
      y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0),
        dy = -Math.abs(y1 - y0),
        sx = x0 < x1 ? 1 : -1,
        sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (let k = 0; k < 400; k++) {
        g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) {
          e += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          e += dx;
          y0 += sy;
        }
      }
    },
  };
  fn(P);
  return c;
}

function blob(
  P: Painter,
  circles: number[][],
  ramp: string[],
  o: { outline?: string; noise?: number; seed?: number } = {},
) {
  const { w, h, g } = P;
  const m = new Uint8Array(w * h),
    nx = new Float32Array(w * h),
    ny = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let best = -1e9,
        bc: number[] | null = null;
      for (const c of circles) {
        const d = Math.hypot((x + 0.5 - c[0]) / (c[3] || 1), y + 0.5 - c[1]);
        const dep = c[2] - d;
        if (dep > best) {
          best = dep;
          bc = c;
        }
      }
      if (best >= 0 && bc) {
        const i = y * w + x;
        m[i] = 1;
        nx[i] = (x + 0.5 - bc[0]) / bc[2];
        ny[i] = (y + 0.5 - bc[1]) / bc[2];
      }
    }
  const seed = o.seed || 0,
    lx = -0.55,
    ly = -0.83;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!m[i]) continue;
      const edge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 || !m[i - 1] || !m[i + 1] || !m[i - w] || !m[i + w];
      if (edge && o.outline) {
        g.fillStyle = o.outline;
        g.fillRect(x, y, 1, 1);
        continue;
      }
      const dot = nx[i] * lx + ny[i] * ly;
      const k = Math.floor(
        (dot * 0.5 + 0.5) * ramp.length + (hash2(x + seed * 37, y + seed * 11) - 0.5) * (o.noise ?? 1),
      );
      g.fillStyle = ramp[clamp(k, 0, ramp.length - 1)];
      g.fillRect(x, y, 1, 1);
    }
}

/* ---------- terrain (living island ramps) ---------- */
const GRASS = [
  [57, 96, 43],
  [68, 112, 47],
  [82, 128, 53],
  [96, 144, 59],
  [112, 158, 66],
  [128, 170, 74],
];
const FOREST = [
  [44, 78, 35],
  [52, 90, 40],
  [57, 96, 43],
  [68, 112, 47],
  [82, 128, 53],
];
const DIRT = [
  [128, 80, 46],
  [146, 94, 54],
  [163, 108, 62],
  [180, 123, 73],
];
const SAND = [
  [204, 168, 110],
  [216, 182, 124],
  [226, 196, 140],
  [234, 208, 156],
];
const PLAZA = [
  [146, 141, 134],
  [160, 155, 147],
  [134, 129, 123],
  [170, 165, 156],
];
const NIGHT = (c: number[]) => [c[0] * 0.38, c[1] * 0.46, c[2] * 0.7 + 18];

export type Ground = "grass" | "forest" | "rock" | "base" | "flag" | "cache";

/** One textured iso tile: diamond top (64×32) with an earthen cliff skirt below it. */
function tile(ground: Ground, variant: number, night: boolean, HW: number, HH: number, depth: number) {
  const W = HW * 2,
    H = HH * 2 + depth;
  return spr(W, H + 1, (P) => {
    const dark = night ? NIGHT : (c: number[]) => c;
    // skirt: the earth below the top face (left face lit, right face in shadow)
    const ramp = ground === "rock" || ground === "base" ? PLAZA : DIRT;
    for (let x = 0; x < W; x++) {
      const edge = HH + HH * (1 - Math.abs(x + 0.5 - HW) / HW);
      for (let y = Math.floor(edge) - 1; y < edge + depth; y++) {
        const h = hash2(x * 3 + variant, y * 7);
        const c = ramp[clamp(Math.floor(h * ramp.length), 0, ramp.length - 1)];
        const k = (x >= HW ? 0.62 : 0.84) * (y > edge + depth - 3 ? 0.8 : 1);
        const out = dark([c[0] * k, c[1] * k, c[2] * k]);
        P.px(x, y, rgbHex(out[0], out[1], out[2]));
      }
    }
    // top face, textured in 2×2 blocks like the island
    for (let y = 0; y < HH * 2; y += 2)
      for (let x = 0; x < W; x += 2) {
        if (Math.abs(x + 1 - HW) / HW + Math.abs(y + 1 - HH) / HH > 1) continue;
        const h = hash2(x + variant * 131, y + variant * 71),
          h2 = hash2(y + 71 + variant, x + 13);
        const wave = Math.sin((x + variant * 9) * 0.21) * 0.25 + Math.cos((y + variant * 5) * 0.33) * 0.25;
        let col: number[];
        if (ground === "grass" || ground === "flag" || ground === "cache") {
          col = GRASS[clamp(Math.floor((0.55 + wave + (h - 0.5) * 0.5) * 5), 0, 5)];
          if (h > 0.985)
            col = [
              [230, 120, 150],
              [240, 232, 206],
              [238, 200, 84],
              [160, 140, 220],
            ][(h2 * 4) | 0];
          if (
            (ground === "flag" || ground === "cache") &&
            Math.abs(x + 1 - HW) / HW + Math.abs(y + 1 - HH) / HH < 0.42
          )
            col = DIRT[clamp(Math.floor((0.5 + (h - 0.5) * 0.8) * 4), 0, 3)];
        } else if (ground === "forest")
          col = FOREST[clamp(Math.floor((0.5 + wave + (h - 0.5) * 0.5) * 5), 0, 4)];
        else if (ground === "rock")
          col = h > 0.5 ? PLAZA[(h2 * 4) | 0] : GRASS[clamp(Math.floor((0.4 + wave) * 5), 0, 5)];
        else {
          col = PLAZA[(hash2(Math.floor(x / 8), Math.floor(y / 6)) * 4) | 0];
          if (x % 8 === 0 || y % 6 === 0) col = [100, 96, 91];
        }
        const c = dark(col);
        P.rect(x, y, 2, 2, rgbHex(c[0], c[1], c[2]));
      }
    // lit top edge, as on the island's cliffs
    for (let x = 0; x < W; x++) {
      const y = Math.round(HH - (HH * (HW - Math.abs(x + 0.5 - HW))) / HW);
      P.px(x, y, night ? "#6f87a3" : x < HW ? "#c8e08f" : "#9ec06a");
    }
  });
}

/** Unexplored tiles: drifting pixel clouds over a pale sea-mist, hiding what is beneath. */
function fogTile(HW: number, HH: number, variant: number, depth: number) {
  return spr(HW * 2, HH * 2 + depth + 1, (P) => {
    // misty cliff skirt so the coastline stays continuous under fog
    for (let x = 0; x < HW * 2; x++) {
      const edge = HH + HH * (1 - Math.abs(x + 0.5 - HW) / HW);
      for (let y = Math.floor(edge) - 1; y < edge + depth; y++) {
        const h = hash2(x * 5 + variant, y * 3);
        const base = x >= HW ? [104, 122, 132] : [128, 146, 156];
        const k = (h - 0.5) * 14 - (y > edge + depth - 3 ? 14 : 0);
        P.px(x, y, rgbHex(base[0] + k, base[1] + k, base[2] + k));
      }
    }
    for (let y = 0; y < HH * 2; y += 2)
      for (let x = 0; x < HW * 2; x += 2) {
        if (Math.abs(x + 1 - HW) / HW + Math.abs(y + 1 - HH) / HH > 1) continue;
        const n = hash2(x + variant * 17, y + variant * 29);
        const puff =
          Math.sin((x + variant * 11) * 0.16) +
          Math.cos((y + variant * 3) * 0.3) +
          Math.sin((x + y) * 0.09 + variant);
        const col =
          puff > 1.3
            ? "#e6eef0"
            : puff > 0.3
              ? n > 0.5
                ? "#cfdcdf"
                : "#c2d2d7"
              : n > 0.6
                ? "#a9bfc7"
                : "#9cb3bc";
        P.rect(x, y, 2, 2, col);
      }
  });
}

/* ---------- props ---------- */
function pines() {
  const sr = mulberry(777);
  const pals = [
    ["#1b3826", "#2a5634", "#3b743b", "#5a9348"],
    ["#173424", "#24503a", "#33704a", "#4d8d5b"],
    ["#1e3923", "#2e5c2f", "#427836", "#62964a"],
  ];
  return [0, 1, 2, 3, 4].map((v) => {
    const pal = pals[v % 3],
      layers = 3 + (v % 3),
      H = 12 + layers * 6,
      cx = 13;
    const c = spr(26, H, (P) => {
      P.rect(cx - 1, H - 7, 3, 7, "#4b3121");
      P.rect(cx + 1, H - 7, 1, 7, "#36231a");
      for (let L = layers - 1; L >= 0; L--) {
        const top = 1 + L * 6,
          bot = top + 9,
          hw = 2.6 + L * 2.3 + (sr() - 0.5);
        for (let y = top; y <= bot; y++) {
          const fr = (y - top) / (bot - top),
            wv = Math.max(0.6, hw * fr + 0.6);
          for (let x = Math.floor(cx - wv); x <= Math.ceil(cx + wv); x++) {
            const d = (x + 0.5 - cx) / wv;
            if (Math.abs(d) > 1) continue;
            if (y === bot && (x + L + v) % 2 === 0 && Math.abs(d) > 0.2) continue;
            let col = pal[2];
            if (Math.abs(d) > 0.8 || y === bot) col = pal[0];
            else if (d < -0.25 && hash2(x * 3 + v, y * 7) > 0.25) col = pal[3];
            else if (d > 0.35) col = pal[1];
            P.px(x, y, col);
          }
        }
      }
      P.px(cx, 0, pal[3]);
    });
    return { c, ax: 13, ay: H - 2 };
  });
}

function roundTrees() {
  const sr = mulberry(911);
  return [0, 1, 2, 3, 4, 5].map((v) => {
    const birch = v >= 3;
    const ramp = birch
      ? ["#3d6a2a", "#538a33", "#6ba63f", "#88bf4f", "#a6d466"]
      : ["#284b23", "#386a2e", "#4f8a39", "#69a546", "#87bf56"];
    const c = spr(30, 36, (P) => {
      const tc = birch ? "#e6e0d2" : "#5a3a22";
      P.rect(13, 19, 4, 15, tc);
      P.rect(16, 19, 1, 15, birch ? "#b9b2a4" : "#3e2716");
      if (birch) for (let y = 21; y < 33; y += 3) P.rect(13 + (y % 2), y, 2, 1, "#2e2a26");
      P.rect(12, 33, 6, 1, "#3e2716");
      const cs = [[15, 13, 9.5]];
      for (let k = 0; k < 4; k++) {
        const a = sr() * 6.28;
        cs.push([15 + Math.cos(a) * 6, 13 + Math.sin(a) * 4.5, 4 + sr() * 2.5]);
      }
      blob(P, cs, ramp, { outline: "#1d361a", noise: 1.4, seed: v + 3 });
    });
    return { c, ax: 15, ay: 33 };
  });
}

function boulders() {
  return [0, 1, 2].map((v) => ({
    ax: 9,
    ay: 11,
    c: spr(18, 13, (P) => {
      const cs =
        v === 0
          ? [[9, 7, 6.5, 1.25]]
          : v === 1
            ? [
                [7, 8, 5],
                [12, 7, 4.5],
              ]
            : [
                [9, 8, 6, 1.4],
                [6, 6, 3.5],
              ];
      blob(P, cs, ["#4c4744", "#655f5a", "#7f7872", "#9a928a", "#b2aaa1"], {
        outline: "#2b2725",
        seed: v + 20,
      });
      P.px(6, 4, "#6c8f45");
      P.px(7, 4, "#6c8f45");
    }),
  }));
}

function bushes() {
  return [0, 1].map((full) => ({
    ax: 7,
    ay: 9,
    c: spr(15, 11, (P) => {
      blob(
        P,
        [
          [7.5, 6.5, 5, 1.3],
          [4.5, 7, 3.5],
          [10.5, 7, 3.5],
        ],
        ["#2f5a28", "#3f7532", "#55913c", "#6dab48"],
        {
          outline: "#1d361a",
          seed: 5,
        },
      );
      if (full)
        for (const [x, y] of [
          [4, 5],
          [8, 4],
          [10, 7],
          [6, 8],
          [11, 4],
        ])
          P.px(x, y, "#d63d4c");
    }),
  }));
}

/** A faction hall, the same building the living island uses for outposts. */
function hall(roof: string, color: string) {
  return {
    ax: 40,
    ay: 52,
    c: spr(80, 64, (P) => {
      const ox = 40,
        oy = 30,
        h = 20,
        rh = 16,
        Q = (x: number, y: number, z: number) => [ox + (x - y) * 16, oy + (x + y) * 8 - z];
      const wl = "#e7d5ae",
        wr = "#c3ad86",
        tm = "#6b4a2e";
      P.poly([Q(0, 2, 0), Q(2, 2, 0), Q(2, 2, h), Q(0, 2, h)], wl);
      P.poly([Q(2, 2, 0), Q(2, 0, 0), Q(2, 0, h), Q(2, 2, h)], wr);
      for (const t of [0, 1, 2]) {
        P.line(...(Q(t, 2, 0) as [number, number]), ...(Q(t, 2, h) as [number, number]), tm);
        P.line(...(Q(2, t, 0) as [number, number]), ...(Q(2, t, h) as [number, number]), shade(tm, -0.2));
      }
      P.poly([Q(0.82, 2, 0), Q(1.18, 2, 0), Q(1.18, 2, 12), Q(0.82, 2, 12)], "#4a3020");
      P.poly([Q(0.88, 2, 0), Q(1.12, 2, 0), Q(1.12, 2, 10), Q(0.88, 2, 10)], "#2a1a10");
      for (const [a, b] of [
        [0.28, 0.58],
        [1.42, 1.72],
      ]) {
        P.poly([Q(a, 2, 8), Q(b, 2, 8), Q(b, 2, 14), Q(a, 2, 14)], "#3a2618");
        P.poly([Q(a + 0.04, 2, 9), Q(b - 0.04, 2, 9), Q(b - 0.04, 2, 13), Q(a + 0.04, 2, 13)], "#ffcf6a");
      }
      P.poly([Q(2, 0, h), Q(2, 2, h), Q(2, 1, h + rh)], "#cdb791");
      P.poly(
        [Q(-0.18, -0.14, h - 1), Q(2.18, -0.14, h - 1), Q(2.18, 1, h + rh), Q(-0.18, 1, h + rh)],
        shade(roof, -0.35),
      );
      P.poly([Q(-0.18, 1, h + rh), Q(2.18, 1, h + rh), Q(2.18, 2.14, h - 1), Q(-0.18, 2.14, h - 1)], roof);
      for (let k = 1; k < 5; k++) {
        const fr = k / 5,
          y = 1 + 1.14 * fr,
          z = h + rh - (rh + 1) * fr;
        P.line(
          ...(Q(-0.18, y, z) as [number, number]),
          ...(Q(2.18, y, z) as [number, number]),
          shade(roof, -0.22),
        );
      }
      P.line(
        ...(Q(-0.18, 1, h + rh) as [number, number]),
        ...(Q(2.18, 1, h + rh) as [number, number]),
        shade(roof, 0.3),
      );
      const [bx, by] = Q(0.15, 2, h + 2);
      P.rect(bx - 1, by - 2, 4, 8, color);
      P.rect(bx - 1, by - 2, 4, 1, shade(color, 0.3));
    }),
  };
}

/** A waving banner on a pole, two animation frames. */
function flag(color: string) {
  return [0, 1].map((f) => ({
    ax: 3,
    ay: 30,
    c: spr(18, 32, (P) => {
      P.rect(2, 2, 2, 28, "#6b5640");
      P.rect(3, 2, 1, 28, "#4c3c2c");
      P.rect(1, 29, 5, 2, "#6f6861");
      P.rect(2, 0, 2, 2, "#e9b04b");
      for (let x = 0; x < 11; x++) {
        const off = Math.round(Math.sin(x * 0.7 + f * 2.2) * 1.1);
        for (let y = 0; y < 7; y++)
          P.px(4 + x, 3 + y + off, y === 0 ? shade(color, 0.25) : y >= 5 ? shade(color, -0.25) : color);
      }
      P.rect(8, 5 + Math.round(Math.sin(2.8 + f * 2.2)), 2, 2, "#f3ead8");
    }),
  }));
}

/** A supply post: crates, logs and a stone pile. */
function supplies() {
  return {
    ax: 13,
    ay: 16,
    c: spr(26, 18, (P) => {
      P.rect(2, 9, 9, 2, "#7a5530");
      P.rect(2, 11, 9, 2, "#5a3a22");
      P.rect(2, 9, 2, 4, "#c09060");
      P.rect(12, 4, 9, 9, "#9a7146");
      P.rect(12, 4, 9, 1, "#c09060");
      P.rect(20, 4, 1, 9, "#6b4a2e");
      P.line(12, 4, 20, 12, "#6b4a2e");
      blob(P, [[7, 15, 3]], ["#5e5853", "#7f7872", "#a29a91"], { outline: "#2b2725" });
      P.rect(4, 15, 18, 1, "#3e2716");
    }),
  };
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- water and beach around the board ---------- */
/**
 * Paints the sea, shallows, foam and a sand beach around the board once. `inside(x, y)` returns
 * the island-shaped distance (0 at the coast, negative inland) for a world point.
 */
function seaAndShore(
  width: number,
  height: number,
  originX: number,
  originY: number,
  coast: (x: number, y: number) => number,
  night: boolean,
) {
  return spr(width, height, (P) => {
    const img = P.g.createImageData(width, height),
      d = img.data;
    for (let py = 0; py < height; py += 2)
      for (let px = 0; px < width; px += 2) {
        const wx = px + originX,
          wy = py + originY;
        const h = hash2(px, py),
          h2 = hash2(py + 71, px + 13);
        const dist = coast(wx + (h - 0.5) * 6, wy + (h2 - 0.5) * 4);
        let col: number[];
        if (dist <= 0) continue; // the board's own tiles cover this
        if (dist < 9)
          col =
            SAND[
              clamp(Math.floor((0.6 + Math.sin(wx * 0.07 + wy * 0.11) * 0.3 + (h - 0.5) * 0.4) * 4), 0, 3)
            ];
        else if (dist < 11) col = [156, 206, 222];
        else {
          const dep = dist - 11;
          col =
            dep < 12
              ? [76, 150, 188]
              : dep < 26
                ? [62, 132, 174]
                : dep < 46
                  ? [50, 112, 156]
                  : dep < 80
                    ? [34, 84, 128]
                    : [30, 74, 114];
          const wave = Math.sin(wx * 0.13 + wy * 0.29 + h * 0.6);
          if (wave > 0.93 && h > 0.5) col = col.map((v) => v + 26);
        }
        if (night) col = NIGHT(col);
        for (const off of [0, 4, width * 4, width * 4 + 4]) {
          const o = (py * width + px) * 4 + off;
          d[o] = col[0];
          d[o + 1] = col[1];
          d[o + 2] = col[2];
          d[o + 3] = 255;
        }
      }
    P.g.putImageData(img, 0, 0);
  });
}

/* ---------- public API ---------- */
export type WorldArt = ReturnType<typeof buildWorldArt>;

export function buildWorldArt(opts: {
  HW: number;
  HH: number;
  night: boolean;
  factions: { color: string; roof: string }[];
}) {
  const { HW, HH, night } = opts;
  const DEPTH = 10;
  const grounds: Ground[] = ["grass", "forest", "rock", "base", "flag", "cache"];
  const tiles = Object.fromEntries(
    grounds.map((g) => [g, [0, 1, 2, 3].map((v) => tile(g, v, night, HW, HH, DEPTH))]),
  ) as Record<Ground, HTMLCanvasElement[]>;
  return {
    DEPTH,
    tiles,
    fog: [0, 1, 2].map((v) => fogTile(HW, HH, v, DEPTH)),
    pine: pines(),
    round: roundTrees(),
    boulder: boulders(),
    bush: bushes(),
    supplies: supplies(),
    hall: opts.factions.map((f) => hall(f.roof, f.color)),
    flag: opts.factions.map((f) => flag(f.color)),
    neutralFlag: flag("#d9c195"),
    sea: (w: number, h: number, ox: number, oy: number, coast: (x: number, y: number) => number) =>
      seaAndShore(w, h, ox, oy, coast, night),
  };
}

/** Draws a sprite anchored at its base point. */
export function stamp(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number) {
  ctx.drawImage(s.c, Math.round(x - s.ax), Math.round(y - s.ay));
}
