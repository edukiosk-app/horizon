/* Treadverse : décors virtuels (piste, piste vallonnée, forêt, bord de mer, montagne, lac).
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

  const CURVES = {
    forest: (th) => { const r = 1 + 0.2 * Math.sin(3 * th + 0.5) + 0.1 * Math.sin(5 * th + 1.3) + 0.05 * Math.sin(9 * th); return [1.35 * r * Math.cos(th), r * Math.sin(th)]; },
    sea: (th) => [20 * Math.cos(th) + 0.25 * Math.sin(3 * th), 0.32 * Math.sin(th) + 0.05 * Math.sin(5 * th)],
    mountain: (th) => { const r = 1 + 0.22 * Math.sin(2 * th + 0.4) + 0.12 * Math.sin(7 * th) + 0.05 * Math.sin(13 * th); return [1.2 * r * Math.cos(th), r * Math.sin(th)]; },
    lake: (th) => { const r = 1 + 0.08 * Math.sin(3 * th + 0.3) + 0.05 * Math.sin(5 * th + 1); return [1.15 * r * Math.cos(th), r * Math.sin(th)]; },
    scifi: (th) => { const r = 1 + 0.12 * Math.sin(2 * th) + 0.06 * Math.sin(5 * th + 0.7); return [2.2 * r * Math.cos(th), r * Math.sin(th)]; },
    jungle: (th) => { const r = 1 + 0.18 * Math.sin(3 * th + 1.1) + 0.09 * Math.sin(7 * th + 0.4); return [1.3 * r * Math.cos(th), r * Math.sin(th)]; },
    egypt: (th) => { const r = 1 + 0.1 * Math.sin(2 * th + 0.3) + 0.06 * Math.sin(5 * th + 1.2); return [1.5 * r * Math.cos(th), r * Math.sin(th)]; },
    vegas: (th) => [2.6 * Math.cos(th) + 0.15 * Math.sin(2 * th), 0.42 * Math.sin(th)],
    wall: (th) => { const r = 1 + 0.2 * Math.sin(3 * th + 0.8) + 0.1 * Math.sin(5 * th + 0.2) + 0.05 * Math.sin(9 * th + 1.5); return [1.3 * r * Math.cos(th), r * Math.sin(th)]; },
    bridge: (th) => { const r = 1 + 0.14 * Math.sin(3 * th + 0.4) + 0.07 * Math.sin(6 * th + 1.7); return [1.4 * r * Math.cos(th), r * Math.sin(th)]; },
    halloween: (th) => { const r = 1 + 0.16 * Math.sin(4 * th + 0.9) + 0.08 * Math.sin(7 * th + 2.1) + 0.04 * Math.sin(11 * th); return [1.25 * r * Math.cos(th), r * Math.sin(th)]; },
  };
  function loopPts(curve, L) {
    const raw = []; for (let i = 0; i <= 20000; i++) raw.push(curve(2 * Math.PI * i / 20000));
    let len = 0; const cum = [0];
    for (let i = 1; i < raw.length; i++) { len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); cum.push(len); }
    const k = L / len, out = []; let j = 0;
    for (let s = 0; s <= L; s += 2) {
      const u = s / k; while (j < cum.length - 2 && cum[j + 1] < u) j++;
      const t = (u - cum[j]) / ((cum[j + 1] - cum[j]) || 1), a = raw[j], b = raw[j + 1];
      out.push([(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k, s]);
    }
    return out;
  }
  const W = (s, L) => 2 * Math.PI * s / L;
  const ELE = {
    forest: (s, L) => { const w = W(s, L); return 40 + 16 * Math.sin(2 * w + 0.3) + 6 * Math.sin(5 * w + 1.1) + 1.5 * Math.sin(11 * w); },
    sea: (s, L) => { const w = W(s, L); return 1.2 + 0.4 * Math.sin(4 * w); },
    mountain: (s, L) => { const w = W(s, L); return 300 + 60 * (1 - Math.cos(w)) + 7 * Math.sin(6 * w) + 3 * Math.sin(13 * w); },
    lake: (s, L) => { const w = W(s, L); return 5 + 1.5 * Math.sin(3 * w) + 0.8 * Math.sin(7 * w); },
    scifi: (s, L) => { const w = W(s, L); return 12 + 4 * Math.sin(2 * w + 0.5) + 1.5 * Math.sin(5 * w); },
    jungle: (s, L) => { const w = W(s, L); return 20 + 9 * Math.sin(2 * w + 0.2) + 3.5 * Math.sin(6 * w + 1) + 1 * Math.sin(13 * w); },
    egypt: (s, L) => { const w = W(s, L); return 8 + 2.5 * Math.sin(3 * w + 0.4) + 1 * Math.sin(7 * w); },
    vegas: (s, L) => { const w = W(s, L); return 2 + 0.6 * Math.sin(2 * w); },
    wall: (s, L) => { const w = W(s, L); return 160 + 22 * Math.sin(2 * w + 0.5) + 9 * Math.sin(5 * w + 1.3) + 3 * Math.sin(11 * w + 0.2); },
    bridge: (s, L) => { const w = W(s, L); return 60 + 7 * Math.sin(2 * w + 0.6) + 2.5 * Math.sin(5 * w + 1.4); },
    halloween: (s, L) => { const w = W(s, L); return 15 + 6 * Math.sin(2 * w + 1.2) + 2.5 * Math.sin(5 * w + 0.3) + 0.8 * Math.sin(12 * w); },
  };

  const DEFS = {
    track: { name: 'Piste de 400 m', desc: 'Le stade et ses couloirs. Un tour = 400 m, idéal pour le fractionné.', len: 400,
      xy: (s) => trackXY(s), ele: () => 0 },
    hilly: { name: 'Piste vallonnée', desc: 'La même piste, avec une bosse.', len: 400,
      xy: (s) => trackXY(s), ele: hillyEle },
    forest: { name: 'Forêt', desc: 'Un chemin entre les arbres, un panneau à chaque kilomètre.', len: 5000, loop: true },
    sea: { name: 'Bord de mer', desc: 'Une promenade le long de la plage, palmiers et coucher de soleil.', len: 5000, loop: true },
    mountain: { name: 'Montagne', desc: 'Des lacets face aux sommets enneigés.', len: 6000, loop: true },
    scifi: { name: 'Ville du futur', desc: 'Une piste suspendue entre les tours de néon, sous une planète à anneaux. Arches lumineuses à traverser.', len: 4000, loop: true },
    jungle: { name: 'Jungle préhistorique', desc: 'Un sentier entre les fougères géantes, des dinosaures au loin et un volcan qui fume.', len: 5000, loop: true },
    lake: { name: 'Tour du lac', desc: 'Une boucle autour d\'un lac, avec un ponton et des arbres.', len: 3000, loop: true },
    egypt: { name: 'Pyramides', desc: 'Une piste dans le désert, face aux grandes pyramides et au sphinx, entre dunes, oasis et chameaux.', len: 5000, loop: true },
    vegas: { name: 'Las Vegas', desc: 'Une grande avenue la nuit, entre les hôtels illuminés, les néons, les palmiers et les fontaines.', len: 5000, loop: true },
    wall: { name: 'Grande Muraille', desc: 'Le chemin de ronde de la Grande Muraille, de tour de guet en tour de guet, sur les crêtes au-dessus de la brume.', len: 5000, loop: true },
    bridge: { name: 'Pont du gouffre', desc: 'Un pont de pierre suspendu au-dessus d\'un gouffre, dans la brume. Le décor de Collapse Run.', len: 5000, loop: true },
    halloween: { name: 'Forêt hantée', desc: 'Halloween : une forêt la nuit sous la pleine lune, citrouilles, tombes, chauves-souris et fantômes.', len: 5000, loop: true },
  };
  function routePts(k) {
    const d = DEFS[k];
    if (d.loop) { const fp = loopPts(CURVES[k], d.len); return fp.map(([x, y, s]) => toLL(x, y, ELE[k](s, d.len))); }
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
    const HQ = (() => { try { return localStorage.getItem('vrHQ') === '1'; } catch (e) { return false; } })();
    const ren = new T.WebGLRenderer({ antialias: HQ, powerPreference: HQ ? 'high-performance' : 'low-power' });
    ren.setPixelRatio(Math.min(HQ ? 1.5 : 1, window.devicePixelRatio || 1)); el.innerHTML = ''; el.appendChild(ren.domElement);
    ren.domElement.style.display = 'block'; ren.domElement.style.width = '100%'; ren.domElement.style.height = '100%';
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(60, 1, 0.3, 1500);
    const nature = k !== 'track' && k !== 'hilly', forest = nature;
    const TH = {
      track: { sky: [0x3b82c4, 0xbcd8ef, 0xe8eef2], fog: [0xd4e3ee, 150, 700], sun: [-0.5, 0.55, -0.65], sunC: 0xfff1d6, sunI: 1.0, hemi: [0xcfe3ff, 0x4f6b3a, 0.75] },
      forest: { sky: [0x5b8fbf, 0xc9dbe2, 0xdfe8e0], fog: [0xbfd3c9, 30, 230], sun: [0.35, 0.45, -0.8], sunC: 0xffe8c2, sunI: 1.05, hemi: [0xd7e8ff, 0x3a4a2a, 0.65] },
      sea: { sky: [0x40507a, 0xf0a36b, 0xffd59a], fog: [0xf4b98a, 160, 1200], sun: [-0.2, 0.12, 0.95], sunC: 0xffc48a, sunI: 1.1, hemi: [0xffd2b0, 0x6b5a4a, 0.7] },
      mountain: { sky: [0x2f6fb5, 0xa9cdea, 0xe2edf5], fog: [0xcfe0ee, 220, 1450], sun: [0.4, 0.6, -0.6], sunC: 0xfff4e0, sunI: 1.05, hemi: [0xdbeaff, 0x5a5a48, 0.7] },
      scifi: { sky: [0x0b0730, 0x3a1a6e, 0xc2367a], fog: [0x2a1250, 60, 650], sun: [0.3, 0.5, -0.8], sunC: 0xffb3f0, sunI: 0.5, hemi: [0x8a7dff, 0x200a30, 0.6] },
      jungle: { sky: [0x7a9bb0, 0xe7c59a, 0xf3d7b0], fog: [0xd9c3a0, 40, 420], sun: [-0.3, 0.35, -0.9], sunC: 0xffd9a8, sunI: 1.05, hemi: [0xe8f0d8, 0x4a4a2a, 0.65] },
      lake: { sky: [0x4a86c5, 0xbcd6ea, 0xe6eef0], fog: [0xd3e1ea, 140, 900], sun: [-0.4, 0.5, -0.7], sunC: 0xfff1d6, sunI: 1.0, hemi: [0xd7e8ff, 0x46603a, 0.7] },
      egypt: { sky: [0x3b6fb2, 0xf3c98d, 0xffdca3], fog: [0xf1d3a2, 300, 2800], sun: [-0.5, 0.22, -0.8], sunC: 0xffc070, sunI: 1.15, hemi: [0xffe6c0, 0x8a6a40, 0.75] },
      vegas: { sky: [0x05061c, 0x1d1248, 0x6a2a6a], fog: [0x1a1038, 70, 800], sun: [0.3, 0.5, -0.8], sunC: 0xffc0f0, sunI: 0.45, hemi: [0x9a8aff, 0x301020, 0.8] },
      wall: { sky: [0x3f7cc0, 0xbcd5ea, 0xe8eff3], fog: [0xcbdbe6, 140, 1500], sun: [0.45, 0.55, -0.7], sunC: 0xfff3dc, sunI: 1.05, hemi: [0xdbeaff, 0x4c5a3a, 0.75] },
      bridge: { sky: [0x3b4a66, 0x8d9db4, 0xb9c3cf], fog: [0x9aa6b6, 40, 380], sun: [0.4, 0.5, -0.75], sunC: 0xfff0dc, sunI: 0.95, hemi: [0xdfe8ff, 0x3a3a44, 0.8] },
      halloween: { sky: [0x0b0a26, 0x2e1c48, 0x6a2c4a], fog: [0x2a1c44, 28, 260], sun: [0.25, 0.45, -0.85], sunC: 0xdfe6ff, sunI: 0.9, hemi: [0x9a8ad0, 0x2a1c10, 0.95] },
    }[k === 'hilly' ? 'track' : k] || {};
    scene.background = new T.Color(TH.fog[0]); scene.fog = new T.Fog(TH.fog[0], TH.fog[1], TH.fog[2]);
    { const sd = new T.Vector3(...TH.sun).normalize(), g = new T.SphereGeometry(1400, 32, 16), p = g.attributes.position, col = [];
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 1400; const c = y > 0.12 ? new T.Color(TH.sky[1]).lerp(new T.Color(TH.sky[0]), Math.min(1, (y - 0.12) / 0.7)) : new T.Color(TH.sky[2]).lerp(new T.Color(TH.sky[1]), Math.max(0, Math.min(1, (y + 0.05) / 0.17)));
        const d = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize().dot(sd); if (d > 0.93) c.lerp(new T.Color(TH.sunC), Math.pow((d - 0.93) / 0.07, 2.5)); col.push(c.r, c.g, c.b); }
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); const skyM = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); skyM.renderOrder = -1; scene.add(skyM); var SKY = skyM; }
    scene.add(new T.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2]));
    const sunDir = new T.Vector3(...TH.sun).normalize();
    const sun = new T.DirectionalLight(TH.sunC, TH.sunI); sun.castShadow = HQ && k !== 'scifi'; sun.shadow.mapSize.set(1024, 1024);
    { const c = sun.shadow.camera; c.left = -35; c.right = 35; c.top = 35; c.bottom = -35; c.near = 1; c.far = 400; } sun.shadow.bias = -0.0006; scene.add(sun, sun.target);
    ren.shadowMap.enabled = sun.castShadow; ren.shadowMap.type = T.PCFShadowMap; cam.far = k === 'mountain' || k === 'egypt' ? 3200 : 1500; cam.updateProjectionMatrix();

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
      const m = new T.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
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
      const w = nature ? 5.4 : 11, A = at(s, nature ? -w / 2 : -0.6), B = at(s, nature ? w / 2 : w - 0.6);
      [A, B].forEach((Q) => { const p = new T.Mesh(new T.BoxGeometry(0.25, 4, 0.25), lam(0xe5e7eb)); p.position.copy(Q.pos).setY(Q.pos.y + 2); scene.add(p); });
      const { tex } = canvasTex([{ t: text, size: 64 }], 512, 96, '#10b981', '#06281d');
      const ban = new T.Mesh(new T.PlaneGeometry(A.pos.distanceTo(B.pos), 0.9), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
      ban.position.copy(A.pos.clone().lerp(B.pos, 0.5)).setY(Math.max(A.pos.y, B.pos.y) + 3.6);
      ban.lookAt(ban.position.clone().sub(A.dir)); scene.add(ban);
    }

    let board = null, S_waves = null, BRIDGE = null; const ANIM = [];
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
    } else if (k === 'scifi') {
      let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const minY = Math.min(...P.map((p) => p.y));
      const grid = new T.GridHelper(6000, 100, 0xff2fd0, 0x6a1fff); grid.position.y = minY - 28; scene.add(grid);
      ribbon(-3, 3, 3, new T.MeshLambertMaterial({ color: 0x1b1f36, side: T.DoubleSide }), 0);
      ribbon(-3.2, -2.9, 2, new T.MeshBasicMaterial({ color: 0x22f0ff, side: T.DoubleSide }), 0.06); ribbon(2.9, 3.2, 2, new T.MeshBasicMaterial({ color: 0x22f0ff, side: T.DoubleSide }), 0.06);
      ribbon(-0.05, 0.05, 2, new T.MeshBasicMaterial({ color: 0xff2fd0, side: T.DoubleSide }), 0.02);
            const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1, 1, 1), e = new T.Euler(), col = new T.Color();
      const na = Math.floor(L / 45), arcs = new T.InstancedMesh(new T.TorusGeometry(4.6, 0.12, 8, 40, Math.PI), new T.MeshBasicMaterial(), na);
      for (let i = 0; i < na; i++) { const A = at(i * 45 + 12); q.setFromEuler(e.set(0, Math.atan2(A.dir.x, A.dir.z), 0)); m4.compose(A.pos, q, sc); arcs.setMatrixAt(i, m4); arcs.setColorAt(i, col.set(i % 2 ? 0x22f0ff : 0xff2fd0)); } scene.add(arcs);
      // piliers sous la piste
      const np = Math.floor(L / 60), pil = new T.InstancedMesh(new T.CylinderGeometry(0.5, 0.8, 1, 8), new T.MeshLambertMaterial({ color: 0x23203a }), np);
      for (let i = 0; i < np; i++) { const A = at(i * 60); const h = A.pos.y - (minY - 28); m4.compose(new T.Vector3(A.pos.x, minY - 28 + h / 2, A.pos.z), new T.Quaternion(), new T.Vector3(1, h, 1)); pil.setMatrixAt(i, m4); } scene.add(pil);
      // tours avec bandes de néon
      const gridP = new Map(), key = (x, z) => Math.floor(x / 20) + ',' + Math.floor(z / 20); P.forEach((p) => { const kk = key(p.x, p.z); if (!gridP.has(kk)) gridP.set(kk, []); gridP.get(kk).push(p); });
      const near = (x, z, r) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const g = gridP.get((Math.floor(x / 20) + dx) + ',' + (Math.floor(z / 20) + dz)); if (g) for (const p of g) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true; } return false; };
      const B = []; for (let s2 = 0; s2 < L; s2 += 26) for (const side of [-1, 1]) { if (rnd() < 0.3) continue; const off = side * (14 + rnd() ** 1.5 * 120), A = at(s2, off); if (near(A.pos.x, A.pos.z, 12)) continue; B.push([A.pos.x, A.pos.z, 30 + rnd() * 170, 8 + rnd() * 16]); }
      const tw = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: 0x14122a, emissive: 0x0a0820 }), B.length), nb = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), B.length);
      const NEON = [0x22f0ff, 0xff2fd0, 0xffe14d, 0x7c5cff];
      B.forEach(([x, z, h, w], i) => { const y0 = minY - 28; m4.compose(new T.Vector3(x, y0 + h / 2, z), new T.Quaternion(), new T.Vector3(w, h, w)); tw.setMatrixAt(i, m4);
        m4.compose(new T.Vector3(x, y0 + h * (0.35 + rnd() * 0.6), z), new T.Quaternion(), new T.Vector3(w + 0.4, 0.9, w + 0.4)); nb.setMatrixAt(i, m4); nb.setColorAt(i, col.set(NEON[Math.floor(rnd() * 4)])); });
      scene.add(tw, nb);
      // planète à anneaux et vaisseaux
      const cx = P.reduce((a, p) => a + p.x, 0) / P.length, cz = P.reduce((a, p) => a + p.z, 0) / P.length;
      const planet = new T.Mesh(new T.SphereGeometry(160, 40, 30), new T.MeshBasicMaterial({ color: 0xff9a5a, fog: false })); planet.position.set(cx - 500, 360, cz - 1150); scene.add(planet);
      const ring = new T.Mesh(new T.TorusGeometry(260, 9, 8, 80), new T.MeshBasicMaterial({ color: 0xffd0a8, fog: false, transparent: true, opacity: 0.7 })); ring.position.copy(planet.position); ring.rotation.set(1.2, 0.3, 0.2); scene.add(ring);
      const ships = []; for (let i = 0; i < 5; i++) { const sh = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshLambertMaterial({ color: 0xd0d7ff, emissive: 0x3040ff, emissiveIntensity: 0.6 })); sh.scale.set(1.3, 0.8, 4); scene.add(sh); ships.push({ m: sh, s: rnd() * L, off: (rnd() < 0.5 ? -1 : 1) * (25 + rnd() * 60), h: 25 + rnd() * 40, v: 15 + rnd() * 25 }); }
      ANIM.push((t) => ships.forEach((o) => { const A = at(o.s + t / 1000 * o.v, o.off); o.m.position.copy(A.pos).setY(A.pos.y + o.h); o.m.rotation.y = Math.atan2(A.dir.x, A.dir.z); }));
      arch(0.5, 'DÉPART');
      for (let km = 1; km * 1000 < L; km++) sign(km * 1000, 3.6, [{ t: km + ' km', size: 72 }], 1.5, 0.95, '#1a1035', '#22f0ff');
    } else {
      const CF = {
        forest: { ground: 0x3b5a2a, base: 0x2f5a2b, path: 0x8b6b45, pw: 1.6, trees: [['pine', 0.7], ['leaf', 0.3]], step: 2.2, far: 40, rocks: 70, ferns: 500, hills: true },
        sea: { ground: 0xe2c99a, base: 0xe2c99a, path: 0xa77d55, pw: 2.2, trees: [['palm', 1]], step: 9, far: 30, rocks: 0, ferns: 0, sea: true },
        mountain: { ground: 0x6b7a4a, base: 0x5f6d45, path: 0x9b8b74, pw: 1.8, trees: [['pine', 1]], step: 4.5, far: 45, rocks: 260, ferns: 0, hills: true, peaks: true },
        lake: { ground: 0x4f8a3a, base: 0x4a8236, path: 0x9b7b52, pw: 1.8, trees: [['leaf', 0.55], ['pine', 0.45]], step: 3, far: 38, rocks: 40, ferns: 250, lake: true },
        jungle: { ground: 0x5d6b2e, base: 0x55632a, path: 0x8a6a46, pw: 1.8, trees: [['fern', 0.8], ['palm', 0.2]], step: 6, far: 40, rocks: 50, ferns: 400, hills: true, jungle: true },
        egypt: { ground: 0xd8b878, base: 0xd2ae6e, path: 0xb48d58, pw: 1.8, trees: [['palm', 1]], step: 110, far: 20, rocks: 30, ferns: 0, egypt: true },
        vegas: { ground: 0x26262e, base: 0x1b1b22, path: 0x34343e, pw: 3.4, trees: [['palm', 1]], step: 9, far: 2.5, rocks: 0, ferns: 0, vegas: true },
        wall: { ground: 0x5f7a3e, base: 0x55703a, path: 0x9c8f7a, pw: 2.2, trees: [['pine', 0.6], ['leaf', 0.4]], step: 5, far: 70, rocks: 0, ferns: 0, hills: true, wall: true },
        bridge: { ground: 0x6b6b70, base: 0x23262e, path: 0x8a8578, pw: 1.6, trees: [['pine', 1]], step: 999999, far: 30, rocks: 0, ferns: 0, bridge: true },
        halloween: { ground: 0x3a3822, base: 0x2a2918, path: 0x7a6044, pw: 1.6, trees: [['dead', 0.7], ['pine', 0.3]], step: 3, far: 36, rocks: 0, ferns: 0, hills: true, halloween: true },
      }[k];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const minY = Math.min(...P.map((p) => p.y)), waterY = minY - 0.6, SEAREL = CF.sea && Math.max(...P.map((p) => p.y)) - minY > 4;
      if (CF.lake) { ribbon(-14, -2, 3, lam(CF.ground), -0.08, (o, s2) => o <= -14 ? waterY - 0.3 - at(s2).pos.y : 0); ribbon(-2, 45, 4, lam(CF.ground), -0.08); }
      else if (CF.wall) { ribbon(-90, -CF.pw - 0.6, 6, lam(CF.ground), 0, (o) => -8 - Math.abs(o) * 0.45); ribbon(CF.pw + 0.6, 90, 6, lam(CF.ground), 0, (o) => -8 - Math.abs(o) * 0.45); }
      else if (!CF.sea && !CF.bridge) ribbon(-45, 45, 4, lam(CF.ground), -0.08);
      else if (SEAREL) { const sg = lam(CF.ground), drop = (o, s2) => Math.abs(o) > 10 ? -at(s2).pos.y - 0.4 : 0;
        ribbon(-6, 6, 4, sg, -0.08); ribbon(6, 18, 4, sg, -0.08, drop); ribbon(-18, -6, 4, sg, -0.08, drop); }
      if (!CF.bridge && !CF.wall) ribbon(-CF.pw, CF.pw, 2, lam(CF.path), 0.0);
      const base = new T.Mesh(new T.PlaneGeometry(9000, 9000), lam(CF.base)); base.rotation.x = -Math.PI / 2; base.position.y = CF.sea ? 0 : CF.lake ? waterY - 1.5 : CF.bridge ? minY - 160 : CF.wall ? minY - 55 : minY - 2; base.receiveShadow = true; scene.add(base);
      if (CF.sea) {
        const seaM = new T.Mesh(new T.PlaneGeometry(9000, 3000), new T.MeshPhongMaterial({ color: 0x1f6f8b, shininess: 90, specular: 0xffc48a, emissive: 0x0a2a3a }));
        const shZ = Math.max(...P.map((p) => p.z)) + 9; seaM.rotation.x = -Math.PI / 2; seaM.position.set(0, 0.15, 1500 + shZ - 1); scene.add(seaM);
        const foam = new T.Mesh(new T.PlaneGeometry(9000, 2.5), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.17, shZ); scene.add(foam); S_waves = [seaM, foam];
      }
      if (CF.lake) {
        const shp = new T.Shape(); for (let s2 = 0; s2 <= L; s2 += 10) { const A = at(s2, -12); if (s2 === 0) shp.moveTo(A.pos.x, -A.pos.z); else shp.lineTo(A.pos.x, -A.pos.z); }
        const wm = new T.Mesh(new T.ShapeGeometry(shp), new T.MeshPhongMaterial({ color: 0x2f6f8f, shininess: 110, specular: 0xffffff, emissive: 0x0b2a38, transparent: true, opacity: 0.94 }));
        wm.rotation.x = -Math.PI / 2; wm.position.y = waterY; scene.add(wm);
        // ponton au départ
        const A = at(15, -2), B = at(15, -26); const deck = new T.Mesh(new T.BoxGeometry(2.2, 0.2, A.pos.distanceTo(B.pos)), lam(0x8f6843));
        deck.position.copy(A.pos.clone().lerp(B.pos, 0.5)).setY(waterY + 0.5); deck.lookAt(B.pos.clone().setY(waterY + 0.5)); deck.castShadow = deck.receiveShadow = true; scene.add(deck);
        for (let i = 0; i < 6; i++) { const B2 = at(120 + i * 480, 2.6); const bench = new T.Mesh(new T.BoxGeometry(1.6, 0.45, 0.5), lam(0x7a5a38)); bench.position.copy(B2.pos).setY(B2.pos.y + 0.25); bench.lookAt(at(120 + i * 480 + 0.1, 2.6).pos.clone().setY(bench.position.y)); bench.rotateY(Math.PI / 2); bench.castShadow = true; scene.add(bench); }
      }
      // emplacements libres hors du chemin
      const grid = new Map(), key = (x, z) => Math.floor(x / 10) + ',' + Math.floor(z / 10);
      P.forEach((p) => { const kk = key(p.x, p.z); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(p); });
      const near = (x, z, r) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const g = grid.get((Math.floor(x / 10) + dx) + ',' + (Math.floor(z / 10) + dz)); if (g) for (const p of g) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true; } return false; };
      const pick = () => { let r = rnd(), acc = 0; for (const [t, w] of CF.trees) { acc += w; if (r <= acc) return t; } return CF.trees[0][0]; };
      const spots = { pine: [], leaf: [], palm: [], fern: [], dead: [] };
      for (let s2 = 0; s2 < L; s2 += CF.step) for (const side of [-1, 1]) {
        if (CF.lake && side < 0 && rnd() < 0.85) continue;                  // côté lac : peu d'arbres
        if (CF.sea && at(s2, side * 5).pos.z > at(s2).pos.z) continue;               // pas de palmiers côté mer
        const off = side * (CF.pw + 2 + rnd() ** 1.6 * (CF.lake && side < 0 ? 6 : CF.far)); const A = at(s2 + rnd() * 2, off);
        if (near(A.pos.x, A.pos.z, CF.pw + (CF.wall ? 6 : 1.5))) continue; if (CF.vegas && rnd() < 0.15) continue; const t = pick(); spots[t].push([A.pos.x, (SEAREL && Math.abs(off) > 12 ? 0 : CF.wall ? A.pos.y - 8 - Math.abs(off) * 0.45 : A.pos.y) - 0.1, A.pos.z, 0.75 + rnd() * 0.75, rnd() * 6.28]);
      }
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), col = new T.Color(), e = new T.Euler();
      const inst = (geo, mat, n, shadow = true) => { const m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };

      const CXZ = () => [P.reduce((a, p) => a + p.x, 0) / P.length, P.reduce((a, p) => a + p.z, 0) / P.length];
      if (CF.egypt) { const [cx, cz] = CXZ();
        const stone = new T.MeshLambertMaterial({ color: 0xc89a55, flatShading: true });
        const ext = Math.max(...P.map((p) => Math.hypot(p.x - cx, p.z - cz)));
        [0.4, 2.5, 4.4].forEach((ang, gi) => { const gx = cx + Math.cos(ang) * (ext + 380), gz = cz + Math.sin(ang) * (ext + 380);
          [[0, 280, 430], [470, 260, 400], [860, 140, 220]].forEach(([dx, h, w]) => { const py = new T.Mesh(new T.ConeGeometry(w / Math.SQRT2, h, 4, 1), stone); py.rotation.y = Math.PI / 4 + gi; py.position.set(gx - 430 + dx * Math.cos(gi), minY - 2 + h / 2, gz + dx * Math.sin(gi) * 0.6); scene.add(py); }); });
        // sphinx (formes simples)
        const sx = new T.Group(), sm = new T.MeshLambertMaterial({ color: 0xc9a161, flatShading: true }), bx = (w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), sm); m.position.set(x, y, z); sx.add(m); };
        bx(12, 9, 34, 0, 4.5, 0); bx(10, 12, 9, 0, 12, 16); bx(12, 4, 6, 0, 18.5, 14); bx(4, 3, 14, -4, 1.5, 22); bx(4, 3, 14, 4, 1.5, 22); sx.position.set(cx + 160, minY - 2, cz + 110); sx.rotation.y = 0.5; sx.scale.setScalar(1.6); scene.add(sx);
        // dunes
        const dm = new T.MeshLambertMaterial({ color: 0xdcb878, flatShading: true });
        for (let i = 0; i < 40; i++) { const A = at(rnd() * L, (rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 220)), r = 25 + rnd() * 60, d = new T.Mesh(new T.SphereGeometry(r, 12, 6, 0, 6.29, 0, Math.PI / 2), dm); d.scale.set(1, 0.18 + rnd() * 0.15, 0.6 + rnd() * 0.5); d.position.set(A.pos.x, minY - 2, A.pos.z); d.rotation.y = rnd() * 3; scene.add(d); }
        // oasis au départ
        const oa = at(60, -14), pool = new T.Mesh(new T.CircleGeometry(9, 28), new T.MeshPhongMaterial({ color: 0x2a8aa8, shininess: 100, emissive: 0x0a3040 })); pool.rotation.x = -Math.PI / 2; pool.position.set(oa.pos.x, oa.pos.y + 0.05, oa.pos.z); scene.add(pool);
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, x = oa.pos.x + Math.cos(a) * 11, z = oa.pos.z + Math.sin(a) * 11; spots.palm.push([x, oa.pos.y - 0.1, z, 0.9 + rnd() * 0.5, rnd() * 6.28]); }
        // chameaux qui marchent
        const cm = new T.MeshLambertMaterial({ color: 0xa87a48, flatShading: true }), camels = [];
        for (let i = 0; i < 6; i++) { const g = new T.Group(), part = (geo, x, y, z, rx) => { const m = new T.Mesh(geo, cm); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m; };
          const bd = part(new T.SphereGeometry(1, 10, 8), 0, 2, 0); bd.scale.set(0.8, 0.7, 1.5); part(new T.SphereGeometry(0.55, 8, 6), 0, 2.7, 0); part(new T.CylinderGeometry(0.22, 0.3, 1.6, 6), 0, 2.8, 1.5, -0.6); part(new T.BoxGeometry(0.35, 0.4, 0.8), 0, 3.5, 2.2);
          const legs = [[-0.4, 0.8], [0.4, 0.8], [-0.4, -0.9], [0.4, -0.9]].map(([x, z]) => { const L2 = new T.Group(); L2.position.set(x, 1.6, z); const lg = new T.Mesh(new T.CylinderGeometry(0.12, 0.1, 1.6, 6), cm); lg.position.y = -0.8; L2.add(lg); g.add(L2); return L2; });
          scene.add(g); camels.push({ g, legs, s: 200 + i * 700, off: (i % 2 ? 1 : -1) * (12 + rnd() * 10), v: 0.9 + rnd() * 0.4 }); }
        ANIM.push((t) => camels.forEach((o, i) => { const A = at(o.s + t / 1000 * o.v, o.off); o.g.position.copy(A.pos).setY(A.pos.y); o.g.rotation.y = Math.atan2(A.dir.x, A.dir.z); o.legs.forEach((l, j) => { l.rotation.x = 0.35 * Math.sin(t / 260 + j * 1.6); }); }));
      }
      if (CF.vegas) { const [cx, cz] = CXZ();
        // trottoirs et marquage
        ribbon(CF.pw, CF.pw + 2.5, 3, lam(0x55555f), 0.12); ribbon(-CF.pw - 2.5, -CF.pw, 3, lam(0x55555f), 0.12);
        ribbon(-0.08, 0.08, 2, new T.MeshBasicMaterial({ color: 0xffd23a, side: T.DoubleSide }), 0.02);
        // hôtels-tours avec bandes de fenêtres lumineuses
        const RES = [[600, 1], [1450, -1], [2250, 1], [3050, -1], [3800, 1], [4400, -1]]; const B = []; for (let s2 = 0; s2 < L; s2 += 38) for (const side of [-1, 1]) { if (rnd() < 0.2) continue; if (RES.some(([rs, rd]) => rd === side && s2 > rs - 300 && s2 < rs + 160)) continue; const off = side * (CF.pw + 12 + rnd() * 30), A = at(s2, off); B.push([A.pos.x, A.pos.z, 40 + rnd() * 140, 16 + rnd() * 18, Math.atan2(A.dir.x, A.dir.z)]); }
        const tw = inst(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: 0x4a4670, emissive: 0x1c1838 }), B.length), win = inst(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), B.length * 8, false);
        const NE = [0xffd166, 0xff4fd8, 0x4fe3ff, 0xff7a3a, 0xb07cff, 0x7dff8a];
        B.forEach(([x, z, h, w, yaw], i) => { q.setFromEuler(e.set(0, yaw, 0)); m4.compose(new T.Vector3(x, minY + h / 2, z), q, sc.set(w, h, w * 0.7)); tw.setMatrixAt(i, m4); const c = NE[Math.floor(rnd() * NE.length)];
          for (let j = 0; j < 8; j++) { m4.compose(new T.Vector3(x, minY + h * (0.1 + j * 0.11), z), q, sc.set(w + 0.3, j === 7 ? 2.2 : 0.7, w * 0.7 + 0.3)); win.setMatrixAt(i * 8 + j, m4); win.setColorAt(i * 8 + j, col.set(j === 7 ? c : j % 2 ? 0xffe9a8 : 0xfff6d8)); } });
        // enseignes au néon (noms génériques)
        const words = ['CASINO', 'JACKPOT', '★ 777 ★', 'SHOW', 'HOTEL', 'BUFFET', 'NEON NIGHTS', 'LUCKY RUN', 'WEDDING CHAPEL', 'TREADVERSE'];
        for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, A = at(80 + i * (L / 26), side * (CF.pw + 7)), c = '#' + NE[i % NE.length].toString(16).padStart(6, '0'), { tex } = canvasTex([{ t: words[i % words.length], size: 64 }], 512, 128, '#0b0618', c);
          const bd = new T.Mesh(new T.PlaneGeometry(12, 3), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, fog: false })); bd.position.copy(A.pos).setY(A.pos.y + 8.5); bd.lookAt(A.pos.clone().addScaledVector(A.dir, -20).addScaledVector(A.nrm, -side * 8).setY(bd.position.y)); scene.add(bd);
          const post = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 7, 6), lam(0x333344)); post.position.copy(A.pos).setY(A.pos.y + 3.5); scene.add(post); }
        // panneau d'accueil (dessin original) et lampadaires
        { const A = at(25, -(CF.pw + 4)), { tex } = canvasTex([{ t: 'WELCOME TO', size: 44 }, { t: 'NEON CITY', size: 76 }, { t: 'RUN ALL NIGHT', size: 34 }], 512, 320, '#f8f4e8', '#d0204a');
          const bd = new T.Mesh(new T.PlaneGeometry(6, 3.75), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })); bd.position.copy(A.pos).setY(A.pos.y + 4.5); bd.lookAt(at(0, -(CF.pw + 4)).pos.clone().setY(bd.position.y)); scene.add(bd);
          const p2 = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 3, 8), lam(0xdddddd)); p2.position.copy(A.pos).setY(A.pos.y + 1.5); scene.add(p2); }
        const nl = Math.floor(L / 30), lp = inst(new T.CylinderGeometry(0.08, 0.1, 6, 6), lam(0x555566), nl * 2), bulb = inst(new T.SphereGeometry(0.35, 10, 8), new T.MeshBasicMaterial({ color: 0xfff0c0 }), nl * 2, false);
        for (let i = 0; i < nl; i++) for (const sd of [-1, 1]) { const A = at(i * 30, sd * (CF.pw + 1.8)), k = i * 2 + (sd > 0 ? 1 : 0); m4.makeTranslation(A.pos.x, A.pos.y + 3, A.pos.z); lp.setMatrixAt(k, m4); m4.makeTranslation(A.pos.x, A.pos.y + 6.1, A.pos.z); bulb.setMatrixAt(k, m4); }
        // fontaines dansantes
        const jets = []; for (let f = 0; f < 2; f++) { const A = at(950 + f * 2500, -(CF.pw + 34)); const pool = new T.Mesh(new T.CircleGeometry(30, 40), new T.MeshPhongMaterial({ color: 0x1a4a7a, emissive: 0x0a2040, shininess: 90 })); pool.rotation.x = -Math.PI / 2; pool.position.copy(A.pos).setY(A.pos.y + 0.05); scene.add(pool);
          for (let j = 0; j < 17; j++) { const jt = new T.Mesh(new T.CylinderGeometry(0.3, 0.6, 1, 8), new T.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.75 })); jt.position.set(A.pos.x + (j - 8) * 3, A.pos.y, A.pos.z); scene.add(jt); jets.push({ m: jt, y0: A.pos.y, ph: j * 0.5 + f }); } }
        ANIM.push((t) => jets.forEach((o) => { const h = 3 + 16 * Math.max(0, Math.sin(t / 600 + o.ph)); o.m.scale.y = h; o.m.position.y = o.y0 + h / 2; }));

        // monuments évoqués (domaine public, sans nom ni enseigne de casino)
        const place = (s2, side, back) => { const A = at(s2, side * (CF.pw + back)); return { A, yaw: Math.atan2(-A.nrm.x * side, -A.nrm.z * side) }; };
        const gold = new T.MeshLambertMaterial({ color: 0xc99a46, emissive: 0x7a4a0a, emissiveIntensity: 0.8, flatShading: true });
        { const { A, yaw } = place(600, 1, 30), g = new T.Group(); // petite tour Eiffel
          const leg = (h, r0, y0, spread, tilt) => { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, m = new T.Mesh(new T.BoxGeometry(r0, h, r0), gold); m.position.set(Math.cos(a) * spread, y0 + h / 2, Math.sin(a) * spread); m.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); g.add(m); } };
          leg(30, 2.4, 0, 13, 0.38); const p1 = new T.Mesh(new T.BoxGeometry(22, 2, 22), gold); p1.position.y = 28; g.add(p1);
          leg(32, 1.6, 29, 6.5, 0.18); const p2 = new T.Mesh(new T.BoxGeometry(11, 1.6, 11), gold); p2.position.y = 60; g.add(p2);
          const sp = new T.Mesh(new T.CylinderGeometry(0.6, 3.2, 42, 4), gold); sp.position.y = 82; sp.rotation.y = Math.PI / 4; g.add(sp); const tip = new T.Mesh(new T.ConeGeometry(0.6, 8, 6), gold); tip.position.y = 107; g.add(tip);
          for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, ar = new T.Mesh(new T.TorusGeometry(7, 0.8, 6, 16, Math.PI), gold); ar.position.set(Math.cos(a) * 9, 10, Math.sin(a) * 9); ar.rotation.y = -a + Math.PI / 2; g.add(ar); }
          g.position.copy(A.pos).setY(minY); g.rotation.y = yaw; scene.add(g); }
        { const { A, yaw } = place(1450, -1, 100), g = new T.Group(); // pyramide de verre noir, faisceau et sphinx
          const py = new T.Mesh(new T.ConeGeometry(85, 100, 4, 1), new T.MeshPhongMaterial({ color: 0x1a1e30, emissive: 0x141a38, specular: 0xaab8ff, shininess: 120, flatShading: true })); py.rotation.y = Math.PI / 4; py.position.y = 50; g.add(py);
          const beam = new T.Mesh(new T.CylinderGeometry(1.2, 2.5, 1400, 12, 1, true), new T.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.35, fog: false, depthWrite: false })); beam.position.y = 100 + 700; g.add(beam);
          const sm = new T.MeshLambertMaterial({ color: 0xc9a161, flatShading: true }), bx = (w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), sm); m.position.set(x, y, z); g.add(m); };
          bx(9, 7, 26, 0, 3.5, 70); bx(7.5, 9, 7, 0, 9.5, 82); bx(9, 3, 4.5, 0, 14.5, 80.5); bx(3, 2.5, 11, -3, 1.25, 88); bx(3, 2.5, 11, 3, 1.25, 88);
          g.position.copy(A.pos).setY(minY); g.rotation.y = yaw + Math.PI; scene.add(g); }
        { const { A, yaw } = place(2250, 1, 22), g = new T.Group(); // statue de la Liberté devant des gratte-ciel
          const cu = new T.MeshLambertMaterial({ color: 0x7fb7a0, flatShading: true }), st = new T.MeshLambertMaterial({ color: 0xb8ad98, flatShading: true });
          const ped = new T.Mesh(new T.BoxGeometry(9, 14, 9), st); ped.position.y = 7; g.add(ped); const robe = new T.Mesh(new T.ConeGeometry(3.2, 15, 10), cu); robe.position.y = 21.5; g.add(robe);
          const head = new T.Mesh(new T.SphereGeometry(1.3, 10, 8), cu); head.position.y = 30; g.add(head); for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4, sp = new T.Mesh(new T.ConeGeometry(0.22, 1.8, 4), cu); sp.position.set(Math.sin(a) * 1.3, 31, Math.cos(a) * 1.3); sp.rotation.set(Math.cos(a) * 0.8, 0, -Math.sin(a) * 0.8); g.add(sp); }
          const arm = new T.Mesh(new T.CylinderGeometry(0.5, 0.6, 7, 8), cu); arm.position.set(2.2, 31, 0); arm.rotation.z = -0.25; g.add(arm); const fl = new T.Mesh(new T.ConeGeometry(0.9, 2.2, 8), new T.MeshBasicMaterial({ color: 0xffc94a })); fl.position.set(3.1, 35.4, 0); g.add(fl);
          const tab = new T.Mesh(new T.BoxGeometry(1.4, 2.4, 0.5), cu); tab.position.set(-2, 25, 0.8); g.add(tab);
          [[-28, 120, 16], [-8, 160, 14], [14, 95, 18], [34, 140, 15], [52, 80, 20]].forEach(([x, h, w]) => { for (let k = 0; k < 3; k++) { const hh = h * (1 - k * 0.28), ww = w * (1 - k * 0.25), b = new T.Mesh(new T.BoxGeometry(ww, hh / 3, ww), new T.MeshLambertMaterial({ color: 0x6d6a80, emissive: 0x2a2440 })); b.position.set(x, k * h / 3 + hh / 6, -60); g.add(b); } });
          g.position.copy(A.pos).setY(minY); g.rotation.y = yaw; scene.add(g); }
        { const { A, yaw } = place(3050, -1, 14), g = new T.Group(); // canal façon Venise, gondoles, campanile
          const can = new T.Mesh(new T.PlaneGeometry(140, 14), new T.MeshPhongMaterial({ color: 0x2a8a9a, shininess: 100, emissive: 0x0a3038 })); can.rotation.x = -Math.PI / 2; can.position.y = 0.1; g.add(can);
          const cam = new T.Mesh(new T.BoxGeometry(9, 70, 9), new T.MeshLambertMaterial({ color: 0xb4583a, flatShading: true })); cam.position.set(50, 35, -22); g.add(cam); const roof = new T.Mesh(new T.ConeGeometry(7, 16, 4), new T.MeshLambertMaterial({ color: 0x3f6f52, flatShading: true })); roof.position.set(50, 78, -22); roof.rotation.y = Math.PI / 4; g.add(roof);
          const bel = new T.Mesh(new T.BoxGeometry(10, 8, 10), new T.MeshLambertMaterial({ color: 0xe8dcc0 })); bel.position.set(50, 66, -22); g.add(bel);
          const pal = new T.Mesh(new T.BoxGeometry(110, 22, 14), new T.MeshLambertMaterial({ color: 0xe9d6b8, emissive: 0x3a2a10 })); pal.position.set(-10, 11, -22); g.add(pal);
          const gm = new T.MeshLambertMaterial({ color: 0x0c0c10 }), gond = []; for (let i = 0; i < 4; i++) { const gd = new T.Mesh(new T.BoxGeometry(9, 0.6, 1.4), gm); gd.position.set(-50 + i * 30, 0.5, 0); g.add(gd); gond.push({ m: gd, x0: -50 + i * 30, ph: i }); }
          ANIM.push((t) => gond.forEach((o) => { o.m.position.x = ((o.x0 + t / 300 + 70) % 140) - 70; o.m.position.y = 0.5 + 0.08 * Math.sin(t / 500 + o.ph); }));
          g.position.copy(A.pos).setY(minY); g.rotation.y = yaw; scene.add(g); }
        { const { A, yaw } = place(3800, 1, 30), g = new T.Group(); // château de conte
          const wm = new T.MeshLambertMaterial({ color: 0xf0e6f0, flatShading: true }), wall = new T.Mesh(new T.BoxGeometry(50, 18, 14), wm); wall.position.y = 9; g.add(wall);
          [[-25, 32, 0xd0303a], [25, 32, 0x3050d0], [-12, 44, 0xe0b020], [12, 44, 0xd0303a], [0, 58, 0x3050d0]].forEach(([x, h, c]) => { const tw = new T.Mesh(new T.CylinderGeometry(4.2, 4.6, h, 12), wm); tw.position.set(x, h / 2, 0); g.add(tw); const cn = new T.Mesh(new T.ConeGeometry(5.4, 14, 12), new T.MeshLambertMaterial({ color: c, flatShading: true })); cn.position.set(x, h + 7, 0); g.add(cn); });
          g.position.copy(A.pos).setY(minY); g.rotation.y = yaw; scene.add(g); }
        { const { A, yaw } = place(4400, -1, 18), g = new T.Group(); // colonnade romaine et statues
          const mb = new T.MeshLambertMaterial({ color: 0xf4f1ea }); for (let i = 0; i < 10; i++) { const c = new T.Mesh(new T.CylinderGeometry(1.1, 1.3, 20, 12), mb); c.position.set(-36 + i * 8, 10, 0); g.add(c); }
          const ent = new T.Mesh(new T.BoxGeometry(84, 4, 5), mb); ent.position.y = 22; g.add(ent); const ped = new T.Mesh(new T.ConeGeometry(46, 9, 3), mb); ped.rotation.z = Math.PI / 2; ped.rotation.y = Math.PI / 2; ped.scale.set(1, 1, 0.12); ped.position.y = 28; g.add(ped);
          for (const x of [-46, 46]) { const st = new T.Group(), b = new T.Mesh(new T.BoxGeometry(4, 3, 4), mb); b.position.y = 1.5; st.add(b); const bd = new T.Mesh(new T.CylinderGeometry(0.9, 1.2, 6, 8), mb); bd.position.y = 6; st.add(bd); const hd = new T.Mesh(new T.SphereGeometry(0.9, 10, 8), mb); hd.position.y = 9.8; st.add(hd); st.position.x = x; g.add(st); }
          g.position.copy(A.pos).setY(minY); g.rotation.y = yaw; scene.add(g); }
      }
      if (CF.wall) {
        // muraille : faces latérales, créneaux, tours de guet
        const brick = new T.MeshLambertMaterial({ color: 0x8f8170, side: T.DoubleSide, flatShading: true });
        for (const sd of [-1, 1]) { ribbon(sd * (CF.pw + 0.6), sd * (CF.pw + 0.61), 3, brick, 0, (o) => Math.abs(o) > CF.pw + 0.605 ? -8.5 : 0.9); ribbon(sd * CF.pw, sd * (CF.pw + 0.6), 3, brick, 0.9); }
        ribbon(-CF.pw, CF.pw, 3, lam(CF.path), 0.02);
        const nc = Math.floor(L / 2.4), cren = inst(new T.BoxGeometry(0.6, 0.9, 1.2), brick, nc * 2);
        for (let i = 0; i < nc; i++) for (const sd of [-1, 1]) { const A = at(i * 2.4, sd * (CF.pw + 0.3)); q.setFromEuler(e.set(0, Math.atan2(A.dir.x, A.dir.z), 0)); m4.compose(new T.Vector3(A.pos.x, A.pos.y + 1.35, A.pos.z), q, sc.set(1, 1, 1)); cren.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), m4); }
        for (let s2 = 200; s2 < L; s2 += 420) { const A = at(s2), yaw = Math.atan2(A.dir.x, A.dir.z), tg = new T.Group();
          [-1, 1].forEach((sd) => { const w = new T.Mesh(new T.BoxGeometry(3, 16, 9), brick); w.position.set(sd * (CF.pw + 2), -2, 0); tg.add(w); });
          const roof = new T.Mesh(new T.BoxGeometry(CF.pw * 2 + 7, 3, 9), brick); roof.position.y = 5.5; tg.add(roof);
          for (let k = -3; k <= 3; k++) { const c2 = new T.Mesh(new T.BoxGeometry(0.9, 1.2, 9.4), brick); c2.position.set(k * 1.6, 7.6, 0); tg.add(c2); }
          tg.position.copy(A.pos); tg.rotation.y = yaw; scene.add(tg); }
        // montagnes et brume
        const [cx, cz] = CXZ();
        for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + rnd() * 0.2, d = 900 + rnd() * 500, h = 160 + rnd() * 220, r = h * (1.2 + rnd() * 0.6);
          const mt = new T.Mesh(new T.ConeGeometry(r, h, 8), new T.MeshLambertMaterial({ color: 0x5f7a52, flatShading: true })); mt.position.set(cx + Math.cos(a) * d, minY - 55 + h / 2, cz + Math.sin(a) * d); scene.add(mt); }
        const mist = new T.Mesh(new T.PlaneGeometry(9000, 9000), new T.MeshBasicMaterial({ color: 0xe6edf2, transparent: true, opacity: 0.45, depthWrite: false })); mist.rotation.x = -Math.PI / 2; mist.position.y = minY - 25; scene.add(mist);
      }
      if (spots.pine.length) { const n = spots.pine.length, tr = inst(new T.CylinderGeometry(0.16, 0.24, 2.6, 6), lam(0x4a3524), n), cones = [0, 1, 2].map(() => inst(new T.ConeGeometry(1, 2.4, 9), new T.MeshLambertMaterial({ flatShading: true }), n));
        spots.pine.forEach(([x, y, z, f, r], i) => { q.setFromEuler(e.set(0, r, 0)); sc.set(f, f, f); m4.compose(new T.Vector3(x, y + 1.3 * f, z), q, sc); tr.setMatrixAt(i, m4);
          col.setHSL(0.30 + rnd() * 0.05, 0.45, 0.17 + rnd() * 0.08); cones.forEach((c, j) => { const rr = (1.9 - j * 0.42) * f; sc.set(rr, f, rr); m4.compose(new T.Vector3(x, y + (2.7 + j * 1.3) * f, z), q, sc); c.setMatrixAt(i, m4); c.setColorAt(i, col); }); }); }
      if (spots.leaf.length) { const n = spots.leaf.length, tr = inst(new T.CylinderGeometry(0.14, 0.22, 2.8, 6), lam(0x4f3a26), n), cr = inst(new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ flatShading: true }), n * 3);
        spots.leaf.forEach(([x, y, z, f, r], i) => { q.setFromEuler(e.set(0, r, 0)); sc.set(f, f, f); m4.compose(new T.Vector3(x, y + 1.4 * f, z), q, sc); tr.setMatrixAt(i, m4); col.setHSL(0.22 + rnd() * 0.1, 0.45, 0.24 + rnd() * 0.1);
          for (let j = 0; j < 3; j++) { const rr = (1.3 + rnd() * 0.6) * f; sc.set(rr, rr * 0.9, rr); m4.compose(new T.Vector3(x + (rnd() - 0.5) * 1.4 * f, y + (3.1 + rnd() * 1.2) * f, z + (rnd() - 0.5) * 1.4 * f), q, sc); cr.setMatrixAt(i * 3 + j, m4); cr.setColorAt(i * 3 + j, col); } }); }
      if (spots.palm.length) { const n = spots.palm.length, tr = inst(new T.CylinderGeometry(0.13, 0.2, 7, 7), lam(0x8a6a45), n), lv = inst(new T.SphereGeometry(1, 8, 5), new T.MeshLambertMaterial({ color: 0x4a8a32, flatShading: true }), n * 8);
        spots.palm.forEach(([x, y, z, f, r], i) => { const tilt = 0.12; q.setFromEuler(e.set(tilt * Math.cos(r), 0, tilt * Math.sin(r))); sc.set(f, f, f); m4.compose(new T.Vector3(x, y + 3.5 * f, z), q, sc); tr.setMatrixAt(i, m4);
          const top = new T.Vector3(x + Math.sin(r) * 0.8 * f, y + 6.9 * f, z - Math.cos(r) * 0.8 * f);
          for (let j = 0; j < 8; j++) { const a = j / 8 * 6.28 + r; q.setFromEuler(e.set(0, -a, -0.38, 'YXZ')); sc.set(1.9 * f, 0.12 * f, 0.45 * f); m4.compose(top.clone().add(new T.Vector3(Math.cos(a) * 1.6 * f, -0.35 * f, Math.sin(a) * 1.6 * f)), q, sc); lv.setMatrixAt(i * 8 + j, m4); } }); }
      if (CF.rocks) { const rk = inst(new T.DodecahedronGeometry(0.6, 0), new T.MeshLambertMaterial({ color: 0x80837f, flatShading: true }), CF.rocks); let n = 0;
        while (n < CF.rocks) { const s2 = rnd() * L, off = (rnd() < 0.5 ? -1 : 1) * (CF.pw + 0.8 + rnd() * 12), A = at(s2, off); if (near(A.pos.x, A.pos.z, CF.pw + 0.6)) continue; const f = 0.4 + rnd() * (k === 'mountain' ? 2.4 : 1.2);
          q.setFromEuler(e.set(rnd() * 3, rnd() * 3, 0)); sc.set(f, f * 0.7, f); m4.compose(new T.Vector3(A.pos.x, A.pos.y + 0.1 * f, A.pos.z), q, sc); rk.setMatrixAt(n, m4); rk.setColorAt(n, col.setHSL(0.1, 0.04, 0.42 + rnd() * 0.15)); n++; } }
      if (CF.ferns) { const fe = inst(new T.ConeGeometry(0.55, 0.6, 5, 1, true), new T.MeshLambertMaterial({ color: 0x4f7a2e, side: T.DoubleSide, flatShading: true }), CF.ferns, false); let n = 0;
        while (n < CF.ferns) { const s2 = rnd() * L, off = (rnd() < 0.5 ? -1 : 1) * (CF.pw + 0.4 + rnd() * 4), A = at(s2, off); if (CF.lake && off < 0) { n++; continue; } m4.makeTranslation(A.pos.x, A.pos.y + 0.22, A.pos.z); fe.setMatrixAt(n++, m4); } }
      if (CF.sea) { const nl = Math.floor(L / 24), po = inst(new T.CylinderGeometry(0.06, 0.08, 4, 8), new T.MeshLambertMaterial({ color: 0x334155 }), nl), bu = inst(new T.SphereGeometry(0.22, 12, 8), new T.MeshBasicMaterial({ color: 0xffe9b0 }), nl, false);
        for (let i = 0; i < nl; i++) { const A = at(i * 24 + 6, at(i * 24 + 6).pos.z > 0 ? CF.pw + 0.6 : -(CF.pw + 0.6)); m4.makeTranslation(A.pos.x, A.pos.y + 2, A.pos.z); po.setMatrixAt(i, m4); m4.makeTranslation(A.pos.x, A.pos.y + 4.1, A.pos.z); bu.setMatrixAt(i, m4); } }
      if (spots.fern.length) { const n = spots.fern.length, tr = inst(new T.CylinderGeometry(0.25, 0.35, 5, 7), lam(0x5a4020), n), lv = inst(new T.SphereGeometry(1, 6, 3), new T.MeshLambertMaterial({ flatShading: true }), n * 7);
        spots.fern.forEach(([x, y, z, f, r], i) => { q.setFromEuler(e.set(0, r, 0)); sc.set(f, f, f); m4.compose(new T.Vector3(x, y + 2.5 * f, z), q, sc); tr.setMatrixAt(i, m4); col.setHSL(0.24 + rnd() * 0.06, 0.5, 0.24 + rnd() * 0.1);
          for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28 + r; q.setFromEuler(e.set(0, -a, -0.45, 'YXZ')); sc.set(2.6 * f, 0.1 * f, 0.5 * f); m4.compose(new T.Vector3(x + Math.cos(a) * 2.2 * f, y + 4.4 * f, z + Math.sin(a) * 2.2 * f), q, sc); lv.setMatrixAt(i * 7 + j, m4); lv.setColorAt(i * 7 + j, col); } }); }

      if (spots.dead.length) { const n = spots.dead.length, bark = new T.MeshLambertMaterial({ color: 0x2a2018, flatShading: true }), tr = inst(new T.CylinderGeometry(0.12, 0.3, 4.2, 6), bark, n), br = inst(new T.CylinderGeometry(0.04, 0.11, 2.2, 5), bark, n * 4);
        spots.dead.forEach(([x, y, z, f, r], i) => { q.setFromEuler(e.set(0.06 * Math.sin(r * 3), r, 0.06 * Math.cos(r * 5))); sc.set(f, f, f); m4.compose(new T.Vector3(x, y + 2.1 * f, z), q, sc); tr.setMatrixAt(i, m4);
          for (let j = 0; j < 4; j++) { const a = r + j * 1.57 + rnd() * 0.5, h = (2.2 + j * 0.55) * f, tilt = 0.75 + rnd() * 0.5; q.setFromEuler(e.set(0, -a, tilt, 'YXZ')); sc.set(f, f * (0.7 + rnd() * 0.5), f);
            m4.compose(new T.Vector3(x + Math.cos(a) * 0.75 * f, y + h + 0.5 * f, z + Math.sin(a) * 0.75 * f), q, sc); br.setMatrixAt(i * 4 + j, m4); } }); }

      if (CF.bridge) {
        // dalles du pont (elles tombent derrière le coureur en Collapse Run)
        const TL = 2, nt = Math.floor(L / TL), tiles = inst(new T.BoxGeometry(CF.pw * 2 + 0.6, 0.5, TL - 0.08), new T.MeshLambertMaterial({ color: 0x8a8578, flatShading: true }), nt);
        const TM = []; for (let i = 0; i < nt; i++) { const A = at(i * TL + TL / 2); q.setFromEuler(e.set(0, Math.atan2(A.dir.x, A.dir.z), 0)); m4.compose(new T.Vector3(A.pos.x, A.pos.y - 0.25, A.pos.z), q, new T.Vector3(1, 1, 1)); tiles.setMatrixAt(i, m4); tiles.setColorAt(i, col.setHSL(0.09, 0.06, 0.42 + rnd() * 0.12)); TM.push([A.pos.clone(), Math.atan2(A.dir.x, A.dir.z)]); }
        // garde-fous et piliers qui plongent dans le gouffre
        const np = Math.floor(L / 30), pil = inst(new T.CylinderGeometry(0.9, 1.4, 1, 8), new T.MeshLambertMaterial({ color: 0x5d5a55, flatShading: true }), np);
        for (let i = 0; i < np; i++) { const A = at(i * 30 + 15), h = A.pos.y - (minY - 160); m4.compose(new T.Vector3(A.pos.x, A.pos.y - 0.5 - h / 2, A.pos.z), new T.Quaternion(), new T.Vector3(1, h, 1)); pil.setMatrixAt(i, m4); }
        const nr = Math.floor(L / 4), rail = inst(new T.BoxGeometry(0.18, 0.7, 0.18), lam(0x4a4743), nr * 2, false);
        for (let i = 0; i < 0; i++) for (const sd of [-1, 1]) { const A = at(i * 4, sd * (CF.pw + 0.2)); m4.makeTranslation(A.pos.x, A.pos.y + 0.3, A.pos.z); rail.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), m4); }
        // aiguilles rocheuses dans la brume
        const cx = P.reduce((a, p) => a + p.x, 0) / P.length, cz = P.reduce((a, p) => a + p.z, 0) / P.length;
        for (let i = 0; i < 40; i++) { const A = at(rnd() * L, (rnd() < 0.5 ? -1 : 1) * (25 + rnd() * 160)), h = 140 + rnd() * 120, r = 8 + rnd() * 18;
          const sp = new T.Mesh(new T.ConeGeometry(r, h, 7), new T.MeshLambertMaterial({ color: 0x6e6a66, flatShading: true })); sp.position.set(A.pos.x, minY - 160 + h / 2, A.pos.z); scene.add(sp); }
        const mist = new T.Mesh(new T.PlaneGeometry(9000, 9000), new T.MeshBasicMaterial({ color: 0xcdd5df, transparent: true, opacity: 0.55, depthWrite: false })); mist.rotation.x = -Math.PI / 2; mist.position.y = minY - 45; scene.add(mist);
        // effondrement : les dalles derrière le front tombent en tournant puis disparaissent
        let FR = null; const fallN = Math.round(320 / TL);
        const setTile = (i, d) => { i = ((i % nt) + nt) % nt; const [p, yaw] = TM[i]; if (d == null) { q.setFromEuler(e.set(0, yaw, 0)); m4.compose(new T.Vector3(p.x, p.y - 0.25, p.z), q, sc.set(1, 1, 1)); }
          else { const drop = d * d * 0.06 + d * 0.35, r = (i * 37 % 7) / 7 - 0.5; if (drop > 140) { m4.makeScale(0, 0, 0); } else { q.setFromEuler(e.set(r * d * 0.08, yaw + r * d * 0.03, r * d * 0.05)); m4.compose(new T.Vector3(p.x, p.y - 0.25 - drop, p.z), q, sc.set(1, 1, 1)); } }
          tiles.setMatrixAt(i, m4); };
        BRIDGE = { set(front) { if (front == null) { if (FR != null) { for (let k = -fallN - 2; k <= 2; k++) setTile(Math.floor(FR / TL) + k, null); tiles.instanceMatrix.needsUpdate = true; } FR = null; return; }
            if (FR != null && front < FR) for (let s3 = front - 2; s3 <= FR + 2; s3 += TL) setTile(Math.floor(s3 / TL), null);
            FR = front; const i0 = Math.floor(front / TL); for (let k = 0; k <= fallN + 2; k++) { const d = front - (i0 - k) * TL; setTile(i0 - k, k > fallN ? null : Math.max(0, d)); } setTile(i0 + 1, null); setTile(i0 + 2, null); tiles.instanceMatrix.needsUpdate = true; } };
      }
      if (CF.halloween) {
        const cx = P.reduce((a, p) => a + p.x, 0) / P.length, cz = P.reduce((a, p) => a + p.z, 0) / P.length;
        // pleine lune et son halo
        const moon = new T.Mesh(new T.SphereGeometry(70, 32, 20), new T.MeshBasicMaterial({ color: 0xf3f0d8, fog: false })); moon.scale.setScalar(1.4); moon.position.set(cx + 200, 330, cz - 950); scene.add(moon);
        const glow = new T.Mesh(new T.SphereGeometry(110, 32, 20), new T.MeshBasicMaterial({ color: 0xbfc8ff, fog: false, transparent: true, opacity: 0.18, depthWrite: false })); glow.position.copy(moon.position); scene.add(glow);
        // citrouilles lumineuses au bord du chemin (côtes et yeux qui brillent)
        const np = Math.floor(L / 14), pk = inst(new T.SphereGeometry(0.42, 14, 10), new T.MeshLambertMaterial({ color: 0xf07a12, emissive: 0x8a3000, emissiveIntensity: 0.8 }), np),
          stem = inst(new T.CylinderGeometry(0.05, 0.07, 0.18, 6), lam(0x3b5a1e), np, false), eyes = inst(new T.BoxGeometry(0.17, 0.15, 0.06), new T.MeshBasicMaterial({ color: 0xffe66b }), np * 3, false);
        for (let i = 0; i < np; i++) { const side = i % 2 ? 1 : -1, A = at(i * 14 + 5 + rnd() * 5, side * (CF.pw + 0.7 + rnd() * 0.8)), f = 1.0 + rnd() * 0.8, fv = A.dir.clone().multiplyScalar(-1).addScaledVector(A.nrm, -side * 0.7), yaw = Math.atan2(fv.x, fv.z);
          q.setFromEuler(e.set(0, yaw, 0)); sc.set(f * 1.2, f * 0.85, f * 1.2); m4.compose(new T.Vector3(A.pos.x, A.pos.y + 0.32 * f, A.pos.z), q, sc); pk.setMatrixAt(i, m4);
          sc.set(f, f, f); m4.compose(new T.Vector3(A.pos.x, A.pos.y + 0.72 * f, A.pos.z), q, sc); stem.setMatrixAt(i, m4);
          const fx = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), rx = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          [[-0.15, 0.42], [0.15, 0.42], [0, 0.22]].forEach(([dx, dy], j) => { const p = new T.Vector3(A.pos.x, A.pos.y + dy * f, A.pos.z).addScaledVector(fx, 0.47 * f).addScaledVector(rx, dx * f);
            sc.set(f * (j === 2 ? 2.2 : 1), f * (j === 2 ? 0.6 : 1), f); m4.compose(p, q, sc); eyes.setMatrixAt(i * 3 + j, m4); }); }
        // cimetière : tombes arrondies et croix
        const ng = 160, tomb = inst(new T.BoxGeometry(0.7, 1, 0.18), new T.MeshLambertMaterial({ color: 0x77777f, flatShading: true }), ng), top = inst(new T.CylinderGeometry(0.35, 0.35, 0.18, 12, 1, false, 0, Math.PI), new T.MeshLambertMaterial({ color: 0x77777f }), ng);
        for (let i = 0; i < ng; i++) { const blk = Math.floor(i / 20), s2 = 400 + blk * (L / 8) + (i % 5) * 2.2, side = blk % 2 ? 1 : -1, A = at(s2, side * (CF.pw + 4 + Math.floor((i % 20) / 5) * 1.8));
          const yaw = Math.atan2(A.dir.x, A.dir.z) + (rnd() - 0.5) * 0.4; q.setFromEuler(e.set((rnd() - 0.5) * 0.2, yaw + Math.PI / 2, (rnd() - 0.5) * 0.15)); sc.set(1, 1, 1);
          m4.compose(new T.Vector3(A.pos.x, A.pos.y + 0.45, A.pos.z), q, sc); tomb.setMatrixAt(i, m4);
          const q2 = q.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0))); m4.compose(new T.Vector3(A.pos.x, A.pos.y + 0.95, A.pos.z), q2, sc); top.setMatrixAt(i, m4); }
        // fantômes qui flottent et chauves-souris
        const gm = new T.MeshLambertMaterial({ color: 0xf4f6ff, emissive: 0x9aa4d8, emissiveIntensity: 0.6, transparent: true, opacity: 0.82 }), ghosts = [];
        for (let i = 0; i < 24; i++) { const g = new T.Group(), body = new T.Mesh(new T.ConeGeometry(0.75, 2, 14, 1, true), gm), head = new T.Mesh(new T.SphereGeometry(0.62, 16, 12), gm); body.position.y = 1.1; head.position.y = 2.1;
          const eyeM = new T.MeshBasicMaterial({ color: 0x111111 }); [-0.2, 0.2].forEach((x) => { const ey = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), eyeM); ey.position.set(x, 2.2, 0.55); g.add(ey); });
          g.add(body, head); scene.add(g); ghosts.push({ g, s: 60 + i * (L / 24), off: (i % 2 ? 1 : -1) * (CF.pw + 2 + rnd() * 3), ph: rnd() * 6 }); }
        const bm = new T.MeshBasicMaterial({ color: 0x0b0710, side: T.DoubleSide }), bats = [];
        for (let i = 0; i < 26; i++) { const gg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(-0.9, 0.25, -0.25), new T.Vector3(-0.3, 0, 0.3), new T.Vector3(0, 0, 0), new T.Vector3(0.9, 0.25, -0.25), new T.Vector3(0.3, 0, 0.3)]); const b = new T.Mesh(gg, bm); b.scale.setScalar(0.8 + rnd() * 0.6); scene.add(b); bats.push({ m: b, s: rnd() * L, r: 6 + rnd() * 14, h: 5 + rnd() * 9, ph: rnd() * 6.28, sp: 1500 + rnd() * 1500 }); }
        ANIM.push((t) => { ghosts.forEach((o) => { const A = at(o.s + Math.sin(t / 4000 + o.ph) * 6, o.off); o.g.position.copy(A.pos).setY(A.pos.y + 0.6 + 0.35 * Math.sin(t / 700 + o.ph)); o.g.rotation.y = Math.atan2(-A.dir.x - A.nrm.x * Math.sign(o.off) * 0.6, -A.dir.z - A.nrm.z * Math.sign(o.off) * 0.6) + 0.25 * Math.sin(t / 1500 + o.ph); });
          bats.forEach((o) => { const c = at(o.s), a = t / o.sp + o.ph; o.m.position.set(c.pos.x + Math.cos(a) * o.r, c.pos.y + o.h + Math.sin(t / 300 + o.ph), c.pos.z + Math.sin(a) * o.r); o.m.rotation.y = -a; o.m.rotation.z = 0.6 * Math.sin(t / 70 + o.ph); }); });
      }
      if (CF.jungle) {
        const cx = P.reduce((a, p) => a + p.x, 0) / P.length, cz = P.reduce((a, p) => a + p.z, 0) / P.length;
        const vol = new T.Mesh(new T.ConeGeometry(320, 360, 24, 1, true), new T.MeshLambertMaterial({ color: 0x4a3a34, flatShading: true })); vol.position.set(cx + 150, minY + 160, cz - 1500); scene.add(vol);
        const lava = new T.Mesh(new T.ConeGeometry(46, 34, 16), new T.MeshBasicMaterial({ color: 0xff5a1f, fog: false })); lava.position.set(vol.position.x, minY + 330, vol.position.z); scene.add(lava);
        const smoke = []; for (let i = 0; i < 12; i++) { const sm = new T.Mesh(new T.SphereGeometry(36 + i * 7, 12, 8), new T.MeshBasicMaterial({ color: 0x8a8078, transparent: true, opacity: 0.42 - i * 0.025, fog: false })); scene.add(sm); smoke.push(sm); }
        ANIM.push((t) => smoke.forEach((sm, i) => { const u = ((t / 9000 + i / 12) % 1); sm.position.set(vol.position.x + u * 260, minY + 350 + u * 420, vol.position.z - u * 60); sm.material.opacity = 0.42 * (1 - u); }));
        // grands herbivores (formes simples) près du sentier
        const dm = new T.MeshLambertMaterial({ color: 0x6b6a55, flatShading: true });
        const herb = (A, s2, rot) => { const g = new T.Group(); const part = (geo, x, y, z, sx, sy, sz, rz) => { const m = new T.Mesh(geo, dm); m.position.set(x * s2, y * s2, z * s2); m.scale.set(sx, sy, sz); if (rz) m.rotation.z = rz; m.castShadow = true; g.add(m); };
          part(new T.SphereGeometry(1, 12, 8), 0, 5, 0, 4.5 * s2, 2.4 * s2, 2.2 * s2); part(new T.CylinderGeometry(0.5 * s2, 1.1 * s2, 9 * s2, 8), 4.5, 9, 0, 1, 1, 1, -0.7); part(new T.SphereGeometry(0.9 * s2, 10, 8), 8, 12.6, 0, 1.4, 0.8, 0.8);
          part(new T.ConeGeometry(1 * s2, 11 * s2, 8), -8.5, 4.2, 0, 1, 1, 1, Math.PI / 2 + 0.25); [[2.5, 1.2], [2.5, -1.2], [-2.5, 1.2], [-2.5, -1.2]].forEach(([a, b]) => part(new T.CylinderGeometry(0.6 * s2, 0.7 * s2, 4 * s2, 8), a, 2, b, 1, 1, 1));
          g.position.copy(A.pos); g.rotation.y = rot; scene.add(g); };
        for (let i = 0; i < 16; i++) { const s2 = 150 + i * (L / 16), A = at(s2, (i % 2 ? 1 : -1) * (16 + rnd() * 14)); herb(A, 1.7 + rnd() * 0.7, rnd() * 6.28); }
        // ptérosaures qui tournent dans le ciel
        const pm = new T.MeshLambertMaterial({ color: 0x3a3028, side: T.DoubleSide }), birds = [];
        for (let i = 0; i < 6; i++) { const gg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(-4, 0.6, -1), new T.Vector3(-0.5, 0, 1.2), new T.Vector3(0, 0, 0), new T.Vector3(4, 0.6, -1), new T.Vector3(0.5, 0, 1.2)]); gg.computeVertexNormals(); const b = new T.Mesh(gg, pm); b.scale.setScalar(1.5 + rnd()); scene.add(b); birds.push({ m: b, s: rnd() * L, r: 30 + rnd() * 40, h: 40 + rnd() * 30, ph: rnd() * 6 }); }
        ANIM.push((t) => birds.forEach((o) => { const c = at(o.s), a = t / 6000 + o.ph; o.m.position.set(c.pos.x + Math.cos(a) * o.r, c.pos.y + o.h + Math.sin(t / 700 + o.ph) * 2, c.pos.z + Math.sin(a) * o.r); o.m.rotation.y = -a; o.m.rotation.z = 0.25 * Math.sin(t / 250 + o.ph); }));
      }
      if (CF.peaks) { const cx = P.reduce((a, p) => a + p.x, 0) / P.length, cz = P.reduce((a, p) => a + p.z, 0) / P.length;
        for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + rnd() * 0.3, d = 1300 + rnd() * 600, h = 320 + rnd() * 380, r = h * (0.9 + rnd() * 0.5);
          const rock = new T.Mesh(new T.ConeGeometry(r, h, 7), new T.MeshLambertMaterial({ color: 0x6b6f73, flatShading: true })); rock.position.set(cx + Math.cos(a) * d, 260 + h / 2, cz + Math.sin(a) * d); scene.add(rock);
          const snow = new T.Mesh(new T.ConeGeometry(r * 0.34, h * 0.34, 7), new T.MeshLambertMaterial({ color: 0xf4f7fa, flatShading: true })); snow.position.set(rock.position.x, 260 + h - h * 0.17 + 0.5, rock.position.z); scene.add(snow); } }
      // panneaux : départ, chaque kilomètre, côtes
      arch(0.5, 'DÉPART');
      for (let km = 1; km * 1000 < L; km++) sign(km * 1000, CF.wall ? CF.pw - 0.4 : CF.pw + 0.9, [{ t: km + ' km', size: 72 }], 1.5, 0.95, CF.sea ? '#0e4a6b' : CF.halloween ? '#2b1140' : CF.vegas ? '#140a2e' : CF.wall ? '#7a1c1c' : '#5b3e24', CF.halloween ? '#ff9a2e' : CF.vegas ? '#ff4fd8' : CF.wall ? '#f6d36b' : '#f5f0e6');
      if (CF.hills) { let lastHill = -500;
        for (let s2 = 0; s2 < L; s2 += 20) { const g = (at(s2 + 120).pos.y - at(s2 + 20).pos.y);
          if (g >= 4.5 && s2 - lastHill > 400) { lastHill = s2; sign(s2, -(CF.pw + 0.9), [{ t: 'CÔTE', size: 46 }, { t: Math.round(g) + ' %', size: 58 }], 1.4, 0.95, '#b45309'); } } }
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
      const ball = new T.Mesh(new T.SphereGeometry(0.42, 24, 16), new T.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.55 })); ball.position.y = 0.75; ball.castShadow = true;
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
    // autres coureurs (courses en direct) : un point de couleur et un prénom chacun
    const OTH = new Map(), LANES = forest ? [0.2, -0.2, 0.9, -0.9, 0.4, -0.4] : [2.44, 3.66, 4.88, 6.1, 7.32, 8.54];
    function label(txt, c) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(15,23,42,.72)'; const w = Math.min(250, g.measureText(txt).width + 28); g.fillRect(128 - w / 2, 8, w, 48); g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillText(txt, 128, 33);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthWrite: false, transparent: true })); sp.scale.set(3.2, 0.8, 1); sp.position.y = 1.95; return sp; }
    function others(list) { const seen = new Set(); list.forEach((p) => { seen.add(p.id); let o = OTH.get(p.id);
        if (!o) { const g = dot(p.c); g.add(label(String(p.n).slice(0, 12), p.c)); o = { g, s: { x: null, v: 0, t: 0, init: false }, lane: LANES[OTH.size % LANES.length] }; OTH.set(p.id, o); }
        o.tx = p.x; });
      for (const [id, o] of OTH) if (!seen.has(id)) { scene.remove(o.g); OTH.delete(id); } }
    function react(id, txt) { const g = id === 'me' ? me : (OTH.get(id) || {}).g; if (!g) return; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.font = '96px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 64, 70);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthWrite: false, transparent: true })); sp.scale.set(1.5, 1.5, 1); sp.position.y = 3.1; g.add(sp); const t0 = performance.now();
      const up = () => { const k = (performance.now() - t0) / 3000; if (k >= 1 || !S.alive) { g.remove(sp); return; } sp.position.y = 3.1 + k * 1.2; sp.material.opacity = k < 0.7 ? 1 : (1 - k) / 0.3; requestAnimationFrame(up); }; up(); }


    // prédateur (séances Aventure) : surgit derrière le coureur pendant un sprint
    let REXG = null; const CH = { t0: 0, dur: 0 };
    function mkRex() { const g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x4d5a2c, flatShading: true }), m2 = new T.MeshLambertMaterial({ color: 0x8a8f5a, flatShading: true }), ey = new T.MeshBasicMaterial({ color: 0xffcc22 });
      const P = (geo, mat, x, y, z, rx, rz) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); if (rx) o.rotation.x = rx; if (rz) o.rotation.z = rz; o.castShadow = true; g.add(o); return o; };
      const body = P(new T.SphereGeometry(1, 12, 9), m, 0, 2.6, 0); body.scale.set(0.95, 1.05, 2.1); body.rotation.x = -0.25;
      P(new T.ConeGeometry(0.75, 3.6, 9), m, 0, 2.5, -2.9, -Math.PI / 2 - 0.25);
      const neck = P(new T.CylinderGeometry(0.5, 0.75, 1.3, 8), m, 0, 3.6, 1.7, 0.9);
      const head = new T.Group(); head.position.set(0, 4.2, 2.4); g.add(head);
      const sk = new T.Mesh(new T.BoxGeometry(1.0, 0.8, 1.7), m); sk.position.set(0, 0.15, 0.6); head.add(sk);
      const jaw = new T.Mesh(new T.BoxGeometry(0.9, 0.3, 1.5), m2); jaw.position.set(0, -0.35, 0.55); head.add(jaw);
      [-0.38, 0.38].forEach((x) => { const e2 = new T.Mesh(new T.SphereGeometry(0.1, 6, 5), ey); e2.position.set(x, 0.38, 0.35); head.add(e2); });
      const teeth = new T.MeshBasicMaterial({ color: 0xf2efe0 }); for (let i = 0; i < 6; i++) { const t = new T.Mesh(new T.ConeGeometry(0.06, 0.2, 4), teeth); t.rotation.x = Math.PI; t.position.set(-0.35 + i * 0.14, -0.15, 1.35); head.add(t); }
      [-0.55, 0.55].forEach((x) => { P(new T.BoxGeometry(0.15, 0.6, 0.15), m, x * 0.9, 2.7, 1.6, 0.6); });
      const legs = [-0.6, 0.6].map((x) => { const L = new T.Group(); L.position.set(x, 2.3, -0.2); g.add(L);
        const th = new T.Mesh(new T.CylinderGeometry(0.42, 0.3, 1.5, 8), m); th.position.y = -0.7; L.add(th); const sh = new T.Mesh(new T.CylinderGeometry(0.22, 0.18, 1.2, 7), m); sh.position.set(0, -1.6, -0.2); sh.rotation.x = -0.3; L.add(sh);
        const ft = new T.Mesh(new T.BoxGeometry(0.45, 0.15, 0.8), m2); ft.position.set(0, -2.2, 0.15); L.add(ft); return L; });
      g.userData = { legs, jaw, head }; g.visible = false; scene.add(g); return g; }
    function mkPumpkin() { const g = new T.Group(), body = new T.Group(); g.add(body);
      const pm = new T.MeshLambertMaterial({ color: 0xf07a12, emissive: 0x7a2a00, emissiveIntensity: 0.7, flatShading: true });
      for (let i = 0; i < 8; i++) { const lobe = new T.Mesh(new T.SphereGeometry(1.15, 14, 12), pm); lobe.scale.set(0.55, 1, 1); lobe.rotation.y = i * Math.PI / 8; body.add(lobe); }
      const st = new T.Mesh(new T.CylinderGeometry(0.15, 0.25, 0.6, 7), lam(0x3b5a1e)); st.position.y = 1.2; body.add(st);
      const fm = new T.MeshBasicMaterial({ color: 0xffe066, side: T.DoubleSide });
      [[-0.42, 0.3], [0.42, 0.3]].forEach(([x, y]) => { const e2 = new T.Mesh(new T.CircleGeometry(0.24, 3), fm); e2.position.set(x, y, 1.13); e2.rotation.z = Math.PI / 2; body.add(e2); });
      const mouth = new T.Mesh(new T.PlaneGeometry(0.95, 0.24), fm); mouth.position.set(0, -0.28, 1.12); body.add(mouth);
      body.position.y = 1.15; g.userData = { anim: (t) => { body.rotation.x = -t / 180; body.position.y = 1.15 + 0.2 * Math.abs(Math.sin(t / 160)); } }; g.visible = false; scene.add(g); return g; }
    function mkSpider() { const g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x15101a, flatShading: true }), ey = new T.MeshBasicMaterial({ color: 0xff2020 });
      const ab = new T.Mesh(new T.SphereGeometry(1.1, 14, 10), m); ab.scale.set(1, 0.85, 1.25); ab.position.set(0, 1.5, -0.9); g.add(ab);
      const th = new T.Mesh(new T.SphereGeometry(0.65, 12, 9), m); th.position.set(0, 1.3, 0.6); g.add(th);
      for (let i = 0; i < 6; i++) { const e2 = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), ey); e2.position.set(-0.25 + (i % 3) * 0.25, 1.45 + Math.floor(i / 3) * 0.16, 1.18); g.add(e2); }
      const legs = []; for (let i = 0; i < 8; i++) { const side = i < 4 ? -1 : 1, k = i % 4, piv = new T.Group(); piv.position.set(side * 0.45, 1.35, 0.9 - k * 0.45); g.add(piv);
        const up = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 1.6, 6), m); up.position.set(side * 0.7, 0.35, 0); up.rotation.z = side * -1.1; piv.add(up);
        const lo = new T.Mesh(new T.CylinderGeometry(0.03, 0.06, 1.9, 6), m); lo.position.set(side * 1.45, -0.55, 0); lo.rotation.z = side * 0.35; piv.add(lo); legs.push({ piv, ph: k * 1.3 + (side > 0 ? Math.PI : 0) }); }
      g.userData = { anim: (t) => { legs.forEach((l) => { l.piv.rotation.y = 0.35 * Math.sin(t / 90 + l.ph); l.piv.rotation.x = 0.15 * Math.sin(t / 90 + l.ph + 1); }); ab.position.y = 1.5 + 0.08 * Math.sin(t / 120); } }; g.visible = false; scene.add(g); return g; }
    function mkBats() { const g = new T.Group(), bm = new T.MeshBasicMaterial({ color: 0x0a0610, side: T.DoubleSide }), sw = [];
      for (let i = 0; i < 40; i++) { const gg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(-0.9, 0.25, -0.25), new T.Vector3(-0.3, 0, 0.3), new T.Vector3(0, 0, 0), new T.Vector3(0.9, 0.25, -0.25), new T.Vector3(0.3, 0, 0.3)]);
        const b = new T.Mesh(gg, bm); b.scale.setScalar(0.6 + Math.random() * 0.5); g.add(b); sw.push({ b, x: (Math.random() - 0.5) * 4, y: 0.8 + Math.random() * 3.2, z: (Math.random() - 0.5) * 6, ph: Math.random() * 6.28 }); }
      g.userData = { anim: (t) => sw.forEach((o) => { o.b.position.set(o.x + 0.6 * Math.sin(t / 400 + o.ph), o.y + 0.5 * Math.sin(t / 250 + o.ph), o.z + 0.8 * Math.cos(t / 500 + o.ph)); o.b.rotation.z = 0.7 * Math.sin(t / 60 + o.ph); }) }; g.visible = false; scene.add(g); return g; }
    function mkHunter() { const g = new T.Group(), a = runner(0xef4444), b = runner(0x991b1b); scene.remove(a); scene.remove(b); a.scale.setScalar(1.15); b.scale.setScalar(1.15); b.position.set(0.9, 0, -2.2); g.add(a, b);
      let last = performance.now(); g.userData = { anim: (t) => { const d = Math.min(0.1, (t - last) / 1000); last = t; animate(a, 4.2, d); animate(b, 4.2, d); } }; g.visible = false; scene.add(g); return g; }
    const CHS = {}; let CHG = null;
    function chase(ms, kind) { kind = kind || 'rex'; if (CHG) CHG.visible = false; if (!CHS[kind]) CHS[kind] = kind === 'collapse' ? (() => { const g = new T.Group(); g.userData = { anim: () => {} }; scene.add(g); return g; })() : kind === 'hunter' ? mkHunter() : kind === 'pumpkin' ? mkPumpkin() : kind === 'spider' ? mkSpider() : kind === 'bats' ? mkBats() : (REXG = REXG || mkRex()); CHG = CHS[kind]; CH.kind = kind; CH.ext = null; CH.extT = null; CH.t0 = performance.now(); CH.dur = ms || 30000; }
    const S = { me: { x: 0, v: 0, t: 0, init: false }, ref: { x: null, v: 0, t: 0 }, lead: null, view: 'follow', alive: true, raf: 0, el, ren };
    function track(o, x) { const now = performance.now(); if (x == null) { o.x = null; return; }
      if (o.x == null || !o.init) { o.x = x; o.v = 0; o.t = now; o.init = true; return; }
      let dx = x - o.x; if (dx < -L / 2) dx += L; if (dx > L / 2) dx -= L; const dt = (now - o.t) / 1000;
      o.v = dt > 0.2 ? o.v * 0.6 + 0.4 * Math.max(0, Math.min(12, dx / dt)) : o.v; o.x = x; o.t = now; }
    const shown = (o) => { if (o.x == null) return null; const dt = Math.min(1.4, (performance.now() - o.t) / 1000); return o.x + o.v * dt; };
    let camPos = null, lookPos = null;
    function frame() {
      if (!S.alive) return; S.raf = requestAnimationFrame(frame);
      const tF = performance.now(); if (tF - (S.lastDraw || 0) < (HQ ? 15 : 31)) return; S.lastDraw = tF;   // 30 images/s en qualité normale
      const w = el.clientWidth, h = el.clientHeight; if (!w || !h || el.offsetParent === null) return;
      if (ren.domElement.width !== Math.round(w * ren.getPixelRatio())) { ren.setSize(w, h, false); cam.aspect = w / h; cam.fov = cam.aspect < 0.8 ? 74 : 60; cam.updateProjectionMatrix(); }
      const nowT = performance.now(), fdt = Math.min(0.1, (nowT - (S.lastF || nowT)) / 1000); S.lastF = nowT;
      const lv = window.trLive && window.trLive(); if (lv) S.me.v = lv.v;
      const xm = lv ? lv.x : (shown(S.me) ?? 0), A = at(xm, laneMe); me.position.copy(A.pos); me.rotation.y = Math.atan2(A.dir.x, A.dir.z); if (FIG) animate(me, S.me.v, fdt); else pulse(me, nowT);
      const gl = window.trGhost && window.trGhost(); if (gl) S.ref.v = gl.v; const xr = gl ? gl.x : shown(S.ref); if (xr != null) { const B = at(xr, laneRef); ref.position.copy(B.pos); ref.rotation.y = Math.atan2(B.dir.x, B.dir.z); if (FIG) animate(ref, S.ref.v, fdt); else pulse(ref, nowT); ref.visible = true; } else ref.visible = false;
      if (window.trOthers) { try { others(window.trOthers()); } catch (e) {} }
      OTH.forEach((o) => { if (o.tx == null) { o.g.visible = false; return; } o.dx = o.dx == null || Math.abs(o.tx - o.dx) > 50 ? o.tx : o.dx + (o.tx - o.dx) * Math.min(1, fdt * 4); const xo = o.dx; const C = at(xo, o.lane); o.g.position.copy(C.pos); o.g.visible = o.g.position.distanceTo(cam.position) > 6; pulse(o.g, nowT); });
      const lead = S.lead === 'me' ? me : S.lead === 'ref' && ref.visible ? ref : null; medal.visible = !!lead;
      if (lead) { medal.position.copy(lead.position).setY(lead.position.y + (FIG ? 2.15 : 1.65) + 0.08 * Math.sin(performance.now() / 300)); medal.rotation.y += 0.04; }

      // prédateur
      let chaseK = 0, lookBk = false;
      if (CH.ext != null && CH.extT != null) CH.ext += (CH.extT - CH.ext) * Math.min(1, fdt * 3);
      if (BRIDGE && CH.kind === 'collapse' && CH.dur && CH.ext != null) BRIDGE.set(xm - CH.ext);
      if (CH.dur) { const u = (performance.now() - CH.t0) / CH.dur; if (u >= 1) { CH.dur = 0; if (CHG) CHG.visible = false; } else {
        chaseK = CH.ext != null && (CH.kind === 'hunter' || CH.kind === 'collapse') ? Math.max(0, Math.min(1, (30 - CH.ext) / 12)) : Math.min(1, u * 8, (1 - u) * 6); const gap = CH.ext != null ? Math.max(1.2, CH.ext) : 4.5 + 7 * (1 - Math.min(1, u * 4)) + 10 * Math.max(0, (u - 0.85) / 0.15);
        const R = at(xm - gap, laneMe + (CH.kind === 'rex' ? 1.3 : CH.kind === 'bats' ? 0.4 : CH.kind === 'hunter' ? 0.7 : 1.0)), t = performance.now(); lookBk = CH.kind === 'collapse' ? (CH.ext != null && CH.ext < 22) : CH.kind !== 'hunter' && (performance.now() - CH.t0) < 4000 && CH.dur > 8000; CHG.position.copy(R.pos); CHG.rotation.y = Math.atan2(R.dir.x, R.dir.z); CHG.visible = true;
        if (CH.kind === 'rex') { const ph = t / 140; REXG.userData.legs[0].rotation.x = 0.6 * Math.sin(ph); REXG.userData.legs[1].rotation.x = -0.6 * Math.sin(ph); REXG.position.y += 0.15 * Math.abs(Math.sin(ph));
        REXG.userData.jaw.rotation.x = 0.25 + 0.25 * Math.sin(t / 220); REXG.userData.head.rotation.x = 0.08 * Math.sin(t / 300); } else CHG.userData.anim(t); } }
      let want, look;
      if (S.view === 'top') { const c = forest ? A.pos : new T.Vector3(0, 0, 0); want = c.clone().add(new T.Vector3(0, forest ? 120 : 150, forest ? 40 : 60)); look = c.clone(); }
      else if (lookBk) { const fr = at(xm + (CH.kind === 'collapse' ? 9 : 13), laneMe - 1.0), bk = at(xm - (CH.kind === 'collapse' ? 16 : 7), laneMe + 1.0); want = fr.pos.clone().setY(fr.pos.y + 4.2); look = bk.pos.clone().setY(bk.pos.y + 2.4); }
      else { const back = at(xm - 9 - ((CH.kind === 'hunter' || CH.kind === 'collapse') && CH.ext != null ? Math.max(7, CH.ext + 3) : 7) * chaseK, laneMe - 0.8 * chaseK), fwd = at(xm + 7, laneMe); want = back.pos.clone().setY(Math.max(back.pos.y, A.pos.y) + 3.4 + 3.8 * chaseK); look = fwd.pos.clone().setY(fwd.pos.y + (cam.aspect < 0.8 ? 2.6 : 1.0)); }
      const kk = 1 - Math.exp(-6 * Math.max(fdt, 0.016));
      camPos = camPos && camPos.distanceTo(want) < 60 ? camPos.lerp(want, kk) : want.clone(); lookPos = lookPos && lookPos.distanceTo(look) < 60 ? lookPos.lerp(look, kk) : look.clone(); cam.position.copy(camPos); cam.lookAt(lookPos);
      if (board) { const lap = Math.floor((S.lapDist || 0) / 400) + 1, txt = 'TOUR ' + lap + '|' + ((S.lapDist || 0) / 1000).toFixed(2).replace('.', ',') + ' km';
        if (txt !== board.last) { board.last = txt; const g = board.canvas.getContext('2d'); g.fillStyle = '#111827'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#fbbf24'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = 'bold 70px sans-serif'; g.fillText('TOUR ' + lap, 256, 90); g.font = 'bold 48px sans-serif'; g.fillText(txt.split('|')[1], 256, 180); board.tex.needsUpdate = true; }
        board.mesh.lookAt(cam.position.x, board.mesh.position.y, cam.position.z); }
      sun.position.copy(me.position).addScaledVector(sunDir, 150); sun.target.position.copy(me.position); SKY.position.copy(cam.position);
      ANIM.forEach((f) => f(nowT));
      if (S_waves) S_waves[1].material.opacity = 0.4 + 0.25 * Math.sin(nowT / 900);
      ren.render(scene, cam);
    }
    frame();
    return {
      route, decor: k,
      place(x, gx, total) { track(S.me, x); track(S.ref, gx); S.lapDist = total; },
      dbg() { return { cam: cam.position.toArray().map(Math.round), me: me.position.toArray().map((v) => Math.round(v * 100) / 100), x: S.me.x, v: S.me.v, ref: ref.visible ? ref.position.toArray().map((v) => Math.round(v * 100) / 100) : null, ch: CHG && CHG.visible ? CHG.position.distanceTo(me.position) : null }; },
      others,
      react,
      chase,
      chaseGap(g) { CH.extT = g; if (g == null || CH.ext == null || Math.abs(g - CH.ext) > 15) CH.ext = g; },
      chaseMore(ms) { if (CH.dur) CH.dur += ms; },
      chaseStop() { CH.dur = 0; CH.ext = null; CH.extT = null; if (CHG) CHG.visible = false; },
      collapse(front) { if (BRIDGE && (front == null || !(CH.kind === 'collapse' && CH.dur))) BRIDGE.set(front); },
      setLeader(l) { S.lead = l; },
      toggleView() { S.view = S.view === 'follow' ? 'top' : 'follow'; return S.view; },
      resize() { camPos = null; lookPos = null; },
      remove() { S.alive = false; cancelAnimationFrame(S.raf); try { ren.dispose(); ren.forceContextLoss(); } catch (e) {} el.innerHTML = ''; },
    };
  }

  window.VR = { DEFS, routePts, create };
})();
