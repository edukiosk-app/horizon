/* Treadverse : décors virtuels (piste de 400 m, piste vallonnée, forêt).
   Aucun fond de carte à télécharger : tout est dessiné sur place avec three.js.
   Les décors fournissent un parcours ordinaire (points lat/lon/altitude) : distance,
   pente du tapis, séances et défis fonctionnent comme sur un vrai parcours. */
(function () {
  const O = { lat: 0, lon: -30 };            // origine fictive, en plein océan
  const KY = 111320, KX = 111320;            // mètres par degré à l'équateur
  const toLL = (x, y, e) => [O.lat + y / KY, O.lon + x / KX, e];
  const toXY = (p) => [(p[1] - O.lon) * KX, (p[0] - O.lat) * KY];

  /* ---------- géométrie des décors ---------- */
  const LS = 84.39, R = 36.8, C = Math.PI * R;   // piste IAAF : 2 lignes droites + 2 virages = 400 m au couloir 1
  function trackXY(s) {
    s = ((s % 400) + 400) % 400;
    if (s < LS) return [-LS / 2 + s, -R];
    s -= LS; if (s < C) { const a = -Math.PI / 2 + s / R; return [LS / 2 + R * Math.cos(a), R * Math.sin(a)]; }
    s -= C; if (s < LS) return [LS / 2 - s, R];
    s -= LS; const a = Math.PI / 2 + s / R; return [-LS / 2 + R * Math.cos(a), R * Math.sin(a)];
  }
  const bump = (s, a, len, h) => (s < a || s > a + len) ? 0 : h * (1 - Math.cos(2 * Math.PI * (s - a) / len)) / 2;
  const hillyEle = (s) => { s = ((s % 400) + 400) % 400; return bump(s, 205, 75, 2.6) + bump(s, 8, 70, 0.9); };

  function forestCurve(n) {
    const raw = [];
    for (let i = 0; i <= n; i++) {
      const th = 2 * Math.PI * i / n, r = 1 + 0.2 * Math.sin(3 * th + 0.5) + 0.1 * Math.sin(5 * th + 1.3) + 0.05 * Math.sin(9 * th);
      raw.push([1.35 * r * Math.cos(th), r * Math.sin(th)]);
    }
    return raw;
  }
  function forestPts(L) {
    const raw = forestCurve(20000); let len = 0; const cum = [0];
    for (let i = 1; i < raw.length; i++) { len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); cum.push(len); }
    const k = L / len, out = []; let j = 0;
    for (let s = 0; s <= L; s += 2) {
      const u = s / k; while (j < cum.length - 2 && cum[j + 1] < u) j++;
      const t = (u - cum[j]) / ((cum[j + 1] - cum[j]) || 1), a = raw[j], b = raw[j + 1];
      out.push([(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, s]);
    }
    return out;
  }
  const forestEle = (s, L) => { const w = 2 * Math.PI * s / L; return 40 + 16 * Math.sin(2 * w + 0.3) + 6 * Math.sin(5 * w + 1.1) + 1.5 * Math.sin(11 * w); };

  const DEFS = {
    track: { name: 'Piste de 400 m', desc: 'Le stade, tout plat. Idéal pour le fractionné : un tour = 400 m.', len: 400,
      xy: (s) => trackXY(s), ele: () => 0 },
    hilly: { name: 'Piste vallonnée', desc: 'La même piste… avec une bosse sur la ligne opposée et une petite sur la ligne droite.', len: 400,
      xy: (s) => trackXY(s), ele: hillyEle },
    forest: { name: 'Forêt, boucle de 5 km', desc: 'Un chemin entre les arbres, des montées et des descentes, un panneau à chaque kilomètre.', len: 5000 },
  };
  function routePts(k) {
    const d = DEFS[k];
    if (k === 'forest') { const fp = forestPts(5000); return fp.map(([x, y, s]) => toLL(x, y, forestEle(s, 5000))); }
    const out = []; for (let s = 0; s <= d.len; s += 1) { const [x, y] = d.xy(s); out.push(toLL(x, y, d.ele(s))); }
    return out;
  }

  /* ---------- rendu ---------- */
  function canvasTex(lines, w, h, bg, fg) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.font = `bold ${l.size}px sans-serif`; g.fillText(l.t, w / 2, h * (i + 1) / (lines.length + 1)); });
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return { tex: t, canvas: c };
  }

  function create(el, route) {
    const T = THREE, k = route.decor;
    const ren = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    ren.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); el.innerHTML = ''; el.appendChild(ren.domElement);
    ren.domElement.style.display = 'block'; ren.domElement.style.width = '100%'; ren.domElement.style.height = '100%';
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(60, 1, 0.3, 1500);
    const forest = k === 'forest';
    const skyCol = forest ? 0xb9d3c2 : 0x9cc8ee; scene.background = new T.Color(skyCol);
    scene.fog = new T.Fog(skyCol, forest ? 25 : 120, forest ? 190 : 600);
    scene.add(new T.HemisphereLight(0xffffff, 0x4a5a3a, 0.8));
    const sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(80, 140, 60); scene.add(sun);

    // trajet en mètres (x vers l'est, z vers le sud, y en hauteur)
    const P = route.pts.map((p) => { const [x, y] = toXY(p); return new T.Vector3(x, p[2], -y); });
    const D = route.dist, L = D[D.length - 1];
    function at(s, off = 0) {
      s = ((s % L) + L) % L; let lo = 0, hi = D.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= s) lo = m; else hi = m; }
      const a = P[lo], b = P[Math.min(lo + 1, P.length - 1)], t = Math.min(1, Math.max(0, (s - D[lo]) / ((D[lo + 1] - D[lo]) || 1)));
      const pos = a.clone().lerp(b, t), dir = b.clone().sub(a).setY(0).normalize();
      const nrm = new T.Vector3(-dir.z, 0, dir.x); // à droite du coureur
      return { pos: pos.add(nrm.clone().multiplyScalar(off)), dir, nrm };
    }
    // ruban le long du trajet, de l'écart o1 à o2 (o>0 : à droite), hauteur relative h(o)
    function ribbon(o1, o2, step, mat, dy = 0, hFn) {
      const pos = [], idx = []; let n = 0;
      for (let s = 0; s <= L + 0.001; s += step) {
        const A = at(s, o1), B = at(s, o2), ya = A.pos.y + dy + (hFn ? hFn(o1, s) : 0), yb = B.pos.y + dy + (hFn ? hFn(o2, s) : 0);
        pos.push(A.pos.x, ya, A.pos.z, B.pos.x, yb, B.pos.z);
        if (n) { const i = 2 * n; idx.push(i - 2, i - 1, i, i - 1, i + 1, i); }
        n++;
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, mat); scene.add(m); return m;
    }
    const lam = (c) => new T.MeshLambertMaterial({ color: c, side: T.DoubleSide });
    const signs = [];
    function sign(s, side, lines, w = 1.6, h = 1, bg = '#0f5132', fg = '#ffffff') {
      const A = at(s, side), { tex } = canvasTex(lines, 256, 160, bg, fg);
      const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.2, 6), lam(0x6b4f2a)); post.position.copy(A.pos).setY(A.pos.y + 1.1); scene.add(post);
      const board = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
      board.position.copy(A.pos).setY(A.pos.y + 2.2 + h / 2 - 0.2);
      board.lookAt(A.pos.clone().sub(A.dir.clone().multiplyScalar(30)).setY(board.position.y)); scene.add(board); signs.push(board);
    }
    function arch(s, text) {
      const w = forest ? 5 : 11, A = at(s, forest ? -w / 2 : -0.6), B = at(s, forest ? w / 2 : w - 0.6);
      [A, B].forEach((Q) => { const p = new T.Mesh(new T.BoxGeometry(0.25, 4, 0.25), lam(0xe5e7eb)); p.position.copy(Q.pos).setY(Q.pos.y + 2); scene.add(p); });
      const { tex } = canvasTex([{ t: text, size: 64 }], 512, 96, '#10b981', '#06281d');
      const ban = new T.Mesh(new T.PlaneGeometry(A.pos.distanceTo(B.pos), 0.9), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
      ban.position.copy(A.pos.clone().lerp(B.pos, 0.5)).setY(Math.max(A.pos.y, B.pos.y) + 3.6);
      ban.lookAt(ban.position.clone().sub(A.dir)); scene.add(ban);
    }

    let board = null;
    if (!forest) {
      // terrain, piste, couloirs, talus pour les bosses
      const g = new T.Mesh(new T.PlaneGeometry(700, 500), lam(0x3f7d3a)); g.rotation.x = -Math.PI / 2; g.position.y = -0.05; scene.add(g);
      const inner = new T.Mesh(new T.CircleGeometry(1, 48), lam(0x4c9a45)); scene.add(inner); inner.visible = false;
      ribbon(-0.3, 9.46, 1, lam(0xb5523b), 0);
      for (let i = 0; i <= 8; i++) { const o = -0.3 + i * 1.22; ribbon(o - 0.025, o + 0.025, 1, new T.MeshBasicMaterial({ color: 0xf8fafc, side: T.DoubleSide }), 0.012); }
      if (k === 'hilly') {
        const slope = (o, s) => { const A = at(s, 0); const e = A.pos.y; const d = o < 0 ? (-0.3 - o) : (o - 9.46); return -Math.min(e, e * d / 7); };
        ribbon(-7.3, -0.3, 1, lam(0x3f7d3a), 0, slope); ribbon(9.46, 16.46, 1, lam(0x3f7d3a), 0, slope);
        sign(196, 11, [{ t: 'CÔTE', size: 46 }, { t: '7 %', size: 58 }], 1.6, 1, '#b45309');
        sign(2, -2.2, [{ t: 'PETITE', size: 36 }, { t: 'BOSSE 3 %', size: 40 }], 1.6, 1, '#b45309');
      }
      // ligne d'arrivée, arche, tribune, projecteurs
      ribbon(-0.3, 9.46, 0.5, new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }), 0.02).geometry.setDrawRange(0, 6);
      arch(0.5, 'TREADVERSE');
      [100, 200, 300].forEach((m) => { sign(m, -1.6, [{ t: m + ' m', size: 70 }], 1.2, 0.75, '#111827', '#fbbf24');
        const A = at(m, -0.3), B = at(m, 9.46); const g = new T.BufferGeometry().setFromPoints([A.pos.clone().setY(A.pos.y + 0.02), B.pos.clone().setY(B.pos.y + 0.02)]); scene.add(new T.Line(g, new T.LineBasicMaterial({ color: 0xfbbf24 }))); });
      for (let r = 0; r < 7; r++) {
        const st = new T.Mesh(new T.BoxGeometry(80, 0.8, 1.6), lam(r % 2 ? 0x9ca3af : 0x6b7280));
        const A = at(LS / 2, 13 + r * 1.6); st.position.set(A.pos.x, 0.4 + r * 0.8, A.pos.z); scene.add(st);
        const crowd = new T.InstancedMesh(new T.BoxGeometry(0.45, 0.7, 0.45), new T.MeshLambertMaterial(), 60);
        const mtx = new T.Matrix4(), col = new T.Color();
        for (let i = 0; i < 60; i++) { if (Math.random() < 0.35) { mtx.makeScale(0, 0, 0); } else mtx.makeTranslation(A.pos.x - 39 + i * 1.3 + Math.random() * 0.3, 1.15 + r * 0.8, A.pos.z); crowd.setMatrixAt(i, mtx); crowd.setColorAt(i, col.setHSL(Math.random(), 0.6, 0.55)); }
        scene.add(crowd);
      }
      [[-LS / 2 - 50, -60], [LS / 2 + 50, -60], [-LS / 2 - 50, 60], [LS / 2 + 50, 60]].forEach(([x, z]) => {
        const p = new T.Mesh(new T.CylinderGeometry(0.3, 0.4, 30, 8), lam(0x9ca3af)); p.position.set(x, 15, z); scene.add(p);
        const l = new T.Mesh(new T.BoxGeometry(5, 3, 0.5), new T.MeshBasicMaterial({ color: 0xfef9c3 })); l.position.set(x, 30, z); l.lookAt(0, 0, 0); scene.add(l);
      });
      // tableau d'affichage au centre
      const c = canvasTex([{ t: 'TOUR 1', size: 70 }, { t: '0,00 km', size: 48 }], 512, 256, '#111827', '#fbbf24');
      board = { ...c, mesh: new T.Mesh(new T.PlaneGeometry(14, 7), new T.MeshBasicMaterial({ map: c.tex, side: T.DoubleSide })), last: '' };
      board.mesh.position.set(0, 7, 0); scene.add(board.mesh);
      const leg = new T.Mesh(new T.BoxGeometry(0.4, 3.6, 0.4), lam(0x374151)); leg.position.set(0, 1.8, 0); scene.add(leg);
    } else {
      ribbon(-45, 45, 4, lam(0x3d6b35), -0.08);
      ribbon(-1.6, 1.6, 2, lam(0x8b6b45), 0.0);
      const base = new T.Mesh(new T.PlaneGeometry(9000, 9000), lam(0x2f5a2b)); base.rotation.x = -Math.PI / 2; base.position.y = Math.min(...P.map((p) => p.y)) - 2; scene.add(base);
      // arbres en dehors du chemin
      const grid = new Map(), key = (x, z) => Math.floor(x / 10) + ',' + Math.floor(z / 10);
      P.forEach((p) => { const kk = key(p.x, p.z); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(p); });
      const near = (x, z, r) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const g = grid.get((Math.floor(x / 10) + dx) + ',' + (Math.floor(z / 10) + dz)); if (g) for (const p of g) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true; } return false; };
      const spots = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let s = 0; s < L; s += 2.2) for (const side of [-1, 1]) { const off = side * (3.2 + rnd() ** 1.6 * 40); const A = at(s + rnd() * 2, off); if (!near(A.pos.x, A.pos.z, 3)) spots.push([A.pos.x, A.pos.y, A.pos.z, 0.7 + rnd() * 0.8]); }
      const N = spots.length, trunk = new T.InstancedMesh(new T.CylinderGeometry(0.18, 0.25, 2.4, 5), lam(0x5b4026), N);
      const crown = new T.InstancedMesh(new T.ConeGeometry(1.6, 5.5, 7), new T.MeshLambertMaterial(), N), m4 = new T.Matrix4(), col = new T.Color(), q = new T.Quaternion(), sc = new T.Vector3();
      spots.forEach(([x, y, z, f], i) => {
        sc.set(f, f, f); m4.compose(new T.Vector3(x, y + 1.2 * f, z), q, sc); trunk.setMatrixAt(i, m4);
        m4.compose(new T.Vector3(x, y + (2.4 + 2.5) * f, z), q, sc); crown.setMatrixAt(i, m4); crown.setColorAt(i, col.setHSL(0.28 + rnd() * 0.08, 0.55, 0.22 + rnd() * 0.12));
      });
      scene.add(trunk, crown);
      // panneaux : départ, chaque kilomètre, côtes
      arch(0.5, 'DÉPART');
      for (let km = 1; km * 1000 < L; km++) sign(km * 1000, 2.4, [{ t: km + ' km', size: 72 }], 1.5, 0.95);
      let lastHill = -500;
      for (let s = 0; s < L; s += 20) {
        const g = (at(s + 120).pos.y - at(s + 20).pos.y);
        if (g >= 5 && s - lastHill > 400) { lastHill = s; sign(s, -2.4, [{ t: 'CÔTE', size: 46 }, { t: Math.round(g) + ' %', size: 58 }], 1.4, 0.95, '#b45309'); }
      }
    }

    // les deux coureurs et la médaille
    // coureurs en 3D : tête, buste, bras et jambes qui se balancent selon la vitesse
    function runner(shirt) {
      const g = new T.Group(), skin = lam(0xd6a37c), sh = new T.MeshLambertMaterial({ color: shirt, emissive: shirt, emissiveIntensity: 0.25 }), dark = lam(0x1f2937), shoe = lam(0xf8fafc);
      const limb = (len, r, mat) => { const piv = new T.Group(), m = new T.Mesh(new T.CylinderGeometry(r, r * 0.85, len, 8), mat); m.position.y = -len / 2; piv.add(m); return piv; };
      const body = new T.Group(); g.add(body);
      const torso = new T.Mesh(new T.CylinderGeometry(0.19, 0.15, 0.6, 10), sh); torso.position.y = 1.18; body.add(torso);
      const head = new T.Mesh(new T.SphereGeometry(0.13, 14, 10), skin); head.position.y = 1.62; body.add(head);
      const parts = {};
      [['l', -1], ['r', 1]].forEach(([n, sd]) => {
        const thigh = limb(0.44, 0.075, dark); thigh.position.set(0.1 * sd, 0.9, 0); body.add(thigh);
        const shin = limb(0.44, 0.06, skin); shin.position.y = -0.44; thigh.add(shin);
        const foot = new T.Mesh(new T.BoxGeometry(0.1, 0.06, 0.24), shoe); foot.position.set(0, -0.46, 0.06); shin.add(foot);
        const arm = limb(0.3, 0.05, sh); arm.position.set(0.24 * sd, 1.42, 0); body.add(arm);
        const fore = limb(0.28, 0.045, skin); fore.position.y = -0.3; arm.add(fore);
        parts[n] = { thigh, shin, arm, fore };
      });
      g.userData = { parts, body, phase: 0 }; scene.add(g); return g;
    }
    function animate(fig, v, dt) {
      const u = fig.userData; if (v > 0.3) u.phase += dt * (2.2 + v * 0.42) * Math.PI; // cadence qui suit la vitesse
      const a = Math.min(1, v / 3.5), ph = u.phase, sw = Math.sin(ph);
      u.parts.l.thigh.rotation.x = 0.75 * a * sw; u.parts.r.thigh.rotation.x = -0.75 * a * sw;
      u.parts.l.shin.rotation.x = 0.25 + 1.1 * a * Math.max(0, -Math.sin(ph - 0.6)); u.parts.r.shin.rotation.x = 0.25 + 1.1 * a * Math.max(0, Math.sin(ph - 0.6));
      if (v <= 0.3) { u.parts.l.thigh.rotation.x = u.parts.r.thigh.rotation.x = 0; u.parts.l.shin.rotation.x = u.parts.r.shin.rotation.x = 0; }
      u.parts.l.arm.rotation.x = -0.7 * a * sw; u.parts.r.arm.rotation.x = 0.7 * a * sw; u.parts.l.fore.rotation.x = u.parts.r.fore.rotation.x = -1.2 * Math.max(0.2, a);
      u.body.position.y = v > 0.3 ? 0.05 * Math.abs(Math.cos(ph)) : 0; u.body.rotation.x = 0.12 * a;
    }
    // point lumineux (par défaut) : boule, anneau blanc, halo au sol qui pulse
    function dot(c) {
      const g = new T.Group();
      const ball = new T.Mesh(new T.SphereGeometry(0.42, 24, 16), new T.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.55 })); ball.position.y = 0.75;
      const ring = new T.Mesh(new T.TorusGeometry(0.47, 0.06, 10, 32), new T.MeshBasicMaterial({ color: 0xffffff })); ring.position.y = 0.75; ring.rotation.x = Math.PI / 2;
      const halo = new T.Mesh(new T.CircleGeometry(0.9, 32), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03;
      const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.33, 6), new T.MeshBasicMaterial({ color: c })); stem.position.y = 0.2;
      g.add(ball, ring, halo, stem); g.userData = { dot: true, halo, ball }; scene.add(g); return g;
    }
    const FIG = (() => { try { return localStorage.getItem('vrFigures') === '1'; } catch (e) { return false; } })();
    const me = FIG ? runner(0xfb923c) : dot(0xfb923c), ref = FIG ? runner(0x3b82f6) : dot(0x3b82f6); ref.visible = false;
    const pulse = (o, t) => { if (!o.userData.dot) return; const k = 1 + 0.18 * Math.sin(t / 260); o.userData.halo.scale.set(k, k, k); };
    const medal = new T.Group(); { const d = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.09, 24), new T.MeshLambertMaterial({ color: 0xfbbf24, emissive: 0x8a5a00, emissiveIntensity: 0.5 })); d.rotation.x = Math.PI / 2; medal.add(d); } medal.visible = false; scene.add(medal);
    const laneMe = forest ? -0.6 : 0, laneRef = forest ? 0.6 : 1.22;

    const S = { me: { x: 0, v: 0, t: 0, init: false }, ref: { x: null, v: 0, t: 0 }, lead: null, view: 'follow', alive: true, raf: 0, el, ren };
    function track(o, x) { const now = performance.now(); if (x == null) { o.x = null; return; }
      if (o.x == null || !o.init) { o.x = x; o.v = 0; o.t = now; o.init = true; return; }
      let dx = x - o.x; if (dx < -L / 2) dx += L; if (dx > L / 2) dx -= L; const dt = (now - o.t) / 1000;
      o.v = dt > 0.2 ? Math.max(0, Math.min(12, dx / dt)) : o.v; o.x = x; o.t = now; }
    const shown = (o) => { if (o.x == null) return null; const dt = Math.min(1.4, (performance.now() - o.t) / 1000); return o.x + o.v * dt; };
    let camPos = null;
    function frame() {
      if (!S.alive) return; S.raf = requestAnimationFrame(frame);
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h || el.offsetParent === null) return;
      if (ren.domElement.width !== Math.round(w * ren.getPixelRatio())) { ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      const nowT = performance.now(), fdt = Math.min(0.1, (nowT - (S.lastF || nowT)) / 1000); S.lastF = nowT;
      const xm = shown(S.me) ?? 0, A = at(xm, laneMe); me.position.copy(A.pos); me.rotation.y = Math.atan2(A.dir.x, A.dir.z); if (FIG) animate(me, S.me.v, fdt); else pulse(me, nowT);
      const xr = shown(S.ref); if (xr != null) { const B = at(xr, laneRef); ref.position.copy(B.pos); ref.rotation.y = Math.atan2(B.dir.x, B.dir.z); if (FIG) animate(ref, S.ref.v, fdt); else pulse(ref, nowT); ref.visible = true; } else ref.visible = false;
      const lead = S.lead === 'me' ? me : S.lead === 'ref' && ref.visible ? ref : null; medal.visible = !!lead;
      if (lead) { medal.position.copy(lead.position).setY(lead.position.y + (FIG ? 2.15 : 1.65) + 0.08 * Math.sin(performance.now() / 300)); medal.rotation.y += 0.04; }
      let want, look;
      if (S.view === 'top') { const c = forest ? A.pos : new T.Vector3(0, 0, 0); want = c.clone().add(new T.Vector3(0, forest ? 120 : 150, forest ? 40 : 60)); look = c.clone(); }
      else { const back = at(xm - 9, laneMe), fwd = at(xm + 7, laneMe); want = back.pos.clone().setY(Math.max(back.pos.y, A.pos.y) + 3.4); look = fwd.pos.clone().setY(fwd.pos.y + 1.0); }
      camPos = camPos ? camPos.lerp(want, 0.12) : want.clone(); cam.position.copy(camPos); cam.lookAt(look);
      if (board) { const lap = Math.floor((S.lapDist || 0) / 400) + 1, txt = 'TOUR ' + lap + '|' + ((S.lapDist || 0) / 1000).toFixed(2).replace('.', ',') + ' km';
        if (txt !== board.last) { board.last = txt; const g = board.canvas.getContext('2d'); g.fillStyle = '#111827'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#fbbf24'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = 'bold 70px sans-serif'; g.fillText('TOUR ' + lap, 256, 90); g.font = 'bold 48px sans-serif'; g.fillText(txt.split('|')[1], 256, 180); board.tex.needsUpdate = true; }
        board.mesh.lookAt(cam.position.x, board.mesh.position.y, cam.position.z); }
      ren.render(scene, cam);
    }
    frame();
    return {
      route, decor: k,
      place(x, gx, total) { track(S.me, x); track(S.ref, gx); S.lapDist = total; },
      setLeader(l) { S.lead = l; },
      toggleView() { S.view = S.view === 'follow' ? 'top' : 'follow'; return S.view; },
      resize() { camPos = null; },
      remove() { S.alive = false; cancelAnimationFrame(S.raf); try { ren.dispose(); ren.forceContextLoss(); } catch (e) {} el.innerHTML = ''; },
    };
  }

  window.VR = { DEFS, routePts, create };
})();
