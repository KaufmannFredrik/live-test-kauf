/* =========================================================
   BLACKJACK — Gutta-utgaven
   Du mot dealeren, med opptil tre AI-gutter ved bordet.
   - Lett: 2 kortstokker, dealer står på myk 17, AI-ene er fulle.
   - Middels: 4 kortstokker, dealer trekker på myk 17, AI-ene
     spiller perfekt basic strategy.
   - Vanskelig: 8 kortstokker, blackjack betaler 6:5, ingen
     overgivelse, og AI-ene teller kort (Hi-Lo) og justerer både
     innsats og spill etter den sanne tellingen.
   Fritt spill bruker lommeboka; turnering er 10 runder der alle
   starter med 1 000 sjetonger og flest sjetonger vinner potten.
   ========================================================= */
(function () {
  'use strict';
  const C = Casino;

  /* ============================================================
     REGLER
     ============================================================ */
  const LEVELS = {
    lett: {
      label: 'Lett', decks: 2, h17: false, bjPays: 1.5, surrender: true, coach: true, skill: 'drunk',
      desc: '2 stokker · dealer står på myk 17 · blackjack 3:2 · tips på',
      print: 'BLACKJACK BETALER 3 TIL 2 · DEALER STÅR PÅ MYK 17'
    },
    middels: {
      label: 'Middels', decks: 4, h17: true, bjPays: 1.5, surrender: true, coach: true, skill: 'basic',
      desc: '4 stokker · dealer trekker på myk 17 · AI-ene spiller perfekt',
      print: 'BLACKJACK BETALER 3 TIL 2 · DEALER TREKKER PÅ MYK 17'
    },
    vanskelig: {
      label: 'Vanskelig', decks: 8, h17: true, bjPays: 1.2, surrender: false, coach: false, skill: 'counter',
      desc: '8 stokker · blackjack 6:5 · AI-ene teller kort',
      print: 'BLACKJACK BETALER 6 TIL 5 · DEALER TREKKER PÅ MYK 17'
    }
  };
  const MIN_BET = 10;
  const MAX_BET = 500;
  const CHIP_VALUES = [5, 10, 25, 100, 500];
  const TOURNEY_ROUNDS = 10;
  const TOURNEY_STACK = 1000;
  const TOURNEY_FEE = { lett: 50, middels: 100, vanskelig: 200 };
  const PENETRATION = 0.75;

  /* ============================================================
     HÅND, SKO OG STRATEGI (ren logikk, ingen DOM)
     ============================================================ */
  function points(card) {
    if (card.rank === 'A') return 11;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    return parseInt(card.rank, 10);
  }
  function hiLo(card) {
    const p = points(card);
    if (p >= 2 && p <= 6) return 1;
    if (p >= 10) return -1;
    return 0;
  }

  class Hand {
    constructor(bet) {
      this.cards = [];
      this.bet = bet || 0;
      this.doubled = false;
      this.surrendered = false;
      this.fromSplit = false;
      this.splitAces = false;
      this.done = false;
      this.result = null;
      this.el = null;
    }
    _raw() {
      let total = 0, aces = 0;
      for (const c of this.cards) { total += points(c); if (c.rank === 'A') aces++; }
      while (total > 21 && aces > 0) { total -= 10; aces--; }
      return { total, soft: aces > 0 };
    }
    get total() { return this._raw().total; }
    get soft() { const r = this._raw(); return r.soft && r.total <= 21; }
    get bust() { return this.total > 21; }
    get blackjack() { return this.cards.length === 2 && this.total === 21 && !this.fromSplit; }
    get pair() { return this.cards.length === 2 && points(this.cards[0]) === points(this.cards[1]); }
    get label() {
      if (!this.cards.length) return '';
      if (this.blackjack) return 'BJ';
      const t = this.total;
      if (t > 21) return t + ' 💥';
      if (this.soft && t < 21) return (t - 10) + '/' + t;
      return String(t);
    }
  }

  class Shoe {
    constructor(decks) { this.decks = decks; this.build(); }
    build() {
      this.cards = C.shuffle(C.makeDeck(this.decks));
      this.total = this.cards.length;
      this.running = 0;
    }
    draw() { if (!this.cards.length) this.build(); return this.cards.pop(); }
    see(card) { this.running += hiLo(card); }
    get remaining() { return this.cards.length; }
    get decksLeft() { return Math.max(0.5, this.cards.length / 52); }
    get trueCount() { return this.running / this.decksLeft; }
    get needsShuffle() { return this.cards.length < this.total * (1 - PENETRATION); }
  }

  /* Basic strategy for flere kortstokker, dobling etter splitt tillatt.
     Returnerer 'H' (trekk), 'S' (stå), 'D' (doble), 'P' (splitt) eller 'R' (overgi). */
  function basicStrategy(hand, up, o) {
    const d = points(up);
    if (o.split && hand.pair) {
      const p = points(hand.cards[0]);
      const split = {
        11: true, 10: false, 9: [2, 3, 4, 5, 6, 8, 9].indexOf(d) !== -1, 8: true,
        7: d <= 7, 6: d <= 6, 5: false, 4: d === 5 || d === 6, 3: d <= 7, 2: d <= 7
      }[p];
      if (split) return 'P';
    }
    const t = hand.total;
    const soft = hand.soft;
    if (o.surrender && !soft) {
      if (t === 16 && d >= 9) return 'R';
      if (t === 15 && (d === 10 || (o.h17 && d === 11))) return 'R';
      if (o.h17 && t === 17 && d === 11) return 'R';
    }
    if (soft) {
      if (t >= 20) return 'S';
      if (t === 19) return (o.h17 && d === 6 && o.double) ? 'D' : 'S';
      if (t === 18) {
        const lo = o.h17 ? 2 : 3;
        if (d >= lo && d <= 6) return o.double ? 'D' : 'S';
        if (d <= 8) return 'S';
        return 'H';
      }
      if (t === 17) return (d >= 3 && d <= 6 && o.double) ? 'D' : 'H';
      if (t === 15 || t === 16) return (d >= 4 && d <= 6 && o.double) ? 'D' : 'H';
      if (t === 13 || t === 14) return (d >= 5 && d <= 6 && o.double) ? 'D' : 'H';
      return 'H';
    }
    if (t >= 17) return 'S';
    if (t >= 13) return d <= 6 ? 'S' : 'H';
    if (t === 12) return (d >= 4 && d <= 6) ? 'S' : 'H';
    if (t === 11) return (o.double && (o.h17 || d !== 11)) ? 'D' : 'H';
    if (t === 10) return (d <= 9 && o.double) ? 'D' : 'H';
    if (t === 9) return (d >= 3 && d <= 6 && o.double) ? 'D' : 'H';
    return 'H';
  }

  /* Korttellerens avvik (et utvalg fra "Illustrious 18"). tc = sann telling. */
  function countingStrategy(hand, up, o, tc) {
    const d = points(up);
    const t = hand.total;
    if (!hand.soft) {
      if (o.split && hand.pair && points(hand.cards[0]) === 10) {
        if ((d === 5 && tc >= 5) || (d === 6 && tc >= 4)) return 'P';
      }
      if (t === 16 && d === 10 && tc >= 0) return 'S';
      if (t === 16 && d === 9 && tc >= 5) return 'S';
      if (t === 15 && d === 10 && tc >= 4) return 'S';
      if (t === 13 && d === 2 && tc <= -1) return 'H';
      if (t === 12 && d === 3 && tc >= 2) return 'S';
      if (t === 12 && d === 2 && tc >= 3) return 'S';
      if (t === 12 && d === 4 && tc < 0) return 'H';
      if (o.double && hand.cards.length === 2) {
        if (t === 10 && (d === 10 || d === 11) && tc >= 4) return 'D';
        if (t === 11 && d === 11 && tc >= 1) return 'D';
        if (t === 9 && d === 2 && tc >= 1) return 'D';
        if (t === 9 && d === 7 && tc >= 3) return 'D';
      }
    }
    return basicStrategy(hand, up, o);
  }

  const ACTION_NAME = { H: 'Trekk', S: 'Stå', D: 'Doble', P: 'Splitt', R: 'Overgi' };

  // Eksponeres for testing.
  window.BJ = { Hand, Shoe, basicStrategy, countingStrategy, points, hiLo, LEVELS };

  const app = document.getElementById('bj-app');
  if (!app) return;

  /* ============================================================
     AI-REPLIKKER
     ============================================================ */
  const LINES = {
    hit: ['Kort!', 'Én til!', 'Kom igjen da!', 'Gi meg et bilde!', 'Trekk!'],
    stand: ['Jeg står.', 'Holder.', 'Fornøyd.', 'Den holder.'],
    double: ['Dobler!', 'Dobbelt eller ingenting!', 'Nå kjører vi!'],
    split: ['Splitter!', 'To er bedre enn én.', 'Del dem!'],
    surrender: ['Jeg gir meg.', 'Nope, ikke denne.'],
    bust: ['Faen…', 'Sprakk igjen!', 'Typisk.', 'Ikke igjen!'],
    blackjack: ['BLACKJACK, gutta!', 'Skål for meg!', 'Ess og bilde, baby!'],
    win: ['Lett match.', 'Skål!', 'Sånn gjør man det.', 'Kaching!'],
    lose: ['Dealeren jukser!', 'Neste runde.', 'Hmpf.', 'Det var flaks.'],
    insurance: ['Jeg tar forsikring.', 'Bedre føre var.'],
    drunk: ['*hikk*', 'Er det min tur?', 'Hva er trumf?', 'Jeg ser to dealere…', 'Skål for dealeren!'],
    rebuy: ['Mamma, send penger!', 'Henter mer i minibanken.'],
    bigBet: ['Kortstokken er varm 🔥', 'Nå trykker vi til.', 'Føler noe godt her.']
  };

  /* ============================================================
     SPILLET
     ============================================================ */
  const game = {
    cfg: null,
    rules: null,
    shoe: null,
    seats: [],
    you: null,
    dealer: null,
    phase: 'idle',
    bet: 0,
    lastBet: 0,
    round: 0,
    sessionStart: 0,
    coach: false,
    showCount: false,
    coachStreak: 0,
    winStreak: 0,
    pendingHuman: null,
    tableDirty: false
  };
  const ui = {};
  window.BJ.game = game; // for tests and the curious

  /* ---------- DOM ---------- */
  function buildUI() {
    app.innerHTML = '';
    app.className = 'game-shell bj';
    const E = C.el;

    const bar = E('div', 'game-toolbar');
    bar.innerHTML =
      '<span class="game-title">🃏 Blackjack</span>' +
      '<span class="pill gold" id="bjLevel"></span>' +
      '<span class="pill" id="bjMode"></span>' +
      '<span class="pill" id="bjBank"></span>' +
      '<span class="toolbar-spacer"></span>' +
      '<button class="tool-btn" id="bjCoach" type="button" title="Vis hva basic strategy anbefaler">💡<span class="tl"> Tips</span></button>' +
      '<button class="tool-btn" id="bjCount" type="button" title="Vis Hi-Lo-tellingen">🧮<span class="tl"> Telling</span></button>' +
      '<button class="tool-btn" id="bjDrink" type="button" title="Drikkemodus">🥴<span class="tl"> Drikk</span></button>' +
      '<button class="tool-btn" id="bjSpeed" type="button" title="Raskere animasjoner">⏩<span class="tl"> Rask</span></button>' +
      '<button class="tool-btn" id="bjRules" type="button" title="Regler">📖<span class="tl"> Regler</span></button>' +
      '<button class="tool-btn" id="bjNew" type="button" title="Nytt bord">🔄<span class="tl"> Nytt bord</span></button>';
    app.appendChild(bar);

    const layout = E('div', 'bj-layout');
    app.appendChild(layout);

    const main = E('div', 'bj-main');
    layout.appendChild(main);

    const table = E('div', 'felt bj-table');
    table.innerHTML =
      '<div class="felt-print bj-print" id="bjPrint"></div>' +
      '<div class="bj-count" id="bjCountBox" hidden></div>' +
      '<div class="bj-shoe" id="bjShoe" title="Kortskoen"><div class="bj-shoe-box"></div><span id="bjShoeText"></span></div>' +
      '<div class="bj-dealer"><div class="bj-dealer-head"><span class="avatar" style="--seat:#241206">🤵</span><span class="seat-name">Dealer</span><span class="bj-total" id="bjDealerTotal"></span></div><div class="bj-cards" id="bjDealerCards"></div></div>' +
      '<div class="bj-bots" id="bjBots"></div>' +
      '<div class="bj-you" id="bjYou"><div class="bj-hands" id="bjHands"></div><div class="bj-betspot" id="bjBetSpot"><span class="bj-betspot-label">Innsats</span></div></div>' +
      '<div class="table-msg" id="bjMsg"></div>';
    main.appendChild(table);

    const controls = E('div', 'bj-controls');
    controls.innerHTML =
      '<div class="bj-betrow">' +
        '<div class="chip-tray" id="bjChips"></div>' +
        '<div class="bj-betinfo"><span>Innsats</span><b id="bjBetAmt">0</b></div>' +
        '<div class="bj-betbtns">' +
          '<button class="tool-btn" id="bjClear" type="button">Tøm</button>' +
          '<button class="tool-btn" id="bjRebet" type="button">Gjenta</button>' +
          '<button class="tool-btn" id="bjDoubleBet" type="button">×2</button>' +
        '</div>' +
      '</div>' +
      '<div class="actions" id="bjActions">' +
        '<button class="act big green" id="bjDeal" type="button">Del ut<span class="kbd">␣</span></button>' +
        '<button class="act" id="bjHit" type="button">Trekk<span class="kbd">H</span></button>' +
        '<button class="act red" id="bjStand" type="button">Stå<span class="kbd">S</span></button>' +
        '<button class="act blue" id="bjDouble" type="button">Doble<span class="kbd">D</span></button>' +
        '<button class="act dark" id="bjSplit" type="button">Splitt<span class="kbd">P</span></button>' +
        '<button class="act dark" id="bjSurrender" type="button">Overgi<span class="kbd">U</span></button>' +
      '</div>' +
      '<div class="actions bj-insure" id="bjInsure" hidden>' +
        '<span class="bj-insure-q">Dealer viser ess. Forsikring?</span>' +
        '<button class="act green" id="bjInsYes" type="button">Ja<span class="kbd">Y</span></button>' +
        '<button class="act red" id="bjInsNo" type="button">Nei<span class="kbd">N</span></button>' +
      '</div>' +
      '<div class="bj-coachline" id="bjCoachLine"></div>';
    main.appendChild(controls);

    const side = E('aside', 'side-panel bj-side');
    side.innerHTML =
      '<div class="side-card"><h3 id="bjScoreTitle">Ved bordet</h3><ul class="score-list" id="bjScores"></ul></div>' +
      '<div class="side-card"><h3>Denne økta</h3><ul class="score-list" id="bjSession"></ul></div>' +
      '<div class="side-card"><h3>Logg</h3><ul class="log-list" id="bjLog"></ul></div>';
    layout.appendChild(side);

    const $ = (id) => document.getElementById(id);
    Object.assign(ui, {
      level: $('bjLevel'), mode: $('bjMode'), bank: $('bjBank'), print: $('bjPrint'),
      countBox: $('bjCountBox'), shoe: $('bjShoe'), shoeText: $('bjShoeText'),
      dealerCards: $('bjDealerCards'), dealerTotal: $('bjDealerTotal'),
      bots: $('bjBots'), hands: $('bjHands'), betSpot: $('bjBetSpot'), msg: $('bjMsg'),
      chips: $('bjChips'), betAmt: $('bjBetAmt'), clear: $('bjClear'), rebet: $('bjRebet'), doubleBet: $('bjDoubleBet'),
      deal: $('bjDeal'), hit: $('bjHit'), stand: $('bjStand'), double: $('bjDouble'), split: $('bjSplit'), surrender: $('bjSurrender'),
      insure: $('bjInsure'), actions: $('bjActions'), insYes: $('bjInsYes'), insNo: $('bjInsNo'), coachLine: $('bjCoachLine'),
      scores: $('bjScores'), scoreTitle: $('bjScoreTitle'), session: $('bjSession'), log: $('bjLog'),
      coachBtn: $('bjCoach'), countBtn: $('bjCount'), drinkBtn: $('bjDrink'), speedBtn: $('bjSpeed'),
      rulesBtn: $('bjRules'), newBtn: $('bjNew'), table
    });

    CHIP_VALUES.forEach((v) => {
      const chip = C.chipEl(v, { button: true });
      chip.addEventListener('click', () => addBet(v, chip));
      ui.chips.appendChild(chip);
    });

    ui.clear.addEventListener('click', clearBet);
    ui.rebet.addEventListener('click', rebet);
    ui.doubleBet.addEventListener('click', doubleTheBet);
    ui.deal.addEventListener('click', () => deal());
    ui.hit.addEventListener('click', () => humanAct('H'));
    ui.stand.addEventListener('click', () => humanAct('S'));
    ui.double.addEventListener('click', () => humanAct('D'));
    ui.split.addEventListener('click', () => humanAct('P'));
    ui.surrender.addEventListener('click', () => humanAct('R'));
    ui.insYes.addEventListener('click', () => humanInsure(true));
    ui.insNo.addEventListener('click', () => humanInsure(false));

    ui.coachBtn.addEventListener('click', () => { if (!game.rules.coach) return; game.coach = !game.coach; Store.set('gutta_bj_coach', game.coach); paintToggles(); refreshHint(); });
    ui.countBtn.addEventListener('click', () => { game.showCount = !game.showCount; Store.set('gutta_bj_count', game.showCount); paintToggles(); paintCount(); });
    ui.drinkBtn.addEventListener('click', () => {
      Settings.set('drink', !Settings.get('drink'));
      if (Settings.get('drink')) { Achievements.unlock('drink_mode'); drinkPrompt('Drikkemodus på!', 'Sprekker du, drikker du.'); }
      paintToggles();
    });
    ui.speedBtn.addEventListener('click', () => { C.setSpeed(C.speed < 1 ? 1 : 0.5); paintToggles(); });
    ui.rulesBtn.addEventListener('click', showRules);
    ui.newBtn.addEventListener('click', newTable);

    document.addEventListener('keydown', onKey);
    document.addEventListener('gutta:wallet', () => { paintBank(); paintScores(); updateButtons(); });
    document.addEventListener('gutta:settings', paintToggles);
  }

  function onKey(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal-overlay.open')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    const click = (btn) => { if (btn && !btn.disabled && !btn.closest('[hidden]')) { e.preventDefault(); btn.click(); } };
    if (k === 'h') click(ui.hit);
    else if (k === 's') click(ui.stand);
    else if (k === 'd') click(ui.double);
    else if (k === 'p') click(ui.split);
    else if (k === 'u') click(ui.surrender);
    else if (k === 'y') click(ui.insYes);
    else if (k === 'n') click(ui.insNo);
    else if (k === ' ' || k === 'enter') {
      // a focused button keeps its normal space/enter behaviour
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A')) return;
      click(ui.deal);
    }
  }

  /* ---------- oppsett ---------- */
  async function setup() {
    const last = Store.get('gutta_bj_config', { level: 'lett', mode: 'free', bots: 2 });
    const cfg = await C.setupDialog({
      icon: '🃏',
      title: 'Blackjack',
      intro: 'Kom så nær 21 som mulig uten å sprekke, og slå dealeren. AI-gutta spiller ved samme bord.',
      fields: [
        { key: 'level', label: 'Vanskelighetsgrad', value: last.level, options: Object.keys(LEVELS).map((k) => ({ value: k, label: LEVELS[k].label, desc: LEVELS[k].desc })) },
        { key: 'mode', label: 'Modus', value: last.mode, options: [
          { value: 'free', label: 'Fritt spill', desc: 'Lommeboka di, innsats ' + MIN_BET + '–' + MAX_BET + ' GK' },
          { value: 'tournament', label: 'Turnering', desc: TOURNEY_ROUNDS + ' runder, flest sjetonger vinner potten' }
        ] },
        { key: 'bots', label: 'AI-spillere ved bordet', value: last.bots, compact: true, options: [0, 1, 2, 3].map((n) => ({ value: n, label: String(n) })) }
      ],
      validate: (v) => (v.mode === 'tournament' ? { bots: [0] } : {}),
      describe: (v) => {
        const skill = { drunk: 'AI-ene er godt på en snurr og gjør mange feil.', basic: 'AI-ene spiller perfekt basic strategy.', counter: 'AI-ene teller kort og satser stort når stokken er varm.' }[LEVELS[v.level].skill];
        if (v.mode === 'tournament') {
          const fee = TOURNEY_FEE[v.level];
          return '🏆 Innskudd <b>' + formatGK(fee) + '</b>. Vinner du, får du hele potten på <b>' + formatGK(fee * (v.bots + 1)) + '</b>. ' + skill;
        }
        return v.bots ? skill : 'Bare deg og dealeren.';
      },
      startLabel: 'Sett deg ved bordet',
      backHref: 'kasino.html'
    });
    Store.set('gutta_bj_config', cfg);
    if (cfg.mode === 'tournament') {
      const fee = TOURNEY_FEE[cfg.level];
      if (!(await C.ensureFunds(fee))) { setup(); return; }
      Wallet.spend(fee, 'blackjack-turnering');
    } else {
      await C.ensureFunds(MIN_BET);
    }
    startTable(cfg);
  }

  function startTable(cfg) {
    game.cfg = cfg;
    game.rules = LEVELS[cfg.level];
    game.shoe = new Shoe(game.rules.decks);
    game.round = 0;
    game.bet = 0;
    game.lastBet = 0;
    game.coach = game.rules.coach && Store.get('gutta_bj_coach', cfg.level === 'lett');
    game.showCount = Store.get('gutta_bj_count', false);
    game.winStreak = 0;
    game.dealer = { hand: new Hand(), holeEl: null };
    game.session = { hands: 0, wins: 0, losses: 0, pushes: 0, bj: 0, net: 0 };

    const tourney = cfg.mode === 'tournament';
    const bots = C.pickBots(cfg.bots).map((b) => Object.assign(b, {
      isHuman: false, skill: game.rules.skill, bankroll: TOURNEY_STACK, start: TOURNEY_STACK, hands: [], insurance: 0, out: false, net: 0
    }));
    game.you = { name: 'Du', avatar: '🫵', color: '#f4a825', isHuman: true, bankroll: tourney ? TOURNEY_STACK : 0, start: TOURNEY_STACK, hands: [], insurance: 0, out: false, net: 0 };
    // Seat order: one bot on first base (acts before you), the rest after you.
    game.seats = bots.length ? [bots[0], game.you].concat(bots.slice(1)) : [game.you];
    game.sessionStart = Wallet.balance;

    ui.level.textContent = '🎚️ ' + game.rules.label;
    ui.print.textContent = game.rules.print;
    ui.scoreTitle.textContent = tourney ? 'Turneringsstilling' : 'Ved bordet (netto)';
    ui.log.innerHTML = '';
    buildSeats();
    clearTableCards();
    paintAll();
    setPhase('betting');
    message(tourney ? 'Turnering! Plasser innsatsen for runde 1' : 'Plasser innsatsen din', '', 1800);
    log('Nytt bord: <b>' + game.rules.label + '</b>, ' + (tourney ? 'turnering' : 'fritt spill') + ' med ' + bots.length + ' AI-spiller' + (bots.length === 1 ? '' : 'e') + '.');
    placeBotBets();
  }

  async function newTable() {
    if (game.phase !== 'betting' && game.phase !== 'idle') { showToast('Vent til runden er ferdig 🃏'); return; }
    if (game.cfg && game.cfg.mode === 'tournament' && game.round < TOURNEY_ROUNDS) {
      const ok = await C.modal({ icon: '🏳️', title: 'Forlate turneringen?', html: '<p>Innskuddet er tapt hvis du går nå.</p>', actions: [{ label: 'Ja, nytt bord', value: true, cls: 'red' }, { label: 'Bli', value: false, cls: 'ghost' }], dismissValue: false });
      if (!ok) return;
    }
    if (game.bet && game.cfg.mode === 'free') game.bet = 0;
    game.phase = 'idle';
    setup();
  }

  /* ---------- seter ---------- */
  function buildSeats() {
    ui.bots.innerHTML = '';
    game.seats.forEach((s, i) => {
      s.order = i + 1;
      if (s.isHuman) return;
      const seat = C.el('div', 'bj-bot');
      seat.style.setProperty('--seat', s.color);
      seat.innerHTML =
        '<div class="bj-bot-head"><span class="avatar" style="--seat:' + s.color + '">' + s.avatar + '</span>' +
        '<div class="bj-bot-meta"><span class="seat-name">' + s.order + '. ' + escapeHtml(s.name) + '</span><span class="seat-stack"></span></div></div>' +
        '<div class="bj-bot-hands"></div><div class="bj-bot-bet"></div>';
      ui.bots.appendChild(seat);
      s.el = { root: seat, stack: seat.querySelector('.seat-stack'), hands: seat.querySelector('.bj-bot-hands'), bet: seat.querySelector('.bj-bot-bet') };
    });
    ui.bots.hidden = game.seats.length === 1;
    game.you.el = { root: document.getElementById('bjYou'), hands: ui.hands, bet: ui.betSpot };
    ui.betSpot.querySelector('.bj-betspot-label').textContent = 'Innsats · plass ' + game.you.order;
  }

  function clearTableCards() {
    ui.dealerCards.innerHTML = '';
    ui.dealerTotal.textContent = '';
    ui.dealerTotal.className = 'bj-total';
    ui.hands.innerHTML = '';
    ui.hands.classList.remove('many');
    game.seats.forEach((s) => {
      s.hands = [];
      s.insurance = 0;
      if (!s.isHuman && s.el) { s.el.hands.innerHTML = ''; s.el.root.classList.remove('win', 'lose', 'push', 'active', 'thinking'); }
    });
    game.dealer.hand = new Hand();
    game.tableDirty = false;
  }

  /* ---------- tilstand og knapper ---------- */
  function setPhase(p) {
    game.phase = p;
    app.dataset.phase = p;
    updateButtons();
  }

  function fundsOf(seat) {
    if (seat.isHuman && game.cfg.mode === 'free') return Wallet.balance;
    return seat.bankroll;
  }
  function payTo(seat, amount) {
    if (amount <= 0) return;
    if (seat.isHuman && game.cfg.mode === 'free') Wallet.add(amount, 'blackjack');
    else seat.bankroll += amount;
  }
  function charge(seat, amount) {
    if (seat.isHuman && game.cfg.mode === 'free') return Wallet.spend(amount, 'blackjack');
    if (seat.bankroll < amount) return false;
    seat.bankroll -= amount;
    return true;
  }
  function maxBetFor(seat) {
    if (game.cfg.mode === 'tournament') return fundsOf(seat);
    return Math.min(MAX_BET, fundsOf(seat));
  }

  function updateButtons() {
    if (!ui.deal) return;
    const betting = game.phase === 'betting';
    const waiting = game.phase === 'human' && game.pendingHuman;
    const o = waiting ? game.pendingHuman.opts : {};
    ui.deal.disabled = !betting || !(game.bet >= MIN_BET || (game.bet === 0 && game.lastBet >= MIN_BET && game.lastBet <= maxBetFor(game.you)));
    ui.deal.textContent = '';
    ui.deal.append(game.bet === 0 && game.lastBet ? 'Del ut (' + C.fmtChips(game.lastBet) + ')' : 'Del ut');
    ui.deal.insertAdjacentHTML('beforeend', '<span class="kbd">␣</span>');
    ui.hit.disabled = !waiting || !o.hit;
    ui.stand.disabled = !waiting;
    ui.double.disabled = !waiting || !o.double;
    ui.split.disabled = !waiting || !o.split;
    ui.surrender.disabled = !waiting || !o.surrender;
    ui.surrender.hidden = !game.rules || !game.rules.surrender;
    ui.deal.hidden = !betting;
    [ui.hit, ui.stand, ui.double, ui.split].forEach((b) => { b.hidden = betting; });
    if (betting) ui.surrender.hidden = true;
    const max = game.you ? maxBetFor(game.you) : 0;
    ui.chips.querySelectorAll('.chip').forEach((chip) => {
      chip.disabled = !betting || game.bet + Number(chip.dataset.v) > max;
    });
    ui.clear.disabled = !betting || !game.bet;
    ui.rebet.disabled = !betting || !game.lastBet || game.bet === game.lastBet || game.lastBet > max;
    ui.doubleBet.disabled = !betting || !game.bet || game.bet * 2 > max;
    ui.insure.hidden = game.phase !== 'insurance';
    ui.actions.hidden = game.phase === 'insurance';
    if (game.phase !== 'human') { ui.coachLine.textContent = ''; [ui.hit, ui.stand, ui.double, ui.split, ui.surrender].forEach((b) => b.classList.remove('hint')); }
  }

  function paintToggles() {
    if (!game.rules) return;
    ui.coachBtn.classList.toggle('on', game.coach);
    ui.coachBtn.disabled = !game.rules.coach;
    ui.coachBtn.title = game.rules.coach ? 'Vis hva basic strategy anbefaler' : 'Ingen tips på Vanskelig';
    ui.countBtn.classList.toggle('on', game.showCount);
    ui.drinkBtn.classList.toggle('on', !!Settings.get('drink'));
    ui.speedBtn.classList.toggle('on', C.speed < 1);
  }

  function paintBank() {
    if (!game.cfg) return;
    if (game.cfg.mode === 'tournament') {
      ui.mode.innerHTML = '🏆 Runde <b>' + Math.min(game.round + (game.phase === 'betting' ? 1 : 0), TOURNEY_ROUNDS) + '/' + TOURNEY_ROUNDS + '</b>';
      ui.bank.innerHTML = 'Sjetonger <b>' + C.fmtChips(game.you.bankroll) + '</b>';
    } else {
      ui.mode.textContent = '🎲 Fritt spill';
      ui.bank.innerHTML = 'Saldo <b>' + formatGK(Wallet.balance) + '</b>';
    }
    ui.betAmt.textContent = C.fmtChips(game.bet);
  }

  function paintShoe() {
    if (!game.shoe) return;
    const left = game.shoe.remaining;
    ui.shoeText.textContent = left + ' kort';
    ui.shoe.style.setProperty('--fill', (left / game.shoe.total).toFixed(3));
  }

  function paintCount() {
    ui.countBox.hidden = !game.showCount;
    if (!game.showCount || !game.shoe) return;
    const rc = game.shoe.running;
    const tc = game.shoe.trueCount;
    ui.countBox.innerHTML = 'Telling <b>' + (rc > 0 ? '+' : '') + rc + '</b><span>Sann ' + (tc > 0 ? '+' : '') + tc.toFixed(1) + '</span>';
    ui.countBox.classList.toggle('hot', tc >= 2);
    ui.countBox.classList.toggle('cold', tc <= -2);
  }

  function paintScores() {
    if (!game.cfg) return;
    const tourney = game.cfg.mode === 'tournament';
    const rows = game.seats.map((s) => ({
      s, v: tourney ? s.bankroll : (s.isHuman ? Wallet.balance - game.sessionStart : s.net)
    }));
    rows.sort((a, b) => b.v - a.v);
    ui.scores.innerHTML = rows.map(({ s, v }) =>
      '<li class="' + (s.isHuman ? 'you' : '') + (s.out ? ' out' : '') + '"><span>' + s.avatar + '</span><span class="who">' + escapeHtml(s.name) + '</span>' +
      '<span class="amt ' + (tourney ? '' : (v > 0 ? 'pos' : v < 0 ? 'neg' : '')) + '">' + (tourney ? C.fmtChips(v) : (v > 0 ? '+' : '') + C.fmtChips(v)) + '</span></li>').join('');
    game.seats.forEach((s) => {
      if (s.isHuman || !s.el) return;
      s.el.stack.textContent = s.out ? 'Ute' : C.fmtChips(s.bankroll) + (tourney ? '' : ' GK');
    });
    const ss = game.session;
    ui.session.innerHTML = [
      ['Hender', ss.hands], ['Vunnet / tapt / push', ss.wins + ' / ' + ss.losses + ' / ' + ss.pushes],
      ['Blackjacks', ss.bj], ['Seiersrekke', game.winStreak]
    ].map(([k, v]) => '<li><span class="who">' + k + '</span><span class="amt">' + v + '</span></li>').join('');
  }

  function paintAll() { paintToggles(); paintBank(); paintShoe(); paintCount(); paintScores(); updateButtons(); }

  function message(text, kind, ms) {
    ui.msg.textContent = text;
    ui.msg.className = 'table-msg show' + (kind ? ' ' + kind : '');
    clearTimeout(ui.msgTimer);
    if (ms) ui.msgTimer = setTimeout(() => ui.msg.classList.remove('show'), ms * Math.max(C.speed, 0.4));
  }
  function hideMessage() { ui.msg.classList.remove('show'); }

  function log(html) {
    ui.log.prepend(C.el('li', '', html));
    while (ui.log.children.length > 60) ui.log.lastChild.remove();
  }

  /* ---------- innsats ---------- */
  function prepareNewBet() {
    if (game.tableDirty) clearTableCards();
    hideMessage();
  }

  function addBet(v, chipEl) {
    if (game.phase !== 'betting') return;
    if (game.bet + v > maxBetFor(game.you)) { showToast('Maks innsats er ' + C.fmtChips(maxBetFor(game.you))); return; }
    prepareNewBet();
    game.bet += v;
    GuttaSFX.chip();
    C.flyChip(v, chipEl, ui.betSpot).then(paintBetSpot);
    paintBank();
    updateButtons();
  }
  function clearBet() { if (game.phase !== 'betting') return; game.bet = 0; GuttaSFX.click(); paintBetSpot(); paintBank(); updateButtons(); }
  function rebet() {
    if (game.phase !== 'betting' || !game.lastBet) return;
    prepareNewBet();
    game.bet = Math.min(game.lastBet, maxBetFor(game.you));
    GuttaSFX.chips(); paintBetSpot(); paintBank(); updateButtons();
  }
  function doubleTheBet() {
    if (game.phase !== 'betting' || !game.bet) return;
    if (game.bet * 2 > maxBetFor(game.you)) return;
    game.bet *= 2;
    GuttaSFX.chips(); paintBetSpot(); paintBank(); updateButtons();
  }
  function paintBetSpot() {
    const old = ui.betSpot.querySelector('.chip-pile');
    if (old) old.remove();
    if (game.bet > 0) ui.betSpot.appendChild(C.chipPile(game.bet));
    ui.betSpot.classList.toggle('has-bet', game.bet > 0);
  }

  /* ---------- AI-innsatser ---------- */
  function placeBotBets() {
    const tourney = game.cfg.mode === 'tournament';
    const roundsLeft = TOURNEY_ROUNDS - game.round; // including the coming one
    const leader = Math.max.apply(null, game.seats.filter((s) => !s.out).map((s) => s.bankroll));
    game.seats.forEach((s) => {
      if (s.isHuman) return;
      s.nextBet = 0;
      if (s.out) return;
      if (!tourney && s.bankroll < MIN_BET) {
        s.bankroll += 1000; s.rebuys = (s.rebuys || 0) + 1; s.net -= 1000;
        C.speak(s.el.root, C.pick(LINES.rebuy), 2000, { below: true });
      }
      const max = maxBetFor(s);
      if (max < MIN_BET) { s.out = true; return; }
      const tc = game.shoe.trueCount;
      let bet;
      if (s.skill === 'drunk') {
        bet = tourney ? s.bankroll * (0.08 + Math.random() * 0.3) : C.pick([10, 25, 25, 50, 50, 100, 150]);
      } else if (s.skill === 'basic') {
        bet = tourney ? s.bankroll * 0.1 : 25;
        if (tourney && roundsLeft === 1 && s.bankroll < leader) bet = s.bankroll;
      } else {
        const unit = tourney ? Math.max(10, s.bankroll * 0.05) : 25;
        const units = C.clamp(Math.floor(tc) - 1, 1, 8);
        bet = unit * units;
        if (units >= 3) C.speak(s.el.root, C.pick(LINES.bigBet), 1800, { below: true });
        if (tourney && roundsLeft <= 3) {
          const gap = leader - s.bankroll;
          if (gap > 0) bet = Math.max(bet, gap + 10);
          else {
            const second = Math.max.apply(null, game.seats.filter((x) => x !== s && !x.out).map((x) => x.bankroll).concat([0]));
            bet = Math.max(MIN_BET, Math.min(bet, (s.bankroll - second) / 2));
          }
        }
      }
      bet = Math.round(bet / 5) * 5;
      s.nextBet = C.clamp(bet, MIN_BET, max);
      paintBotBet(s, s.nextBet);
    });
  }
  function paintBotBet(s, amount) {
    s.el.bet.innerHTML = '';
    if (amount > 0) s.el.bet.appendChild(C.chipPile(amount, { small: true }));
  }

  /* ============================================================
     RUNDEN
     ============================================================ */
  async function deal() {
    if (game.phase !== 'betting') return;
    if (game.bet === 0 && game.lastBet) { prepareNewBet(); game.bet = Math.min(game.lastBet, maxBetFor(game.you)); paintBetSpot(); }
    if (game.bet < MIN_BET) { showToast('Minste innsats er ' + MIN_BET); return; }
    if (game.bet > fundsOf(game.you)) { showToast('Ikke nok penger til den innsatsen'); return; }
    prepareNewBet();
    setPhase('dealing');
    GuttaSFX.click();
    try {
      await playRound();
    } catch (err) {
      console.error(err);
      message('Noe gikk galt. Runden er avbrutt.', 'lose', 2500);
    }
    game.tableDirty = true;
    if (game.cfg.mode === 'tournament' && (game.round >= TOURNEY_ROUNDS || tournamentOver())) {
      await C.wait(1200);
      await finishTournament();
      return;
    }
    setPhase('betting');
    placeBotBets();
    paintAll();
  }

  async function playRound() {
    const rules = game.rules;
    game.round++;
    // shuffle if the cut card is out
    if (game.shoe.needsShuffle) {
      message('Ny kortsko – blander…', 'push');
      GuttaSFX.shuffle();
      game.shoe.build();
      paintShoe(); paintCount();
      log('Kortskoen blandes. Tellingen starter på 0.');
      await C.wait(1100);
      hideMessage();
    }

    // take the bets (yours first, so a failed charge never strands the AI bets)
    if (!charge(game.you, game.bet)) { game.round--; showToast('Ikke nok penger til den innsatsen'); return; }
    game.you.hands = [new Hand(game.bet)];
    const players = game.seats.filter((s) => !s.out);
    for (const s of players) {
      if (s.isHuman) continue;
      const bet = s.nextBet;
      if (!bet || !charge(s, bet)) { s.hands = []; continue; }
      s.hands = [new Hand(bet)];
    }
    game.lastBet = game.bet;
    game.bet = 0;
    paintBetSpot();
    paintBank();
    paintScores();
    const active = players.filter((s) => s.hands.length);
    ui.hands.classList.toggle('many', false);
    active.forEach((s) => { if (!s.isHuman) paintBotBet(s, 0); ensureHandEl(s, s.hands[0], 0); });

    // deal: two rounds, dealer gets up card then hole card
    const dealerHand = game.dealer.hand;
    for (let r = 0; r < 2; r++) {
      for (const s of active) await dealCard(s, s.hands[0], true);
      await dealDealer(r === 0);
    }

    // insurance & peek
    const up = dealerHand.cards[0];
    const upTen = points(up) === 10;
    if (up.rank === 'A') await insurancePhase(active);
    let dealerBJ = false;
    if (up.rank === 'A' || upTen) {
      dealerBJ = dealerHand.blackjack;
      if (dealerBJ) {
        await revealHole();
        message('Dealer har blackjack!', 'lose');
        GuttaSFX.lose();
        log('Dealer har <b>blackjack</b>.');
      } else if (up.rank === 'A') {
        message('Dealer har ikke blackjack', 'push', 1300);
      }
      settleInsurance(active, dealerBJ);
    }

    if (!dealerBJ) {
      for (const s of active) {
        markActive(s, true);
        await playSeat(s);
        markActive(s, false);
      }
      await dealerTurn(active);
    }
    await settle(active, dealerBJ);
  }

  /* ---------- dele ut ---------- */
  async function dealCard(seat, hand, up) {
    const card = game.shoe.draw();
    hand.cards.push(card);
    const cEl = await C.dealTo(hand.el.cards, card, { from: ui.shoe, up: up, mini: !seat.isHuman, ms: 380 });
    if (up) game.shoe.see(card);
    paintShoe(); paintCount();
    paintHand(hand);
    return cEl;
  }
  async function dealDealer(up) {
    const hand = game.dealer.hand;
    const card = game.shoe.draw();
    hand.cards.push(card);
    const cEl = await C.dealTo(ui.dealerCards, card, { from: ui.shoe, up: up, ms: 380 });
    if (up) game.shoe.see(card); else game.dealer.holeEl = cEl;
    paintShoe(); paintCount();
    paintDealerTotal();
  }
  async function revealHole() {
    if (!game.dealer.holeEl) return;
    await C.setFaceUp(game.dealer.holeEl, true);
    game.shoe.see(game.dealer.hand.cards[1]);
    game.dealer.holeEl = null;
    paintCount();
    paintDealerTotal();
  }
  function paintDealerTotal() {
    const h = game.dealer.hand;
    if (game.dealer.holeEl && h.cards.length >= 1) {
      const upHand = new Hand(); upHand.cards = [h.cards[0]];
      ui.dealerTotal.textContent = upHand.label;
      ui.dealerTotal.className = 'bj-total';
    } else {
      ui.dealerTotal.textContent = h.label;
      ui.dealerTotal.className = 'bj-total' + (h.bust ? ' bust' : h.blackjack ? ' bj' : '');
    }
  }

  function ensureHandEl(seat, hand, index) {
    if (hand.el) return hand.el;
    const group = C.el('div', 'bj-hand');
    group.innerHTML = '<div class="bj-cards"></div><div class="bj-hand-foot"><span class="bj-total"></span><span class="bj-hand-bet"></span></div>';
    const container = seat.isHuman ? ui.hands : seat.el.hands;
    const after = container.children[index];
    container.insertBefore(group, after || null);
    hand.el = { group, cards: group.querySelector('.bj-cards'), total: group.querySelector('.bj-total'), bet: group.querySelector('.bj-hand-bet') };
    paintHand(hand);
    if (seat.isHuman) ui.hands.classList.toggle('many', seat.hands.length > 2);
    return hand.el;
  }
  function paintHand(hand) {
    if (!hand.el) return;
    hand.el.total.textContent = hand.label;
    hand.el.total.className = 'bj-total' + (hand.bust ? ' bust' : hand.blackjack ? ' bj' : hand.soft ? ' soft' : '');
    hand.el.bet.textContent = hand.bet ? C.fmtChips(hand.bet) + (hand.doubled ? ' ×2' : '') : '';
  }
  function markActive(seat, on) {
    if (seat.isHuman) return;
    seat.el.root.classList.toggle('active', on);
  }
  function focusHand(seat, hand) {
    seat.hands.forEach((h) => h.el && h.el.group.classList.toggle('active', h === hand));
  }

  /* ---------- forsikring ---------- */
  function insurancePhase(active) {
    return new Promise((resolve) => {
      const tc = game.shoe.trueCount;
      active.forEach((s) => {
        if (s.isHuman) return;
        const cost = s.hands[0].bet / 2;
        const take = (s.skill === 'drunk' && C.chance(0.4)) || (s.skill === 'counter' && tc >= 3);
        if (take && fundsOf(s) >= cost) { charge(s, cost); s.insurance = cost; C.speak(s.el.root, C.pick(LINES.insurance), 1600, { below: true }); }
      });
      const you = game.you;
      if (!you.hands.length || fundsOf(you) < you.hands[0].bet / 2 || you.hands[0].blackjack) { resolve(); return; }
      game.insureResolve = resolve;
      setPhase('insurance');
      message('Forsikring? Koster ' + C.fmtChips(you.hands[0].bet / 2), 'push');
      const hintTake = game.coach && game.rules.coach;
      if (hintTake) ui.coachLine.textContent = '💡 Basic strategy: aldri ta forsikring.';
    });
  }
  function humanInsure(yes) {
    if (game.phase !== 'insurance' || !game.insureResolve) return;
    const you = game.you;
    const cost = you.hands[0].bet / 2;
    if (yes && charge(you, cost)) { you.insurance = cost; GuttaSFX.chip(); log('Du tok forsikring for ' + C.fmtChips(cost) + '.'); }
    hideMessage();
    const r = game.insureResolve; game.insureResolve = null;
    setPhase('dealing');
    paintBank();
    r();
  }
  function settleInsurance(active, dealerBJ) {
    active.forEach((s) => {
      if (!s.insurance) return;
      if (dealerBJ) {
        payTo(s, s.insurance * 3);
        if (s.isHuman) { log('Forsikringen betalte <b>' + C.fmtChips(s.insurance * 2) + '</b>.'); C.floatText(ui.betSpot, '+' + C.fmtChips(s.insurance * 2), 'win'); }
      } else if (s.isHuman) log('Forsikringen gikk tapt.');
      if (!s.isHuman) s.net += dealerBJ ? s.insurance * 2 : -s.insurance;
      s.insurance = 0;
    });
    paintBank(); paintScores();
  }

  /* ---------- en spillers tur ---------- */
  function optionsFor(seat, hand) {
    const first2 = hand.cards.length === 2;
    const funds = fundsOf(seat);
    return {
      hit: !hand.splitAces,
      double: first2 && !hand.splitAces && funds >= hand.bet,
      split: first2 && hand.pair && seat.hands.length < 4 && funds >= hand.bet,
      surrender: game.rules.surrender && first2 && seat.hands.length === 1 && !hand.fromSplit,
      h17: game.rules.h17
    };
  }

  async function playSeat(seat) {
    for (let i = 0; i < seat.hands.length; i++) {
      const hand = seat.hands[i];
      focusHand(seat, hand);
      if (hand.cards.length === 1) await dealCard(seat, hand, true);
      if (hand.blackjack) {
        hand.done = true;
        if (seat.isHuman) { message('BLACKJACK!', 'win', 1300); GuttaSFX.bigWin(); }
        else C.speak(seat.el.root, C.pick(LINES.blackjack), 1800, { below: true });
        continue;
      }
      while (!hand.done) {
        if (hand.total >= 21 || (hand.splitAces && hand.cards.length >= 2)) { hand.done = true; break; }
        const opts = optionsFor(seat, hand);
        const action = seat.isHuman ? await humanDecision(seat, hand, opts) : await botDecision(seat, hand, opts);
        await apply(seat, hand, i, action);
      }
      if (hand.bust) {
        if (seat.isHuman) { message('Sprakk!', 'lose', 1100); GuttaSFX.bust(); }
        else { C.speak(seat.el.root, C.pick(LINES.bust), 1600, { below: true }); GuttaSFX.bust(); }
      }
    }
    focusHand(seat, null);
  }

  async function apply(seat, hand, index, action) {
    const name = seat.isHuman ? 'Du' : seat.name;
    if (action === 'H') {
      await dealCard(seat, hand, true);
    } else if (action === 'S') {
      hand.done = true;
    } else if (action === 'D') {
      if (!charge(seat, hand.bet)) { hand.done = true; return; }
      const before = hand.label;
      hand.bet *= 2; hand.doubled = true;
      GuttaSFX.chips();
      paintBank(); paintHand(hand);
      await dealCard(seat, hand, true);
      hand.done = true;
      log(escapeHtml(name) + ' doblet på ' + before + ' og fikk ' + hand.label + '.');
    } else if (action === 'P') {
      if (!charge(seat, hand.bet)) { hand.done = true; return; }
      GuttaSFX.chips();
      const moved = hand.cards.pop();
      const aces = moved.rank === 'A';
      const nh = new Hand(hand.bet);
      nh.cards.push(moved);
      nh.fromSplit = hand.fromSplit = true;
      nh.splitAces = hand.splitAces = aces;
      seat.hands.splice(index + 1, 0, nh);
      ensureHandEl(seat, nh, index + 1);
      // move the card element over to the new hand
      const movedEl = hand.el.cards.lastElementChild;
      if (movedEl) { nh.el.cards.appendChild(movedEl); C.flyFrom(movedEl, hand.el.cards, 300); }
      paintHand(hand); paintHand(nh); paintBank();
      log(escapeHtml(name) + ' splittet ' + moved.rank + '-ere.');
      await C.wait(250);
      await dealCard(seat, hand, true);
    } else if (action === 'R') {
      hand.surrendered = true;
      hand.done = true;
      payTo(seat, hand.bet / 2);
      paintBank();
      log(escapeHtml(name) + ' ga seg (fikk halve innsatsen tilbake).');
      if (seat.isHuman) message('Du ga deg', 'push', 1100);
    }
    paintScores();
  }

  /* ---------- menneskets valg ---------- */
  function humanDecision(seat, hand, opts) {
    return new Promise((resolve) => {
      game.pendingHuman = { resolve, opts, hand };
      setPhase('human');
      refreshHint();
    });
  }
  function refreshHint() {
    [ui.hit, ui.stand, ui.double, ui.split, ui.surrender].forEach((b) => b.classList.remove('hint'));
    ui.coachLine.textContent = '';
    if (game.phase !== 'human' || !game.pendingHuman) return;
    const { hand, opts } = game.pendingHuman;
    const rec = basicStrategy(hand, game.dealer.hand.cards[0], opts);
    game.pendingHuman.rec = rec;
    if (!game.coach) return;
    const btn = { H: ui.hit, S: ui.stand, D: ui.double, P: ui.split, R: ui.surrender }[rec];
    if (btn) btn.classList.add('hint');
    ui.coachLine.textContent = '💡 Basic strategy: ' + ACTION_NAME[rec] + ' (' + hand.label + ' mot dealerens ' + game.dealer.hand.cards[0].rank + ')';
  }
  function humanAct(action) {
    const p = game.pendingHuman;
    if (game.phase !== 'human' || !p) return;
    const o = p.opts;
    if ((action === 'H' && !o.hit) || (action === 'D' && !o.double) || (action === 'P' && !o.split) || (action === 'R' && !o.surrender)) return;
    GuttaSFX.click();
    // learning: compare against basic strategy
    if (p.rec) {
      if (action === p.rec) {
        game.coachStreak++;
        if (game.coachStreak >= 25) Achievements.unlock('coach');
      } else {
        game.coachStreak = 0;
        log('💡 Basic strategy sa <b>' + ACTION_NAME[p.rec] + '</b>, du valgte ' + ACTION_NAME[action] + '.');
      }
    }
    game.pendingHuman = null;
    setPhase('playing');
    p.resolve(action);
  }

  /* ---------- AI-valg ---------- */
  async function botDecision(seat, hand, opts) {
    seat.el.root.classList.add('thinking');
    await C.wait(520 + Math.random() * 420);
    seat.el.root.classList.remove('thinking');
    const up = game.dealer.hand.cards[0];
    let action;
    if (seat.skill === 'counter') action = countingStrategy(hand, up, opts, game.shoe.trueCount);
    else action = basicStrategy(hand, up, opts);
    if (seat.skill === 'drunk') {
      if (action === 'R') action = 'H';
      if (C.chance(0.3)) {
        const legal = ['H', 'S'].concat(opts.double ? ['D'] : []);
        action = C.pick(legal);
        if (C.chance(0.5)) { C.speak(seat.el.root, C.pick(LINES.drunk), 1500, { below: true }); GuttaSFX.hiccup(); await C.wait(500); }
      }
    }
    const legalMap = { H: opts.hit, S: true, D: opts.double, P: opts.split, R: opts.surrender };
    if (!legalMap[action]) action = action === 'D' ? (opts.hit ? 'H' : 'S') : 'S';
    const lineKey = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' }[action];
    C.speak(seat.el.root, C.pick(LINES[lineKey]), 1300, { below: true });
    return action;
  }

  /* ---------- dealerens tur ---------- */
  async function dealerTurn(active) {
    const hand = game.dealer.hand;
    await C.wait(300);
    await revealHole();
    const live = active.some((s) => s.hands.some((h) => !h.bust && !h.surrendered && !h.blackjack));
    if (!live) return;
    const mustHit = () => hand.total < 17 || (game.rules.h17 && hand.total === 17 && hand.soft);
    while (mustHit()) {
      await C.wait(380);
      await dealDealer(true);
    }
    if (hand.bust) { message('Dealer sprakk!', 'win', 1300); GuttaSFX.win(); }
  }

  /* ---------- oppgjør ---------- */
  async function settle(active, dealerBJ) {
    const d = game.dealer.hand;
    const dTotal = d.total;
    let youNet = 0, youWon = 0, youLost = 0, youPush = 0, youBJ = false, youBust = false, youDoubleLoss = false;
    const splitResults = [];
    for (const s of active) {
      let seatNet = 0;
      for (const h of s.hands) {
        const stake = h.bet;
        let ret = 0;
        if (h.surrendered) { h.result = 'lose'; ret = 0; seatNet -= stake / 2; }
        else if (h.bust) { h.result = 'lose'; seatNet -= stake; }
        else if (h.blackjack && !dealerBJ) { h.result = 'win'; ret = stake + stake * game.rules.bjPays; seatNet += stake * game.rules.bjPays; }
        else if (dealerBJ) {
          if (h.blackjack) { h.result = 'push'; ret = stake; } else { h.result = 'lose'; seatNet -= stake; }
        } else if (d.bust || h.total > dTotal) { h.result = 'win'; ret = stake * 2; seatNet += stake; }
        else if (h.total === dTotal) { h.result = 'push'; ret = stake; }
        else { h.result = 'lose'; seatNet -= stake; }
        payTo(s, ret);
        if (h.el) {
          h.el.group.classList.add(h.result);
          const delta = ret - (h.surrendered ? stake / 2 : stake);
          C.floatText(h.el.group, h.result === 'push' ? 'Push' : (delta >= 0 ? '+' : '−') + C.fmtChips(Math.abs(delta)), h.result);
        }
        if (s.isHuman) {
          if (h.result === 'win') youWon++; else if (h.result === 'lose') youLost++; else youPush++;
          if (h.blackjack && h.result === 'win') youBJ = true;
          if (h.bust) youBust = true;
          if (h.doubled && h.result === 'lose') youDoubleLoss = true;
          if (h.fromSplit) splitResults.push(h.result);
        }
      }
      if (s.isHuman) youNet = seatNet;
      else {
        s.net += seatNet;
        s.el.root.classList.add(seatNet > 0 ? 'win' : seatNet < 0 ? 'lose' : 'push');
        if (seatNet !== 0 && C.chance(0.6)) C.speak(s.el.root, C.pick(seatNet > 0 ? LINES.win : LINES.lose), 1700, { below: true });
      }
    }

    // stats & feedback for the human
    const ss = game.session;
    if (game.you.hands.length) {
      ss.hands += game.you.hands.length;
      ss.wins += youWon; ss.losses += youLost; ss.pushes += youPush;
      if (youBJ) ss.bj++;
      Stats.add('blackjack.hands', game.you.hands.length);
      if (youBJ) { Stats.add('blackjack.blackjacks'); Achievements.unlock('blackjack'); }
      if (game.cfg.mode === 'free') C.recordResult('blackjack', youNet);
      else if (youNet > 0) Stats.add('blackjack.wins');
      if (youNet > 0) {
        game.winStreak++;
        if (game.winStreak >= 5) Achievements.unlock('bj_streak');
      } else if (youNet < 0) game.winStreak = 0;
      if (splitResults.length >= 2 && splitResults.every((r) => r === 'win')) Achievements.unlock('split_double');

      const text = youNet > 0 ? 'Du vinner ' + C.fmtChips(youNet) + '!' : youNet < 0 ? 'Du taper ' + C.fmtChips(-youNet) : 'Push – pengene tilbake';
      message(text, youNet > 0 ? 'win' : youNet < 0 ? 'lose' : 'push');
      if (youNet > 0) { (youBJ || youNet >= 200) ? (GuttaSFX.bigWin(), confettiBurst()) : GuttaSFX.win(); }
      else if (youNet < 0) GuttaSFX.lose(); else GuttaSFX.chip();
      log('Runde ' + game.round + ': dealer ' + (dealerBJ ? 'blackjack' : d.bust ? 'sprakk (' + dTotal + ')' : dTotal) +
        ', du ' + game.you.hands.map((h) => h.label).join(' / ') + ' → <b>' + (youNet > 0 ? '+' : '') + C.fmtChips(youNet) + '</b>');

      // Drikkemodus — én beskjed per runde
      if (dealerBJ) drinkPrompt('Dealer-blackjack!', 'Alle ved bordet tar en slurk');
      else if (youBJ) drinkPrompt('BLACKJACK!', 'Del ut tre slurker til hvem du vil');
      else if (youDoubleLoss) drinkPrompt('Doblet og tapte', 'Tre slurker, eller chug hvis du tør');
      else if (youBust) drinkPrompt('Du sprakk!', 'Ta to slurker');
    }
    paintAll();
  }

  /* ---------- turnering ---------- */
  function tournamentOver() {
    const alive = game.seats.filter((s) => s.bankroll >= MIN_BET);
    return game.you.bankroll < MIN_BET || alive.length <= 1;
  }
  async function finishTournament() {
    setPhase('idle');
    const rows = game.seats.map((s) => ({ name: s.name, avatar: s.avatar, amount: s.bankroll, you: s.isHuman }))
      .sort((a, b) => b.amount - a.amount || (a.you ? -1 : 1));
    const place = rows.findIndex((r) => r.you) + 1;
    const fee = TOURNEY_FEE[game.cfg.level];
    const pot = fee * game.seats.length;
    Stats.add('blackjack.tournaments');
    let html = C.standingsHtml(rows, 'sjetonger');
    if (place === 1) {
      Wallet.add(pot, 'blackjack-turnering');
      Stats.add('blackjack.tournamentWins');
      Stats.max('blackjack.best', pot - fee);
      Achievements.unlock('bj_tournament');
      Achievements.unlock('first_win');
      html = '<p>Du slo AI-gutta og tar hele potten på <b>' + formatGK(pot) + '</b>! 🍾</p>' + html;
      GuttaSFX.bigWin(); confettiBurst(); setTimeout(() => confettiBurst(window.innerWidth / 4, window.innerHeight / 3), 300);
      drinkPrompt('Turneringsvinner!', 'Resten av bordet skåler for deg');
    } else {
      html = '<p>Du endte på <b>' + place + '. plass</b>. Innskuddet på ' + formatGK(fee) + ' er borte, men æren lever.</p>' + html;
      GuttaSFX.lose();
      drinkPrompt(place + '. plass…', 'Ta ' + place + ' slurker');
    }
    const v = await C.modal({ icon: place === 1 ? '🏆' : '🃏', title: place === 1 ? 'Du vant turneringen!' : 'Turneringen er over', html,
      actions: [{ label: 'Ny turnering', value: 'again' }, { label: 'Fritt spill', value: 'free', cls: 'ghost' }, { label: 'Lobbyen', href: 'kasino.html', cls: 'ghost' }] });
    if (v === 'again') {
      if (!(await C.ensureFunds(fee))) { setup(); return; }
      Wallet.spend(fee, 'blackjack-turnering');
      startTable(game.cfg);
    } else {
      const cfg = Object.assign({}, game.cfg, { mode: 'free' });
      Store.set('gutta_bj_config', cfg);
      startTable(cfg);
    }
  }

  /* ---------- regler ---------- */
  function showRules() {
    const r = game.rules || LEVELS.lett;
    C.modal({
      icon: '📖', title: 'Slik spiller du', wide: true,
      html: '<ul class="rules-list">' +
        '<li>Målet er å komme nærmere 21 enn dealeren uten å gå over. Bildekort teller 10, ess teller 1 eller 11.</li>' +
        '<li><b>Blackjack</b> (ess + tierkort på de to første) betaler ' + (r.bjPays === 1.5 ? '3:2' : '6:5') + '. Vanlig gevinst betaler 1:1.</li>' +
        '<li>Dealeren ' + (r.h17 ? 'trekker' : 'står') + ' på myk 17 og kikker etter blackjack når hun viser ess eller tierkort.</li>' +
        '<li><b>Doble</b>: dobbel innsats, nøyaktig ett kort til. <b>Splitt</b>: del et par i to hender (opptil 4). Splittede ess får ett kort hver.</li>' +
        (r.surrender ? '<li><b>Overgi</b>: gi opp de to første kortene og få halve innsatsen tilbake.</li>' : '') +
        '<li><b>Forsikring</b> koster halve innsatsen og betaler 2:1 hvis dealeren har blackjack.</li>' +
        '<li>Tastatur: <b>H</b> trekk, <b>S</b> stå, <b>D</b> doble, <b>P</b> splitt, <b>U</b> overgi, <b>mellomrom</b> del ut, <b>Y/N</b> forsikring.</li>' +
        '<li><b>Hi-Lo-telling</b>: 2–6 gir +1, 7–9 gir 0, tiere og ess gir −1. Sann telling er tellingen delt på antall stokker igjen. Høy sann telling er bra for spillerne.</li>' +
        '<li>AI-nivå: Lett = fulle gutter som gjør feil, Middels = perfekt basic strategy, Vanskelig = korttellere.</li>' +
        '</ul>',
      actions: [{ label: 'Skjønner!', value: true }],
      dismissValue: true
    });
  }

  /* ---------- start ---------- */
  buildUI();
  setPhase('idle');
  setup();
})();
