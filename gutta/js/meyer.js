/* =========================================================
   MEYER — bløffespillet med to terninger og et beger
   Rist begeret i skjul og si et tall som er høyere enn forrige.
   Neste spiller tror deg (og må slå det selv) eller løfter.
   Lyver du, mister du et liv. Sa du sannheten, mister han som
   løftet. Meyer (2-1) koster to liv.
   AI-nivåer:
   - Lett: naive og fulle. Løfter litt tilfeldig og bløffer vilt.
   - Middels: regner sannsynligheter for hver påstand.
   - Vanskelig: regner også på hvor ofte DU lyver, og velger
     bløffer som er vanskelige å avsløre.
   ========================================================= */
(function () {
  'use strict';
  const C = Casino;

  /* ============================================================
     VERDIER OG SANNSYNLIGHETER (ren logikk)
     ============================================================ */
  // lowest -> highest
  const ORDER = ['32', '41', '42', '43', '51', '52', '53', '54', '61', '62', '63', '64', '65', '11', '22', '33', '44', '55', '66', '31', '21'];
  const rank = (v) => ORDER.indexOf(v);
  const prob = (v) => (v[0] === v[1] ? 1 / 36 : 2 / 36);
  const pGE = (v) => ORDER.slice(rank(v)).reduce((s, x) => s + prob(x), 0);
  const pGT = (v) => ORDER.slice(rank(v) + 1).reduce((s, x) => s + prob(x), 0);
  function valueOf(a, b) {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return String(hi) + String(lo);
  }
  function label(v) {
    if (v === '21') return 'Meyer';
    if (v === '31') return 'Lille Meyer';
    if (v[0] === v[1]) return 'Par ' + v[0];
    return v;
  }
  /* Kan påstand v følge etter forrige påstand prev? (Meyer kan følges av Meyer.) */
  function canFollow(v, prev) {
    if (!prev) return true;
    if (prev === '21') return v === '21';
    return rank(v) > rank(prev);
  }

  window.Meyer = { ORDER, rank, prob, pGE, pGT, valueOf, label, canFollow };

  const app = document.getElementById('my-app');
  if (!app) return;

  /* ============================================================
     OPPSETT
     ============================================================ */
  const LEVELS = {
    lett: { label: 'Lett', noise: 0.28, naive: true, wild: 0.45, think: [500, 900], desc: 'Godtroende fulle gutter som bløffer vilt' },
    middels: { label: 'Middels', noise: 0.12, naive: false, wild: 0.08, think: [700, 1200], desc: 'Regner sannsynlighet på hver påstand' },
    vanskelig: { label: 'Vanskelig', noise: 0.02, naive: false, wild: 0.03, think: [800, 1500], model: true, desc: 'Husker hvor ofte du lyver' }
  };
  const BUYINS = [50, 100, 250];
  const LINES = {
    believe: ['Jeg tror deg.', 'Greit, gi hit.', 'Ok, ok.', 'Den kjøper jeg.'],
    lift: ['LØFT!', 'Tull! Løft!', 'Den tror jeg ikke på.', 'Vis meg!'],
    caughtLie: ['Faen, tatt!', 'Ups…', 'Det var verdt et forsøk.'],
    truth: ['Sa jo det!', 'Ærlig som dagen er lang.', 'Hehe, sant hvert ord.'],
    wrongLift: ['Æsj.', 'Burde trodd deg.', 'Typisk.'],
    out: ['Jeg er ute… skål for dere.', 'Ferdig for i kveld.'],
    meyer: ['MEYER! 🎲', 'Meyer, gutter!'],
    drunk: ['*hikk*', 'Hvem sin tur er det?', 'Jeg ser tre terninger…']
  };

  const game = { cfg: null, lv: null, players: [], phase: 'idle', gen: 0, human: null, model: { lifted: 0, lies: 0, ann: 0, lb: [[0, 0], [0, 0], [0, 0]] } };
  window.Meyer.game = game;
  const ui = {};

  function buildUI() {
    app.innerHTML = '';
    app.className = 'game-shell my';
    const E = C.el;
    const bar = E('div', 'game-toolbar');
    bar.innerHTML =
      '<span class="game-title">🎲 Meyer</span>' +
      '<span class="pill gold" id="myLevel"></span>' +
      '<span class="pill" id="myPot"></span>' +
      '<span class="toolbar-spacer"></span>' +
      '<button class="tool-btn" id="myHelp" type="button" title="Vis sannsynligheter">🎯<span class="tl"> Sjanser</span></button>' +
      '<button class="tool-btn" id="myDrink" type="button" title="Drikkemodus">🥴<span class="tl"> Drikk</span></button>' +
      '<button class="tool-btn" id="mySpeed" type="button" title="Raskere AI">⏩<span class="tl"> Rask</span></button>' +
      '<button class="tool-btn" id="myRules" type="button" title="Regler">📖<span class="tl"> Regler</span></button>' +
      '<button class="tool-btn" id="myNew" type="button" title="Nytt spill">🔄<span class="tl"> Nytt spill</span></button>';
    app.appendChild(bar);

    const layout = E('div', 'my-layout');
    layout.innerHTML =
      '<div class="my-main">' +
        '<div class="felt my-table" id="myTable">' +
          '<div class="my-center">' +
            '<div class="my-claim" id="myClaim"></div>' +
            '<div class="my-cupzone"><div class="my-dice" id="myDice"></div><div class="my-cup" id="myCup"><span>GUTTA</span></div></div>' +
            '<div class="my-note" id="myNote"></div>' +
          '</div>' +
          '<div class="table-msg" id="myMsg"></div>' +
        '</div>' +
        '<div class="my-controls" id="myControls"></div>' +
      '</div>' +
      '<aside class="side-panel my-side">' +
        '<div class="side-card"><h3>Rangering</h3><ol class="my-ladder" id="myLadder"></ol></div>' +
        '<div class="side-card"><h3>Logg</h3><ul class="log-list" id="myLog"></ul></div>' +
      '</aside>';
    app.appendChild(layout);
    const $ = (id) => document.getElementById(id);
    Object.assign(ui, {
      level: $('myLevel'), pot: $('myPot'), table: $('myTable'), claim: $('myClaim'), dice: $('myDice'), cup: $('myCup'), note: $('myNote'),
      msg: $('myMsg'), controls: $('myControls'), ladder: $('myLadder'), log: $('myLog'),
      helpBtn: $('myHelp'), drinkBtn: $('myDrink'), speedBtn: $('mySpeed'), rulesBtn: $('myRules'), newBtn: $('myNew')
    });
    ui.helpBtn.addEventListener('click', () => { game.help = !game.help; Store.set('gutta_my_help', game.help); paintToggles(); paintLadder(); });
    ui.drinkBtn.addEventListener('click', () => {
      Settings.set('drink', !Settings.get('drink'));
      if (Settings.get('drink')) { Achievements.unlock('drink_mode'); drinkPrompt('Drikkemodus på!', 'Mister du et liv, drikker du'); }
      paintToggles();
    });
    ui.speedBtn.addEventListener('click', () => { C.setSpeed(C.speed < 1 ? 1 : 0.5); paintToggles(); });
    ui.rulesBtn.addEventListener('click', showRules);
    ui.newBtn.addEventListener('click', newGame);
    document.addEventListener('gutta:settings', paintToggles);
    window.addEventListener('resize', positionSeats);
    document.addEventListener('keydown', (e) => {
      if (e.repeat || document.querySelector('.modal-overlay.open')) return;
      const k = e.key.toLowerCase();
      const btn = (sel) => { const b = ui.controls.querySelector(sel); if (b && !b.disabled) { e.preventDefault(); b.click(); } };
      if (k === 't') btn('[data-k="believe"]');
      else if (k === 'l') btn('[data-k="lift"]');
      else if (k === ' ' || k === 'enter') { if (e.target && e.target.tagName === 'BUTTON') return; btn('[data-k="roll"]') || btn('[data-k="truth"]'); }
    });
  }

  /* ---------- oppsett ---------- */
  async function setup() {
    const last = Store.get('gutta_my_config', { level: 'lett', opponents: 3, lives: 6, buyin: 50 });
    const cfg = await C.setupDialog({
      icon: '🎲',
      title: 'Meyer',
      intro: 'Rist, si et tall, og håp at ingen løfter. Sistemann med liv igjen vinner potten.',
      fields: [
        { key: 'level', label: 'AI-nivå', value: last.level, options: Object.keys(LEVELS).map((k) => ({ value: k, label: LEVELS[k].label, desc: LEVELS[k].desc })) },
        { key: 'opponents', label: 'Motstandere', value: last.opponents, compact: true, options: [1, 2, 3, 4].map((n) => ({ value: n, label: String(n) })) },
        { key: 'lives', label: 'Liv', value: last.lives, compact: true, options: [3, 6].map((n) => ({ value: n, label: n + ' 🍺' })) },
        { key: 'buyin', label: 'Innsats', value: last.buyin, compact: true, options: BUYINS.map((b) => ({ value: b, label: b + ' GK' })) }
      ],
      describe: (v) => '💰 Vinneren tar potten på <b>' + formatGK(v.buyin * (v.opponents + 1)) + '</b>.',
      startLabel: 'Rist begeret',
      backHref: 'kasino.html'
    });
    Store.set('gutta_my_config', cfg);
    if (!(await C.ensureFunds(cfg.buyin))) { setup(); return; }
    Wallet.spend(cfg.buyin, 'meyer');
    start(cfg);
  }

  function start(cfg) {
    game.cfg = cfg;
    game.lv = LEVELS[cfg.level];
    game.help = Store.get('gutta_my_help', cfg.level === 'lett');
    game.model = Object.assign({ lifted: 0, lies: 0, ann: 0, lb: [[0, 0], [0, 0], [0, 0]] }, Store.get('gutta_my_model', {}));
    game.human = { name: 'Du', avatar: '🫵', color: '#f4a825', isHuman: true };
    const bots = C.pickBots(cfg.opponents).map((b) => Object.assign(b, { isHuman: false }));
    game.players = [game.human].concat(bots).map((p, i) => Object.assign(p, { seat: i, lives: cfg.lives, out: false, place: 0, dice: null }));
    game.order = [];
    ui.level.textContent = '🎚️ ' + game.lv.label;
    ui.pot.innerHTML = 'Pott <b>' + formatGK(cfg.buyin * game.players.length) + '</b>';
    ui.log.innerHTML = '';
    buildSeats();
    paintToggles();
    paintLadder();
    log('Nytt spill: <b>' + game.lv.label + '</b>, ' + cfg.lives + ' liv hver.');
    game.gen++;
    loop(game.gen, C.randInt(game.players.length));
  }

  async function newGame() {
    if (game.cfg && !game.over) {
      const ok = await C.modal({ icon: '🏳️', title: 'Gi opp?', html: '<p>Innsatsen på ' + formatGK(game.cfg.buyin) + ' er tapt hvis du går nå.</p>',
        actions: [{ label: 'Ja, nytt spill', value: true, cls: 'red' }, { label: 'Spill videre', value: false, cls: 'ghost' }], dismissValue: false });
      if (!ok) return;
    }
    game.over = true;
    game.gen++;
    if (game.pending) { const p = game.pending; game.pending = null; p('abort'); }
    setup();
  }

  /* ---------- bord ---------- */
  function buildSeats() {
    ui.table.querySelectorAll('.my-seat').forEach((el) => el.remove());
    game.players.forEach((p) => {
      const seat = C.el('div', 'my-seat' + (p.isHuman ? ' you' : ''));
      seat.innerHTML = '<span class="avatar" style="--seat:' + p.color + '">' + p.avatar + '</span>' +
        '<div class="my-meta"><span class="seat-name">' + escapeHtml(p.name) + '</span><span class="my-lives"></span></div>';
      ui.table.appendChild(seat);
      p.el = { seat, lives: seat.querySelector('.my-lives') };
    });
    positionSeats();
    paintSeats();
  }
  function positionSeats() {
    const n = game.players.length;
    if (!n) return;
    const r = ui.table.getBoundingClientRect();
    const tall = r.height > r.width;
    game.players.forEach((p, i) => {
      const th = Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = 50 + (tall ? 38 : 42) * Math.cos(th), y = 50 + (tall ? 41 : 38) * Math.sin(th);
      p.el.seat.style.left = x + '%';
      p.el.seat.style.top = y + '%';
      p.el.seat.classList.toggle('top', y < 40);
    });
  }
  function paintSeats() {
    game.players.forEach((p) => {
      p.el.seat.classList.toggle('out', p.out);
      const full = Math.max(0, p.lives);
      p.el.lives.innerHTML = p.out ? (p.place ? p.place + '. plass' : 'Ute') : '<span class="full">' + '🍺'.repeat(full) + '</span>' + '<span class="empty">' + '🍺'.repeat(Math.max(0, game.cfg.lives - full)) + '</span>';
    });
  }
  function paintToggles() {
    ui.helpBtn.classList.toggle('on', !!game.help);
    ui.drinkBtn.classList.toggle('on', !!Settings.get('drink'));
    ui.speedBtn.classList.toggle('on', C.speed < 1);
  }
  function paintLadder(current) {
    ui.ladder.innerHTML = ORDER.slice().reverse().map((v) => {
      const cls = v === current ? ' class="cur"' : '';
      return '<li' + cls + '><span>' + label(v) + '</span>' + (game.help ? '<small>' + Math.round(pGE(v) * 100) + ' %</small>' : '') + '</li>';
    }).join('');
  }
  function setClaim(p, v) {
    if (!v) { ui.claim.innerHTML = ''; paintLadder(); return; }
    ui.claim.innerHTML = '<span>' + escapeHtml(p.isHuman ? 'Du' : p.name) + ' sier</span><b>' + label(v) + '</b>';
    ui.claim.classList.remove('pop'); void ui.claim.offsetWidth; ui.claim.classList.add('pop');
    paintLadder(v);
  }
  function dieHtml(n) {
    const pips = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n];
    let h = '<div class="die d' + n + '">';
    for (let i = 1; i <= 9; i++) h += '<i' + (pips.indexOf(i) !== -1 ? ' class="on"' : '') + '></i>';
    return h + '</div>';
  }
  function showDice(d) { ui.dice.innerHTML = d ? dieHtml(d[0]) + dieHtml(d[1]) : ''; }
  function cup(state) { ui.cup.className = 'my-cup ' + state; }
  function message(text, kind, ms) {
    ui.msg.textContent = text;
    ui.msg.className = 'table-msg show' + (kind ? ' ' + kind : '');
    clearTimeout(ui.msgTimer);
    if (ms) ui.msgTimer = setTimeout(() => ui.msg.classList.remove('show'), ms * Math.max(C.speed, 0.4));
  }
  function log(html) {
    ui.log.prepend(C.el('li', '', html));
    while (ui.log.children.length > 80) ui.log.lastChild.remove();
  }
  const nm = (p) => (p.isHuman ? 'Du' : p.name);
  const alive = () => game.players.filter((p) => !p.out);
  function nextAlive(i) {
    const n = game.players.length;
    for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!game.players[j].out) return j; }
    return i;
  }
  function checkGen(gen) { if (gen !== game.gen) throw new Error('aborted'); }

  /* ============================================================
     SPILLØKKA
     ============================================================ */
  async function loop(gen, starter) {
    game.over = false;
    try {
      let start = starter;
      while (alive().length > 1 && !game.human.out) {
        const loser = await round(gen, start);
        checkGen(gen);
        await C.wait(1400);
        checkGen(gen);
        start = loser.out ? nextAlive(game.players.indexOf(loser)) : game.players.indexOf(loser);
      }
      await finish();
    } catch (e) {
      if (e.message !== 'aborted') console.error(e);
    }
  }

  async function round(gen, startIdx) {
    let cur = startIdx;
    let prev = null, prevPlayer = null;
    setClaim(null);
    showDice(null);
    cup('down');
    ui.note.textContent = '';
    game.players.forEach((p) => p.el.seat.classList.remove('active', 'lost'));
    log('— Ny runde, ' + escapeHtml(nm(game.players[cur])) + ' starter —');
    for (let guard = 0; guard < 100; guard++) {
      const p = game.players[cur];
      game.players.forEach((q) => q.el.seat.classList.toggle('active', q === p));
      // 1) believe or lift?
      if (prev) {
        const lift = p.isHuman ? await humanBelieveOrLift(prevPlayer, prev) : await botBelieveOrLift(p, prevPlayer, prev, gen);
        checkGen(gen);
        if (lift) return await reveal(p, prevPlayer, prev, gen);
        if (!p.isHuman) C.speak(p.el.seat, C.pick(LINES.believe), 1300, { below: p.el.seat.classList.contains('top') });
        log(escapeHtml(nm(p)) + ' tror på det.');
      }
      // 2) roll under the cup
      cup('down shake');
      ui.note.textContent = p.isHuman ? '' : nm(p) + ' rister…';
      showDice(null);
      if (p.isHuman) await humanRoll();
      GuttaSFX.diceRoll();
      await C.wait(750);
      checkGen(gen);
      p.dice = [C.randInt(6) + 1, C.randInt(6) + 1];
      const actual = valueOf(p.dice[0], p.dice[1]);
      cup('down');
      // 3) announce
      p.prevClaimBefore = prev;
      let ann;
      if (p.isHuman) {
        showDice(p.dice);
        cup('peek');
        ann = await humanAnnounce(actual, prev);
        checkGen(gen);
        cup('down');
        game.model.ann++;
      } else {
        await C.wait(game.lv.think[0] + Math.random() * (game.lv.think[1] - game.lv.think[0]));
        checkGen(gen);
        ann = botAnnounce(p, actual, prev);
        if (ann === '21') C.speak(p.el.seat, C.pick(LINES.meyer), 1400, { below: p.el.seat.classList.contains('top') });
        else if (game.lv.naive && C.chance(0.2)) { C.speak(p.el.seat, C.pick(LINES.drunk), 1300, { below: p.el.seat.classList.contains('top') }); GuttaSFX.hiccup(); }
      }
      p.claim = ann;
      setClaim(p, ann);
      ui.note.textContent = '';
      log(escapeHtml(nm(p)) + ' sier <b>' + label(ann) + '</b>.');
      GuttaSFX.click();
      prev = ann; prevPlayer = p;
      cur = nextAlive(cur);
      await C.wait(500);
    }
    throw new Error('round guard');
  }

  async function reveal(lifter, claimer, claim, gen) {
    if (!lifter.isHuman) C.speak(lifter.el.seat, C.pick(LINES.lift), 1400, { below: lifter.el.seat.classList.contains('top') });
    message(nm(lifter) + ' løfter!', 'push', 1200);
    GuttaSFX.swoosh();
    await C.wait(700);
    checkGen(gen);
    showDice(claimer.dice);
    cup('up');
    const actual = valueOf(claimer.dice[0], claimer.dice[1]);
    const truth = rank(actual) >= rank(claim);
    const loser = truth ? lifter : claimer;
    const cost = claim === '21' ? 2 : 1;
    await C.wait(600);
    loser.lives -= cost;
    loser.el.seat.classList.add('lost');
    log(escapeHtml(nm(lifter)) + ' løftet: ' + escapeHtml(nm(claimer)) + ' hadde <b>' + label(actual) + '</b> (sa ' + label(claim) + '). ' +
      (truth ? 'Sant!' : 'Løgn!') + ' ' + escapeHtml(nm(loser)) + ' mister ' + cost + ' liv.');
    message((truth ? 'Sant! ' : 'Løgn! ') + nm(loser) + ' mister ' + cost + ' liv', loser.isHuman ? 'lose' : (lifter.isHuman || claimer.isHuman ? 'win' : 'push'), 2200);
    loser.isHuman ? GuttaSFX.lose() : GuttaSFX.win();
    // AI chatter
    if (!claimer.isHuman) C.speak(claimer.el.seat, C.pick(truth ? LINES.truth : LINES.caughtLie), 1500, { below: claimer.el.seat.classList.contains('top') });
    else if (!lifter.isHuman && truth) C.speak(lifter.el.seat, C.pick(LINES.wrongLift), 1500, { below: lifter.el.seat.classList.contains('top') });
    // model of the human
    if (claimer.isHuman) { game.model.lifted++; if (!truth) game.model.lies++; Store.set('gutta_my_model', game.model); }
    // drinking
    if (loser.isHuman) drinkPrompt(cost === 2 ? 'Meyer-straff!' : 'Du mister et liv', cost === 2 ? 'To store slurker' : 'Ta en slurk');
    if (loser.lives <= 0) {
      loser.out = true;
      loser.place = alive().length + 1;
      log('💀 <b>' + escapeHtml(nm(loser)) + '</b> er ute (' + loser.place + '. plass).');
      if (!loser.isHuman) C.speak(loser.el.seat, C.pick(LINES.out), 1800, { below: loser.el.seat.classList.contains('top') });
    }
    paintSeats();
    return loser;
  }

  /* ---------- menneskets valg ---------- */
  function setControls(html) { ui.controls.innerHTML = html; }
  function humanRoll() {
    return new Promise((resolve) => {
      setControls('<div class="my-prompt">Din tur! Rist begeret.</div><div class="actions"><button class="act big green" data-k="roll" type="button">🎲 Rist<span class="kbd">␣</span></button></div>');
      app.dataset.turn = 'you';
      const b = ui.controls.querySelector('[data-k="roll"]');
      game.pending = (v) => { game.pending = null; resolve(v); };
      b.addEventListener('click', () => { setControls(''); app.dataset.turn = ''; const p = game.pending; if (p) p('roll'); });
    });
  }
  function humanAnnounce(actual, prev) {
    return new Promise((resolve) => {
      const can = (v) => canFollow(v, prev);
      const truthOk = can(actual);
      let html = '<div class="my-prompt">Du fikk <b>' + label(actual) + '</b>. ' + (prev ? 'Du må si noe høyere enn <b>' + label(prev) + '</b>.' : 'Si hva du vil.') +
        (truthOk ? '' : ' <span class="warn">Du må bløffe!</span>') + '</div>';
      html += '<div class="actions">' + (truthOk ? '<button class="act green" data-k="truth" data-v="' + actual + '" type="button">Si sannheten: ' + label(actual) + '<span class="kbd">␣</span></button>' : '') + '</div>';
      html += '<div class="my-grid">' + ORDER.slice().reverse().map((v) =>
        '<button type="button" class="my-val' + (v === actual ? ' real' : '') + '" data-v="' + v + '"' + (can(v) ? '' : ' disabled') + '>' + label(v) +
        (game.help ? '<small>' + Math.round(pGE(v) * 100) + '%</small>' : '') + '</button>').join('') + '</div>';
      setControls(html);
      app.dataset.turn = 'you';
      game.pending = (v) => { game.pending = null; resolve(v); };
      ui.controls.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.v;
        if (!can(v)) return;
        setControls(''); app.dataset.turn = '';
        const p = game.pending; if (p) p(v);
      }));
    });
  }
  function humanBelieveOrLift(claimer, claim) {
    return new Promise((resolve) => {
      const hint = game.help ? '<div class="my-hint">🎯 Sjansen for å slå ' + label(claim) + ' ærlig: ' + Math.round(pGT(claim) * 100) + ' %. ' +
        'Sjansen for at ' + escapeHtml(claimer.name) + ' faktisk hadde det: ~' + Math.round(estimateTrue(claim, claimer.prevClaimBefore, claimer) * 100) + ' %.</div>' : '';
      const forced = claim === '21';
      setControls('<div class="my-prompt">' + escapeHtml(claimer.name) + ' sier <b>' + label(claim) + '</b>. Tror du ' + (claimer.isHuman ? 'deg' : 'ham') + '?' +
        (forced ? ' <span class="warn">Tror du på Meyer, må du slå Meyer selv!</span>' : '') + '</div>' + hint +
        '<div class="actions"><button class="act green" data-k="believe" type="button">Tror deg<span class="kbd">T</span></button>' +
        '<button class="act red" data-k="lift" type="button">Løft!<span class="kbd">L</span></button></div>');
      app.dataset.turn = 'you';
      game.pending = (v) => {
        game.pending = null;
        if (v === 'lift' || v === 'believe') {
          const b = game.model.lb[bucketOf(claim)];
          b[1]++; if (v === 'lift') b[0]++;
          Store.set('gutta_my_model', game.model);
        }
        resolve(v === 'lift');
      };
      ui.controls.querySelector('[data-k="believe"]').addEventListener('click', () => { setControls(''); app.dataset.turn = ''; const p = game.pending; if (p) p('believe'); });
      ui.controls.querySelector('[data-k="lift"]').addEventListener('click', () => { setControls(''); app.dataset.turn = ''; const p = game.pending; if (p) p('lift'); });
      GuttaSFX.click();
    });
  }

  /* ============================================================
     AI
     ============================================================ */
  /* Påstander deles i lav / middels / høy når vi lærer hvor ofte du løfter. */
  function bucketOf(v) { const r = rank(v); return r <= 6 ? 0 : r <= 12 ? 1 : 2; }
  function humanLiftRate(v) {
    const prior = [0.25, 0.4, 0.65][bucketOf(v)];
    const b = game.model.lb[bucketOf(v)];
    return (b[0] + prior * 3) / (b[1] + 3);
  }
  function nextPlayerAfter(p) { return game.players[nextAlive(game.players.indexOf(p))]; }

  /* Sannsynligheten for at påstanden er sann: ærlige kast som rettferdiggjør den,
     mot tvungne løgner (kastet slo ikke forrige påstand) som ofte havner like over. */
  function estimateTrue(claim, before, claimer) {
    const honest = pGE(claim);
    const forced = before ? 1 - pGT(before) : 0.12; // even an opener lies sometimes
    const dist = before ? Math.max(1, rank(claim) - rank(before)) : 3;
    let lieBias = Math.pow(0.62, dist - 1);
    if (claimer && claimer.isHuman && game.lv && game.lv.model && game.model.lifted >= 4) {
      const lieRate = (game.model.lies + 1) / (game.model.lifted + 2);
      lieBias *= 0.5 + lieRate * 1.2;
    }
    const lie = forced * lieBias;
    return honest / (honest + lie);
  }

  async function botBelieveOrLift(p, claimer, claim, gen) {
    p.el.seat.classList.add('thinking');
    await C.wait(game.lv.think[0] + Math.random() * (game.lv.think[1] - game.lv.think[0]));
    checkGen(gen);
    p.el.seat.classList.remove('thinking');
    const lv = game.lv;
    if (lv.naive) {
      // gullible: believes nearly everything, then has to bluff its way out
      return claim === '21' ? C.chance(0.5) : C.chance(0.08 + 0.18 * (rank(claim) / ORDER.length));
    }
    if (claim === '21') {
      // believing Meyer means you must roll Meyer yourself (2/36) or bluff it
      const pTrue = lv.naive ? 0.5 : estimateTrue(claim, claimer.prevClaimBefore, claimer);
      return pTrue < 0.85 || C.chance(0.6);
    }
    let pTrue = estimateTrue(claim, claimer.prevClaimBefore, claimer);
    pTrue = Math.max(0, Math.min(1, pTrue + (Math.random() * 2 - 1) * lv.noise));
    // risk if I accept: I need to beat it; if I can't, I must bluff and may get caught
    const beat = pGT(claim);
    let nextLift = 0.35 + 0.5 * (rank(claim) / ORDER.length);
    if (lv.model && nextPlayerAfter(p).isHuman) {
      const above = ORDER[Math.min(ORDER.length - 1, rank(claim) + 1)];
      nextLift = humanLiftRate(above);
    }
    const riskAccept = (1 - beat) * nextLift;
    const riskLift = pTrue;
    return riskLift < riskAccept;
  }

  function botAnnounce(p, actual, prev) {
    const lv = game.lv;
    const ok = canFollow(actual, prev);
    if (ok && !C.chance(lv.wild * 0.5)) return actual; // honest
    // must (or wants to) lie: pick something above prev
    const legal = ORDER.filter((v) => canFollow(v, prev));
    if (!legal.length) return '21';
    if (lv.naive && C.chance(lv.wild)) return C.pick(legal.slice(Math.floor(legal.length / 2)));
    // smallest legal bluffs are the hardest to call
    const humanNext = lv.model && nextPlayerAfter(p).isHuman;
    const weights = legal.map((v, i) => {
      let w = Math.pow(0.55, i);
      if (lv.model && v[0] === v[1] && i < 3) w *= 1.3; // pairs feel believable
      if (humanNext) w *= Math.pow(1 - humanLiftRate(v), 2);
      if (v === '21') w *= 0.4;
      return w;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < legal.length; i++) { r -= weights[i]; if (r <= 0) return legal[i]; }
    return legal[0];
  }

  /* ---------- slutt ---------- */
  async function finish() {
    game.over = true;
    setControls('');
    const human = game.human;
    const winner = alive()[0];
    if (winner) winner.place = 1;
    const n = game.players.length;
    const pot = game.cfg.buyin * n;
    Stats.add('meyer.games');
    let html;
    if (!human.out) {
      Wallet.add(pot, 'meyer');
      Stats.add('meyer.wins');
      Stats.max('meyer.best', pot - game.cfg.buyin);
      Achievements.unlock('meyer_win');
      Achievements.unlock('first_win');
      if (game.cfg.level === 'vanskelig') Achievements.unlock('meyer_hard');
      GuttaSFX.bigWin(); confettiBurst();
      drinkPrompt('Meyer-mester!', 'Alle andre skåler for deg');
      html = '<p>Du lurte dem alle og vinner potten på <b>' + formatGK(pot) + '</b>! 🎲</p>';
    } else {
      GuttaSFX.lose();
      html = '<p>Du endte på <b>' + human.place + '. plass</b>. ' + escapeHtml(winner ? winner.name : 'Noen') + ' tar potten.</p>';
    }
    alive().forEach((p, i) => { if (!p.place) p.place = i + 1; });
    const rows = game.players.slice().sort((a, b) => a.place - b.place).map((p) => ({ name: p.name, avatar: p.avatar, amount: Math.max(0, p.lives), you: p.isHuman }));
    html += C.standingsHtml(rows, 'liv igjen');
    const v = await C.modal({ icon: human.out ? '🎲' : '🏆', title: human.out ? 'Du er ute' : 'Du vant!', html,
      actions: [{ label: 'Nytt spill', value: 'again' }, { label: 'Lobbyen', href: 'kasino.html', cls: 'ghost' }] });
    if (v === 'again') setup();
  }

  function showRules() {
    C.modal({
      icon: '📖', title: 'Meyer', wide: true,
      html: '<ul class="rules-list">' +
        '<li>Rist to terninger i begeret og se i skjul. Si en verdi som er <b>høyere</b> enn forrige påstand. Du kan lyve.</li>' +
        '<li>Neste spiller <b>tror deg</b> (og må rise og slå påstanden din) eller <b>løfter</b> begeret.</li>' +
        '<li>Løfter noen og du løy, mister du et liv. Sa du sannheten (eller noe bedre), mister han som løftet.</li>' +
        '<li>Rangering fra høyest: <b>Meyer</b> (2-1), <b>Lille Meyer</b> (3-1), par 6 ned til par 1, så 65, 64 … ned til 32. Høyeste terning leses først.</li>' +
        '<li>Meyer kan ikke slås, bare matches. Den som taper på en Meyer-påstand mister <b>to</b> liv.</li>' +
        '<li>Den som taper, starter neste runde. Sistemann med liv vinner potten.</li>' +
        '<li>Tastatur: <b>T</b> tror deg, <b>L</b> løft, <b>mellomrom</b> rist / si sannheten.</li>' +
        '</ul>',
      actions: [{ label: 'Skjønner!', value: true }],
      dismissValue: true
    });
  }

  buildUI();
  setup();
})();
