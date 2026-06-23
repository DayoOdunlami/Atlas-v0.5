"use client";

import { useEffect, useRef } from "react";

type FieldNode = {
  x: number;
  y: number;
  r: number;
  kind: string;
  cl: string;
  base: number;
  amp: number;
  ph: number;
  sp: number;
  appear: number;
};

type WebNode = {
  y: number;
  x0: number;
  xT: number;
  r: number;
  ph: number;
  sp: number;
};

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function ease(p: number) {
  return 1 - (1 - Math.max(0, Math.min(1, p))) ** 3;
}

function buildField(w: number, h: number) {
  const rnd = rng(20260622);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const clusters = [
    { key: "highways", cx: 0.8, cy: 0.52, sx: 0.16, sy: 0.2, n: 96, kind: "corpus", smin: 1.4, smax: 5.2 },
    { key: "maritime", cx: 0.66, cy: 0.68, sx: 0.1, sy: 0.12, n: 54, kind: "corpus", smin: 1.4, smax: 4.6 },
    { key: "rail", cx: 0.93, cy: 0.34, sx: 0.07, sy: 0.1, n: 60, kind: "corpus", smin: 1.0, smax: 2.4 },
    { key: "data", cx: 1.0, cy: 0.74, sx: 0.13, sy: 0.16, n: 70, kind: "corpus", smin: 1.6, smax: 5.0 },
    { key: "thin", cx: 0.6, cy: 0.2, sx: 0.08, sy: 0.07, n: 22, kind: "thin", smin: 1.2, smax: 3.0 },
  ];
  const nodes: FieldNode[] = [];
  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      const x = (c.cx + gauss() * c.sx) * w;
      const y = (c.cy + gauss() * c.sy) * h;
      const r = c.smin + rnd() * (c.smax - c.smin);
      nodes.push({
        x,
        y,
        r,
        kind: c.kind,
        cl: c.key,
        base: 0.22 + rnd() * 0.22,
        amp: 0.1 + rnd() * 0.14,
        ph: rnd() * 6.28,
        sp: 0.5 + rnd() * 0.9,
        appear: Math.min(1, c.cx + gauss() * c.sx) * 0.66 + rnd() * 0.18,
      });
    }
  }
  const web: WebNode[] = [];
  for (let i = 0; i < 9; i++) {
    const y = (0.3 + rnd() * 0.5) * h;
    web.push({
      y,
      x0: (1.06 + rnd() * 0.06) * w,
      xT: (0.74 + rnd() * 0.2) * w,
      r: 2.6 + rnd() * 3.4,
      ph: rnd() * 6.28,
      sp: 0.6 + rnd() * 0.8,
    });
  }
  const corpus = nodes.filter((n) => n.kind === "corpus");
  const bridges: [FieldNode, FieldNode][] = [];
  for (let i = 0; i < 150; i++) {
    const a = corpus[(rnd() * corpus.length) | 0];
    const b = corpus[(rnd() * corpus.length) | 0];
    if (!a || !b || a === b) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) < w * 0.13) bridges.push([a, b]);
  }
  return { nodes, web, bridges };
}

export function CorpusFieldCanvas({
  active,
  highlight,
}: {
  active: boolean;
  highlight: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const highlightRef = useRef(highlight);
  const stateRef = useRef({
    nodes: [] as FieldNode[],
    web: [] as WebNode[],
    bridges: [] as [FieldNode, FieldNode][],
    w: 0,
    h: 0,
    t0: 0,
    webOn: -10,
    wasActive: false,
    raf: 0,
  });

  activeRef.current = active;
  highlightRef.current = highlight;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    const init = () => {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr;
      cv.height = h * dpr;
      const ctx = cv.getContext("2d");
      if (!ctx) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const built = buildField(w, h);
      stateRef.current = {
        ...stateRef.current,
        ...built,
        w,
        h,
        t0: performance.now(),
      };
      return true;
    };

    if (!init()) return;

    const draw = () => {
      const s = stateRef.current;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !s.w) {
        s.raf = requestAnimationFrame(draw);
        return;
      }
      const t = (performance.now() - s.t0) / 1000;
      const hl = highlightRef.current;
      const isActive = activeRef.current;
      const intro = Math.min(1, t / 1.3);
      if (isActive && !s.wasActive) s.webOn = t;
      s.wasActive = isActive;

      ctx.clearRect(0, 0, s.w, s.h);
      ctx.lineWidth = 1;
      for (const [a, b] of s.bridges) {
        const fl = (0.05 + 0.03 * Math.sin(t * 0.6 + a.ph)) * intro;
        ctx.strokeStyle = `rgba(63,122,82,${fl.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const n of s.nodes) {
        const breathe = n.base + n.amp * Math.sin(t * n.sp + n.ph);
        const appearF = ease((intro - n.appear) / 0.28);
        let a = Math.max(0.04, breathe) * appearF;
        if (hl) {
          const match =
            (hl === "corpus" && n.kind === "corpus") ||
            hl === n.cl ||
            (hl === "thin" && n.kind === "thin");
          a *= match ? 1.85 : 0.3;
        }
        a = Math.min(0.92, a);
        const r = n.r * (0.6 + 0.4 * appearF);
        ctx.fillStyle =
          n.kind === "thin"
            ? `rgba(176,122,46,${a.toFixed(3)})`
            : `rgba(63,122,82,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 6.2832);
        ctx.fill();
      }

      const sinceWeb = t - s.webOn;
      for (const n of s.web) {
        const pulse = 0.5 + 0.5 * Math.sin(t * n.sp + n.ph);
        if (isActive) {
          const p = ease(sinceWeb / 0.9);
          const x = n.x0 + (n.xT - n.x0) * p;
          ctx.strokeStyle = `rgba(62,107,140,${(0.18 * p).toFixed(3)})`;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(n.x0, n.y);
          ctx.lineTo(x, n.y);
          ctx.stroke();
          ctx.fillStyle = `rgba(110,148,184,${(0.14 + 0.18 * pulse).toFixed(3)})`;
          ctx.strokeStyle = `rgba(62,107,140,${(0.35 + 0.4 * pulse).toFixed(3)})`;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, n.y, n.r + 1.5, 0, 6.2832);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const ex = Math.min(s.w - 4, n.xT + (n.x0 - n.xT) * 0.9);
          ctx.strokeStyle = `rgba(150,150,150,${((0.12 + 0.08 * pulse) * intro).toFixed(3)})`;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(ex, n.y, n.r, 0, 6.2832);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      s.raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      init();
    };
    window.addEventListener("resize", onResize);
    draw();

    return () => {
      cancelAnimationFrame(stateRef.current.raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="corpus-field"
      className="absolute inset-0 block h-full w-full"
      aria-hidden
    />
  );
}
