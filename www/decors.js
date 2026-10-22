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
    ren.shadowMap.enabled = sun.castShadow; ren.shadowMap.type = T.PCFShadowMap; cam.far = k === 'mountain' ? 3000 : 1500; cam.updateProjectionMatrix();

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

    let board = null, S_waves = null; const ANIM = [];
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
      }[k];
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const minY = Math.min(...P.map((p) => p.y)), waterY = minY - 0.6, SEAREL = CF.sea && Math.max(...P.map((p) => p.y)) - minY > 4;
      if (CF.lake) { ribbon(-14, -2, 3, lam(CF.ground), -0.08, (o, s2) => o <= -14 ? waterY - 0.3 - at(s2).pos.y : 0); ribbon(-2, 45, 4, lam(CF.ground), -0.08); }
      else if (!CF.sea) ribbon(-45, 45, 4, lam(CF.ground), -0.08);
      else if (SEAREL) { const sg = lam(CF.ground), drop = (o, s2) => Math.abs(o) > 10 ? -at(s2).pos.y - 0.4 : 0;
        ribbon(-6, 6, 4, sg, -0.08); ribbon(6, 18, 4, sg, -0.08, drop); ribbon(-18, -6, 4, sg, -0.08, drop); }
      ribbon(-CF.pw, CF.pw, 2, lam(CF.path), 0.0);
      const base = new T.Mesh(new T.PlaneGeometry(9000, 9000), lam(CF.base)); base.rotation.x = -Math.PI / 2; base.position.y = CF.sea ? 0 : CF.lake ? waterY - 1.5 : minY - 2; base.receiveShadow = true; scene.add(base);
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
      const spots = { pine: [], leaf: [], palm: [], fern: [] };
      for (let s2 = 0; s2 < L; s2 += CF.step) for (const side of [-1, 1]) {
        if (CF.lake && side < 0 && rnd() < 0.85) continue;                  // côté lac : peu d'arbres
        if (CF.sea && at(s2, side * 5).pos.z > at(s2).pos.z) continue;               // pas de palmiers côté mer
        const off = side * (CF.pw + 2 + rnd() ** 1.6 * (CF.lake && side < 0 ? 6 : CF.far)); const A = at(s2 + rnd() * 2, off);
        if (near(A.pos.x, A.pos.z, CF.pw + 1.5)) continue; const t = pick(); spots[t].push([A.pos.x, (SEAREL && Math.abs(off) > 12 ? 0 : A.pos.y) - 0.1, A.pos.z, 0.75 + rnd() * 0.75, rnd() * 6.28]);
      }
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), col = new T.Color(), e = new T.Euler();
      const inst = (geo, mat, n, shadow = true) => { const m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };
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
      for (let km = 1; km * 1000 < L; km++) sign(km * 1000, CF.pw + 0.9, [{ t: km + ' km', size: 72 }], 1.5, 0.95, CF.sea ? '#0e4a6b' : '#5b3e24', '#f5f0e6');
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
      let want, look;
      if (S.view === 'top') { const c = forest ? A.pos : new T.Vector3(0, 0, 0); want = c.clone().add(new T.Vector3(0, forest ? 120 : 150, forest ? 40 : 60)); look = c.clone(); }
      else { const back = at(xm - 9, laneMe), fwd = at(xm + 7, laneMe); want = back.pos.clone().setY(Math.max(back.pos.y, A.pos.y) + 3.4); look = fwd.pos.clone().setY(fwd.pos.y + (cam.aspect < 0.8 ? 2.6 : 1.0)); }
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
      dbg() { return { cam: cam.position.toArray().map(Math.round), me: me.position.toArray().map((v) => Math.round(v * 100) / 100), x: S.me.x, v: S.me.v, ref: ref.visible ? ref.position.toArray().map((v) => Math.round(v * 100) / 100) : null }; },
      others,
      react,
      setLeader(l) { S.lead = l; },
      toggleView() { S.view = S.view === 'follow' ? 'top' : 'follow'; return S.view; },
      resize() { camPos = null; lookPos = null; },
      remove() { S.alive = false; cancelAnimationFrame(S.raf); try { ren.dispose(); ren.forceContextLoss(); } catch (e) {} el.innerHTML = ''; },
    };
  }

  window.VR = { DEFS, routePts, create };
})();
