
class Component extends DCLogic {
  state = { query: '', submitted: false, primerOpen: undefined, focused: false, phIdx: 0, highlight: null };

  renderVals() {
    const q = this.state.query || '';
    const submitted = !!this.state.submitted;
    const isActive = q.trim().length > 0 || submitted;
    const webLane = this.props.webLane ?? 'demonstrate';
    const firstRun = this.props.firstRun ?? true;
    const primerOpen = this.state.primerOpen === undefined ? firstRun : this.state.primerOpen;
    const PH = [
      'a mode, a gap, a network, a decision…',
      'which transport mode should we back?',
      'where are we thinnest vs the national picture?',
      'who should we convene — and who is missing?',
      'is this gap real, or are we just not seeing it?',
    ];
    const mk = (text, hl) => ({
      q: text, hl,
      onClick: () => this.setState({ query: text, submitted: false }),
      onEnter: () => this.setState({ highlight: hl }),
      onLeave: () => this.setState({ highlight: null }),
    });
    return {
      query: q,
      placeholder: PH[this.state.phIdx % PH.length],
      onInput: (e) => this.setState({ query: e.target.value, submitted: false }),
      onKeyDown: (e) => { if (e.key === 'Enter' && (this.state.query || '').trim()) this.setState({ submitted: true }); },
      onFocus: () => this.setState({ focused: true }),
      onBlur: () => this.setState({ focused: false }),
      submit: () => { if ((this.state.query || '').trim()) this.setState({ submitted: true }); },
      reset: () => this.setState({ query: '', submitted: false }),
      isRest: !isActive,
      isActive,
      isSubmitted: submitted,
      notSubmitted: !submitted,
      isWebColumn: webLane !== 'line',
      isWebLine: webLane === 'line',
      primerOpen,
      primerClosed: !primerOpen,
      openPrimer: () => this.setState({ primerOpen: true }),
      closePrimer: () => this.setState({ primerOpen: false }),
      starters: [
        mk('Which transport mode should we prioritise for decarbonisation?', 'corpus'),
        mk('Where is our funding thinnest against the national picture?', 'thin'),
        mk('Who should we convene on maritime — and who is missing?', 'maritime'),
      ],
    };
  }

  componentDidMount() {
    this._tries = 0;
    this._raf = null;
    this._wasActive = false;
    this._webOn = -10;
    this._initField();
    this._phTimer = setInterval(() => {
      if (this.state.focused || (this.state.query || '').trim()) return;
      this.setState(s => ({ phIdx: (s.phIdx + 1) }));
    }, 2900);
  }

  _rng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  _build(w, h) {
    const rnd = this._rng(20260622);
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
    const clusters = [
      { key: 'highways', cx: 0.80, cy: 0.52, sx: 0.16, sy: 0.20, n: 96, kind: 'corpus', smin: 1.4, smax: 5.2 },
      { key: 'maritime', cx: 0.66, cy: 0.68, sx: 0.10, sy: 0.12, n: 54, kind: 'corpus', smin: 1.4, smax: 4.6 },
      { key: 'rail',     cx: 0.93, cy: 0.34, sx: 0.07, sy: 0.10, n: 60, kind: 'corpus', smin: 1.0, smax: 2.4 },
      { key: 'data',     cx: 1.00, cy: 0.74, sx: 0.13, sy: 0.16, n: 70, kind: 'corpus', smin: 1.6, smax: 5.0 },
      { key: 'thin',     cx: 0.60, cy: 0.20, sx: 0.08, sy: 0.07, n: 22, kind: 'thin',   smin: 1.2, smax: 3.0 },
    ];
    const nodes = [];
    clusters.forEach(c => {
      for (let i = 0; i < c.n; i++) {
        const x = (c.cx + gauss() * c.sx) * w;
        const y = (c.cy + gauss() * c.sy) * h;
        const r = c.smin + rnd() * (c.smax - c.smin);
        nodes.push({ x, y, r, kind: c.kind, cl: c.key, base: 0.22 + rnd() * 0.22, amp: 0.10 + rnd() * 0.14, ph: rnd() * 6.28, sp: 0.5 + rnd() * 0.9, appear: Math.min(1, (c.cx + gauss() * c.sx)) * 0.66 + rnd() * 0.18 });
      }
    });
    const web = [];
    for (let i = 0; i < 9; i++) {
      const y = (0.30 + rnd() * 0.5) * h;
      web.push({ y, x0: (1.06 + rnd() * 0.06) * w, xT: (0.74 + rnd() * 0.20) * w, r: 2.6 + rnd() * 3.4, ph: rnd() * 6.28, sp: 0.6 + rnd() * 0.8 });
    }
    const corpus = nodes.filter(n => n.kind === 'corpus');
    const bridges = [];
    for (let i = 0; i < 150; i++) {
      const a = corpus[(rnd() * corpus.length) | 0];
      const b = corpus[(rnd() * corpus.length) | 0];
      if (!a || !b || a === b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < w * 0.13) bridges.push([a, b]);
    }
    this._nodes = nodes; this._web = web; this._bridges = bridges;
  }

  _initField() {
    if (typeof window === 'undefined') return;
    const cv = document.getElementById('corpus-field');
    if (!cv || cv.clientWidth === 0) {
      if (this._tries++ > 120) return;
      setTimeout(() => this._initField(), 60);
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._cv = cv; this._ctx = ctx; this._w = w; this._h = h;
    this._build(w, h);
    this._t0 = performance.now();
    this._onResize = () => { this._tries = 0; if (this._raf) cancelAnimationFrame(this._raf); this._initField(); };
    window.addEventListener('resize', this._onResize);
    if (this._raf) cancelAnimationFrame(this._raf);
    this._draw();
  }

  _ease(p) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3); }

  _draw() {
    const w = this._w, h = this._h;
    // self-heal: the framework can swap the <canvas> node on re-render — rebind if so
    const live = (typeof document !== 'undefined') ? document.getElementById('corpus-field') : null;
    if (!live || !w) { this._raf = requestAnimationFrame(() => this._draw()); return; }
    if (live !== this._cv) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      live.width = w * dpr; live.height = h * dpr;
      const c = live.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._cv = live; this._ctx = c;
    }
    const ctx = this._ctx;
    if (!ctx) { this._raf = requestAnimationFrame(() => this._draw()); return; }
    const t = (performance.now() - this._t0) / 1000;
    const active = (this.state.query || '').trim().length > 0 || this.state.submitted;
    const hl = this.state.highlight;
    // intro calibration sweep (left -> right), ~1.3s, once
    const intro = Math.min(1, t / 1.3);
    // mark when web activates, to time the stream-in
    if (active && !this._wasActive) this._webOn = t;
    this._wasActive = active;

    ctx.clearRect(0, 0, w, h);

    // bridges (fade in with intro)
    ctx.lineWidth = 1;
    for (const [a, b] of this._bridges) {
      const fl = (0.05 + 0.03 * Math.sin(t * 0.6 + a.ph)) * intro;
      ctx.strokeStyle = 'rgba(63,122,82,' + fl.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // corpus + thin nodes
    for (const n of this._nodes) {
      const breathe = n.base + n.amp * Math.sin(t * n.sp + n.ph);
      const appearF = this._ease((intro - n.appear) / 0.28);
      let a = Math.max(0.04, breathe) * appearF;
      if (hl) {
        const match = (hl === 'corpus' && n.kind === 'corpus') || (hl === n.cl) || (hl === 'thin' && n.kind === 'thin');
        a *= match ? 1.85 : 0.30;
      }
      a = Math.min(0.92, a);
      const r = n.r * (0.6 + 0.4 * appearF);
      ctx.fillStyle = (n.kind === 'thin') ? 'rgba(176,122,46,' + a.toFixed(3) + ')' : 'rgba(63,122,82,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
    }

    // web nodes — dormant ticks at rest; stream in from off-frame when active
    const sinceWeb = t - this._webOn;
    for (const n of this._web) {
      const pulse = 0.5 + 0.5 * Math.sin(t * n.sp + n.ph);
      if (active) {
        const p = this._ease(sinceWeb / 0.9);
        const x = n.x0 + (n.xT - n.x0) * p;
        // arriving trail
        ctx.strokeStyle = 'rgba(62,107,140,' + (0.18 * p).toFixed(3) + ')';
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(n.x0, n.y); ctx.lineTo(x, n.y); ctx.stroke();
        // node
        const a = 0.35 + 0.4 * pulse;
        ctx.fillStyle = 'rgba(110,148,184,' + (0.14 + 0.18 * pulse).toFixed(3) + ')';
        ctx.strokeStyle = 'rgba(62,107,140,' + a.toFixed(3) + ')';
        ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, n.y, n.r + 1.5, 0, 6.2832); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // faint dormant marker near the right edge
        const ex = Math.min(w - 4, n.xT + (n.x0 - n.xT) * 0.9);
        ctx.strokeStyle = 'rgba(150,150,150,' + ((0.12 + 0.08 * pulse) * intro).toFixed(3) + ')';
        ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(ex, n.y, n.r, 0, 6.2832); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    this._raf = requestAnimationFrame(() => this._draw());
  }

  componentWillUnmount() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._phTimer) clearInterval(this._phTimer);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }
}
