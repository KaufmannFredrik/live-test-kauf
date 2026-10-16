/* =========================================================
   POKER — Texas Hold'em sit & go mot AI-gutta
   Alle starter med like mange sjetonger, blindsene stiger, og
   sistemann med sjetonger vinner potten med innkjøp.
   AI-nivåer:
   - Lett: fulle «calling stations». Ser for mange flopper,
     høyner sjelden og avslører hånden sin når de snakker.
   - Middels: tight-aggressive. Regner vinnersjanse (Monte Carlo)
     mot pottodds, c-better og bløffer av og til.
   - Vanskelig: posisjonsbevisste haier. Vekter motstandernes
     mulige hender etter hvordan de har satset, sjekk-høyner,
     slowplayer, spiller push/fold med kort stakk og lager en
     modell av hvordan DU spiller.
   ========================================================= */
(function () {
  'use strict';
  const C = Casino;

  /* ============================================================
     HÅNDEVALUERING (ren logikk)
     ============================================================ */
  const CAT_NAME = ['Høyt kort', 'Ett par', 'To par', 'Tre like', 'Straight', 'Flush', 'Fullt hus', 'Fire like', 'Straight flush'];
  const SG = { 2: 'to', 3: 'tre', 4: 'fire', 5: 'fem', 6: 'seks', 7: 'sju', 8: 'åtte', 9: 'ni', 10: 'ti', 11: 'knekt', 12: 'dame', 13: 'konge', 14: 'ess' };
  const PL = { 2: 'toere', 3: 'treere', 4: 'firere', 5: 'femmere', 6: 'seksere', 7: 'sjuere', 8: 'åttere', 9: 'niere', 10: 'tiere', 11: 'knekter', 12: 'damer', 13: 'konger', 14: 'ess' };

  function straightHigh(mask) {
    if (mask & (1 << 14)) mask |= 2; // ace plays low too
    for (let hi = 14; hi >= 5; hi--) {
      const need = (0x1f << (hi - 4));
      if ((mask & need) === need) return hi;
    }
    return 0;
  }
  function packScore(cat, ks) {
    let s = cat;
    for (let i = 0; i < 5; i++) s = s * 15 + (ks[i] || 0);
    return s;
  }
  /* Evaluerer 5–7 kort. Høyere tall = bedre hånd. */
  function evaluate(cards) {
    const counts = new Array(15).fill(0);
    const bySuit = { s: [], h: [], d: [], c: [] };
    let mask = 0;
    for (const c of cards) { counts[c.value]++; bySuit[c.suit].push(c.value); mask |= 1 << c.value; }
    let flush = null;
    for (const s in bySuit) if (bySuit[s].length >= 5) flush = s;
    if (flush) {
      let fm = 0; bySuit[flush].forEach((v) => { fm |= 1 << v; });
      const sf = straightHigh(fm);
      if (sf) return packScore(8, [sf]);
    }
    let quad = 0; const trips = [], pairs = [], singles = [];
    for (let v = 14; v >= 2; v--) {
      if (counts[v] === 4) quad = v;
      else if (counts[v] === 3) trips.push(v);
      else if (counts[v] === 2) pairs.push(v);
      else if (counts[v] === 1) singles.push(v);
    }
    if (quad) {
      const kick = [];
      for (let v = 14; v >= 2; v--) if (v !== quad && counts[v]) { kick.push(v); break; }
      return packScore(7, [quad, kick[0]]);
    }
    if (trips.length && (trips.length > 1 || pairs.length)) return packScore(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
    if (flush) return packScore(5, bySuit[flush].sort((a, b) => b - a).slice(0, 5));
    const st = straightHigh(mask);
    if (st) return packScore(4, [st]);
    if (trips.length) return packScore(3, [trips[0]].concat(singles.slice(0, 2)));
    if (pairs.length >= 2) {
      const rest = singles.concat(pairs.slice(2)).sort((a, b) => b - a);
      return packScore(2, [pairs[0], pairs[1], rest[0]]);
    }
    if (pairs.length === 1) return packScore(1, [pairs[0]].concat(singles.slice(0, 3)));
    return packScore(0, singles.slice(0, 5));
  }
  function category(score) { return Math.floor(score / 759375); }
  function kicker(score, i) { return Math.floor(score / Math.pow(15, 4 - i)) % 15; }
  function describe(score) {
    const cat = category(score), k0 = kicker(score, 0), k1 = kicker(score, 1);
    switch (cat) {
      case 8: return k0 === 14 ? 'Royal flush!' : 'Straight flush til ' + SG[k0];
      case 7: return 'Fire ' + PL[k0];
      case 6: return 'Fullt hus, ' + PL[k0] + ' over ' + PL[k1];
      case 5: return 'Flush, ' + SG[k0] + ' høy';
      case 4: return 'Straight til ' + SG[k0];
      case 3: return 'Tre ' + PL[k0];
      case 2: return 'To par, ' + PL[k0] + ' og ' + PL[k1];
      case 1: return 'Par i ' + PL[k0];
      default: return 'Høyt kort, ' + SG[k0];
    }
  }
  /* De fem kortene som utgjør den beste hånden (for å lyse dem opp). */
  function bestFive(cards) {
    if (cards.length <= 5) return cards.slice();
    let best = -1, bestSet = null;
    const pick = (start, chosen) => {
      if (chosen.length === 5) {
        const five = chosen.map((i) => cards[i]);
        const sc = evaluate(five);
        if (sc > best) { best = sc; bestSet = five; }
        return;
      }
      for (let i = start; i < cards.length; i++) pick(i + 1, chosen.concat(i));
    };
    pick(0, []);
    return bestSet;
  }

  /* Chen-formelen: rask styrke for to startkort (ca. −1 til 20). */
  function chen(a, b) {
    const hi = Math.max(a.value, b.value), lo = Math.min(a.value, b.value);
    const base = { 14: 10, 13: 8, 12: 7, 11: 6 }[hi] || hi / 2;
    let s = base;
    if (hi === lo) s = Math.max(5, base * 2);
    if (a.suit === b.suit) s += 2;
    if (hi !== lo) {
      const gap = hi - lo - 1;
      s -= [0, 1, 2, 4][gap] != null ? [0, 1, 2, 4][gap] : 5;
      if (gap <= 1 && hi < 12) s += 1;
    }
    return Math.ceil(s);
  }

  /* Vinnersjanse ved simulering. weights[o](hand) kan nedvekte usannsynlige motstanderhender. */
  const FULL = C.makeDeck(1);
  function equity(hole, board, nOpp, iters, weightFn) {
    if (nOpp <= 0) return 1;
    const known = new Set(hole.concat(board).map((c) => c.rank + c.suit));
    const deck = FULL.filter((c) => !known.has(c.rank + c.suit));
    const need = 5 - board.length;
    const k = need + 2 * nOpp;
    let win = 0, wsum = 0;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(Math.random() * (deck.length - i));
        const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
      }
      const full = need ? board.concat(deck.slice(0, need)) : board;
      const mine = evaluate(hole.concat(full));
      let w = 1, lost = false, ties = 0;
      for (let o = 0; o < nOpp; o++) {
        const oh = [deck[need + 2 * o], deck[need + 2 * o + 1]];
        if (weightFn) w *= weightFn(o, oh);
        const sc = evaluate(oh.concat(full));
        if (sc > mine) { lost = true; break; }
        if (sc === mine) ties++;
      }
      wsum += w;
      if (!lost) win += w / (ties + 1);
    }
    return wsum ? win / wsum : 0;
  }

  /* Sidepotter fra hvor mye hver spiller har lagt i potten denne hånden. */
  function buildPots(players) {
    const levels = [...new Set(players.filter((p) => !p.folded && p.total > 0).map((p) => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const L of levels) {
      let amount = 0;
      players.forEach((p) => { amount += Math.max(0, Math.min(p.total, L) - Math.min(p.total, prev)); });
      const eligible = players.filter((p) => !p.folded && p.total >= L);
      if (amount > 0) pots.push({ amount, eligible });
      prev = L;
    }
    let leftover = 0;
    players.forEach((p) => { if (p.total > prev) leftover += p.total - prev; });
    if (leftover && pots.length) pots[pots.length - 1].amount += leftover;
    return pots;
  }

  window.Poker = { evaluate, describe, category, chen, equity, buildPots, bestFive, straightHigh };

  const app = document.getElementById('pk-app');
  if (!app) return;

  /* ============================================================
     OPPSETT OG KONSTANTER
     ============================================================ */
  const START_STACK = 1500;
  const HANDS_PER_LEVEL = 7;
  const BLINDS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000], [800, 1600], [1000, 2000], [1500, 3000], [2500, 5000]];
  const BUYINS = [100, 250, 500, 1000];
  const AI = {
    lett: { label: 'Lett', sims: 90, noise: 0.16, margin: -0.09, aggr: 0.25, bluff: 0.03, cbet: 0.3, slow: 0.05, chrOpen: 2, chrCall: 4, chr3b: 13, think: [500, 900], tells: 'obvious',
      desc: 'Fulle «calling stations» som avslører seg selv' },
    middels: { label: 'Middels', sims: 320, noise: 0.04, margin: 0.03, aggr: 0.6, bluff: 0.07, cbet: 0.55, slow: 0.08, chrOpen: 8, chrCall: 9, chr3b: 12, think: [700, 1300], tells: 'subtle',
      desc: 'Tight-aggressive, regner odds' },
    vanskelig: { label: 'Vanskelig', sims: 750, noise: 0, margin: 0.0, aggr: 0.8, bluff: 0.11, cbet: 0.7, slow: 0.2, chrOpen: 7, chrCall: 9, chr3b: 11, think: [900, 1600], tells: 'misleading',
      desc: 'Posisjon, bløff og leser deg' }
  };
  const LINES = {
    fold: ['Kaster.', 'Ikke denne gangen.', 'For dyrt for meg.', 'Nope.'],
    check: ['Sjekk.', '*banker i bordet*', 'Sjekker.'],
    call: ['Syner.', 'Jeg er med.', 'Ser deg.', 'Ok, ok.'],
    raise: ['Høyner!', 'Mer i potten!', 'La oss gjøre det interessant.', 'Høyner.'],
    bet: ['Byr.', 'Litt i potten.', 'Kjør.'],
    allin: ['ALL IN! 🍺', 'Alt eller ingenting!', 'Jeg dytter alt!'],
    win: ['Takk for pengene!', 'Skål!', 'Lett match.', 'Kom igjen da!'],
    bust: ['Det var det.', 'GG, gutta.', 'Jeg går og henter en øl.'],
    strongTell: ['Hehe… dette blir bra 😏', 'Åh, dette liker jeg!', '*gnir hendene*'],
    weakTell: ['Eh… jeg høyner, tror jeg?', '*svetter litt*', 'Ikke se på meg sånn…'],
    reverse: ['Jeg har sikkert ingenting…', 'Bare en liten bet, altså.']
  };

  /* ============================================================
     TILSTAND
     ============================================================ */
  const game = {
    cfg: null, ai: null, players: [], button: -1, hand: 0, board: [], deck: [],
    street: 'preflop', currentBet: 0, minRaise: 0, sb: 10, bb: 20, level: 0,
    phase: 'idle', pending: null, human: null, aggressor: null, over: false, gen: 0,
    model: { hands: 0, vpip: 0, pfr: 0, bets: 0, calls: 0, showBluffs: 0, faced: 0, foldsToBet: 0 }, oddsHelp: false
  };
  window.Poker.game = game;
  const ui = {};

  /* ---------- DOM ---------- */
  function buildUI() {
    app.innerHTML = '';
    app.className = 'game-shell pk';
    const E = C.el;
    const bar = E('div', 'game-toolbar');
    bar.innerHTML =
      '<span class="game-title">♠️ Poker</span>' +
      '<span class="pill gold" id="pkLevel"></span>' +
      '<span class="pill" id="pkBlinds"></span>' +
      '<span class="pill" id="pkHandNo"></span>' +
      '<span class="toolbar-spacer"></span>' +
      '<button class="tool-btn" id="pkOdds" type="button" title="Vis vinnersjanse og pottodds">🎯<span class="tl"> Odds</span></button>' +
      '<button class="tool-btn" id="pkRank" type="button" title="Håndrangering">🏅<span class="tl"> Hender</span></button>' +
      '<button class="tool-btn" id="pkDrink" type="button" title="Drikkemodus">🥴<span class="tl"> Drikk</span></button>' +
      '<button class="tool-btn" id="pkSpeed" type="button" title="Raskere AI">⏩<span class="tl"> Rask</span></button>' +
      '<button class="tool-btn" id="pkRules" type="button" title="Regler">📖<span class="tl"> Regler</span></button>' +
      '<button class="tool-btn" id="pkNew" type="button" title="Ny turnering">🔄<span class="tl"> Nytt bord</span></button>';
    app.appendChild(bar);

    const layout = E('div', 'pk-layout');
    layout.innerHTML =
      '<div class="pk-main">' +
        '<div class="pk-table-wrap"><div class="felt pk-table" id="pkTable">' +
          '<div class="pk-center">' +
            '<div class="pk-board" id="pkBoard"></div>' +
            '<div class="pk-pot" id="pkPot"></div>' +
            '<div class="pk-deck" id="pkDeck"></div>' +
          '</div>' +
          '<div class="table-msg" id="pkMsg"></div>' +
        '</div></div>' +
        '<div class="pk-controls">' +
          '<div class="pk-myinfo"><span id="pkMyHand"></span><span id="pkOddsLine"></span></div>' +
          '<div class="pk-raise" id="pkRaiseBox">' +
            '<div class="pk-presets">' +
              '<button class="tool-btn" type="button" data-p="min">Min</button>' +
              '<button class="tool-btn" type="button" data-p="0.5">½ pott</button>' +
              '<button class="tool-btn" type="button" data-p="0.75">¾ pott</button>' +
              '<button class="tool-btn" type="button" data-p="1">Pott</button>' +
              '<button class="tool-btn" type="button" data-p="max">All-in</button>' +
            '</div>' +
            '<input type="range" id="pkSlider" min="0" max="100" step="1" aria-label="Beløp">' +
          '</div>' +
          '<div class="actions">' +
            '<button class="act red" id="pkFold" type="button">Kast<span class="kbd">F</span></button>' +
            '<button class="act" id="pkCall" type="button">Sjekk<span class="kbd">C</span></button>' +
            '<button class="act green" id="pkRaise" type="button">Høyn<span class="kbd">R</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<aside class="side-panel pk-side">' +
        '<div class="side-card"><h3>Stilling</h3><ul class="score-list" id="pkScores"></ul></div>' +
        '<div class="side-card"><h3>Logg</h3><ul class="log-list" id="pkLog"></ul></div>' +
      '</aside>';
    app.appendChild(layout);

    const $ = (id) => document.getElementById(id);
    Object.assign(ui, {
      level: $('pkLevel'), blinds: $('pkBlinds'), handNo: $('pkHandNo'), table: $('pkTable'), board: $('pkBoard'), pot: $('pkPot'),
      deck: $('pkDeck'), msg: $('pkMsg'), myHand: $('pkMyHand'), oddsLine: $('pkOddsLine'), raiseBox: $('pkRaiseBox'), slider: $('pkSlider'),
      fold: $('pkFold'), call: $('pkCall'), raise: $('pkRaise'), scores: $('pkScores'), log: $('pkLog'),
      oddsBtn: $('pkOdds'), rankBtn: $('pkRank'), drinkBtn: $('pkDrink'), speedBtn: $('pkSpeed'), rulesBtn: $('pkRules'), newBtn: $('pkNew')
    });

    ui.fold.addEventListener('click', () => humanAct('fold'));
    ui.call.addEventListener('click', () => humanAct('call'));
    ui.raise.addEventListener('click', () => humanAct('raise'));
    ui.slider.addEventListener('input', paintRaiseLabel);
    ui.raiseBox.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => preset(b.dataset.p)));
    ui.oddsBtn.addEventListener('click', () => {
      if (game.cfg && game.cfg.level === 'vanskelig') { showToast('Ingen hjelp på Vanskelig 🦈'); return; }
      game.oddsHelp = !game.oddsHelp; Store.set('gutta_pk_odds', game.oddsHelp); paintToggles(); paintMyInfo();
    });
    ui.rankBtn.addEventListener('click', showRankings);
    ui.drinkBtn.addEventListener('click', () => {
      Settings.set('drink', !Settings.get('drink'));
      if (Settings.get('drink')) { Achievements.unlock('drink_mode'); drinkPrompt('Drikkemodus på!', 'Taper du en stor pott, drikker du'); }
      paintToggles();
    });
    ui.speedBtn.addEventListener('click', () => { C.setSpeed(C.speed < 1 ? 1 : 0.5); paintToggles(); });
    ui.rulesBtn.addEventListener('click', showRules);
    ui.newBtn.addEventListener('click', newTable);
    document.addEventListener('keydown', onKey);
    document.addEventListener('gutta:settings', paintToggles);
    window.addEventListener('resize', positionSeats);
  }

  function onKey(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-overlay.open')) return;
    if (e.target && (e.target.tagName === 'INPUT' && e.target.type !== 'range')) return;
    const k = e.key.toLowerCase();
    const click = (b) => { if (b && !b.disabled) { e.preventDefault(); b.click(); } };
    if (k === 'f') click(ui.fold);
    else if (k === 'c' || k === 'k') click(ui.call);
    else if (k === 'r' || k === 'b') click(ui.raise);
    else if (k === 'a' && game.pending) { preset('max'); }
  }

  /* ---------- oppsett ---------- */
  async function setup() {
    const last = Store.get('gutta_pk_config', { level: 'lett', opponents: 3, buyin: 250 });
    const cfg = await C.setupDialog({
      icon: '♠️',
      title: 'Texas Hold\'em',
      intro: 'Sit &amp; go: alle starter med ' + C.fmtChips(START_STACK) + ' sjetonger, blindsene stiger hver ' + HANDS_PER_LEVEL + '. hånd, og sistemann igjen vinner.',
      fields: [
        { key: 'level', label: 'AI-nivå', value: last.level, options: Object.keys(AI).map((k) => ({ value: k, label: AI[k].label, desc: AI[k].desc })) },
        { key: 'opponents', label: 'Motstandere', value: last.opponents, compact: true, options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })) },
        { key: 'buyin', label: 'Innkjøp', value: last.buyin, compact: true, options: BUYINS.map((b) => ({ value: b, label: C.fmtChips(b) + ' GK' })) }
      ],
      describe: (v) => {
        const n = v.opponents + 1, pot = v.buyin * n;
        const prizes = prizeTable(n, v.buyin);
        return '💰 Premiepott <b>' + formatGK(pot) + '</b>: ' + prizes.map((p, i) => (i + 1) + '. plass ' + formatGK(p)).join(', ') + '.';
      },
      startLabel: 'Kjøp inn',
      backHref: 'kasino.html'
    });
    Store.set('gutta_pk_config', cfg);
    if (!(await C.ensureFunds(cfg.buyin))) { setup(); return; }
    Wallet.spend(cfg.buyin, 'poker-innkjøp');
    start(cfg);
  }

  function prizeTable(n, buyin) {
    const pot = buyin * n;
    if (n >= 4) return [Math.round(pot * 0.7), pot - Math.round(pot * 0.7)];
    return [pot];
  }

  function start(cfg) {
    game.cfg = cfg;
    game.ai = AI[cfg.level];
    game.hand = 0;
    game.level = 0;
    game.over = false;
    game.board = [];
    game.oddsHelp = cfg.level !== 'vanskelig' && Store.get('gutta_pk_odds', cfg.level === 'lett');
    game.model = Object.assign({ hands: 0, vpip: 0, pfr: 0, bets: 0, calls: 0, showBluffs: 0, faced: 0, foldsToBet: 0 }, Store.get('gutta_pk_model', {}));
    const bots = C.pickBots(cfg.opponents).map((b) => Object.assign(b, { isHuman: false }));
    game.human = { name: 'Du', avatar: '🫵', color: '#f4a825', isHuman: true };
    // human sits at index 0 (bottom of the table); bots clockwise
    game.players = [game.human].concat(bots).map((p, i) => Object.assign(p, {
      seat: i, stack: START_STACK, hole: [], folded: false, allIn: false, bet: 0, total: 0, acted: false, out: false, noReraise: false, place: 0
    }));
    game.button = C.randInt(game.players.length);
    game.finishOrder = [];
    ui.level.textContent = '🎚️ ' + game.ai.label;
    ui.log.innerHTML = '';
    buildSeats();
    paintToggles();
    log('Ny turnering: <b>' + game.ai.label + '</b> mot ' + bots.length + ' AI-spiller' + (bots.length === 1 ? '' : 'e') + ', innkjøp ' + formatGK(cfg.buyin) + '.');
    game.gen++;
    loop(game.gen);
  }

  async function newTable() {
    if (game.cfg && !game.over) {
      const ok = await C.modal({ icon: '🏳️', title: 'Forlate turneringen?', html: '<p>Innkjøpet på ' + formatGK(game.cfg.buyin) + ' er tapt hvis du går nå.</p>',
        actions: [{ label: 'Ja, gi opp', value: true, cls: 'red' }, { label: 'Spill videre', value: false, cls: 'ghost' }], dismissValue: false });
      if (!ok) return;
    }
    game.over = true;
    game.gen++; // the running hand stops at its next checkpoint
    if (game.pending) { const p = game.pending; game.pending = null; p.resolve({ type: 'fold' }); }
    setup();
  }

  /* ---------- seter ---------- */
  function buildSeats() {
    ui.table.querySelectorAll('.pk-seat, .pk-bet').forEach((el) => el.remove());
    game.players.forEach((p) => {
      const seat = C.el('div', 'pk-seat' + (p.isHuman ? ' you' : ''));
      seat.innerHTML =
        '<div class="pk-cards"></div>' +
        '<div class="pk-plate"><span class="avatar" style="--seat:' + p.color + '">' + p.avatar + '</span>' +
        '<div class="pk-meta"><span class="seat-name">' + escapeHtml(p.name) + '</span><span class="seat-stack"></span></div></div>' +
        '<div class="pk-act"></div><div class="pk-badges"></div>';
      const bet = C.el('div', 'pk-bet');
      ui.table.appendChild(seat);
      ui.table.appendChild(bet);
      p.el = { seat, cards: seat.querySelector('.pk-cards'), stack: seat.querySelector('.seat-stack'), act: seat.querySelector('.pk-act'), badges: seat.querySelector('.pk-badges'), bet };
    });
    positionSeats();
    paintSeats();
  }

  function positionSeats() {
    if (!game.players.length || !ui.table) return;
    const n = game.players.length;
    const r = ui.table.getBoundingClientRect();
    const tall = r.height > r.width * 0.95;
    const rx = tall ? 40 : 44, ry = tall ? 42 : 39;
    game.players.forEach((p, i) => {
      const th = Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = 50 + rx * Math.cos(th), y = 50 + ry * Math.sin(th);
      p.el.seat.style.left = x + '%';
      p.el.seat.style.top = y + '%';
      p.el.seat.classList.toggle('top', y < 35);
      p.el.bet.style.left = (50 + rx * 0.58 * Math.cos(th)) + '%';
      p.el.bet.style.top = (50 + ry * (p.isHuman ? 0.5 : 0.56) * Math.sin(th)) + '%';
    });
  }

  function paintSeats() {
    game.players.forEach((p, i) => {
      p.el.stack.textContent = p.out ? (p.place ? p.place + '. plass' : 'Ute') : C.fmtChips(p.stack);
      p.el.seat.classList.toggle('folded', p.folded && !p.out);
      p.el.seat.classList.toggle('out', p.out);
      p.el.seat.classList.toggle('allin', p.allIn && !p.out);
      const badges = [];
      if (i === game.button && !p.out) badges.push('<span class="pk-dealer">D</span>');
      p.el.badges.innerHTML = badges.join('');
      p.el.bet.innerHTML = '';
      if (p.bet > 0) p.el.bet.appendChild(C.chipPile(p.bet, { small: true }));
    });
    paintPot();
    paintScores();
  }
  function paintPot() {
    const pot = game.players.reduce((s, p) => s + p.total - p.bet, 0);
    const all = game.players.reduce((s, p) => s + p.total, 0);
    ui.pot.innerHTML = all ? 'Pott <b>' + C.fmtChips(all) + '</b>' + (pot && pot !== all ? '<small>' + C.fmtChips(pot) + ' i midten</small>' : '') : '';
  }
  function paintScores() {
    const rows = game.players.slice().sort((a, b) => (a.out - b.out) || (a.out ? a.place - b.place : b.stack - a.stack));
    ui.scores.innerHTML = rows.map((p) =>
      '<li class="' + (p.isHuman ? 'you' : '') + (p.out ? ' out' : '') + '"><span>' + p.avatar + '</span><span class="who">' + escapeHtml(p.name) + '</span>' +
      '<span class="amt">' + (p.out ? (p.place ? p.place + '.' : '–') : C.fmtChips(p.stack)) + '</span></li>').join('');
  }
  function paintToggles() {
    ui.oddsBtn.classList.toggle('on', !!game.oddsHelp);
    ui.oddsBtn.disabled = !!(game.cfg && game.cfg.level === 'vanskelig');
    ui.drinkBtn.classList.toggle('on', !!Settings.get('drink'));
    ui.speedBtn.classList.toggle('on', C.speed < 1);
  }
  function paintHeader() {
    const [sb, bb] = BLINDS[game.level];
    ui.blinds.innerHTML = '<span class="tl">Blinds </span><b>' + C.fmtChips(sb) + '/' + C.fmtChips(bb) + '</b>';
    const left = HANDS_PER_LEVEL - ((game.hand - 1) % HANDS_PER_LEVEL);
    ui.handNo.innerHTML = 'Hånd <b>' + game.hand + '</b><span class="tl"> · ny blind om ' + left + '</span>';
  }
  function setAct(p, text, cls) {
    p.el.act.textContent = text || '';
    p.el.act.className = 'pk-act' + (cls ? ' ' + cls : '') + (text ? ' show' : '');
  }
  function message(text, kind, ms) {
    ui.msg.textContent = text;
    ui.msg.className = 'table-msg show' + (kind ? ' ' + kind : '');
    clearTimeout(ui.msgTimer);
    if (ms) ui.msgTimer = setTimeout(() => ui.msg.classList.remove('show'), ms * Math.max(C.speed, 0.4));
  }
  function hideMessage() { ui.msg.classList.remove('show'); }
  function log(html) {
    ui.log.prepend(C.el('li', '', html));
    while (ui.log.children.length > 80) ui.log.lastChild.remove();
  }
  const cardsText = (cards) => cards.map(C.cardLabel).join(' ');

  /* ============================================================
     TURNERINGSLØKKA
     ============================================================ */
  const alive = () => game.players.filter((p) => !p.out);
  function nextAlive(i) {
    const n = game.players.length;
    for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!game.players[j].out) return j; }
    return i;
  }

  function checkGen(gen) { if (gen !== game.gen) throw new Error('aborted'); }

  async function loop(gen) {
    while (!game.over && gen === game.gen) {
      if (alive().length < 2 || game.human.out) break;
      try {
        await playHand(gen);
      } catch (err) {
        if (gen !== game.gen) return;
        console.error(err);
        message('Noe gikk galt i hånden – deler ut på nytt', 'lose', 2000);
        await C.wait(1500);
      }
      if (gen !== game.gen) return;
      await C.wait(1500);
    }
    if (gen === game.gen) await finish();
  }

  async function playHand(gen) {
    const P = game.players;
    game.revealed = false;
    game.hand++;
    game.level = Math.min(BLINDS.length - 1, Math.floor((game.hand - 1) / HANDS_PER_LEVEL));
    [game.sb, game.bb] = BLINDS[game.level];
    if ((game.hand - 1) % HANDS_PER_LEVEL === 0 && game.hand > 1) { message('Blindsene øker: ' + game.sb + '/' + game.bb, 'push', 1600); GuttaSFX.fanfare(); await C.wait(900); }
    paintHeader();
    // reset
    game.board = [];
    ui.board.innerHTML = '';
    game.deck = C.shuffle(C.makeDeck(1));
    game.street = 'preflop';
    game.aggressor = null;
    game.handLog = { humanVpip: false, humanPfr: false };
    P.forEach((p) => {
      p.hole = []; p.folded = p.out; p.allIn = false; p.bet = 0; p.total = 0; p.acted = false; p.noReraise = false;
      p.el.cards.innerHTML = '';
      p.el.seat.classList.remove('winner', 'acting');
      setAct(p, '');
      p.startStack = p.stack;
    });
    ui.myHand.textContent = '';
    ui.oddsLine.textContent = '';
    hideMessage();
    game.button = nextAlive(game.button);
    const heads = alive().length === 2;
    const sbI = heads ? game.button : nextAlive(game.button);
    const bbI = nextAlive(sbI);
    log('<b>Hånd ' + game.hand + '</b> · blinds ' + game.sb + '/' + game.bb);
    post(P[sbI], game.sb, 'SB');
    post(P[bbI], game.bb, 'BB');
    game.currentBet = game.bb;
    game.minRaise = game.bb;
    paintSeats();
    GuttaSFX.shuffle();
    await C.wait(300);
    // deal hole cards, starting left of the button
    for (let r = 0; r < 2; r++) {
      let i = game.button;
      for (let k = 0; k < P.length; k++) {
        i = nextAlive(i);
        const p = P[i];
        const card = game.deck.pop();
        p.hole.push(card);
        await C.dealTo(p.el.cards, p.isHuman ? card : null, { from: ui.deck, up: p.isHuman, mini: !p.isHuman, ms: 260, flipWait: 60 });
        checkGen(gen);
        if (i === game.button) break;
      }
    }
    if (!game.human.out) { game.model.hands++; }
    paintMyInfo();

    // preflop
    const firstPre = heads ? sbI : nextAlive(bbI);
    if (!(await bettingRound(firstPre, gen))) return finishHand(false, gen);
    for (const [street, n] of [['flop', 3], ['turn', 1], ['river', 1]]) {
      await sweepBets();
      game.street = street;
      game.currentBet = 0;
      game.minRaise = game.bb;
      P.forEach((p) => { p.acted = false; p.noReraise = false; });
      const contenders = P.filter((p) => !p.folded);
      const canAct = contenders.filter((p) => !p.allIn);
      const runout = canAct.length <= 1;
      if (runout && !game.revealed) await revealAll(true);
      game.deck.pop(); // burn
      for (let k = 0; k < n; k++) {
        const card = game.deck.pop();
        game.board.push(card);
        await C.dealTo(ui.board, card, { from: ui.deck, up: true, ms: 300, flipWait: 160 });
        checkGen(gen);
      }
      log({ flop: 'Flopp', turn: 'Turn', river: 'River' }[street] + ': ' + cardsText(game.board));
      paintMyInfo();
      if (runout) { await showEquities(); await C.wait(900); continue; }
      if (!(await bettingRound(nextAlive(game.button), gen))) return finishHand(false, gen);
    }
    await sweepBets();
    return finishHand(true, gen);
  }

  function post(p, amount, label) {
    const amt = Math.min(amount, p.stack);
    p.stack -= amt; p.bet += amt; p.total += amt;
    if (p.stack === 0) p.allIn = true;
    setAct(p, label + ' ' + C.fmtChips(amt), 'blind');
  }

  /* ---------- en innsatsrunde ---------- */
  function needsAction(p) {
    if (p.folded || p.allIn || p.out) return false;
    if (!p.acted) return true;
    return p.bet < game.currentBet;
  }
  async function bettingRound(startIdx, gen) {
    const P = game.players;
    let i = startIdx;
    let guard = 0;
    while (guard++ < 400) {
      checkGen(gen);
      const live = P.filter((p) => !p.folded);
      if (live.length <= 1) return false;
      const canAct = live.filter((p) => !p.allIn);
      if (canAct.length === 0) return true;
      if (canAct.length === 1 && canAct[0].bet >= game.currentBet && canAct[0].acted) return true;
      if (canAct.length === 1 && canAct[0].bet >= game.currentBet && live.length > 1 && live.every((p) => p === canAct[0] || p.allIn)) return true;
      if (!P.some(needsAction)) return true;
      const p = P[i];
      if (needsAction(p)) {
        p.el.seat.classList.add('acting');
        const d = p.isHuman ? await humanDecision(p) : await botDecision(p);
        checkGen(gen);
        p.el.seat.classList.remove('acting');
        applyAction(p, d);
        paintSeats();
        if (P.filter((x) => !x.folded).length <= 1) return false;
      }
      i = (i + 1) % P.length;
    }
    return true;
  }

  function optionsFor(p) {
    const toCall = Math.min(game.currentBet - p.bet, p.stack);
    const maxTo = p.bet + p.stack;
    const othersCanAct = game.players.some((q) => q !== p && !q.folded && !q.allIn && !q.out);
    const canRaise = !p.noReraise && othersCanAct && maxTo > game.currentBet;
    const minTo = Math.min(game.currentBet + game.minRaise, maxTo);
    return { toCall, canCheck: toCall === 0, canRaise, minTo, maxTo, pot: potTotal() };
  }
  function potTotal() { return game.players.reduce((s, p) => s + p.total, 0); }

  function applyAction(p, d) {
    const o = optionsFor(p);
    const name = p.isHuman ? 'Du' : p.name;
    if (p.isHuman && game.street !== 'preflop' && o.toCall > 0) {
      game.model.faced++;
      if (d.type === 'fold') game.model.foldsToBet++;
    }
    if (d.type === 'fold') {
      p.folded = true; p.acted = true;
      setAct(p, 'Kaster', 'fold');
      p.el.cards.querySelectorAll('.pcard').forEach((c) => c.classList.add('dim'));
      log(escapeHtml(name) + ' kaster.');
      GuttaSFX.click();
      return;
    }
    if (d.type === 'call' || (d.type === 'raise' && !o.canRaise)) {
      if (o.toCall === 0) { setAct(p, 'Sjekk', 'check'); log(escapeHtml(name) + ' sjekker.'); GuttaSFX.click(); }
      else {
        const amt = o.toCall;
        p.stack -= amt; p.bet += amt; p.total += amt;
        if (p.stack === 0) p.allIn = true;
        setAct(p, p.allIn ? 'All-in ' + C.fmtChips(p.bet) : 'Syner ' + C.fmtChips(amt), p.allIn ? 'allin' : 'call');
        log(escapeHtml(name) + (p.allIn ? ' syner all-in (' + C.fmtChips(amt) + ').' : ' syner ' + C.fmtChips(amt) + '.'));
        GuttaSFX.chip();
        if (p.isHuman && game.street === 'preflop') game.handLog.humanVpip = true;
        if (p.isHuman) game.model.calls++;
      }
      p.acted = true;
      return;
    }
    // raise / bet to d.to
    let to = Math.round(Math.max(o.minTo, Math.min(o.maxTo, d.to || o.minTo)));
    const amt = to - p.bet;
    const raiseBy = to - game.currentBet;
    const wasBet = game.currentBet === 0;
    p.stack -= amt; p.bet = to; p.total += amt;
    if (p.stack === 0) p.allIn = true;
    if (raiseBy >= game.minRaise) {
      game.minRaise = raiseBy;
      game.players.forEach((q) => { if (q !== p) { q.acted = false; q.noReraise = false; } });
    } else {
      // short all-in: those who already acted may only call or fold
      game.players.forEach((q) => { if (q !== p && q.acted) { q.acted = false; q.noReraise = true; } });
    }
    game.currentBet = Math.max(game.currentBet, to);
    p.acted = true;
    game.aggressor = p;
    const label = p.allIn ? 'All-in ' + C.fmtChips(to) : (wasBet ? 'By ' : 'Høyn til ') + C.fmtChips(to);
    setAct(p, label, p.allIn ? 'allin' : 'raise');
    log(escapeHtml(name) + (p.allIn ? ' går <b>all-in</b> med ' + C.fmtChips(to) + '.' : wasBet ? ' byr ' + C.fmtChips(to) + '.' : ' høyner til ' + C.fmtChips(to) + '.'));
    p.allIn ? GuttaSFX.airhorn() : GuttaSFX.chips();
    if (p.isHuman) {
      game.model.bets++;
      if (game.street === 'preflop') { game.handLog.humanVpip = true; game.handLog.humanPfr = true; }
    }
  }

  async function sweepBets() {
    const P = game.players;
    if (!P.some((p) => p.bet > 0)) return;
    await Promise.all(P.filter((p) => p.bet > 0).map((p) => C.flyChip(p.bet, p.el.bet, ui.pot, 380)));
    P.forEach((p) => { p.bet = 0; if (!p.folded && !p.allIn) setAct(p, ''); });
    if (P.some((p) => p.total)) GuttaSFX.chips();
    paintSeats();
  }

  /* ---------- menneskets valg ---------- */
  function humanDecision(p) {
    return new Promise((resolve) => {
      const o = optionsFor(p);
      game.pending = { resolve, o };
      // controls
      ui.call.firstChild.textContent = o.canCheck ? 'Sjekk' : (o.toCall >= p.stack ? 'All-in ' + C.fmtChips(o.toCall) : 'Syn ' + C.fmtChips(o.toCall));
      ui.fold.disabled = false;
      ui.call.disabled = false;
      ui.raise.disabled = !o.canRaise;
      ui.raiseBox.classList.toggle('off', !o.canRaise);
      ui.slider.min = o.minTo;
      ui.slider.max = o.maxTo;
      ui.slider.step = Math.max(1, Math.round(game.bb / 2));
      ui.slider.value = o.minTo;
      paintRaiseLabel();
      app.dataset.turn = 'you';
      paintMyInfo(true);
      GuttaSFX.click();
    });
  }
  function paintRaiseLabel() {
    if (!game.pending) return;
    const o = game.pending.o;
    let v = Number(ui.slider.value);
    if (v >= o.maxTo - ui.slider.step / 2) v = o.maxTo;
    const all = v >= o.maxTo;
    ui.raise.firstChild.textContent = all ? 'All-in ' + C.fmtChips(o.maxTo) : (game.currentBet === 0 ? 'By ' : 'Høyn til ') + C.fmtChips(v);
  }
  function preset(kind) {
    if (!game.pending) return;
    const o = game.pending.o;
    if (!o.canRaise) return;
    let to;
    if (kind === 'min') to = o.minTo;
    else if (kind === 'max') to = o.maxTo;
    else {
      const callAmt = o.toCall;
      to = game.currentBet + Math.round((o.pot + callAmt) * Number(kind));
    }
    ui.slider.value = Math.max(o.minTo, Math.min(o.maxTo, to));
    if (kind === 'max') ui.slider.value = o.maxTo;
    paintRaiseLabel();
    GuttaSFX.click();
  }
  function humanAct(type) {
    const pend = game.pending;
    if (!pend) return;
    if (type === 'raise' && !pend.o.canRaise) return;
    game.pending = null;
    app.dataset.turn = '';
    [ui.fold, ui.call, ui.raise].forEach((b) => { b.disabled = true; });
    ui.raiseBox.classList.add('off');
    let to = Number(ui.slider.value);
    if (to >= pend.o.maxTo - Number(ui.slider.step) / 2) to = pend.o.maxTo;
    pend.resolve(type === 'raise' ? { type: 'raise', to } : { type });
  }

  /* Din håndstyrke og (valgfritt) vinnersjanse. */
  function paintMyInfo(yourTurn) {
    const h = game.human;
    if (!h || !h.hole.length || h.out) { ui.myHand.textContent = ''; ui.oddsLine.textContent = ''; return; }
    if (game.board.length) ui.myHand.innerHTML = '🂠 <b>' + describe(evaluate(h.hole.concat(game.board))) + '</b>';
    else {
      const ch = chen(h.hole[0], h.hole[1]);
      const tier = ch >= 12 ? 'Premium' : ch >= 9 ? 'Sterk' : ch >= 6 ? 'Spillbar' : ch >= 4 ? 'Svak' : 'Søppel';
      ui.myHand.innerHTML = '🂠 ' + cardsText(h.hole) + ' · <b>' + tier + '</b>';
    }
    if (!game.oddsHelp || h.folded) { ui.oddsLine.textContent = ''; return; }
    const opp = game.players.filter((p) => !p.folded && !p.out && p !== h).length;
    const eq = equity(h.hole, game.board, opp, 1200);
    let txt = '🎯 Vinnersjanse ' + Math.round(eq * 100) + ' %';
    if (yourTurn && game.pending && game.pending.o.toCall > 0) {
      const o = game.pending.o;
      const need = o.toCall / (o.pot + o.toCall);
      txt += ' · trenger ' + Math.round(need * 100) + ' % for å syne' + (eq >= need ? ' ✅' : ' ❌');
    }
    ui.oddsLine.textContent = txt;
  }

  /* ============================================================
     AI-BESLUTNINGER
     ============================================================ */
  function seatsAfter(p) {
    // live players who act after p this street (0 = on the button)
    const P = game.players, n = P.length, i = P.indexOf(p);
    if (i === game.button) return 0;
    let cnt = 0;
    for (let k = 1; k < n; k++) {
      const j = (i + k) % n;
      if (!P[j].out && !P[j].folded) cnt++;
      if (j === game.button) break;
    }
    return cnt;
  }

  /* Hvor ofte du kaster når noen byr etter floppen (med en forsiktig startverdi). */
  function humanFoldRate() {
    const m = game.model;
    return (m.foldsToBet + 4) / (m.faced + 10);
  }

  /* Hvor sannsynlig en motstanders hånd er, gitt hvordan de har spilt (Vanskelig). */
  function rangeWeights(me) {
    const opps = game.players.filter((p) => p !== me && !p.folded && !p.out);
    const m = game.model;
    const humanLoose = m.hands >= 8 ? m.vpip / m.hands : 0.35;
    return (o, hand) => {
      const q = opps[o];
      if (!q) return 1;
      const ch = chen(hand[0], hand[1]);
      const aggressive = q === game.aggressor;
      let floor = q.isHuman ? (humanLoose > 0.45 ? 3 : 5) : 5;
      if (aggressive) floor += q.isHuman && humanLoose > 0.45 ? 2 : 4;
      return ch >= floor ? 1 : 0.25;
    };
  }

  async function botDecision(p) {
    const ai = game.ai;
    p.el.seat.classList.add('thinking');
    await C.wait(ai.think[0] + Math.random() * (ai.think[1] - ai.think[0]));
    p.el.seat.classList.remove('thinking');
    const d = decide(p);
    // talk (tells)
    let line = null;
    if (d.type === 'fold') line = C.chance(0.35) ? C.pick(LINES.fold) : null;
    else if (d.type === 'call') line = C.chance(0.3) ? C.pick(d.toCall ? LINES.call : LINES.check) : null;
    else line = C.chance(0.6) ? C.pick(d.allin ? LINES.allin : game.currentBet ? LINES.raise : LINES.bet) : null;
    if (d.type !== 'fold' && d.strength != null) {
      if (ai.tells === 'obvious' && C.chance(0.55)) line = C.pick(d.strength > 0.65 ? LINES.strongTell : d.strength < 0.35 && d.type === 'raise' ? LINES.weakTell : [line || '…']);
      if (ai.tells === 'misleading' && d.strength > 0.7 && C.chance(0.25)) line = C.pick(LINES.reverse);
    }
    if (line && line !== '…') C.speak(p.el.seat, line, 1500, { below: p.el.seat.classList.contains('top') });
    return d;
  }

  function decide(p) {
    const ai = game.ai;
    const o = optionsFor(p);
    const bb = game.bb;
    const live = game.players.filter((q) => !q.folded && !q.out);
    const nOpp = live.length - 1;
    const stackBB = (p.stack + p.bet) / bb;
    const late = seatsAfter(p) <= 1;
    const mk = (type, extra) => Object.assign({ type, toCall: o.toCall }, extra || {});
    const raiseTo = (to) => (o.canRaise ? mk('raise', { to: Math.max(o.minTo, Math.min(o.maxTo, Math.round(to))), allin: to >= o.maxTo }) : mk('call'));

    if (game.street === 'preflop') {
      const ch = chen(p.hole[0], p.hole[1]);
      const facing = game.currentBet / bb; // in big blinds
      const m = game.model;
      const humanRaising = game.aggressor && game.aggressor.isHuman;
      const humanLoose = m.hands >= 8 && m.pfr / m.hands > 0.3;
      let callBar = ai.chrCall + (facing > 6 ? 2 : 0) - (humanRaising && humanLoose && game.cfg.level === 'vanskelig' ? 2 : 0);
      let openBar = ai.chrOpen - (late ? 2 : 0);
      const strength = Math.min(1, Math.max(0, (ch + 1) / 21));
      // short stack push/fold (Middels/Vanskelig)
      if (game.cfg.level !== 'lett' && stackBB <= 12) {
        const pushBar = stackBB <= 6 ? 5 : 7 + (nOpp > 2 ? 1 : 0);
        if (ch >= pushBar && (facing <= 1 || ch >= pushBar + 2)) return raiseTo(o.maxTo);
        if (o.toCall === 0) return mk('call', { strength });
        return o.toCall <= bb / 2 && ch >= pushBar - 2 ? mk('call', { strength }) : mk('fold');
      }
      if (game.cfg.level === 'lett') {
        if (C.chance(0.04) && ch >= 8) return raiseTo(o.maxTo); // drunk shove
        if (ch >= ai.chr3b && C.chance(0.7)) return raiseTo(Math.max(game.currentBet * 3, bb * 3));
        if (o.toCall === 0) return mk('call', { strength });
        if (facing <= 4 && (ch >= 2 || C.chance(0.35))) return mk('call', { strength });
        if (ch >= 6 || C.chance(0.15)) return mk('call', { strength });
        return mk('fold');
      }
      // Middels / Vanskelig
      const hard = game.cfg.level === 'vanskelig';
      const headsUp = live.length === 2;
      if (hard && headsUp) { openBar = 3; callBar = 5 - (humanRaising && humanLoose ? 1 : 0); }
      if (facing <= 1) {
        // unopened (or limped) pot
        const limpers = game.players.filter((q) => q.bet === bb && q !== p).length - 1;
        if (ch >= openBar) return raiseTo(bb * (2.5 + Math.max(0, limpers)) + (late ? 0 : bb * 0.5));
        if (game.cfg.level === 'vanskelig' && late && C.chance(0.18) && ch >= 3) return raiseTo(bb * 2.5); // steal
        if (o.toCall === 0) return mk('call', { strength });
        if (o.toCall <= bb / 2 && ch >= openBar - 3) return mk('call', { strength });
        return mk('fold');
      }
      // facing a raise
      if (ch >= ai.chr3b) return raiseTo(game.currentBet * 3);
      if (game.cfg.level === 'vanskelig' && ch >= 6 && ch <= 8 && p.hole[0].suit === p.hole[1].suit && C.chance(0.08)) return raiseTo(game.currentBet * 3); // light 3-bet
      const potOdds = o.toCall / (o.pot + o.toCall);
      if (ch >= callBar || (ch >= callBar - 2 && potOdds < 0.2)) return mk('call', { strength });
      return mk('fold');
    }

    // ---------- after the flop ----------
    const weightFn = game.cfg.level === 'vanskelig' ? rangeWeights(p) : null;
    let e = equity(p.hole, game.board, nOpp, ai.sims, weightFn);
    e = Math.max(0, Math.min(1, e + (Math.random() * 2 - 1) * ai.noise));
    const pot = o.pot;
    const potOdds = o.toCall / (pot + o.toCall || 1);
    let margin = ai.margin;
    if (game.cfg.level === 'vanskelig' && game.aggressor && game.aggressor.isHuman) {
      const m = game.model;
      const af = m.bets / Math.max(1, m.calls);
      if (af > 1.6) margin -= 0.05;   // human bets a lot: call lighter
      if (af < 0.6) margin += 0.06;   // passive human betting = strength
    }
    const wasAggressor = game.aggressor === p;
    const dry = boardIsDry();
    const sized = (f) => raiseTo(game.currentBet + Math.max(bb, (pot + o.toCall) * f));
    let bluff = ai.bluff, cbet = ai.cbet, valueSize = 0.55;
    if (game.cfg.level === 'vanskelig' && live.indexOf(game.human) !== -1 && game.model.faced >= 4) {
      const fr = humanFoldRate();
      bluff = Math.min(0.45, ai.bluff + Math.max(0, fr - 0.35) * 0.9);
      cbet = Math.min(0.92, ai.cbet + Math.max(0, fr - 0.35) * 0.6);
      if (fr < 0.3) { bluff = 0.03; valueSize = 0.8; } // calling station: value-bet big, never bluff
    }

    if (o.toCall === 0) {
      if (e > 0.78) {
        if (C.chance(ai.slow) && dry && game.street !== 'river') return mk('call', { strength: e }); // slowplay
        return sized(valueSize + Math.random() * 0.35);
      }
      if (e > 0.56 && C.chance(ai.aggr)) return sized(valueSize - 0.1 + Math.random() * 0.2);
      if (wasAggressor && game.street === 'flop' && C.chance(cbet) && nOpp <= 2) return sized(0.5);
      if (C.chance(bluff) && nOpp <= 2) return sized(0.6);
      return mk('call', { strength: e });
    }
    // facing a bet
    if (e > 0.82 && C.chance(0.75)) {
      if (C.chance(ai.slow * 0.6) && game.street !== 'river') return mk('call', { strength: e });
      return raiseTo(Math.max(o.minTo, game.currentBet * 2.6 + pot * 0.2));
    }
    if (e > potOdds + margin) {
      if (game.cfg.level === 'vanskelig' && e > 0.6 && !late && C.chance(0.15)) return raiseTo(game.currentBet * 3); // check-raise style
      return mk('call', { strength: e });
    }
    if (game.cfg.level === 'vanskelig' && game.street === 'flop' && e > 0.3 && C.chance(0.12)) return raiseTo(game.currentBet * 2.7); // semi-bluff
    if (C.chance(bluff * 0.4) && nOpp === 1) return raiseTo(game.currentBet * 2.5);
    if (game.cfg.level === 'lett' && o.toCall <= pot * 0.3 && C.chance(0.45)) return mk('call', { strength: e });
    return mk('fold');
  }

  function boardIsDry() {
    const b = game.board;
    if (b.length < 3) return true;
    const suits = {}; b.forEach((c) => { suits[c.suit] = (suits[c.suit] || 0) + 1; });
    const flushy = Math.max.apply(null, Object.values(suits)) >= 3;
    const vals = b.map((c) => c.value).sort((a, x) => a - x);
    let connected = 0;
    for (let i = 1; i < vals.length; i++) if (vals[i] - vals[i - 1] <= 2) connected++;
    return !flushy && connected < 2;
  }

  /* ============================================================
     SHOWDOWN OG UTBETALING
     ============================================================ */
  async function revealAll(allin) {
    const P = game.players;
    for (const p of P) {
      if (p.folded || p.out || p.isHuman) continue;
      const els = p.el.cards.querySelectorAll('.pcard');
      p.hole.forEach((c, i) => { if (els[i]) C.revealInto(els[i], c); });
    }
    GuttaSFX.cardFlip();
    game.revealed = true;
    if (allin) { message('All-in! Kortene snus', 'push', 1400); log('All-in: alle kort vises.'); }
    await C.wait(600);
  }
  async function showEquities() {
    const live = game.players.filter((p) => !p.folded && !p.out);
    if (live.length < 2 || game.board.length >= 5) return;
    // exact-ish shares by simulation over the remaining board
    const wins = new Array(live.length).fill(0);
    const known = new Set(live.flatMap((p) => p.hole).concat(game.board).map((c) => c.rank + c.suit));
    const deck = C.makeDeck(1).filter((c) => !known.has(c.rank + c.suit));
    const need = 5 - game.board.length;
    const N = 1500;
    for (let it = 0; it < N; it++) {
      for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (deck.length - i)); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
      const full = game.board.concat(deck.slice(0, need));
      const scores = live.map((p) => evaluate(p.hole.concat(full)));
      const best = Math.max.apply(null, scores);
      const winners = scores.filter((s) => s === best).length;
      scores.forEach((s, i) => { if (s === best) wins[i] += 1 / winners; });
    }
    live.forEach((p, i) => setAct(p, Math.round((wins[i] / N) * 100) + ' %', 'equity'));
  }

  async function finishHand(showdown, gen) {
    const P = game.players;
    await sweepBets();
    checkGen(gen);
    const live = P.filter((p) => !p.folded && !p.out);
    const human = game.human;
    const humanStart = human.startStack;
    let humanWon = 0;
    let humanShowedWeak = false;
    if (live.length === 1) {
      const w = live[0];
      const amount = potTotal();
      w.stack += amount;
      await awardFx(w, amount);
      log('<b>' + escapeHtml(w.isHuman ? 'Du' : w.name) + '</b> vinner ' + C.fmtChips(amount) + ' uten showdown.');
      message((w.isHuman ? 'Du' : w.name) + ' vinner ' + C.fmtChips(amount), w.isHuman ? 'win' : '', 1600);
      if (w.isHuman) {
        humanWon = amount;
        GuttaSFX.win();
        // bluff achievement: everybody folded while you only had high card
        if (game.board.length >= 3 && category(evaluate(w.hole.concat(game.board))) === 0 && game.aggressor === w) {
          Achievements.unlock('poker_bluff');
          drinkPrompt('Bløff!', 'Alle som kastet tar en slurk');
        }
      } else if (C.chance(0.5)) C.speak(w.el.seat, C.pick(LINES.win), 1500, { below: w.el.seat.classList.contains('top') });
    } else {
      if (!game.revealed) await revealAll(false);
      const scores = new Map();
      live.forEach((p) => {
        const sc = evaluate(p.hole.concat(game.board));
        scores.set(p, sc);
        setAct(p, describe(sc), 'hand');
        log(escapeHtml(p.isHuman ? 'Du' : p.name) + ' viser ' + cardsText(p.hole) + ' (' + describe(sc).toLowerCase() + ').');
      });
      const pots = buildPots(P);
      const order = [];
      for (let k = 1; k <= P.length; k++) order.push(P[(game.button + k) % P.length]);
      let first = true;
      for (const pot of pots) {
        const elig = pot.eligible;
        const best = Math.max.apply(null, elig.map((p) => scores.get(p)));
        const winners = order.filter((p) => elig.indexOf(p) !== -1 && scores.get(p) === best);
        const share = Math.floor(pot.amount / winners.length);
        let odd = pot.amount - share * winners.length;
        for (const w of winners) {
          const get = share + (odd > 0 ? 1 : 0);
          if (odd > 0) odd--;
          w.stack += get;
          if (w.isHuman) humanWon += get;
        }
        if (elig.length === 1) { log(escapeHtml(winners[0].isHuman ? 'Du' : winners[0].name) + ' får tilbake ' + C.fmtChips(pot.amount) + '.'); continue; }
        const names = winners.map((w) => (w.isHuman ? 'Du' : w.name)).join(' og ');
        const what = describe(best);
        log('<b>' + escapeHtml(names) + '</b> vinner ' + (pots.length > 1 ? (first ? 'hovedpotten' : 'en sidepott') + ' på ' : '') + C.fmtChips(pot.amount) + ' med ' + what.toLowerCase() + '.');
        if (first) {
          message(names + ' vinner med ' + what.toLowerCase(), winners.some((w) => w.isHuman) ? 'win' : '', 2400);
          winners.forEach((w) => {
            const five = bestFive(w.hole.concat(game.board));
            const ids = new Set(five.map((c) => c.id));
            ui.table.querySelectorAll('.pcard').forEach((el) => { if (ids.has(el.dataset.id) && (w.el.cards.contains(el) || ui.board.contains(el))) el.classList.add('glow'); });
          });
          await Promise.all(winners.map((w) => awardFx(w, pot.amount / winners.length)));
        }
        first = false;
      }
      if (live.indexOf(human) !== -1) {
        const hs = scores.get(human);
        if (humanWon > 0 && category(hs) >= 7) Achievements.unlock('poker_monster');
        if (category(hs) === 0 && game.aggressor === human) humanShowedWeak = true;
      }
      if (humanWon > 0) GuttaSFX.win(); else if (live.indexOf(human) !== -1) GuttaSFX.lose();
      await C.wait(900);
    }
    P.forEach((p) => { p.total = 0; p.bet = 0; });
    // model update
    if (!human.out) {
      if (game.handLog.humanVpip) game.model.vpip++;
      if (game.handLog.humanPfr) game.model.pfr++;
      if (humanShowedWeak) game.model.showBluffs++;
      Store.set('gutta_pk_model', game.model);
      Stats.add('poker.hands');
      if (humanWon > 0) Stats.add('poker.handsWon');
    }
    // drink mode: lost a big pot
    const lost = humanStart - human.stack;
    if (lost > 0 && lost >= humanStart * 0.35 && human.stack > 0) drinkPrompt('Stor pott tapt!', 'Ta tre slurker');

    // eliminations (bigger starting stack = better place)
    const busted = P.filter((p) => !p.out && p.stack === 0).sort((a, b) => a.startStack - b.startStack);
    let remaining = alive().length;
    for (const p of busted) {
      p.out = true;
      p.place = remaining;
      remaining--;
      game.finishOrder.unshift(p);
      log('💀 <b>' + escapeHtml(p.isHuman ? 'Du' : p.name) + '</b> er ute på ' + p.place + '. plass.');
      if (!p.isHuman) C.speak(p.el.seat, C.pick(LINES.bust), 1800, { below: p.el.seat.classList.contains('top') });
      else drinkPrompt('Du er ute!', 'Chug, eller tre store slurker');
    }
    game.revealed = false;
    paintSeats();
    paintMyInfo();
  }

  async function awardFx(w, amount) {
    w.el.seat.classList.add('winner');
    await C.flyChip(Math.round(amount), ui.pot, w.el.seat, 500);
    C.floatText(w.el.seat, '+' + C.fmtChips(amount), 'win');
    paintSeats();
  }

  /* ---------- slutt på turneringen ---------- */
  async function finish() {
    game.over = true;
    const n = game.players.length;
    const prizes = prizeTable(n, game.cfg.buyin);
    const human = game.human;
    alive().sort((a, b) => b.stack - a.stack).forEach((p, i) => { p.place = i + 1; });
    const place = human.place;
    const prize = prizes[place - 1] || 0;
    Stats.add('poker.tournaments');
    let html;
    if (place === 1) {
      Stats.add('poker.wins');
      Achievements.unlock('poker_win');
      Achievements.unlock('first_win');
      if (game.cfg.level === 'vanskelig') Achievements.unlock('poker_hard');
      GuttaSFX.bigWin(); confettiBurst(); setTimeout(() => confettiBurst(window.innerWidth * 0.25, window.innerHeight * 0.4), 300);
      drinkPrompt('Pokerhaien!', 'Alle andre drikker for deg');
      html = '<p>Du tok alle sjetongene på bordet og vinner <b>' + formatGK(prize) + '</b>! 🦈</p>';
    } else if (prize) {
      GuttaSFX.win();
      html = '<p>Du endte på <b>' + place + '. plass</b> og får <b>' + formatGK(prize) + '</b>.</p>';
    } else {
      GuttaSFX.lose();
      html = '<p>Du endte på <b>' + place + '. plass</b> av ' + n + '. Innkjøpet på ' + formatGK(game.cfg.buyin) + ' er borte.</p>';
    }
    if (prize) { Wallet.add(prize, 'poker-premie'); Stats.max('poker.best', prize - game.cfg.buyin); }
    Stats.add('poker.net', prize - game.cfg.buyin);
    const rows = game.players.slice().sort((a, b) => a.place - b.place)
      .map((p) => ({ name: p.name, avatar: p.avatar, amount: prizes[p.place - 1] || 0, you: p.isHuman }));
    html += C.standingsHtml(rows, 'GK');
    const v = await C.modal({ icon: place === 1 ? '🏆' : '♠️', title: place === 1 ? 'Du vant turneringen!' : 'Turneringen er over for deg', html,
      actions: [{ label: 'Ny turnering', value: 'again' }, { label: 'Lobbyen', href: 'kasino.html', cls: 'ghost' }] });
    if (v === 'again') setup();
  }

  /* ---------- hjelp ---------- */
  function showRankings() {
    const ex = [
      ['Royal flush', 'A K Q J 10 i samme farge'], ['Straight flush', 'Fem på rad i samme farge'], ['Fire like', 'Fire kort med samme verdi'],
      ['Fullt hus', 'Tre like + et par'], ['Flush', 'Fem kort i samme farge'], ['Straight', 'Fem på rad (ess kan være lavt)'],
      ['Tre like', 'Tre kort med samme verdi'], ['To par', 'To forskjellige par'], ['Ett par', 'To kort med samme verdi'], ['Høyt kort', 'Ingen av delene']
    ];
    C.modal({ icon: '🏅', title: 'Håndrangering', html: '<table class="rules-table">' + ex.map(([a, b], i) => '<tr><td>' + (i + 1) + '.</td><td><b>' + a + '</b></td><td>' + b + '</td></tr>').join('') + '</table>',
      actions: [{ label: 'Lukk', value: true }], dismissValue: true });
  }
  function showRules() {
    C.modal({
      icon: '📖', title: 'Texas Hold\'em', wide: true,
      html: '<ul class="rules-list">' +
        '<li>Alle får to skjulte kort. Fem felles kort legges ut: floppen (3), turn (1) og river (1). Beste femkortshånd av sju vinner.</li>' +
        '<li>Det er fire innsatsrunder. Du kan <b>kaste</b>, <b>sjekke</b> (hvis ingen har budt), <b>syne</b> eller <b>høyne</b>. Minste høyning er like stor som forrige høyning.</li>' +
        '<li>Går noen all-in med mindre enn de andre, lages det sidepotter. De kan bare vinne det de selv har dekket.</li>' +
        '<li>Blindsene øker hver ' + HANDS_PER_LEVEL + '. hånd. Sistemann med sjetonger vinner. Med 4 eller flere spillere får 2. plass også premie.</li>' +
        '<li>Tastatur: <b>F</b> kast, <b>C</b> sjekk/syn, <b>R</b> høyn, <b>A</b> sett beløpet til all-in.</li>' +
        '<li><b>Odds-hjelpen</b> viser vinnersjansen din (simulert) og hvor stor sjanse du trenger for at et syn skal lønne seg (pottodds).</li>' +
        '<li>AI-nivå: Lett røper hånda si når de snakker. Middels spiller solid og regner odds. Vanskelig bløffer, utnytter posisjon og lærer hvordan du spiller.</li>' +
        '</ul>',
      actions: [{ label: 'Skjønner!', value: true }],
      dismissValue: true
    });
  }

  buildUI();
  setup();
})();
