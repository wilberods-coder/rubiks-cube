/* ==========================================================================
   Кубик Рубика — интерактив
   1. Lenis (smooth scroll) + GSAP ScrollTrigger
   2. Скролл-сцены: Hero, манифест, История (sticky), Механика (sticky), Культура
   3. Three.js: процедурный кубик 3×3 с крестовиной, взрывом и вращением слоёв
   Three.js грузится динамически: если CDN/WebGL недоступен, сайт работает без 3D.
   ========================================================================== */

const { gsap, ScrollTrigger, Lenis } = window;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Общее состояние кубика. Скролл-анимации пишут сюда, рендер-цикл читает. */
const cubeState = {
  intro: 0,     // 0→1 появление после загрузки
  hero: 0,      // прогресс ухода Hero из вьюпорта
  mechIn: 0,    // вход секции «Механика»
  mechOut: 0,   // выход из неё
  m: { explode: 0, sepY: 0, top: 0, mid: 0, bot: 0, spin: 0, tilt: 0 },
  idle: { top: 0, mid: 0, bot: 0 }, // случайные повороты слоёв в Hero
};


/* ==========================================================================
   1. Smooth scroll
   ========================================================================== */
function initSmoothScroll() {
  if (reducedMotion || !Lenis) return null;
  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  // Lenis и ScrollTrigger работают от одного тикера GSAP
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.lenis = lenis; // доступ из консоли для отладки
  return lenis;
}

function initAnchors(lenis) {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      const target = hash === '#top' ? 0 : document.querySelector(hash);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6 });
      else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ==========================================================================
   2. Скролл-сцены
   ========================================================================== */
function initHero() {
  gsap.from('[data-hero]', {
    y: 40, opacity: 0, duration: 1.3, stagger: 0.12, ease: 'power3.out', delay: 0.15,
  });

  // Текст уходит вверх и растворяется
  gsap.to('.hero__content', {
    y: -90, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '65% top', scrub: true },
  });
  gsap.to('.hero__hint', {
    opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '15% top', scrub: true },
  });

  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => { cubeState.hero = self.progress; },
    onLeave: solveIdleLayers, // уходя из Hero, «собираем» кубик обратно
  });
}

function initStatement() {
  const el = document.querySelector('.statement__text');
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.to(el.querySelectorAll('.w'), {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
  });
}

function initHistory() {
  const steps = [...document.querySelectorAll('.history__step')];
  const slides = [...document.querySelectorAll('.slide')];
  const dots = [...document.querySelectorAll('.history__progress span')];
  const bg = document.querySelector('.history__bg');
  // Фон «эпохи»: синька чертежа → тёплое дерево → венгерская зелень → чёрный мир
  const colors = ['#071a2e', '#1c140d', '#08150f', '#050505'];
  let current = 0;

  const setStep = (i) => {
    if (i === current) return;
    current = i;
    [steps, slides, dots].forEach((list) => list.forEach((el, n) => el.classList.toggle('is-active', n === i)));
    bg.style.backgroundColor = colors[i];
  };

  ScrollTrigger.create({
    trigger: '.history__track',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
  });

  // Лёгкий параллакс визуала внутри залипшего экрана
  gsap.fromTo('.history__visual', { yPercent: 5 }, {
    yPercent: -5, ease: 'none',
    scrollTrigger: { trigger: '.history__track', start: 'top top', end: 'bottom bottom', scrub: true },
  });
}

function initMechanics() {
  const track = '.mech__track';
  const steps = [...document.querySelectorAll('.mech__step')];
  const { m } = cubeState;
  let current = 0;

  // Плавное появление/уход 3D-кубика вокруг залипшей секции
  ScrollTrigger.create({
    trigger: track, start: 'top 45%', end: 'top top',
    onUpdate: (self) => { cubeState.mechIn = self.progress; },
  });
  ScrollTrigger.create({
    trigger: track, start: 'bottom bottom', end: 'bottom 30%',
    onUpdate: (self) => { cubeState.mechOut = self.progress; },
  });

  // Хореография кубика: 4 шага по 1 единице времени
  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
  });
  const Q = Math.PI / 2;
  tl
    // 01 Крестовина — кубик приоткрывается, видно ядро
    .to(m, { spin: Q * 0.3, duration: 0.25, ease: 'none' })
    .to(m, { explode: 0.6, spin: Q * 0.8, tilt: 0.15, duration: 0.75 })
    // 02 26 деталей — полный разбор на элементы
    .to(m, { explode: 1.05, spin: Q * 1.5, tilt: 0.3, duration: 0.8 })
    .to(m, { spin: Q * 1.7, duration: 0.2, ease: 'none' })
    // 03 Слои — собираем, раздвигаем по вертикали и вращаем слои
    .to(m, { explode: 0, sepY: 0.42, tilt: 0.05, duration: 0.35 })
    .to(m, { top: Q, bot: -Q, duration: 0.45 })
    .to(m, { mid: Q, duration: 0.2 })
    // 04 43 квинтиллиона — перемешиваем и смыкаем слои
    .to(m, { top: Q * 3, mid: -Q, bot: -Q * 2, sepY: 0, spin: Q * 4, tilt: 0.2, duration: 1 });

  ScrollTrigger.create({
    trigger: track, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
      if (i === current) return;
      current = i;
      steps.forEach((el, n) => el.classList.toggle('is-active', n === i));
    },
  });

  // Параллакс характеристик: data-speed задаёт амплитуду
  gsap.utils.toArray('[data-speed]').forEach((el) => {
    const speed = parseFloat(el.dataset.speed) || 0;
    gsap.fromTo(el, { y: () => speed * 160 }, {
      y: () => -speed * 160, ease: 'none',
      scrollTrigger: { trigger: '.specs', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });
}

function initCulture() {
  // Навигация становится светлой над белой секцией
  ScrollTrigger.create({
    trigger: '.culture',
    start: 'top 26px',
    end: 'bottom 26px',
    toggleClass: { targets: '#nav', className: 'is-light' },
  });

  // «Перебор комбинаций» в большом числе
  const big = document.getElementById('combos');
  ScrollTrigger.create({
    trigger: big, start: 'top 85%', once: true,
    onEnter: () => scrambleDigits(big),
  });

  gsap.from('.bar__fill', {
    scaleX: 0, duration: 1.4, stagger: 0.12, ease: 'power3.out',
    scrollTrigger: { trigger: '.bars', start: 'top 85%', once: true },
  });

  document.querySelectorAll('[data-count]').forEach((el) => {
    const to = parseInt(el.dataset.count, 10);
    const from = to > 1000 ? to - 60 : 0; // годы «докручиваются», а не растут с нуля
    const obj = { v: from };
    el.textContent = from;
    gsap.to(obj, {
      v: to, duration: 1.6, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.textContent = Math.round(obj.v); },
    });
  });
}

function scrambleDigits(el) {
  const final = el.textContent;
  if (reducedMotion) return;
  const chars = [...final];
  const p = { v: 0 };
  gsap.to(p, {
    v: 1, duration: 2, ease: 'power2.out',
    onUpdate: () => {
      const settled = Math.floor(p.v * chars.length);
      el.textContent = chars.map((ch, i) => (ch === ' ' || i < settled ? ch : (Math.random() * 10) | 0)).join('');
    },
    onComplete: () => { el.textContent = final; },
  });
}

/* Fade-in снизу: y 50 → 0, opacity 0 → 1, пачками */
function initReveals() {
  const items = gsap.utils.toArray('[data-reveal]');
  if (reducedMotion) { gsap.set(items, { clearProps: 'all', opacity: 1 }); return; }
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      y: 0, opacity: 1, duration: 1.1, stagger: 0.1, ease: 'power3.out', overwrite: true,
    }),
  });
}

/* ==========================================================================
   Иллюстрации истории (изометрические SVG, генерируются кодом)
   ========================================================================== */
const ISO = Math.cos(Math.PI / 6);
const isoPt = (x, y, z, s) => [200 + (x - z) * ISO * s, 200 + ((x + z) / 2 - y) * s];
const toD = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L') + ' Z';
const lineD = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');

function cellQuad(face, i, j) {
  if (face === 'top') return [[i, 3, j], [i + 1, 3, j], [i + 1, 3, j + 1], [i, 3, j + 1]];
  if (face === 'left') return [[i, j, 3], [i + 1, j, 3], [i + 1, j + 1, 3], [i, j + 1, 3]];
  return [[3, j, i], [3, j, i + 1], [3, j + 1, i + 1], [3, j + 1, i]];
}

function inset(quad, k) {
  const c = quad.reduce((a, p) => a.map((v, n) => v + p[n] / quad.length), [0, 0, 0]);
  return quad.map((p) => p.map((v, n) => c[n] + (v - c[n]) * (1 - k)));
}

function eachCell(fn) {
  let n = 0;
  for (const face of ['top', 'left', 'right']) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) fn(face, i, j, n++);
  }
}

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svgWrap = (inner, defs = '') =>
  `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" fill="none">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;
const label = (x, y, text, anchor = 'start', extra = '') =>
  `<text class="label" x="${x}" y="${y}" text-anchor="${anchor}" fill="rgba(255,255,255,.55)" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="10" letter-spacing="2" ${extra}>${text}</text>`;
const hexOutline = (s) => toD([[0, 3, 0], [3, 3, 0], [3, 0, 0], [3, 0, 3], [0, 0, 3], [0, 3, 3]].map((p) => isoPt(...p, s)));

function blueprintSVG() {
  const s = 46;
  let out = '<rect width="400" height="400" fill="url(#bp-grid)" mask="url(#bp-fade)"/>';
  // скрытые рёбра — пунктиром
  const back = isoPt(0, 0, 0, s);
  [[3, 0, 0], [0, 3, 0], [0, 0, 3]].forEach((p) => {
    out += `<path class="label" d="${lineD([back, isoPt(...p, s)])}" stroke="rgba(255,255,255,.3)" stroke-dasharray="4 5"/>`;
  });
  eachCell((face, i, j, n) => {
    out += `<path class="draw" pathLength="1" style="--d:${(n * 0.025).toFixed(3)}s" d="${toD(cellQuad(face, i, j).map((p) => isoPt(...p, s)))}" stroke="rgba(255,255,255,.85)" stroke-width="1.1"/>`;
  });
  out += `<path class="draw" pathLength="1" d="${hexOutline(s)}" stroke="#fff" stroke-width="2"/>`;
  // стрелка вращения верхнего слоя
  const arc = [];
  for (let a = 200; a <= 330; a += 5) {
    const r = (a * Math.PI) / 180;
    arc.push(isoPt(1.5 + Math.cos(r) * 2.35, 3.25, 1.5 + Math.sin(r) * 2.35, s));
  }
  out += `<path class="draw" pathLength="1" style="--d:.8s" d="${lineD(arc)}" stroke="${'#5eb8ff'}" stroke-width="1.6"/>`;
  const [ex, ey] = arc[arc.length - 1];
  const [px, py] = arc[arc.length - 3];
  const ang = Math.atan2(ey - py, ex - px);
  const head = [[ex - 9 * Math.cos(ang - 0.45), ey - 9 * Math.sin(ang - 0.45)], [ex, ey], [ex - 9 * Math.cos(ang + 0.45), ey - 9 * Math.sin(ang + 0.45)]];
  out += `<path class="label" d="${lineD(head)}" stroke="#5eb8ff" stroke-width="1.6"/>`;
  // размерная линия по нижнему правому ребру
  const a = isoPt(3, 0, 0, s), b = isoPt(3, 0, 3, s);
  const off = (p) => [p[0] + 0.5 * 24, p[1] + ISO * 24];
  out += `<path class="draw" pathLength="1" style="--d:1s" d="${lineD([off(a), off(b)])}" stroke="rgba(255,255,255,.6)"/>`;
  out += `<path class="label" d="${lineD([a, off(a)])} ${lineD([b, off(b)])}" stroke="rgba(255,255,255,.35)"/>`;
  const mid = off([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  out += label(mid[0] + 10, mid[1] + 14, '57 MM', 'middle', `transform="rotate(-30 ${mid[0] + 10} ${mid[1] + 14})"`);
  out += label(16, 28, 'FIG. 1 — 3×3×3');
  out += label(16, 44, 'E. RUBIK · BUDAPEST · 1974');
  out += label(384, 384, 'ROT. 90°', 'end');
  const defs = `
    <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0H0V20" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
    </pattern>
    <radialGradient id="bp-g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <mask id="bp-fade"><rect width="400" height="400" fill="url(#bp-g)"/></mask>`;
  return svgWrap(out, defs);
}

function woodSVG() {
  const s = 46;
  const rnd = seeded(7);
  const tones = {
    top: ['#e6c08f', '#dcb282', '#ecc99c'],
    left: ['#c99a66', '#bf905d', '#d3a473'],
    right: ['#a67848', '#9b6e42', '#b08352'],
  };
  let out = '';
  eachCell((face, i, j, n) => {
    const fill = tones[face][(rnd() * 3) | 0];
    const d = toD(inset(cellQuad(face, i, j), 0.03).map((p) => isoPt(...p, s)));
    out += `<path class="fill" style="--d:${(n * 0.03).toFixed(2)}s" d="${d}" fill="${fill}"/>`;
    out += `<path class="draw" pathLength="1" style="--d:${(n * 0.03).toFixed(2)}s" d="${d}" stroke="#5a3d22" stroke-width="1.2"/>`;
    // волокна древесины
    const q = cellQuad(face, i, j);
    for (const t of [0.35, 0.65]) {
      const p1 = q[0].map((v, k) => v + (q[3][k] - v) * t);
      const p2 = q[1].map((v, k) => v + (q[2][k] - v) * t);
      out += `<path class="label" d="${lineD([isoPt(...p1, s), isoPt(...p2, s)])}" stroke="rgba(90,61,34,.25)" stroke-width=".8"/>`;
    }
  });
  // резинки, стягивающие бруски
  const band = (pts, delay) =>
    `<path class="draw" pathLength="1" style="--d:${delay}s" d="${lineD(pts.map((p) => isoPt(...p, s)))}" stroke="#d2493c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  out += band([[1.5, 0, 3], [1.5, 3, 3], [1.5, 3, 0]], 1);
  out += band([[3, 0, 1.5], [3, 3, 1.5], [0, 3, 1.5]], 1.2);
  out += label(16, 28, 'ПРОТОТИП №1');
  out += label(16, 44, 'ДЕРЕВО · РЕЗИНКИ');
  out += label(384, 384, '> 1 МЕСЯЦ НА СБОРКУ', 'end');
  return svgWrap(out);
}

function stickerCube(s, colorFor, glowColors) {
  let out = `<path class="fill" d="${hexOutline(s)}" fill="#0c0c0d" stroke="#0c0c0d" stroke-width="6" stroke-linejoin="round"/>`;
  eachCell((face, i, j, n) => {
    const d = toD(inset(cellQuad(face, i, j), 0.14).map((p) => isoPt(...p, s)));
    const shade = face === 'top' ? 1 : face === 'left' ? 0.86 : 0.72;
    out += `<path class="fill" style="--d:${(n * 0.035).toFixed(3)}s" d="${d}" fill="${colorFor(face, i, j)}" stroke="${colorFor(face, i, j)}" stroke-width="5" stroke-linejoin="round" opacity="${shade}"/>`;
  });
  out += `<path class="draw" pathLength="1" d="${hexOutline(s)}" stroke="rgba(255,255,255,.35)" stroke-width="1"/>`;
  const glow = glowColors
    ? `<circle class="label" cx="200" cy="215" r="170" fill="url(#glow)"/>`
    : '';
  return glow + out;
}

function magicSVG() {
  const flag = { top: '#f5f5f7', left: '#ff5f6d', right: '#5cf2a5' };
  let out = stickerCube(44, (face) => flag[face], true);
  out += label(16, 28, 'BŰVÖS KOCKA');
  out += label(16, 44, 'POLITECHNIKA · BUDAPEST');
  out += label(384, 384, 'HU 170062', 'end');
  const defs = `<radialGradient id="glow"><stop offset="0" stop-color="#5cf2a5" stop-opacity=".22"/><stop offset="1" stop-color="#5cf2a5" stop-opacity="0"/></radialGradient>`;
  return svgWrap(out, defs);
}

function worldSVG() {
  const palette = ['#f5f5f7', '#ffe066', '#ff5f6d', '#ffb35c', '#5cf2a5', '#5eb8ff'];
  const rnd = seeded(1980);
  let out = `
    <g class="orbit"><ellipse cx="200" cy="200" rx="190" ry="64" transform="rotate(-18 200 200)" stroke="rgba(255,255,255,.16)" stroke-dasharray="2 6"/>
      <circle cx="390" cy="200" r="3.5" fill="#5eb8ff" transform="rotate(-18 200 200)"/></g>
    <g class="orbit orbit--rev"><ellipse cx="200" cy="200" rx="180" ry="90" transform="rotate(24 200 200)" stroke="rgba(255,255,255,.12)" stroke-dasharray="2 6"/>
      <circle cx="20" cy="200" r="3.5" fill="#ff5f6d" transform="rotate(24 200 200)"/></g>`;
  out += stickerCube(40, () => palette[(rnd() * 6) | 0], true);
  out += label(16, 28, 'RUBIK’S CUBE · IDEAL TOY CORP.');
  out += label(16, 44, '1980');
  out += label(200, 384, 'LONDON · PARIS · NÜRNBERG · NEW YORK', 'middle');
  const defs = `<radialGradient id="glow"><stop offset="0" stop-color="#ff5f6d" stop-opacity=".2"/><stop offset=".5" stop-color="#5eb8ff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
  return svgWrap(out, defs).replace(/id="glow"/, 'id="glow-w"').replace(/url\(#glow\)/, 'url(#glow-w)');
}

function buildHistorySlides() {
  const builders = { blueprint: blueprintSVG, wood: woodSVG, magic: magicSVG, world: worldSVG };
  document.querySelectorAll('.slide').forEach((el) => { el.innerHTML = builders[el.dataset.slide](); });
}

/* ==========================================================================
   3. Three.js — кубик Рубика
   ========================================================================== */

function solveIdleLayers() {
  const full = Math.PI * 2;
  const idle = cubeState.idle;
  gsap.to(idle, {
    top: Math.round(idle.top / full) * full,
    mid: Math.round(idle.mid / full) * full,
    bot: Math.round(idle.bot / full) * full,
    duration: 0.8, ease: 'power3.inOut', overwrite: true,
  });
}

function scheduleIdleTwist() {
  gsap.delayedCall(2.6, () => {
    if (cubeState.hero < 0.25 && !document.hidden) {
      const key = ['top', 'mid', 'bot'][(Math.random() * 3) | 0];
      const dir = Math.random() < 0.5 ? -1 : 1;
      gsap.to(cubeState.idle, {
        [key]: cubeState.idle[key] + (dir * Math.PI) / 2,
        duration: 0.75, ease: 'power3.inOut',
      });
    }
    scheduleIdleTwist();
  });
}

async function initCube(canvas) {
  let THREE, RoundedBoxGeometry, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (err) {
    console.warn('Three.js недоступен, 3D отключено', err);
    canvas.remove();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL недоступен', err);
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // сохраняем насыщенность граней

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 6, 6);
  const rim = new THREE.DirectionalLight(0x7fb2ff, 1.6);
  rim.position.set(-6, 2, -5);
  scene.add(key, rim);

  /* --- Геометрия --- */
  const root = new THREE.Group();  // позиция и масштаб в кадре
  const cube = new THREE.Group();  // вращение
  root.add(cube);
  scene.add(root);

  const bodyGeo = new RoundedBoxGeometry(0.94, 0.94, 0.94, 4, 0.09);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x050506, roughness: 0.45, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.35,
    envMapIntensity: 0.35,
  });

  const stickerGeo = new THREE.ShapeGeometry(roundedRect(THREE, 0.78, 0.14), 6);
  const FACES = [
    { axis: 'x', sign: 1, color: 0xff453a, rot: [0, Math.PI / 2, 0] },   // красный
    { axis: 'x', sign: -1, color: 0xff9f0a, rot: [0, -Math.PI / 2, 0] }, // оранжевый
    { axis: 'y', sign: 1, color: 0xf5f5f7, rot: [-Math.PI / 2, 0, 0] },  // белый
    { axis: 'y', sign: -1, color: 0xffd60a, rot: [Math.PI / 2, 0, 0] },  // жёлтый
    { axis: 'z', sign: 1, color: 0x30d158, rot: [0, 0, 0] },             // зелёный
    { axis: 'z', sign: -1, color: 0x0a84ff, rot: [0, Math.PI, 0] },      // синий
  ];
  FACES.forEach((f) => {
    f.mat = new THREE.MeshPhysicalMaterial({
      color: f.color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2,
      envMapIntensity: 0.55, emissive: f.color, emissiveIntensity: 0.12,
    });
  });

  // Три горизонтальных слоя: вращаются вокруг Y независимо
  const layers = [0, 1, 2].map(() => {
    const g = new THREE.Group();
    cube.add(g);
    return g;
  });

  const cubies = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue; // центр — это крестовина
        const piece = new THREE.Group();
        piece.add(new THREE.Mesh(bodyGeo, bodyMat));
        const pos = { x, y, z };
        FACES.forEach((f) => {
          if (pos[f.axis] !== f.sign) return;
          const sticker = new THREE.Mesh(stickerGeo, f.mat);
          sticker.position[f.axis] = f.sign * 0.472;
          sticker.rotation.set(...f.rot);
          piece.add(sticker);
        });
        piece.userData.home = new THREE.Vector3(x, y, z);
        layers[y + 1].add(piece);
        cubies.push(piece);
      }
    }
  }

  // Крестовина: сфера + 3 оси
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 0.9, roughness: 0.25 });
  const core = new THREE.Group();
  core.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), coreMat));
  const axisGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 20);
  const axisY = new THREE.Mesh(axisGeo, coreMat);
  const axisX = new THREE.Mesh(axisGeo, coreMat);
  axisX.rotation.z = Math.PI / 2;
  const axisZ = new THREE.Mesh(axisGeo, coreMat);
  axisZ.rotation.x = Math.PI / 2;
  core.add(axisX, axisY, axisZ);
  cube.add(core);

  /* --- Камера под размер экрана --- */
  const view = { visW: 1, visH: 1, portrait: false, phone: false };
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // кубик занимает ~40% высоты на desktop и ~60% ширины на телефоне
    const visH = Math.max(3.4 / 0.4, 3.4 / (0.6 * camera.aspect));
    camera.position.set(0, 0, visH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    view.visH = visH;
    view.visW = visH * camera.aspect;
    view.portrait = camera.aspect < 0.9;
    view.phone = camera.aspect < 0.62; // узкий телефонный экран
  }
  resize();
  window.addEventListener('resize', resize);

  /* --- Мышь --- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* --- Рендер-цикл на тикере GSAP (синхронно с Lenis) --- */
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  let spin = 0;
  let last = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const s = cubeState;
    const heroVis = 1 - smooth(0.3, 0.85, s.hero);
    const mechVis = s.mechIn * (1 - s.mechOut);
    const vis = Math.max(heroVis, mechVis) * s.intro;
    canvas.style.opacity = vis.toFixed(3);
    if (vis < 0.003) return; // кубик не виден — не тратим GPU

    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    if (!reducedMotion) spin += dt * 0.18;

    const m = s.m;
    let px, py, scale, rx, ry, explode = 0, sepY = 0;
    if (s.mechIn <= 0.001) {
      // Hero: под заголовком, тянется за мышью, при скролле уплывает вверх
      const h = s.hero;
      px = 0;
      // телефон / планшет в портрете / ландшафт
      const [offY, size] = view.phone ? [0.17, 1] : view.portrait ? [0.25, 0.64] : [0.22, 0.72];
      py = -view.visH * offY + h * view.visH * 0.3;
      scale = (0.85 + 0.15 * easeOut(s.intro)) * (1 - h * 0.25) * size;
      ry = 0.65 + spin + h * 2.2 + pointer.sx * 0.6;
      rx = 0.42 + pointer.sy * 0.35 + h * 0.5;
    } else {
      // Механика: справа на desktop, сверху на телефоне
      px = view.portrait ? 0 : view.visW * 0.2;
      py = view.portrait ? view.visH * 0.15 : 0;
      py -= (1 - easeOut(s.mechIn)) * view.visH * 0.35;
      py += s.mechOut * view.visH * 0.35;
      scale = view.portrait ? 0.72 : 1;
      ry = 0.75 + m.spin + spin * 0.25 + pointer.sx * 0.25;
      rx = 0.4 + m.tilt + pointer.sy * 0.15;
      explode = m.explode;
      sepY = m.sepY;
    }

    root.position.set(px, py, 0);
    root.scale.setScalar(scale);
    cube.rotation.set(rx, ry, 0);

    layers[2].rotation.y = s.idle.top + m.top;
    layers[1].rotation.y = s.idle.mid + m.mid;
    layers[0].rotation.y = s.idle.bot + m.bot;

    const e = 1 + explode * 0.9;
    for (const c of cubies) {
      const hm = c.userData.home;
      c.position.set(hm.x * e, hm.y * (e + sepY), hm.z * e);
    }
    // оси дотягиваются до центров
    axisX.scale.y = axisZ.scale.y = e - 0.3;
    axisY.scale.y = e + sepY - 0.3;

    renderer.render(scene, camera);
  }

  gsap.ticker.add(render);
  gsap.to(cubeState, { intro: 1, duration: 1.6, ease: 'power2.out', delay: 0.2 });
  if (!reducedMotion) scheduleIdleTwist();
}

function roundedRect(THREE, size, r) {
  const h = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  return shape;
}

/* ==========================================================================
   Запуск
   ========================================================================== */
if (!gsap || !ScrollTrigger) {
  // Библиотеки не загрузились — просто показываем контент
  document.documentElement.classList.remove('js');
} else {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  buildHistorySlides();
  const lenis = initSmoothScroll();
  initAnchors(lenis);
  initHero();
  initStatement();
  initHistory();
  initMechanics();
  initCulture();
  initReveals();
  initCube(document.getElementById('cube-canvas'));
}
