/* =========================================================
   ØLAUTOMATEN — enarmet banditt, 3 hjul og 5 gevinstlinjer
   Hjulstrimlene er faste, så tilbakebetalingen (RTP) er regnet
   ut eksakt ved å gå gjennom alle stoppkombinasjoner:
   Lav 94,8 %, Middels 94,6 %, Høy 93,9 % (gratisspinn inkludert).
   ⭐ er wild, 🎡 er scatter: tre hvor som helst gir 8 gratisspinn
   der alle gevinster dobles.
   ========================================================= */
(function () {
  'use strict';
  const C = Casino;

  /* ============================================================
     MATEMATIKK (ren logikk)
     ============================================================ */
  const SYM = {
    B: { e: '🍺', name: 'Fullt krus' }, S: { e: '🥃', name: 'Shot' }, P: { e: '🌭', name: 'Pølse' },
    Z: { e: '🍕', name: 'Pizza' }, K: { e: '🥨', name: 'Kringle' }, L: { e: '🍋', name: 'Sur sitron' },
    C: { e: '🍒', name: 'Kirsebær' }, W: { e: '⭐', name: 'Wild' }, F: { e: '🎡', name: 'Bonushjul' }
  };
  const VOL = {
    lav: {
      label: 'Lav', rtp: '94,8 %', desc: 'Mange små gevinster',
      strips: ['CLKZPWFSBCLKZPWFSCLKZPWCLKZCLKCLC', 'LKZPWFSBCLKZPWFSCLKZPWCLKZCLKCLCC', 'KZPWFSBCLKZPWFSCLKZPWCLKZCLKCLCLC'],
      pays: { B: 80, S: 40, P: 20, Z: 14, K: 8, L: 6, C: 4, W: 50, C2: 1 }
    },
    middels: {
      label: 'Middels', rtp: '94,6 %', desc: 'Balansert',
      strips: ['CLKZPFSWBCLKZPFSWCLKZPCLKZCLKCL', 'LKZPFSWBCLKZPFSWCLKZPCLKZCLKCLC', 'KZPFSWBCLKZPFSWCLKZPCLKZCLKCLCL'],
      pays: { B: 150, S: 60, P: 28, Z: 16, K: 11, L: 7, C: 5, W: 90, C2: 1 }
    },
    hoy: {
      label: 'Høy', rtp: '93,9 %', desc: 'Sjeldne, store gevinster',
      strips: ['LCKPZBFSWLCKPZBFSLCKPZLCKLCKL', 'CKPZBFSWLCKPZBFSLCKPZLCKLCKLL', 'KPZBFSWLCKPZBFSLCKPZLCKLCKLCL'],
      pays: { B: 300, S: 90, P: 36, Z: 19, K: 9, L: 6, C: 4, W: 180, C2: 1 }
    }
  };
  const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const FREE_SPINS = 8, FREE_MULT = 2, SCATTER_PAY = 2;

  function windowAt(strips, stops) {
    // cols[reel][row], row 0 = top
    return strips.map((s, r) => {
      const L = s.length, i = stops[r];
      return [s[(i - 1 + L) % L], s[i], s[(i + 1) % L]];
    });
  }
  function lineWin(a, b, c, pays) {
    const s = [a, b, c];
    const base = s.find((x) => x !== 'W');
    if (!base) return { mult: pays.W, sym: 'W', n: 3 };
    if (base !== 'F' && s.every((x) => x === base || x === 'W')) return { mult: pays[base], sym: base, n: 3 };
    if ((s[0] === 'C' || s[0] === 'W') && (s[1] === 'C' || s[1] === 'W') && s.slice(0, 2).indexOf('C') !== -1) return { mult: pays.C2, sym: 'C', n: 2 };
    return null;
  }
  function evaluate(cols, pays) {
    const wins = [];
    LINES.forEach((ln, i) => {
      const w = lineWin(cols[0][ln[0]], cols[1][ln[1]], cols[2][ln[2]], pays);
      if (w) wins.push(Object.assign({ line: i }, w));
    });
    let scatters = 0;
    cols.forEach((col) => col.forEach((x) => { if (x === 'F') scatters++; }));
    return { wins, scatters };
  }
  /* Eksakt RTP (andel av total innsats) ved å telle alle stoppkombinasjoner. */
  function exactRTP(vol) {
    const v = VOL[vol], s = v.strips;
    let line = 0, trig = 0, n = 0;
    for (let i = 0; i < s[0].length; i++) for (let j = 0; j < s[1].length; j++) for (let k = 0; k < s[2].length; k++) {
      const ev = evaluate(windowAt(s, [i, j, k]), v.pays);
      n++;
      ev.wins.forEach((w) => { line += w.mult; });
      if (ev.scatters >= 3) trig++;
    }
    const p = trig / n;
    const w = line / n / LINES.length + p * SCATTER_PAY;
    const eFree = FREE_MULT * w / (1 - FREE_SPINS * p);
    return { rtp: w + p * FREE_SPINS * eFree, base: w, trigger: p };
  }

  window.Slots = { SYM, VOL, LINES, windowAt, lineWin, evaluate, exactRTP };

  const app = document.getElementById('sl-app');
  if (!app) return;

  /* ============================================================
     MASKINEN
     ============================================================ */
  const LINE_BETS = [1, 2, 5, 10, 20];
  const game = { vol: null, lineBet: 2, spinning: false, free: 0, freeWin: 0, auto: 0, stops: [0, 0, 0], session: { spins: 0, net: 0, best: 0 } };
  window.Slots.game = game;
  const ui = {};

  function buildUI() {
    app.innerHTML = '';
    app.className = 'game-shell sl';
    const E = C.el;
    const bar = E('div', 'game-toolbar');
    bar.innerHTML =
      '<span class="game-title">🎰 Ølautomaten</span>' +
      '<span class="pill gold" id="slVol"></span>' +
      '<span class="pill" id="slBank"></span>' +
      '<span class="toolbar-spacer"></span>' +
      '<button class="tool-btn" id="slDrink" type="button" title="Drikkemodus">🥴<span class="tl"> Drikk</span></button>' +
      '<button class="tool-btn" id="slSpeed" type="button" title="Raskere hjul">⏩<span class="tl"> Rask</span></button>' +
      '<button class="tool-btn" id="slPay" type="button" title="Gevinsttabell">📖<span class="tl"> Gevinster</span></button>' +
      '<button class="tool-btn" id="slSwap" type="button" title="Bytt volatilitet">🔄<span class="tl"> Bytt maskin</span></button>';
    app.appendChild(bar);

    const layout = E('div', 'sl-layout');
    layout.innerHTML =
      '<div class="sl-cabinet">' +
        '<div class="sl-sign"><span class="sl-lights"></span><b>ØLAUTOMATEN</b><span class="sl-lights"></span></div>' +
        '<div class="sl-display"><span id="slWinLabel">Lykke til!</span><b id="slWin">0</b></div>' +
        '<div class="sl-window" id="slWindow">' +
          '<div class="sl-reel"><div class="sl-strip"></div></div>' +
          '<div class="sl-reel"><div class="sl-strip"></div></div>' +
          '<div class="sl-reel"><div class="sl-strip"></div></div>' +
          '<svg class="sl-lines" id="slLines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true"></svg>' +
          '<div class="sl-free" id="slFree" hidden></div>' +
        '</div>' +
        '<div class="sl-panel">' +
          '<div class="sl-bet">' +
            '<button class="tool-btn" id="slMinus" type="button" aria-label="Lavere innsats">−</button>' +
            '<div class="sl-betinfo"><span>Per linje</span><b id="slLineBet">2</b></div>' +
            '<button class="tool-btn" id="slPlus" type="button" aria-label="Høyere innsats">+</button>' +
            '<div class="sl-betinfo"><span>Totalt (5 linjer)</span><b id="slTotal">10</b></div>' +
          '</div>' +
          '<div class="sl-buttons">' +
            '<button class="tool-btn" id="slAuto" type="button">🔁 Auto 10</button>' +
            '<button class="act big green" id="slSpin" type="button">Spinn<span class="kbd">␣</span></button>' +
          '</div>' +
        '</div>' +
        '<button class="sl-lever" id="slLever" type="button" aria-label="Trekk i spaken"><span class="sl-knob"></span><span class="sl-arm"></span></button>' +
      '</div>' +
      '<aside class="side-panel sl-side">' +
        '<div class="side-card"><h3>Gevinster <small id="slPayNote"></small></h3><ul class="sl-paytable" id="slPaytable"></ul></div>' +
        '<div class="side-card"><h3>Denne økta</h3><ul class="score-list" id="slSession"></ul></div>' +
      '</aside>';
    app.appendChild(layout);

    const $ = (id) => document.getElementById(id);
    Object.assign(ui, {
      vol: $('slVol'), bank: $('slBank'), win: $('slWin'), winLabel: $('slWinLabel'), window: $('slWindow'), lines: $('slLines'), free: $('slFree'),
      minus: $('slMinus'), plus: $('slPlus'), lineBet: $('slLineBet'), total: $('slTotal'), auto: $('slAuto'), spin: $('slSpin'), lever: $('slLever'),
      paytable: $('slPaytable'), payNote: $('slPayNote'), session: $('slSession'),
      drinkBtn: $('slDrink'), speedBtn: $('slSpeed'), payBtn: $('slPay'), swapBtn: $('slSwap'),
      reels: [...app.querySelectorAll('.sl-reel')], strips: [...app.querySelectorAll('.sl-strip')]
    });
    ui.minus.addEventListener('click', () => changeBet(-1));
    ui.plus.addEventListener('click', () => changeBet(1));
    ui.spin.addEventListener('click', () => spin());
    ui.lever.addEventListener('click', () => spin());
    ui.auto.addEventListener('click', toggleAuto);
    ui.drinkBtn.addEventListener('click', () => {
      Settings.set('drink', !Settings.get('drink'));
      if (Settings.get('drink')) { Achievements.unlock('drink_mode'); drinkPrompt('Drikkemodus på!', 'Tre sure sitroner = slurk'); }
      paintToggles();
    });
    ui.speedBtn.addEventListener('click', () => { C.setSpeed(C.speed < 1 ? 1 : 0.5); paintToggles(); });
    ui.payBtn.addEventListener('click', showPaytable);
    ui.swapBtn.addEventListener('click', () => { if (!game.spinning && !game.free) { game.auto = 0; setup(); } });
    document.addEventListener('keydown', (e) => {
      if (e.repeat || document.querySelector('.modal-overlay.open')) return;
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); spin(); }
    });
    document.addEventListener('gutta:wallet', paintBank);
    document.addEventListener('gutta:settings', paintToggles);
  }

  async function setup() {
    const last = Store.get('gutta_sl_config', { vol: 'middels' });
    const cfg = await C.setupDialog({
      icon: '🎰',
      title: 'Ølautomaten',
      intro: 'Tre like på en av fem linjer gir gevinst. ⭐ erstatter alt, og tre 🎡 hvor som helst gir ' + FREE_SPINS + ' gratisspinn med dobbel gevinst.',
      fields: [{ key: 'vol', label: 'Volatilitet', value: last.vol, options: Object.keys(VOL).map((k) => ({ value: k, label: VOL[k].label, desc: VOL[k].desc + ' · RTP ' + VOL[k].rtp })) }],
      describe: (v) => 'Høyeste gevinst: <b>' + VOL[v.vol].pays.B + '×</b> linjeinnsatsen for tre 🍺. Tilbakebetaling over tid: <b>' + VOL[v.vol].rtp + '</b>.',
      startLabel: 'Sett på maskinen',
      backHref: 'kasino.html'
    });
    Store.set('gutta_sl_config', cfg);
    await C.ensureFunds(LINE_BETS[0] * LINES.length);
    start(cfg.vol);
  }

  function start(vol) {
    game.vol = VOL[vol];
    game.volKey = vol;
    game.stops = game.vol.strips.map((s) => C.randInt(s.length));
    ui.vol.textContent = '🎚️ ' + game.vol.label;
    paintReelsStatic();
    paintPaytable();
    paintBet();
    paintBank();
    paintSession();
    paintToggles();
    ui.lines.innerHTML = '';
  }

  /* ---------- maling ---------- */
  function symHtml(s) { return '<div class="sl-sym s' + s + '"><span>' + SYM[s].e + '</span>' + (s === 'W' ? '<i>WILD</i>' : '') + '</div>'; }
  function paintReelsStatic() {
    const cols = windowAt(game.vol.strips, game.stops);
    ui.strips.forEach((st, r) => {
      st.style.transform = 'translateY(0)';
      st.innerHTML = cols[r].map(symHtml).join('');
    });
  }
  function paintPaytable() {
    const p = game.vol.pays;
    ui.payNote.textContent = '× linjeinnsats';
    ui.paytable.innerHTML = ['B', 'W', 'S', 'P', 'Z', 'K', 'L', 'C'].map((s) =>
      '<li><span>' + SYM[s].e + SYM[s].e + SYM[s].e + '</span><b>' + p[s] + '×</b></li>').join('') +
      '<li><span>🍒🍒</span><b>' + p.C2 + '×</b></li>' +
      '<li class="scat"><span>🎡🎡🎡</span><b>' + FREE_SPINS + ' gratis</b></li>';
  }
  function paintBet() {
    ui.lineBet.textContent = game.lineBet;
    ui.total.textContent = game.lineBet * LINES.length;
    const i = LINE_BETS.indexOf(game.lineBet);
    ui.minus.disabled = i <= 0 || game.spinning || game.free > 0;
    ui.plus.disabled = i >= LINE_BETS.length - 1 || game.spinning || game.free > 0;
    ui.spin.disabled = game.spinning;
    ui.lever.disabled = game.spinning;
  }
  function paintBank() { if (ui.bank) ui.bank.innerHTML = 'Saldo <b>' + formatGK(Wallet.balance) + '</b>'; }
  function paintToggles() {
    ui.drinkBtn.classList.toggle('on', !!Settings.get('drink'));
    ui.speedBtn.classList.toggle('on', C.speed < 1);
    ui.auto.classList.toggle('on', game.auto > 0);
    ui.auto.textContent = game.auto > 0 ? '⏹ Stopp (' + game.auto + ')' : '🔁 Auto 10';
  }
  function paintSession() {
    const s = game.session;
    ui.session.innerHTML = [['Spinn', s.spins], ['Største gevinst', C.fmtChips(s.best)],
      ['Netto', '<span class="' + (s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : '') + '">' + (s.net > 0 ? '+' : '') + C.fmtChips(s.net) + '</span>']]
      .map(([k, v]) => '<li><span class="who">' + k + '</span><span class="amt">' + v + '</span></li>').join('');
  }
  function setWin(label, amount) {
    ui.winLabel.textContent = label;
    ui.win.textContent = C.fmtChips(amount);
    ui.win.parentElement.classList.toggle('hot', amount > 0);
  }

  function changeBet(dir) {
    if (game.spinning || game.free) return;
    const i = LINE_BETS.indexOf(game.lineBet);
    game.lineBet = LINE_BETS[Math.max(0, Math.min(LINE_BETS.length - 1, i + dir))];
    GuttaSFX.click();
    paintBet();
  }
  function toggleAuto() {
    if (game.auto > 0) { game.auto = 0; paintToggles(); return; }
    game.auto = 10;
    paintToggles();
    if (!game.spinning) spin();
  }

  /* ---------- spinn ---------- */
  async function spin() {
    if (game.spinning || !game.vol) return;
    const total = game.lineBet * LINES.length;
    const isFree = game.free > 0;
    if (!isFree) {
      if (!Wallet.spend(total, 'ølautomat')) {
        game.auto = 0; paintToggles();
        await C.ensureFunds(total);
        return;
      }
      game.session.spins++;
      game.session.net -= total;
      Stats.add('slots.spins');
      game.spinStake = total;
    } else {
      game.free--;
      paintFree();
    }
    game.spinning = true;
    paintBet();
    ui.lines.innerHTML = '';
    ui.window.querySelectorAll('.sl-sym.win').forEach((el) => el.classList.remove('win'));
    setWin(isFree ? 'Gratisspinn!' : 'Spinner…', 0);
    ui.lever.classList.add('pulled');
    setTimeout(() => ui.lever.classList.remove('pulled'), 380);
    GuttaSFX.swoosh();

    const stops = game.vol.strips.map((s) => C.randInt(s.length));
    await animateReels(stops);
    game.stops = stops;

    const cols = windowAt(game.vol.strips, stops);
    const ev = evaluate(cols, game.vol.pays);
    const mult = isFree ? FREE_MULT : 1;
    let win = 0;
    ev.wins.forEach((w) => { win += w.mult * game.lineBet * mult; });
    if (ev.scatters >= 3) win += SCATTER_PAY * total * mult;
    showWins(ev, cols);

    if (win > 0) {
      Wallet.add(win, 'ølautomat');
      game.session.net += win;
      game.session.best = Math.max(game.session.best, win);
      if (isFree) game.freeWin += win;
      const big = win >= total * 15;
      setWin(big ? 'STOR GEVINST!' : 'Gevinst', win);
      if (big) { GuttaSFX.bigWin(); coinShower(); } else { GuttaSFX.coin(); }
      Stats.max('slots.best', win);
      Achievements.unlock('first_win');
    } else setWin(isFree ? 'Gratisspinn' : 'Ingen gevinst', 0);
    Stats.add('slots.net', win - (isFree ? 0 : total));
    if (win > 0) Stats.add('slots.wins');

    if (ev.wins.some((w) => w.sym === 'B' && w.n === 3)) { Achievements.unlock('slots_jackpot'); drinkPrompt('JACKPOT!', 'Del ut ti slurker'); confettiBurst(); }
    else if (ev.wins.some((w) => w.sym === 'L' && w.n === 3)) drinkPrompt('Sur øl!', 'Ta en slurk av noe surt');

    if (ev.scatters >= 3) {
      game.free += FREE_SPINS;
      if (!isFree) game.freeWin = 0;
      message(FREE_SPINS + ' GRATISSPINN!');
      GuttaSFX.fanfare();
      drinkPrompt('Gratisspinn!', 'Skål for huset');
      paintFree();
      await C.wait(1200);
    }
    paintSession();
    game.spinning = false;
    paintBet();

    if (game.free > 0) { await C.wait(700); return spin(); }
    if (isFree) {
      message('Gratisspinn ferdig: ' + C.fmtChips(game.freeWin) + ' GK');
      paintFree();
      await C.wait(1200);
    }
    if (game.auto > 0) {
      game.auto--;
      paintToggles();
      if (game.auto > 0) { await C.wait(win > 0 ? 900 : 350); if (game.auto > 0) spin(); }
    }
  }

  function animateReels(stops) {
    const fast = C.speed < 0.05;
    return Promise.all(ui.strips.map((st, r) => {
      const strip = game.vol.strips[r];
      const L = strip.length;
      const final = [strip[(stops[r] - 1 + L) % L], strip[stops[r]], strip[(stops[r] + 1) % L]];
      const current = windowAt(game.vol.strips, game.stops)[r];
      if (fast) { st.innerHTML = final.map(symHtml).join(''); return Promise.resolve(); }
      // long strip: final symbols on top, a run of random symbols, the current symbols at the bottom
      const spinLen = 14 + r * 5;
      const filler = [];
      for (let i = 0; i < spinLen; i++) filler.push(strip[C.randInt(L)]);
      st.innerHTML = final.concat(filler, current).map(symHtml).join('');
      const cell = ui.reels[r].clientHeight / 3;
      const dist = (spinLen + 3) * cell;
      st.style.transform = 'translateY(' + (-dist) + 'px)';
      const dur = (900 + r * 380) * C.speed;
      const anim = st.animate([
        { transform: 'translateY(' + (-dist) + 'px)' },
        { transform: 'translateY(' + (cell * 0.18) + 'px)', offset: 0.92 },
        { transform: 'translateY(0)' }
      ], { duration: dur, easing: 'cubic-bezier(.25,.1,.3,1)' });
      return C.settled(anim, dur).then(() => {
        st.style.transform = 'translateY(0)';
        st.innerHTML = final.map(symHtml).join('');
        GuttaSFX.reelStop();
      });
    }));
  }

  function showWins(ev, cols) {
    const svg = ui.lines;
    const yOf = (row) => 50 + row * 100;
    let html = '';
    ev.wins.forEach((w) => {
      const ln = LINES[w.line];
      const n = w.n;
      const pts = [];
      for (let r = 0; r < n; r++) pts.push((50 + r * 100) + ',' + yOf(ln[r]));
      html += '<polyline points="' + pts.join(' ') + '" class="l' + w.line + '"/>';
      for (let r = 0; r < n; r++) {
        const el = ui.strips[r].children[ln[r]];
        if (el) el.classList.add('win');
      }
    });
    svg.innerHTML = html;
    if (ev.scatters >= 3) {
      cols.forEach((col, r) => col.forEach((s, row) => { if (s === 'F') ui.strips[r].children[row].classList.add('win'); }));
    }
  }

  function paintFree() {
    ui.free.hidden = game.free <= 0;
    ui.free.textContent = '🎡 ' + game.free + ' gratisspinn igjen · ×' + FREE_MULT;
  }

  function message(text) {
    const m = C.el('div', 'sl-banner', text);
    ui.window.appendChild(m);
    setTimeout(() => m.remove(), 1800 * Math.max(C.speed, 0.4));
  }

  function coinShower() {
    for (let i = 0; i < 26; i++) {
      const c = C.el('div', 'sl-coin', '🪙');
      c.style.left = (10 + Math.random() * 80) + '%';
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      c.style.animationDuration = (1 + Math.random() * 0.8) + 's';
      ui.window.appendChild(c);
      setTimeout(() => c.remove(), 2600);
    }
  }

  function showPaytable() {
    const v = game.vol || VOL.middels;
    const rows = ['B', 'W', 'S', 'P', 'Z', 'K', 'L', 'C'].map((s) => '<tr><td>' + SYM[s].e.repeat(3) + '</td><td>' + SYM[s].name + '</td><td><b>' + v.pays[s] + '×</b></td></tr>').join('');
    C.modal({
      icon: '🎰', title: 'Gevinster (' + v.label + ')', wide: true,
      html: '<table class="rules-table"><tr><th>Linje</th><th>Symbol</th><th>Betaler</th></tr>' + rows +
        '<tr><td>🍒🍒</td><td>To kirsebær fra venstre</td><td><b>' + v.pays.C2 + '×</b></td></tr></table>' +
        '<ul class="rules-list"><li>Gevinster betales per linje som × linjeinnsatsen. Fem linjer: tre vannrette og to diagonaler.</li>' +
        '<li>⭐ <b>Wild</b> erstatter alle symboler unntatt 🎡.</li>' +
        '<li>🎡 tre hvor som helst gir ' + SCATTER_PAY + '× totalinnsatsen og <b>' + FREE_SPINS + ' gratisspinn</b> der alle gevinster dobles.</li>' +
        '<li>Tilbakebetaling over tid (RTP): <b>' + v.rtp + '</b>. Huset vinner i det lange løp, så spill for moro.</li></ul>',
      actions: [{ label: 'Lukk', value: true }],
      dismissValue: true
    });
  }

  buildUI();
  setup();
})();
