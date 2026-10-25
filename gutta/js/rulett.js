/* =========================================================
   RULETT — Gutta-utgaven
   Hjulet tegnes på canvas og kula følger en enkel "fysikk":
   den går motsatt vei av hjulet, mister fart, spiraler inn og
   hopper litt før den lander. Resultatet trekkes rettferdig
   (crypto) før kula slippes, og animasjonen lander der.
   Det er bare deg mot huset. Nivået bestemmer hjulet:
   - Lett: europeisk hjul med «la partage» (halve tapet tilbake
     på enkle sjanser når kula lander på 0). Husets fordel 1,35 %.
   - Middels: europeisk hjul. Husets fordel 2,70 %.
   - Vanskelig: amerikansk hjul med 0 og 00. Husets fordel 5,26 %.
   ========================================================= */
(function () {
  'use strict';
  const C = Casino;

  /* ============================================================
     HJUL OG INNSATSER (ren logikk)
     ============================================================ */
  const DZ = 37; // "00"
  const EURO = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const AMER = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, DZ, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 || n === DZ ? 'green' : RED.has(n) ? 'red' : 'black');
  const numLabel = (n) => (n === DZ ? '00' : String(n));
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

  const LEVELS = {
    lett: { label: 'Lett', american: false, partage: true, edge: '1,35 %', desc: 'Europeisk hjul + la partage: halve innsatsen tilbake på enkle sjanser ved 0' },
    middels: { label: 'Middels', american: false, partage: false, edge: '2,70 %', desc: 'Klassisk europeisk hjul med én null' },
    vanskelig: { label: 'Vanskelig', american: true, partage: false, edge: '5,26 %', desc: 'Amerikansk hjul med både 0 og 00' }
  };

  function buildBets(american) {
    const B = new Map();
    const add = (key, type, nums, pays, name) => B.set(key, { key, type, nums, pays, name });
    add('n0', 'straight', [0], 35, '0');
    if (american) add('n00', 'straight', [DZ], 35, '00');
    for (let n = 1; n <= 36; n++) add('n' + n, 'straight', [n], 35, String(n));
    for (let n = 1; n <= 36; n++) {
      if (n % 3 !== 0) add('s' + n + '-' + (n + 1), 'split', [n, n + 1], 17, n + '/' + (n + 1));
      if (n <= 33) add('s' + n + '-' + (n + 3), 'split', [n, n + 3], 17, n + '/' + (n + 3));
    }
    for (let n = 1; n <= 32; n++) if (n % 3 !== 0) add('c' + n, 'corner', [n, n + 1, n + 3, n + 4], 8, n + '/' + (n + 1) + '/' + (n + 3) + '/' + (n + 4));
    for (let n = 1; n <= 34; n += 3) add('st' + n, 'street', [n, n + 1, n + 2], 11, n + '–' + (n + 2));
    for (let n = 1; n <= 31; n += 3) add('l' + n, 'line', range(n, n + 5), 5, n + '–' + (n + 5));
    if (!american) {
      add('s0-1', 'split', [0, 1], 17, '0/1');
      add('s0-2', 'split', [0, 2], 17, '0/2');
      add('s0-3', 'split', [0, 3], 17, '0/3');
      add('t0-1-2', 'street', [0, 1, 2], 11, '0/1/2');
      add('t0-2-3', 'street', [0, 2, 3], 11, '0/2/3');
      add('f4', 'corner', [0, 1, 2, 3], 8, '0/1/2/3');
    } else {
      add('s0-1', 'split', [0, 1], 17, '0/1');
      add('s00-3', 'split', [DZ, 3], 17, '00/3');
      add('s0-00', 'split', [0, DZ], 17, '0/00');
      add('t0-00-2', 'street', [0, DZ, 2], 11, '0/00/2');
      add('top5', 'topline', [0, DZ, 1, 2, 3], 6, '0/00/1/2/3');
    }
    for (let c = 1; c <= 3; c++) add('col' + c, 'column', range(1, 36).filter((n) => (n - 1) % 3 === c - 1), 2, c + '. kolonne');
    for (let d = 1; d <= 3; d++) add('doz' + d, 'dozen', range(12 * (d - 1) + 1, 12 * d), 2, d + '. dusin');
    add('red', 'simple', [...RED], 1, 'Rød');
    add('black', 'simple', range(1, 36).filter((n) => !RED.has(n)), 1, 'Svart');
    add('odd', 'simple', range(1, 36).filter((n) => n % 2 === 1), 1, 'Oddetall');
    add('even', 'simple', range(1, 36).filter((n) => n % 2 === 0), 1, 'Partall');
    add('low', 'simple', range(1, 18), 1, '1–18');
    add('high', 'simple', range(19, 36), 1, '19–36');
    return B;
  }

  /* Hva en innsats gir tilbake (innsats + gevinst), gitt resultatet. */
  function payout(bet, amount, result, partage) {
    if (bet.nums.indexOf(result) !== -1) return amount * (bet.pays + 1);
    if (partage && bet.type === 'simple' && result === 0) return amount / 2;
    return 0;
  }

  window.Rulett = { EURO, AMER, DZ, RED, buildBets, payout, colorOf };

  const app = document.getElementById('ru-app');
  if (!app) return;

  /* ============================================================
     HJULET (canvas)
     ============================================================ */
  class Wheel {
    constructor(canvas, order) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.setOrder(order);
      this.angle = 0;
      this.ball = null;
      this.spinning = false;
      this.highlight = null;
    }
    setOrder(order) {
      this.order = order;
      this.N = order.length;
      this.w = (Math.PI * 2) / this.N;
      this.img = this.prerender();
      this.draw();
    }
    pocketTheta(i) { return -Math.PI / 2 + i * this.w; }
    prerender() {
      const S = 640, c = S / 2, R = S / 2 - 4;
      const cv = document.createElement('canvas');
      cv.width = cv.height = S;
      const g = cv.getContext('2d');
      // wooden rim
      let grad = g.createRadialGradient(c, c, R * 0.8, c, c, R);
      grad.addColorStop(0, '#7a4519'); grad.addColorStop(0.6, '#5a3315'); grad.addColorStop(1, '#2a1608');
      g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
      g.lineWidth = 6; g.strokeStyle = '#f4a825'; g.stroke();
      // ball track
      grad = g.createRadialGradient(c, c, R * 0.78, c, c, R * 0.93);
      grad.addColorStop(0, '#2a1608'); grad.addColorStop(0.5, '#6b4224'); grad.addColorStop(1, '#3a1f0f');
      g.beginPath(); g.arc(c, c, R * 0.93, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
      g.beginPath(); g.arc(c, c, R * 0.93, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = 'rgba(255,214,107,0.5)'; g.stroke();
      // pockets with numbers
      const fill = { red: '#c8202f', black: '#1b1b1b', green: '#1e8a3c' };
      const floor = { red: '#8e1622', black: '#0c0c0c', green: '#13602a' };
      for (let i = 0; i < this.N; i++) {
        const n = this.order[i];
        const th = this.pocketTheta(i);
        const a0 = th - this.w / 2, a1 = th + this.w / 2;
        g.beginPath(); g.arc(c, c, R * 0.79, a0, a1); g.arc(c, c, R * 0.6, a1, a0, true); g.closePath();
        g.fillStyle = fill[colorOf(n)]; g.fill();
        g.beginPath(); g.arc(c, c, R * 0.6, a0, a1); g.arc(c, c, R * 0.5, a1, a0, true); g.closePath();
        g.fillStyle = floor[colorOf(n)]; g.fill();
        // fret
        g.beginPath(); g.moveTo(c + Math.cos(a0) * R * 0.5, c + Math.sin(a0) * R * 0.5); g.lineTo(c + Math.cos(a0) * R * 0.79, c + Math.sin(a0) * R * 0.79);
        g.lineWidth = 2.5; g.strokeStyle = '#d9a441'; g.stroke();
        // number
        g.save();
        g.translate(c + Math.cos(th) * R * 0.7, c + Math.sin(th) * R * 0.7);
        g.rotate(th + Math.PI / 2);
        g.fillStyle = '#fff8e7';
        g.font = 'bold ' + (this.N > 37 ? 22 : 24) + 'px Rubik, Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(numLabel(n), 0, 0);
        g.restore();
      }
      g.beginPath(); g.arc(c, c, R * 0.79, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = '#d9a441'; g.stroke();
      g.beginPath(); g.arc(c, c, R * 0.6, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = '#d9a441'; g.stroke();
      // cone
      grad = g.createRadialGradient(c - R * 0.12, c - R * 0.12, R * 0.05, c, c, R * 0.5);
      grad.addColorStop(0, '#ffd66b'); grad.addColorStop(0.45, '#c98a1f'); grad.addColorStop(1, '#5a3315');
      g.beginPath(); g.arc(c, c, R * 0.5, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
      g.lineWidth = 3; g.strokeStyle = '#3a1f0f'; g.stroke();
      // turret spokes
      g.save(); g.translate(c, c);
      for (let k = 0; k < 4; k++) {
        g.rotate(Math.PI / 2);
        g.beginPath(); g.moveTo(0, -R * 0.06); g.lineTo(R * 0.36, -R * 0.02); g.lineTo(R * 0.36, R * 0.02); g.lineTo(0, R * 0.06); g.closePath();
        g.fillStyle = '#fff1c4'; g.fill(); g.strokeStyle = '#8a5a06'; g.lineWidth = 2; g.stroke();
        g.beginPath(); g.arc(R * 0.38, 0, R * 0.035, 0, Math.PI * 2); g.fillStyle = '#ffd66b'; g.fill(); g.stroke();
      }
      g.restore();
      g.beginPath(); g.arc(c, c, R * 0.1, 0, Math.PI * 2); g.fillStyle = '#fff8e7'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#3a1f0f'; g.stroke();
      g.font = (R * 0.12) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🍺', c, c + 2);
      return cv;
    }
    draw() {
      const cv = this.canvas, g = this.ctx, S = cv.width, c = S / 2, R = S / 2 - 4;
      g.clearRect(0, 0, S, S);
      g.save(); g.translate(c, c); g.rotate(this.angle); g.drawImage(this.img, -c, -c, S, S);
      if (this.highlight != null) {
        const i = this.order.indexOf(this.highlight);
        const th = this.pocketTheta(i);
        g.beginPath(); g.arc(0, 0, R * 0.79, th - this.w / 2, th + this.w / 2); g.arc(0, 0, R * 0.5, th + this.w / 2, th - this.w / 2, true); g.closePath();
        g.fillStyle = 'rgba(255,214,107,0.35)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd66b'; g.stroke();
      }
      g.restore();
      if (this.ball) {
        const bx = c + Math.cos(this.ball.a) * this.ball.r * R;
        const by = c + Math.sin(this.ball.a) * this.ball.r * R;
        const br = R * 0.032;
        g.beginPath(); g.arc(bx + 2, by + 3, br, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
        const bg = g.createRadialGradient(bx - br * 0.4, by - br * 0.4, br * 0.1, bx, by, br);
        bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#c9c2b0');
        g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
      }
    }
    /* Spinner til et forhåndstrukket tall. Returnerer et løfte. */
    spin(target, duration) {
      const idx = this.order.indexOf(target);
      this.highlight = null;
      if (duration < 60) {
        this.angle = (this.angle + 1.3) % (Math.PI * 2);
        this.ball = { a: this.pocketTheta(idx) + this.angle, r: 0.555 };
        this.draw();
        return Promise.resolve();
      }
      const T = duration, tLand = T * 0.8;
      const w0 = this.angle, W = Math.PI * 2 * (1.2 + Math.random() * 0.5);
      const wheelAt = (t) => w0 + W * (1 - Math.pow(1 - Math.min(t / T, 1), 3));
      const b0 = (this.ball ? this.ball.a : -Math.PI / 2) + Math.random() * 0.5;
      let bLand = this.pocketTheta(idx) + wheelAt(tLand);
      // ball travels the other way: make it 7-9 full turns backwards
      const turns = 7 + Math.random() * 2;
      while (bLand > b0 - Math.PI * 2 * turns) bLand -= Math.PI * 2;
      let lastPocket = -1, lastTick = 0;
      this.spinning = true;
      return new Promise((resolve) => {
        const start = performance.now();
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          this.spinning = false;
          this.angle = wheelAt(T) % (Math.PI * 2);
          this.ball = { a: this.pocketTheta(idx) + this.angle, r: 0.555 };
          this.highlight = target;
          this.draw();
          resolve();
        };
        const frame = (now) => {
          if (done) return;
          const t = now - start;
          if (t >= T) { finish(); return; }
          this.angle = wheelAt(t);
          if (t < tLand) {
            const u = t / tLand;
            const a = b0 + (bLand - b0) * (1 - Math.pow(1 - u, 2.2));
            let r = 0.86;
            if (u > 0.55) {
              const v = (u - 0.55) / 0.45;
              r = 0.86 - (0.86 - 0.555) * (v * v * (3 - 2 * v));
              r += Math.sin(v * Math.PI * 5) * 0.035 * (1 - v);
              const rel = ((a - this.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
              const pocket = Math.floor(rel / this.w);
              if (pocket !== lastPocket && now - lastTick > 45) { lastPocket = pocket; lastTick = now; GuttaSFX.tick(); }
            }
            this.ball = { a, r };
          } else {
            if (!this.landed) { this.landed = true; GuttaSFX.ballDrop(); }
            this.ball = { a: this.pocketTheta(idx) + this.angle, r: 0.555 };
          }
          this.draw();
          requestAnimationFrame(frame);
        };
        this.landed = false;
        requestAnimationFrame(frame);
        setTimeout(finish, T + 400); // background tabs pause rAF
      });
    }
  }

  /* ============================================================
     SPILLET
     ============================================================ */
  const MIN_SPIN = 5;          // free play: minimum total per spin
  const MAX_SPIN = 1000;       // free play: maximum total per spin
  const MAX_STRAIGHT = 200;
  const CHIP_VALUES = [1, 5, 25, 100, 500];

  const game = {
    cfg: null, level: null, bets: null, wheel: null,
    my: new Map(), history: [], lastBets: null, undo: [],
    spin: 0, chip: 5, phase: 'idle', counts: {},
    session: { spins: 0, staked: 0, net: 0, best: 0, hits: 0 }
  };
  window.Rulett.game = game;
  const ui = {};

  function buildUI() {
    app.innerHTML = '';
    app.className = 'game-shell ru';
    const E = C.el;
    const bar = E('div', 'game-toolbar');
    bar.innerHTML =
      '<span class="game-title">🔴 Rulett</span>' +
      '<span class="pill gold" id="ruLevel"></span>' +
      '<span class="pill" id="ruBank"></span>' +
      '<span class="toolbar-spacer"></span>' +
      '<button class="tool-btn" id="ruDrink" type="button" title="Drikkemodus">🥴<span class="tl"> Drikk</span></button>' +
      '<button class="tool-btn" id="ruSpeed" type="button" title="Raskere spinn">⏩<span class="tl"> Rask</span></button>' +
      '<button class="tool-btn" id="ruRules" type="button" title="Regler og utbetalinger">📖<span class="tl"> Regler</span></button>' +
      '<button class="tool-btn" id="ruNew" type="button" title="Nytt bord">🔄<span class="tl"> Nytt bord</span></button>';
    app.appendChild(bar);

    const layout = E('div', 'ru-layout');
    layout.innerHTML =
      '<div class="ru-left">' +
        '<div class="ru-wheel-wrap" id="ruWheelWrap"><canvas id="ruWheel" width="640" height="640" aria-label="Rulett-hjul"></canvas>' +
          '<div class="ru-result" id="ruResult" hidden></div></div>' +
        '<div class="ru-info">' +
          '<div class="ru-last" id="ruLast"><span>Siste</span><b>–</b></div>' +
          '<div class="ru-history" id="ruHistory" aria-label="Siste resultater"></div>' +
          '<div class="ru-stats" id="ruStats"></div>' +
        '</div>' +
      '</div>' +
      '<div class="ru-right">' +
        '<div class="felt ru-felt"><div class="ru-board" id="ruBoard"></div><div class="table-msg" id="ruMsg"></div></div>' +
        '<div class="ru-controls">' +
          '<div class="chip-tray" id="ruChips"></div>' +
          '<div class="ru-total"><span>Innsats</span><b id="ruTotal">0</b></div>' +
          '<div class="ru-btns">' +
            '<button class="tool-btn" id="ruUndo" type="button">↶ Angre</button>' +
            '<button class="tool-btn" id="ruClear" type="button">Tøm</button>' +
            '<button class="tool-btn" id="ruRebet" type="button">Gjenta</button>' +
            '<button class="tool-btn" id="ruDouble" type="button">×2</button>' +
          '</div>' +
          '<button class="act big green ru-spin" id="ruSpin" type="button">Spinn<span class="kbd">␣</span></button>' +
        '</div>' +
      '</div>' +
      '<aside class="side-panel ru-side">' +
        '<div class="side-card"><h3>Denne økta</h3><ul class="score-list" id="ruSession"></ul></div>' +
        '<div class="side-card"><h3>Logg</h3><ul class="log-list" id="ruLog"></ul></div>' +
      '</aside>';
    app.appendChild(layout);

    const $ = (id) => document.getElementById(id);
    Object.assign(ui, {
      level: $('ruLevel'), bank: $('ruBank'), wheelWrap: $('ruWheelWrap'), canvas: $('ruWheel'),
      result: $('ruResult'), last: $('ruLast'), history: $('ruHistory'), stats: $('ruStats'), board: $('ruBoard'), msg: $('ruMsg'),
      chips: $('ruChips'), total: $('ruTotal'), undo: $('ruUndo'), clear: $('ruClear'), rebet: $('ruRebet'), double: $('ruDouble'),
      spin: $('ruSpin'), session: $('ruSession'), log: $('ruLog'),
      drinkBtn: $('ruDrink'), speedBtn: $('ruSpeed'), rulesBtn: $('ruRules'), newBtn: $('ruNew')
    });

    CHIP_VALUES.forEach((v) => {
      const chip = C.chipEl(v, { button: true });
      chip.addEventListener('click', () => { game.chip = v; GuttaSFX.chip(); paintChips(); });
      ui.chips.appendChild(chip);
    });
    ui.undo.addEventListener('click', undo);
    ui.clear.addEventListener('click', clearBets);
    ui.rebet.addEventListener('click', rebet);
    ui.double.addEventListener('click', doubleBets);
    ui.spin.addEventListener('click', spin);
    ui.drinkBtn.addEventListener('click', () => {
      Settings.set('drink', !Settings.get('drink'));
      if (Settings.get('drink')) { Achievements.unlock('drink_mode'); drinkPrompt('Drikkemodus på!', 'Feil farge = slurk'); }
      paintToggles();
    });
    ui.speedBtn.addEventListener('click', () => { C.setSpeed(C.speed < 1 ? 1 : 0.5); paintToggles(); });
    ui.rulesBtn.addEventListener('click', showRules);
    ui.newBtn.addEventListener('click', newTable);

    ui.board.addEventListener('click', (e) => {
      const t = e.target.closest('[data-bet]');
      if (t) placeBet(t.dataset.bet);
    });
    ui.board.addEventListener('contextmenu', (e) => {
      const t = e.target.closest('[data-bet]');
      if (t && game.my.has(t.dataset.bet)) { e.preventDefault(); removeBet(t.dataset.bet); }
    });
    ui.board.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-bet]');
      highlightCover(t ? t.dataset.bet : null);
    });
    ui.board.addEventListener('mouseleave', () => highlightCover(null));

    document.addEventListener('keydown', (e) => {
      if (e.repeat || document.querySelector('.modal-overlay.open')) return;
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT')) return;
      if (e.key === ' ' || e.key === 'Enter') { if (!ui.spin.disabled) { e.preventDefault(); spin(); } }
      else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    });
    document.addEventListener('gutta:wallet', () => { paintBank(); updateButtons(); });
    document.addEventListener('gutta:settings', paintToggles);

    game.wheel = new Wheel(ui.canvas, EURO);
    if ('ResizeObserver' in window) new ResizeObserver(() => layoutBoard()).observe(ui.board.parentElement);
    else window.addEventListener('resize', layoutBoard);
  }

  /* ---------- oppsett ---------- */
  async function setup() {
    const last = Store.get('gutta_ru_config', { level: 'lett' });
    const cfg = await C.setupDialog({
      icon: '🔴',
      title: 'Rulett',
      intro: 'Deg mot huset. Sats på tall, farger og kombinasjoner, og la kula bestemme.',
      fields: [
        { key: 'level', label: 'Vanskelighetsgrad', value: last.level, options: Object.keys(LEVELS).map((k) => ({ value: k, label: LEVELS[k].label, desc: LEVELS[k].desc })) },
      ],
      describe: (v) => '🏠 Husets fordel: <b>' + LEVELS[v.level].edge + '</b>. Innsats ' + MIN_SPIN + '–' + MAX_SPIN + ' GK per spinn, maks ' + MAX_STRAIGHT + ' på ett enkelt tall.',
      startLabel: 'Til bordet',
      backHref: 'kasino.html'
    });
    Store.set('gutta_ru_config', cfg);
    await C.ensureFunds(MIN_SPIN);
    startTable(cfg);
  }

  function startTable(cfg) {
    game.cfg = cfg;
    game.level = LEVELS[cfg.level];
    game.bets = buildBets(game.level.american);
    game.my = new Map();
    game.undo = [];
    game.lastBets = null;
    game.history = [];
    game.counts = {};
    game.spin = 0;
    game.session = { spins: 0, staked: 0, net: 0, best: 0, hits: 0 };
    game.wheel.setOrder(game.level.american ? AMER : EURO);
    game.wheel.highlight = null;
    game.wheel.ball = null;
    game.wheel.draw();
    ui.level.textContent = '🎚️ ' + game.level.label + (game.level.american ? ' · 00' : '');
    ui.log.innerHTML = '';
    ui.result.hidden = true;
    buildBoard();
    paintChips();
    paintHistory();
    paintAll();
    setPhase('betting');
    log('Nytt bord: <b>' + game.level.label + '</b> (' + (game.level.american ? 'amerikansk' : 'europeisk') + ' hjul).');
    message('Plasser innsatsene dine', '', 2000);
  }

  async function newTable() {
    if (game.phase === 'spinning') { showToast('Vent til kula har landet 🔴'); return; }
    refundMyBets();
    setPhase('idle');
    setup();
  }

  /* ---------- brettet ---------- */
  function buildBoard() {
    const b = ui.board;
    b.innerHTML = '';
    const am = game.level.american;
    const cell = (key, cls, html) => { const d = C.el('div', 'ru-cell ' + cls, html); d.dataset.bet = key; b.appendChild(d); return d; };
    cell('n0', 'num green zero', '<span>0</span>');
    if (am) cell('n00', 'num green zero dz', '<span>00</span>');
    for (let n = 1; n <= 36; n++) { const d = cell('n' + n, 'num ' + colorOf(n), '<span>' + n + '</span>'); d.dataset.n = n; }
    for (let c = 1; c <= 3; c++) cell('col' + c, 'out col', '<span>2:1</span>');
    ['1.', '2.', '3.'].forEach((t, i) => cell('doz' + (i + 1), 'out doz', '<span>' + t + ' 12</span>'));
    cell('low', 'out simple', '<span>1–18</span>');
    cell('even', 'out simple', '<span>PAR</span>');
    cell('red', 'out simple diamond red', '<span>◆</span>');
    cell('black', 'out simple diamond black', '<span>◆</span>');
    cell('odd', 'out simple', '<span>ODDE</span>');
    cell('high', 'out simple', '<span>19–36</span>');
    ui.hotLayer = C.el('div', 'ru-hot-layer');
    ui.chipLayer = C.el('div', 'ru-chip-layer');
    b.appendChild(ui.hotLayer);
    b.appendChild(ui.chipLayer);
    game.bets.forEach((def, key) => {
      if (b.querySelector('[data-bet="' + key + '"]')) return;
      const h = C.el('button', 'ru-hot');
      h.type = 'button';
      h.dataset.bet = key;
      h.setAttribute('aria-label', def.name);
      h.title = def.name + ' (' + def.pays + ':1)';
      ui.hotLayer.appendChild(h);
    });
    b.dataset.orient = '';
    layoutBoard();
  }

  function layoutBoard() {
    const b = ui.board;
    if (!b || !game.bets) return;
    const width = b.parentElement.clientWidth;
    const orient = width < 620 ? 'v' : 'h';
    if (b.dataset.orient !== orient) {
      b.dataset.orient = orient;
      const am = game.level.american;
      const place = (key, row, col, rs, cs) => {
        const el = b.querySelector('.ru-cell[data-bet="' + key + '"]');
        if (el) { el.style.gridRow = row + ' / span ' + rs; el.style.gridColumn = col + ' / span ' + cs; }
      };
      const outside = ['low', 'even', 'red', 'black', 'odd', 'high'];
      if (orient === 'h') {
        if (am) { place('n00', 1, 1, 3, 1); place('n0', 4, 1, 3, 1); } else place('n0', 1, 1, 6, 1);
        for (let n = 1; n <= 36; n++) { const c = Math.ceil(n / 3) - 1, r = (n - 1) % 3; place('n' + n, 1 + 2 * (2 - r), 2 + c, 2, 1); }
        for (let r = 0; r < 3; r++) place('col' + (r + 1), 1 + 2 * (2 - r), 14, 2, 1);
        for (let d = 0; d < 3; d++) place('doz' + (d + 1), 7, 2 + 4 * d, 1, 4);
        outside.forEach((k, i) => place(k, 8, 2 + 2 * i, 1, 2));
      } else {
        if (am) { place('n0', 1, 3, 1, 3); place('n00', 1, 6, 1, 3); } else place('n0', 1, 3, 1, 6);
        for (let n = 1; n <= 36; n++) { const c = Math.ceil(n / 3) - 1, r = (n - 1) % 3; place('n' + n, 2 + c, 3 + 2 * r, 1, 2); }
        for (let r = 0; r < 3; r++) place('col' + (r + 1), 14, 3 + 2 * r, 1, 2);
        for (let d = 0; d < 3; d++) place('doz' + (d + 1), 2 + 4 * d, 2, 4, 1);
        outside.forEach((k, i) => place(k, 2 + 2 * i, 1, 2, 1));
      }
    }
    requestAnimationFrame(positionOverlays);
  }

  /* Hotspots for splitt/hjørne/rekke m.m. beregnes fra hvor tallcellene faktisk ligger. */
  function positionOverlays() {
    const b = ui.board;
    const br = b.getBoundingClientRect();
    if (!br.width) return;
    const centers = {};
    let cw = 1e9, ch = 1e9;
    b.querySelectorAll('.ru-cell').forEach((el) => {
      const r = el.getBoundingClientRect();
      centers[el.dataset.bet] = { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
      if (el.dataset.n) { cw = Math.min(cw, r.width); ch = Math.min(ch, r.height); }
    });
    const cc = (n) => centers['n' + n];
    const mid = (a, b2) => ({ x: (a.x + b2.x) / 2, y: (a.y + b2.y) / 2 });
    const lerp = (a, b2, k) => ({ x: a.x + (b2.x - a.x) * k, y: a.y + (b2.y - a.y) * k });
    const street = (n) => lerp(cc(n), cc(n + 1), -0.5);
    const zeroEdge = (k) => lerp(cc(k), cc(k + 3), -0.5);
    const pos = {};
    for (let n = 1; n <= 36; n++) {
      if (n % 3 !== 0) pos['s' + n + '-' + (n + 1)] = mid(cc(n), cc(n + 1));
      if (n <= 33) pos['s' + n + '-' + (n + 3)] = mid(cc(n), cc(n + 3));
    }
    for (let n = 1; n <= 32; n++) if (n % 3 !== 0) pos['c' + n] = { x: (cc(n).x + cc(n + 1).x + cc(n + 3).x + cc(n + 4).x) / 4, y: (cc(n).y + cc(n + 1).y + cc(n + 3).y + cc(n + 4).y) / 4 };
    for (let n = 1; n <= 34; n += 3) pos['st' + n] = street(n);
    for (let n = 1; n <= 31; n += 3) pos['l' + n] = mid(street(n), street(n + 3));
    if (!game.level.american) {
      pos['s0-1'] = zeroEdge(1); pos['s0-2'] = zeroEdge(2); pos['s0-3'] = zeroEdge(3);
      pos['t0-1-2'] = mid(zeroEdge(1), zeroEdge(2)); pos['t0-2-3'] = mid(zeroEdge(2), zeroEdge(3));
      pos['f4'] = lerp(zeroEdge(1), zeroEdge(2), -0.5);
    } else {
      pos['s0-1'] = zeroEdge(1); pos['s00-3'] = zeroEdge(3); pos['t0-00-2'] = zeroEdge(2);
      pos['s0-00'] = lerp(zeroEdge(2), lerp(cc(2), cc(5), 0.5), -1);
      pos['top5'] = lerp(zeroEdge(1), zeroEdge(2), -0.5);
    }
    game.anchor = Object.assign({}, centers, pos);
    const size = Math.max(14, Math.min(cw, ch) * 0.42);
    b.style.setProperty('--hot', size + 'px');
    ui.hotLayer.querySelectorAll('.ru-hot').forEach((h) => {
      const p = pos[h.dataset.bet];
      if (!p) { h.hidden = true; return; }
      h.hidden = false;
      h.style.left = p.x + 'px';
      h.style.top = p.y + 'px';
    });
    paintChipsOnBoard();
  }

  function highlightCover(key) {
    ui.board.querySelectorAll('.ru-cell.cover').forEach((el) => el.classList.remove('cover'));
    if (!key || !game.bets.has(key)) return;
    game.bets.get(key).nums.forEach((n) => {
      const el = ui.board.querySelector('.ru-cell[data-bet="' + (n === DZ ? 'n00' : 'n' + n) + '"]');
      if (el) el.classList.add('cover');
    });
  }

  function paintChipsOnBoard() {
    const layer = ui.chipLayer;
    if (!layer || !game.anchor) return;
    layer.innerHTML = '';
    game.my.forEach((amt, key) => {
      const p = game.anchor[key];
      if (!p) return;
      const m = C.chipEl(amt, { small: true });
      m.classList.add('ru-my-chip');
      m.querySelector('span').textContent = C.chipLabel(amt);
      m.style.left = p.x + 'px';
      m.style.top = p.y + 'px';
      layer.appendChild(m);
    });
  }

  /* ---------- innsatser ---------- */
  const totalMine = () => { let t = 0; game.my.forEach((v) => { t += v; }); return t; };
  function fundsYou() { return Wallet.balance; }
  function maxTotal() { return Math.min(MAX_SPIN, fundsYou() + totalMine()); }
  function chargeYou(n) { return Wallet.spend(n, 'rulett'); }
  function payYou(n) { if (n > 0) Wallet.add(n, 'rulett'); }

  /* Innsatser trekkes fra saldoen med en gang de legges på bordet (som sjetonger), og
     legges tilbake når de fjernes. */
  function placeBet(key, amount, silent) {
    if (game.phase !== 'betting') return false;
    const def = game.bets.get(key);
    if (!def) return false;
    amount = amount || game.chip;
    const cur = game.my.get(key) || 0;
    if (def.type === 'straight' && cur + amount > MAX_STRAIGHT) { if (!silent) showToast('Maks ' + MAX_STRAIGHT + ' på ett enkelt tall'); return false; }
    if (totalMine() + amount > maxTotal()) { if (!silent) showToast(fundsYou() < amount ? 'Ikke nok sjetonger' : 'Maks ' + C.fmtChips(maxTotal()) + ' per spinn'); return false; }
    if (!chargeYou(amount)) { if (!silent) showToast('Ikke nok sjetonger'); return false; }
    game.my.set(key, cur + amount);
    game.undo.push({ key, amount });
    if (!silent) GuttaSFX.chip();
    paintChipsOnBoard();
    paintBank();
    updateButtons();
    return true;
  }
  function removeBet(key) {
    if (game.phase !== 'betting' || !game.my.has(key)) return;
    const amt = game.my.get(key);
    game.my.delete(key);
    game.undo = game.undo.filter((u) => u.key !== key);
    payYou(amt);
    GuttaSFX.click();
    paintChipsOnBoard(); paintBank(); updateButtons();
  }
  function undo() {
    if (game.phase !== 'betting') return;
    const u = game.undo.pop();
    if (!u) return;
    const cur = game.my.get(u.key) || 0;
    if (cur <= u.amount) game.my.delete(u.key); else game.my.set(u.key, cur - u.amount);
    payYou(Math.min(cur, u.amount));
    GuttaSFX.click();
    paintChipsOnBoard(); paintBank(); updateButtons();
  }
  function refundMyBets() {
    const t = totalMine();
    if (t > 0 && game.cfg) payYou(t);
    game.my = new Map();
    game.undo = [];
  }
  function clearBets() {
    if (game.phase !== 'betting') return;
    refundMyBets();
    GuttaSFX.click();
    paintChipsOnBoard(); paintBank(); updateButtons();
  }
  function rebet() {
    if (game.phase !== 'betting' || !game.lastBets) return;
    refundMyBets();
    let ok = true;
    game.lastBets.forEach((amt, key) => { if (!placeBet(key, amt, true)) ok = false; });
    GuttaSFX.chips();
    if (!ok) showToast('Fikk ikke plass til alle innsatsene');
  }
  function doubleBets() {
    if (game.phase !== 'betting' || !game.my.size) return;
    const snapshot = new Map(game.my);
    if (totalMine() * 2 > maxTotal()) { showToast('Ikke nok til å doble'); return; }
    snapshot.forEach((amt, key) => placeBet(key, amt, true));
    GuttaSFX.chips();
  }

  /* ---------- spinn ---------- */
  async function spin() {
    if (game.phase !== 'betting') return;
    if (totalMine() < MIN_SPIN) { showToast('Minste innsats per spinn er ' + MIN_SPIN); return; }
    setPhase('spinning');
    game.lastBets = new Map(game.my);
    game.spin++;
    paintBank();
    message('Rien ne va plus!', 'push', 1300);
    GuttaSFX.swoosh();
    const result = game.wheel.order[C.randInt(game.wheel.N)];
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    if (narrow && C.speed > 0.05) { ui.wheelWrap.classList.add('overlay'); document.body.classList.add('ru-spinning'); }
    ui.result.hidden = true;
    await game.wheel.spin(result, C.speed > 0.05 ? 5600 * C.speed : 0);
    showResult(result);
    await C.wait(narrow ? 1300 : 300);
    ui.wheelWrap.classList.remove('overlay');
    document.body.classList.remove('ru-spinning');
    await settle(result);
    setPhase('betting');
  }

  function showResult(n) {
    const col = colorOf(n);
    ui.result.className = 'ru-result ' + col;
    ui.result.innerHTML = '<b>' + numLabel(n) + '</b><span>' + (col === 'red' ? 'Rød' : col === 'black' ? 'Svart' : 'Grønn') + '</span>';
    ui.result.hidden = false;
    game.history.unshift(n);
    if (game.history.length > 40) game.history.pop();
    game.counts[n] = (game.counts[n] || 0) + 1;
    const cellEl = ui.board.querySelector('.ru-cell[data-bet="' + (n === DZ ? 'n00' : 'n' + n) + '"]');
    ui.board.querySelectorAll('.ru-cell.hit').forEach((el) => el.classList.remove('hit'));
    if (cellEl) cellEl.classList.add('hit');
    paintHistory();
  }

  async function settle(result) {
    const partage = game.level.partage;
    // human
    let back = 0, staked = 0, straightHit = false, zeroWin = false;
    game.my.forEach((amt, key) => {
      const def = game.bets.get(key);
      const r = payout(def, amt, result, partage);
      staked += amt;
      back += r;
      if (r > amt && def.type === 'straight') straightHit = true;
      if (r > amt && result === 0) zeroWin = true;
    });
    payYou(back);
    const net = back - staked;
    // feedback
    const col = colorOf(result);
    const name = numLabel(result) + ' ' + (col === 'red' ? 'rød' : col === 'black' ? 'svart' : 'grønn');
    if (staked > 0) {
      Stats.add('roulette.spins');
      C.recordResult('roulette', net);
      const ss = game.session;
      ss.spins++; ss.staked += staked; ss.net += net;
      if (net > 0) { ss.hits++; ss.best = Math.max(ss.best, net); }
      if (straightHit) Achievements.unlock('roulette_straight');
      if (zeroWin) Achievements.unlock('roulette_zero');
      if (net >= 1000) Achievements.unlock('roulette_big');
      if (net > 0) {
        message(name + ' · Du vinner ' + C.fmtChips(net) + '!', 'win', 2600);
        if (net >= 300 || straightHit) { GuttaSFX.bigWin(); confettiBurst(); } else GuttaSFX.win();
      } else if (net < 0) {
        message(name + (back > 0 ? ' · Du fikk ' + C.fmtChips(back) + ' tilbake' : ' · Ingen gevinst'), 'lose', 2400);
        GuttaSFX.lose();
      } else { message(name + ' · Pengene tilbake', 'push', 2200); GuttaSFX.chip(); }
      // flash the winning chips
      game.my.forEach((amt, key) => {
        const r = payout(game.bets.get(key), amt, result, partage);
        const p = game.anchor && game.anchor[key];
        if (r > amt && p) {
          const f = C.el('div', 'float-text win', '+' + C.fmtChips(r - amt));
          f.style.left = p.x + 'px'; f.style.top = (p.y - 20) + 'px';
          ui.board.appendChild(f);
          setTimeout(() => f.remove(), 1400);
        }
      });
      log('Spinn ' + game.spin + ': <b>' + name + '</b> → ' + (net > 0 ? '+' : '') + C.fmtChips(net));
      // Drikkemodus
      if (straightHit) drinkPrompt('Rett i blinken!', 'Del ut fem slurker');
      else if ((result === 0 || result === DZ) && !zeroWin) drinkPrompt('Grønn null!', 'Alle ved bordet drikker');
      else if (back === 0) drinkPrompt('Feil farge!', 'Ta en slurk');
    }
    game.my = new Map();
    game.undo = [];
    await C.wait(600);
    paintAll();
  }

  /* ---------- maling ---------- */
  function setPhase(p) { game.phase = p; app.dataset.phase = p; updateButtons(); }
  function updateButtons() {
    if (!ui.spin) return;
    const betting = game.phase === 'betting';
    const t = game.cfg ? totalMine() : 0;
    ui.spin.disabled = !betting || t < MIN_SPIN;
    ui.undo.disabled = !betting || !game.undo.length;
    ui.clear.disabled = !betting || !game.my.size;
    ui.rebet.disabled = !betting || !game.lastBets || !game.lastBets.size;
    ui.double.disabled = !betting || !game.my.size;
    ui.total.textContent = C.fmtChips(t);
  }
  function paintChips() {
    ui.chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', Number(c.dataset.v) === game.chip));
  }
  function paintToggles() {
    ui.drinkBtn.classList.toggle('on', !!Settings.get('drink'));
    ui.speedBtn.classList.toggle('on', C.speed < 1);
  }
  function paintBank() {
    if (!game.cfg) return;
    ui.bank.innerHTML = 'Saldo <b>' + formatGK(Wallet.balance) + '</b>';
    updateButtons();
  }
  function paintSession() {
    const ss = game.session;
    const net = ss.net;
    ui.session.innerHTML = [
      ['Spinn', ss.spins],
      ['Spinn med gevinst', ss.hits],
      ['Satset totalt', C.fmtChips(ss.staked)],
      ['Største gevinst', C.fmtChips(ss.best)],
      ['Netto', '<span class="' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '') + '">' + (net > 0 ? '+' : '') + C.fmtChips(net) + '</span>']
    ].map(([k, v]) => '<li><span class="who">' + k + '</span><span class="amt">' + v + '</span></li>').join('');
  }
  function paintHistory() {
    const h = game.history;
    ui.last.innerHTML = '<span>Siste</span><b class="' + (h.length ? colorOf(h[0]) : '') + '">' + (h.length ? numLabel(h[0]) : '–') + '</b>';
    ui.history.innerHTML = h.slice(1, 15).map((n) => '<span class="ru-ball ' + colorOf(n) + '">' + numLabel(n) + '</span>').join('');
    const reds = h.filter((n) => colorOf(n) === 'red').length;
    const blacks = h.filter((n) => colorOf(n) === 'black').length;
    const greens = h.length - reds - blacks;
    const hot = Object.keys(game.counts).map(Number).sort((a, b) => game.counts[b] - game.counts[a]).slice(0, 3);
    ui.stats.innerHTML = h.length
      ? '<span class="r">Rød ' + reds + '</span><span class="b">Svart ' + blacks + '</span><span class="g">Grønn ' + greens + '</span>' +
        '<span class="hot">🔥 ' + hot.map(numLabel).join(', ') + '</span>'
      : '<span>Ingen spinn ennå</span>';
  }
  function paintAll() { paintToggles(); paintBank(); paintSession(); updateButtons(); paintChipsOnBoard(); }

  function message(text, kind, ms) {
    ui.msg.textContent = text;
    ui.msg.className = 'table-msg show' + (kind ? ' ' + kind : '');
    clearTimeout(ui.msgTimer);
    if (ms) ui.msgTimer = setTimeout(() => ui.msg.classList.remove('show'), ms * Math.max(C.speed, 0.4));
  }
  function log(html) {
    ui.log.prepend(C.el('li', '', html));
    while (ui.log.children.length > 60) ui.log.lastChild.remove();
  }

  function showRules() {
    const lv = game.level || LEVELS.lett;
    C.modal({
      icon: '📖', title: 'Rulett: regler og utbetalinger', wide: true,
      html: '<p>Legg sjetonger på bordet og trykk <b>Spinn</b>. Trykk på et tall for enkelt tall, på en strek mellom to tall for splitt, på et hjørne for fire tall, og på kanten ut mot dusinene for rekke (3 tall) eller dobbel rekke (6 tall). Høyreklikk fjerner en innsats.</p>' +
        '<table class="rules-table"><tr><th>Innsats</th><th>Tall</th><th>Betaler</th></tr>' +
        '<tr><td>Enkelt tall</td><td>1</td><td>35:1</td></tr><tr><td>Splitt</td><td>2</td><td>17:1</td></tr>' +
        '<tr><td>Rekke</td><td>3</td><td>11:1</td></tr><tr><td>Hjørne</td><td>4</td><td>8:1</td></tr>' +
        (lv.american ? '<tr><td>Topplinje (0, 00, 1, 2, 3)</td><td>5</td><td>6:1</td></tr>' : '') +
        '<tr><td>Dobbel rekke</td><td>6</td><td>5:1</td></tr><tr><td>Dusin / kolonne</td><td>12</td><td>2:1</td></tr>' +
        '<tr><td>Rød/svart, par/odde, 1–18/19–36</td><td>18</td><td>1:1</td></tr></table>' +
        (lv.partage ? '<p><b>La partage</b>: lander kula på 0, får du halve innsatsen tilbake på enkle sjanser.</p>' : '') +
        (lv.american ? '<p>Det amerikanske hjulet har både 0 og 00, så huset har dobbelt så stor fordel.</p>' : '') +
        '<p>Ingen system slår husets fordel i lengden: hvert spinn er uavhengig av de forrige. Historikken er bare for moro.</p>',
      actions: [{ label: 'Skjønner!', value: true }],
      dismissValue: true
    });
  }

  buildUI();
  setPhase('idle');
  setup();
})();
