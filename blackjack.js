/* ==========================================================================
   BLACKJACK — NORWAY EDITION
   A complete, self-contained casino Blackjack game in vanilla JavaScript.
   No frameworks, no build step — this file builds its own DOM, plays its
   own sounds (synthesized, no audio files), and runs a full 4-deck shoe
   with insurance, splits, double down, and late surrender.

   Drop this in alongside blackjack.css and an empty page: the game mounts
   itself into <body> automatically.
   ========================================================================== */
(function () {
  'use strict';

  /* ============================================================
     CONFIG & CONSTANTS
     ============================================================ */
  const CONFIG = {
    NUM_DECKS: 4,
    RESHUFFLE_PENETRATION: 0.75,
    STARTING_BANKROLL: 1000,
    MIN_BET: 10,
    MAX_BET: 500,
    CHIP_VALUES: [1, 5, 25, 100, 500],
    BLACKJACK_PAYOUT: 1.5,
    INSURANCE_PAYOUT: 2,
    MAX_RESPLITS: 3,
    NEXT_ROUND_DELAY_MS: 2600,
  };

  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUIT_SYMBOL = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const RED_SUITS = new Set(['hearts', 'diamonds']);

  const PHASE = {
    BETTING: 'betting',
    DEALING: 'dealing',
    INSURANCE: 'insurance',
    PLAYER_TURN: 'player_turn',
    DEALER_TURN: 'dealer_turn',
    RESOLUTION: 'resolution',
  };

  function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  }

  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  /* ============================================================
     SVG ASSETS — a small Nordic-cross shield used as the table
     crest and card-back motif. Drawn with a clip-path so it can
     be reused at any size without external images.
     ============================================================ */
  let SVG_UID = 0;
  function shieldSVG(size) {
    const uid = 'bjShield' + (++SVG_UID);
    return (
      '<svg viewBox="0 0 100 120" width="' + size + '" height="' + (size * 1.2) + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><clipPath id="' + uid + '"><path d="M50 4 L92 18 V58 C92 90 74 107 50 116 C26 107 8 90 8 58 V18 Z"/></clipPath></defs>' +
        '<g clip-path="url(#' + uid + ')">' +
          '<rect x="0" y="0" width="100" height="120" fill="#a6132f"/>' +
          '<rect x="30" y="0" width="18" height="120" fill="#0a1830"/>' +
          '<rect x="0" y="44" width="100" height="18" fill="#0a1830"/>' +
          '<rect x="35" y="0" width="8" height="120" fill="#f7f5ef"/>' +
          '<rect x="0" y="49" width="100" height="8" fill="#f7f5ef"/>' +
        '</g>' +
        '<path d="M50 4 L92 18 V58 C92 90 74 107 50 116 C26 107 8 90 8 58 V18 Z" fill="none" stroke="#d8b26b" stroke-width="4"/>' +
      '</svg>'
    );
  }

  function cardBackSVG() {
    return (
      '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="27" y="2" width="13" height="116" fill="#a6132f" opacity="0.85"/>' +
        '<rect x="0" y="39" width="100" height="13" fill="#a6132f" opacity="0.85"/>' +
        '<rect x="31" y="2" width="5" height="116" fill="#f7f5ef" opacity="0.8"/>' +
        '<rect x="0" y="42" width="100" height="5" fill="#f7f5ef" opacity="0.8"/>' +
        '<circle cx="50" cy="45.5" r="9" fill="none" stroke="#d8b26b" stroke-width="2"/>' +
      '</svg>'
    );
  }

  /* ============================================================
     SOUND MANAGER — every sound is synthesized at runtime via the
     Web Audio API. There are no audio files anywhere in this game.
     ============================================================ */
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }
    _ctx() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      return this.ctx;
    }
    _tone(freq, duration, type, gain, delay) {
      if (!this.enabled) return;
      const ctx = this._ctx();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + (delay || 0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(gain || 0.05, 0.001), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    }
    cardDeal() { this._tone(520, 0.09, 'triangle', 0.05); }
    cardFlip() { this._tone(760, 0.07, 'square', 0.03); }
    chip() { this._tone(940, 0.06, 'sine', 0.05); }
    click() { this._tone(1200, 0.035, 'square', 0.02); }
    win() { [660, 880, 1100].forEach((f, i) => this._tone(f, 0.18, 'sine', 0.05, i * 0.09)); }
    blackjack() { [660, 880, 1100, 1320].forEach((f, i) => this._tone(f, 0.2, 'triangle', 0.06, i * 0.09)); }
    lose() { this._tone(220, 0.3, 'sawtooth', 0.045); this._tone(160, 0.35, 'sawtooth', 0.04, 0.08); }
    bust() { this._tone(180, 0.28, 'sawtooth', 0.05); }
  }

  /* ============================================================
     CARD / DECK / SHOE
     ============================================================ */
  let CARD_UID = 0;

  class Card {
    constructor(rank, suit) {
      this.rank = rank;
      this.suit = suit;
      this.id = 'c' + (++CARD_UID);
    }
    get isRed() { return RED_SUITS.has(this.suit); }
    get isAce() { return this.rank === 'A'; }
    get baseValue() {
      if (this.rank === 'A') return 11;
      if (this.rank === 'J' || this.rank === 'Q' || this.rank === 'K') return 10;
      return parseInt(this.rank, 10);
    }
  }

  class Deck {
    static create() {
      const cards = [];
      for (const suit of SUITS) {
        for (const rank of RANKS) cards.push(new Card(rank, suit));
      }
      return cards;
    }
  }

  class Shoe {
    constructor(numDecks) {
      this.numDecks = numDecks;
      this.build();
    }
    build() {
      this.cards = [];
      for (let i = 0; i < this.numDecks; i++) this.cards.push(...Deck.create());
      this.shuffle();
      this.drawnCount = 0;
      this.reshuffleThreshold = Math.floor(this.numDecks * 52 * CONFIG.RESHUFFLE_PENETRATION);
    }
    /** Fisher-Yates shuffle — fair, unbiased, in place. */
    shuffle() {
      for (let i = this.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = this.cards[i];
        this.cards[i] = this.cards[j];
        this.cards[j] = tmp;
      }
    }
    draw() {
      if (this.cards.length === 0) this.build();
      this.drawnCount++;
      return this.cards.pop();
    }
    needsReshuffle() { return this.drawnCount >= this.reshuffleThreshold; }
    get remaining() { return this.cards.length; }
    get totalCards() { return this.numDecks * 52; }
  }

  /* ============================================================
     HAND
     ============================================================ */
  class Hand {
    constructor(options) {
      options = options || {};
      this.cards = [];
      this.bet = options.bet || 0;
      this.isDoubled = false;
      this.isSurrendered = false;
      this.fromSplit = !!options.fromSplit;
      this.fromSplitAces = !!options.fromSplitAces;
      this.isDone = false;
      this.result = null;
    }
    addCard(card) { this.cards.push(card); }
    _computeRaw() {
      let total = 0, aces = 0;
      for (const c of this.cards) {
        if (c.isAce) { aces++; total += 11; } else total += c.baseValue;
      }
      return { total, aces };
    }
    get value() {
      let { total, aces } = this._computeRaw();
      while (total > 21 && aces > 0) { total -= 10; aces--; }
      return total;
    }
    get isSoft() {
      let { total, aces } = this._computeRaw();
      while (total > 21 && aces > 0) { total -= 10; aces--; }
      return aces > 0 && total <= 21;
    }
    get isBust() { return this.value > 21; }
    get isBlackjack() { return this.cards.length === 2 && this.value === 21 && !this.fromSplit; }
    get canHit() {
      if (this.isDone || this.isBust || this.isSurrendered) return false;
      if (this.fromSplitAces && this.cards.length >= 2) return false;
      return true;
    }
    get canDouble() {
      return this.cards.length === 2 && !this.isDoubled && !this.fromSplitAces && !this.isDone;
    }
    get displayValue() {
      if (this.isBust) return 'Bust';
      if (this.isBlackjack) return 'Blackjack';
      return (this.isSoft ? 'Soft ' : 'Hard ') + this.value;
    }
  }

  /* ============================================================
     PLAYER / DEALER
     ============================================================ */
  class Player {
    constructor(bankroll) {
      this.bankroll = bankroll;
      this.hands = [];
      this.activeHandIndex = 0;
      this.insuranceBet = 0;
      this.stats = {
        wins: 0, losses: 0, pushes: 0, blackjacks: 0,
        winStreak: 0, largestWin: 0, totalWinnings: 0, roundsPlayed: 0,
      };
    }
    get activeHand() { return this.hands[this.activeHandIndex]; }
    resetHands() { this.hands = []; this.activeHandIndex = 0; this.insuranceBet = 0; }
  }

  class Dealer {
    constructor() { this.reset(); }
    reset() { this.hand = new Hand(); this.holeHidden = true; }
    get upCard() { return this.hand.cards[0]; }
    shouldHit() {
      const v = this.hand.value;
      if (v < 17) return true;
      if (v === 17 && this.hand.isSoft) return true;
      return false;
    }
  }

  /* ============================================================
     CHIP MANAGER — builds chip DOM elements and animates them
     flying from the tray to the bet spot ("chip movement").
     ============================================================ */
  class ChipManager {
    createChip(value, interactive) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'bj-chip';
      chip.dataset.value = String(value);
      chip.dataset.label = '$' + value;
      chip.setAttribute('aria-label', 'Bet chip ' + value + ' dollars');
      if (!interactive) { chip.disabled = true; chip.tabIndex = -1; }
      return chip;
    }
    flyChip(value, fromRect, toRect, onDone) {
      const chip = this.createChip(value, false);
      chip.classList.add('bj-flying');
      chip.style.left = fromRect.left + 'px';
      chip.style.top = fromRect.top + 'px';
      chip.style.width = fromRect.width + 'px';
      chip.style.height = fromRect.height + 'px';
      chip.style.opacity = '1';
      document.body.appendChild(chip);
      requestAnimationFrame(() => {
        const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
        const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
        chip.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.85)';
      });
      setTimeout(() => {
        chip.remove();
        if (onDone) onDone();
      }, 560);
    }
  }

  /* ============================================================
     ANIMATION MANAGER — card dealing, flipping, confetti, and
     ambient particle dust across the felt.
     ============================================================ */
  class AnimationManager {
    constructor(sound) { this.sound = sound; }

    dealCard(slotEl, shoeRect) {
      return new Promise((resolve) => {
        const motionEl = slotEl.querySelector('.bj-card-motion') || slotEl.querySelector('.bj-card');
        const rect = slotEl.getBoundingClientRect();
        const fromX = shoeRect.left - rect.left;
        const fromY = shoeRect.top - rect.top;
        motionEl.style.setProperty('--from-x', fromX + 'px');
        motionEl.style.setProperty('--from-y', fromY + 'px');
        motionEl.style.setProperty('--from-r', (Math.random() * 24 - 12) + 'deg');
        motionEl.classList.add('bj-deal-in');
        this.sound.cardDeal();
        setTimeout(() => {
          // Drop the animation class once it's done so its final keyframe
          // transform can never linger and shadow the flip transform.
          motionEl.classList.remove('bj-deal-in');
          resolve();
        }, 480);
      });
    }

    flipCard(cardEl) {
      return new Promise((resolve) => {
        this.sound.cardFlip();
        cardEl.classList.add('bj-flipped');
        setTimeout(resolve, 500);
      });
    }

    confetti(canvas) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const colors = ['#c41e3a', '#d8b26b', '#f7f5ef', '#223969', '#2ecc71'];
      const pieces = [];
      for (let i = 0; i < 150; i++) {
        pieces.push({
          x: Math.random() * canvas.width,
          y: -20 - Math.random() * canvas.height * 0.4,
          w: 5 + Math.random() * 6,
          h: 8 + Math.random() * 9,
          color: colors[(Math.random() * colors.length) | 0],
          vy: 2 + Math.random() * 3.2,
          vx: -1.6 + Math.random() * 3.2,
          rot: Math.random() * Math.PI * 2,
          vr: -0.22 + Math.random() * 0.44,
        });
      }
      let frame = 0;
      const maxFrames = 230;
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of pieces) {
          p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        frame++;
        if (frame < maxFrames) requestAnimationFrame(tick);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
      tick();
    }

    ambientParticles(canvas) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let w, h;
      const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
      resize();
      window.addEventListener('resize', resize);
      const dust = [];
      for (let i = 0; i < 36; i++) {
        dust.push({
          x: Math.random() * w, y: Math.random() * h,
          r: 0.6 + Math.random() * 1.3,
          vy: -0.07 - Math.random() * 0.1,
          vx: -0.025 + Math.random() * 0.05,
          alpha: 0.06 + Math.random() * 0.16,
        });
      }
      const loop = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#d8b26b';
        for (const d of dust) {
          d.y += d.vy; d.x += d.vx;
          if (d.y < -10) d.y = h + 10;
          if (d.x < -10) d.x = w + 10;
          if (d.x > w + 10) d.x = -10;
          ctx.globalAlpha = d.alpha;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(loop);
      };
      loop();
    }
  }

  /* ============================================================
     UI MANAGER — builds and updates every DOM element. This is
     the only class that touches the document directly.
     ============================================================ */
  class UIManager {
    constructor() {
      this.el = {};
      this.buttons = {};
      this.playerHandEls = [];
      this.dealerCardSlots = [];
      this._pendingInsurance = null;
    }

    /* ---------- construction ---------- */
    init() {
      this._injectFonts();
      const root = document.createElement('div');
      root.className = 'bj-root';
      document.body.appendChild(root);
      this.el.root = root;

      root.appendChild(this._div('bj-stadium-glow'));

      const particleCanvas = document.createElement('canvas');
      particleCanvas.className = 'bj-particle-canvas';
      root.appendChild(particleCanvas);
      this.el.particleCanvas = particleCanvas;

      const confettiCanvas = document.createElement('canvas');
      confettiCanvas.className = 'bj-confetti-canvas';
      root.appendChild(confettiCanvas);
      this.el.confettiCanvas = confettiCanvas;

      root.appendChild(this._buildHeader());
      root.appendChild(this._buildTable());

      const banner = this._div('bj-message-banner');
      root.appendChild(banner);
      this.el.messageBanner = banner;

      root.appendChild(this._buildBottomBar());
      root.appendChild(this._buildInsuranceModal());

      const footer = this._div('bj-footer');
      footer.textContent = 'BLACKJACK \u2014 NORWAY EDITION \u00B7 4-deck shoe \u00B7 dealer stands on hard 17, hits soft 17 \u00B7 for entertainment purposes only';
      root.appendChild(footer);
    }

    _injectFonts() {
      if (document.getElementById('bj-fonts')) return;
      const link = document.createElement('link');
      link.id = 'bj-fonts';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap';
      document.head.appendChild(link);
    }

    _div(cls) { const d = document.createElement('div'); if (cls) d.className = cls; return d; }

    _buildHeader() {
      const header = this._div('bj-header');

      const brand = this._div('bj-brand');
      const crestWrap = document.createElement('div');
      crestWrap.className = 'bj-crest';
      crestWrap.innerHTML = shieldSVG(44);
      const titleWrap = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'bj-title';
      title.textContent = 'Blackjack \u2014 Norway Edition';
      const subtitle = document.createElement('p');
      subtitle.className = 'bj-subtitle';
      subtitle.textContent = 'Premium Table \u00B7 Scandinavian Rules Room';
      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);
      brand.appendChild(crestWrap);
      brand.appendChild(titleWrap);

      const stats = this._div('bj-stats-panel');
      const statDefs = [
        ['bankroll', 'Bankroll'], ['bet', 'Current Bet'], ['winnings', 'Total Winnings'],
        ['profit', 'Profit / Loss'], ['wins', 'Wins'], ['losses', 'Losses'],
        ['pushes', 'Pushes'], ['blackjacks', 'Blackjacks'], ['streak', 'Win Streak'],
        ['largest', 'Largest Win'],
      ];
      this.statValueEls = {};
      statDefs.forEach(([key, label]) => {
        const item = this._div('bj-stat-item');
        const l = document.createElement('span');
        l.className = 'bj-stat-label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'bj-stat-value';
        v.textContent = key === 'bet' || key === 'bankroll' ? '$0' : '0';
        item.appendChild(l);
        item.appendChild(v);
        stats.appendChild(item);
        this.statValueEls[key] = v;
      });

      header.appendChild(brand);
      header.appendChild(stats);
      return header;
    }

    _buildTable() {
      const wrap = this._div('bj-table-wrap');
      const table = this._div('bj-table');

      const shoeBadge = this._div('bj-shoe-badge');
      const shoeIcon = this._div('bj-shoe-icon');
      const shoeText = document.createElement('span');
      shoeText.textContent = 'Shoe: 208 / 208';
      shoeBadge.appendChild(shoeIcon);
      shoeBadge.appendChild(shoeText);
      table.appendChild(shoeBadge);
      this.el.shoeIcon = shoeIcon;
      this.el.shoeText = shoeText;

      const dealerZone = this._div('bj-dealer-zone');
      const dealerLabel = this._div('bj-zone-label');
      dealerLabel.textContent = 'Dealer';
      const dealerHandWrap = this._div('bj-hand');
      const dealerCards = this._div('bj-cards');
      const dealerScore = document.createElement('span');
      dealerScore.className = 'bj-score-badge';
      dealerScore.textContent = '';
      dealerHandWrap.appendChild(dealerCards);
      dealerHandWrap.appendChild(dealerScore);
      dealerZone.appendChild(dealerLabel);
      dealerZone.appendChild(dealerHandWrap);
      table.appendChild(dealerZone);
      this.el.dealerCards = dealerCards;
      this.el.dealerScore = dealerScore;
      this.el.dealerHandWrap = dealerHandWrap;

      const playerZone = this._div('bj-player-zone');
      const playerLabel = this._div('bj-zone-label');
      playerLabel.textContent = 'Your Hand';
      const playerHandsRow = this._div('bj-hands-row');
      playerZone.appendChild(playerLabel);
      playerZone.appendChild(playerHandsRow);
      table.appendChild(playerZone);
      this.el.playerHandsRow = playerHandsRow;
      this.el.playerLabel = playerLabel;

      wrap.appendChild(table);
      this.el.table = table;
      return wrap;
    }

    _buildBottomBar() {
      const bar = this._div('bj-bottom-bar');

      const chipTray = this._div('bj-chip-tray');
      CONFIG.CHIP_VALUES.forEach((value) => {
        const chip = this.chips.createChip(value, true);
        chip.addEventListener('click', () => this.onChipClickHandler(value, chip));
        chipTray.appendChild(chip);
      });
      this.el.chipTray = chipTray;

      const betSpot = this._div('bj-bet-spot');
      const betStack = this._div('bj-bet-stack');
      betSpot.appendChild(betStack);
      this.el.betSpot = betSpot;
      this.el.betStack = betStack;

      const traySection = this._div('bj-chip-tray-section');
      traySection.style.display = 'flex';
      traySection.style.gap = '26px';
      traySection.style.alignItems = 'center';
      traySection.style.flexWrap = 'wrap';
      traySection.style.justifyContent = 'center';
      traySection.appendChild(chipTray);
      traySection.appendChild(betSpot);

      const summary = this._div('bj-bet-summary');
      const betAmountSpan = document.createElement('span');
      betAmountSpan.innerHTML = 'Bet: <strong id="bj-bet-amt">$0</strong>';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'bj-btn';
      clearBtn.textContent = 'Clear Bet';
      clearBtn.style.padding = '6px 14px';
      clearBtn.style.fontSize = '0.75rem';
      summary.appendChild(betAmountSpan);
      summary.appendChild(clearBtn);
      this.el.betAmountSpan = betAmountSpan;
      this.el.clearBetBtn = clearBtn;

      const controls = this._div('bj-controls');
      const btnDefs = [
        ['deal', 'Deal', 'R', 'bj-gold'],
        ['hit', 'Hit', 'H', ''],
        ['stand', 'Stand', 'S', ''],
        ['double', 'Double', 'D', ''],
        ['split', 'Split', 'P', ''],
        ['insurance', 'Insurance', 'I', ''],
        ['surrender', 'Surrender', '', ''],
        ['newshoe', 'New Shoe', '', ''],
      ];
      btnDefs.forEach(([key, label, hint, extraClass]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bj-btn' + (extraClass ? ' ' + extraClass : '') + (key === 'deal' ? ' bj-primary' : '');
        btn.innerHTML = label + (hint ? '<span class="bj-key-hint">' + hint + '</span>' : '');
        btn.disabled = key !== 'newshoe';
        controls.appendChild(btn);
        this.buttons[key] = btn;
      });

      bar.appendChild(traySection);
      bar.appendChild(summary);
      bar.appendChild(controls);
      return bar;
    }

    _buildInsuranceModal() {
      const overlay = this._div('bj-modal-overlay');
      const modal = this._div('bj-modal');
      const h3 = document.createElement('h3');
      h3.textContent = 'Insurance?';
      const p = document.createElement('p');
      p.id = 'bj-insurance-copy';
      p.textContent = 'Dealer shows an Ace. Insurance costs half your bet and pays 2:1 if the dealer has Blackjack.';
      const controls = this._div('bj-controls');
      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.className = 'bj-btn bj-gold';
      acceptBtn.textContent = 'Take Insurance';
      const declineBtn = document.createElement('button');
      declineBtn.type = 'button';
      declineBtn.className = 'bj-btn';
      declineBtn.textContent = 'No Insurance';
      controls.appendChild(acceptBtn);
      controls.appendChild(declineBtn);
      modal.appendChild(h3);
      modal.appendChild(p);
      modal.appendChild(controls);
      overlay.appendChild(modal);
      this.el.insuranceOverlay = overlay;
      this.el.insuranceCopy = p;
      this.el.insuranceAcceptBtn = acceptBtn;
      this.el.insuranceDeclineBtn = declineBtn;
      return overlay;
    }

    /* ---------- hand rendering ---------- */
    clearTable() {
      this.el.dealerCards.innerHTML = '';
      this.el.dealerScore.textContent = '';
      this.el.dealerScore.className = 'bj-score-badge';
      this.el.dealerHandWrap.classList.remove('win', 'lose', 'push', 'active');
      this.dealerCardSlots = [];
      this.el.playerHandsRow.innerHTML = '';
      this.playerHandEls = [];
    }

    ensurePlayerHandColumn(handIndex) {
      while (this.playerHandEls.length <= handIndex) {
        const wrap = this._div('bj-hand');
        const label = this._div('bj-zone-label');
        label.textContent = this.playerHandEls.length === 0 ? '' : 'Hand ' + (this.playerHandEls.length + 1);
        const cardsEl = this._div('bj-cards');
        const scoreEl = document.createElement('span');
        scoreEl.className = 'bj-score-badge';
        const betLabel = this._div('bj-bet-chip-label');
        if (label.textContent) wrap.appendChild(label);
        wrap.appendChild(cardsEl);
        wrap.appendChild(scoreEl);
        wrap.appendChild(betLabel);
        this.el.playerHandsRow.appendChild(wrap);
        this.playerHandEls.push({ wrap, cardsEl, scoreEl, betLabel, cardSlots: [] });
      }
      return this.playerHandEls[handIndex];
    }

    rebuildPlayerHandsUI(player) {
      this.el.playerHandsRow.innerHTML = '';
      this.playerHandEls = [];
      player.hands.forEach((hand, i) => {
        const col = this.ensurePlayerHandColumn(i);
        hand.cards.forEach((card) => {
          const slot = this._buildCardSlot(card, true);
          col.cardsEl.appendChild(slot);
          col.cardSlots.push(slot);
        });
        col.betLabel.textContent = fmtMoney(hand.bet);
      });
      this.highlightActiveHand(player.activeHandIndex);
    }

    _buildCardSlot(card, faceUpStatic) {
      const slot = document.createElement('div');
      slot.className = 'bj-card-slot';
      // .bj-card-motion handles the "deal-in" translate/rotate/scale animation.
      // .bj-card (nested inside) handles the 3D rotateY flip only.
      // Keeping these as two separate elements is important: CSS animations
      // and the flip transition both target the `transform` property, and if
      // they lived on the same element the deal-in animation's final
      // keyframe (a 2D transform with no rotateY) would permanently win over
      // the flip rule, leaving every card — including the dealer's hidden
      // hole card — visibly face-up as soon as it was dealt.
      const motion = document.createElement('div');
      motion.className = 'bj-card-motion';
      const cardEl = document.createElement('div');
      cardEl.className = 'bj-card';
      cardEl.dataset.cardId = card.id;
      const face = document.createElement('div');
      face.className = 'bj-card-face ' + (card.isRed ? 'bj-red' : 'bj-black');
      const symbol = SUIT_SYMBOL[card.suit];
      face.innerHTML =
        '<div class="bj-card-corner"><span>' + card.rank + '</span><span class="bj-suit-mini">' + symbol + '</span></div>' +
        '<div class="bj-card-pip">' + symbol + '</div>' +
        '<div class="bj-card-corner bj-bottom"><span>' + card.rank + '</span><span class="bj-suit-mini">' + symbol + '</span></div>';
      const back = document.createElement('div');
      back.className = 'bj-card-back';
      back.innerHTML = cardBackSVG();
      cardEl.appendChild(face);
      cardEl.appendChild(back);
      if (faceUpStatic) cardEl.classList.add('bj-flipped');
      motion.appendChild(cardEl);
      slot.appendChild(motion);
      return slot;
    }

    appendCardToHand(owner, handIndex, card) {
      const slot = this._buildCardSlot(card, false);
      if (owner === 'dealer') {
        this.el.dealerCards.appendChild(slot);
        this.dealerCardSlots.push(slot);
      } else {
        const col = this.ensurePlayerHandColumn(handIndex);
        col.cardsEl.appendChild(slot);
        col.cardSlots.push(slot);
      }
      return slot;
    }

    flipCardAt(owner, handIndex, cardIndex, animator) {
      const slot = owner === 'dealer'
        ? this.dealerCardSlots[cardIndex]
        : (this.playerHandEls[handIndex] && this.playerHandEls[handIndex].cardSlots[cardIndex]);
      if (!slot) return Promise.resolve();
      return animator.flipCard(slot.querySelector('.bj-card'));
    }

    async flipAllInHand(owner, handIndex, animator) {
      const slots = owner === 'dealer' ? this.dealerCardSlots : this.playerHandEls[handIndex].cardSlots;
      for (let i = 0; i < slots.length; i++) {
        await animator.flipCard(slots[i].querySelector('.bj-card'));
      }
    }

    /* ---------- scores ---------- */
    _applyScoreBadge(el, text, cls) {
      el.textContent = text;
      el.className = 'bj-score-badge' + (cls ? ' ' + cls : '');
    }

    updateAllScores(player, dealer) {
      player.hands.forEach((hand, i) => {
        const col = this.playerHandEls[i];
        if (!col) return;
        let cls = '';
        if (hand.isBust) cls = 'bj-bust';
        else if (hand.isBlackjack) cls = 'bj-blackjack';
        else if (hand.isSoft) cls = 'bj-soft';
        this._applyScoreBadge(col.scoreEl, hand.cards.length ? hand.displayValue : '', cls);
        col.betLabel.textContent = fmtMoney(hand.bet);
      });
      if (dealer.holeHidden && dealer.hand.cards.length) {
        const up = dealer.upCard;
        this._applyScoreBadge(this.el.dealerScore, 'Showing ' + up.rank, '');
      } else if (dealer.hand.cards.length) {
        let cls = dealer.hand.isBust ? 'bj-bust' : (dealer.hand.isBlackjack ? 'bj-blackjack' : (dealer.hand.isSoft ? 'bj-soft' : ''));
        this._applyScoreBadge(this.el.dealerScore, dealer.hand.displayValue, cls);
      } else {
        this._applyScoreBadge(this.el.dealerScore, '', '');
      }
    }

    highlightActiveHand(activeIndex) {
      this.playerHandEls.forEach((col, i) => col.wrap.classList.toggle('active', i === activeIndex));
    }

    setHandResult(handIndex, result) {
      const col = this.playerHandEls[handIndex];
      if (!col) return;
      col.wrap.classList.remove('win', 'lose', 'push', 'active');
      col.wrap.classList.add(result);
    }

    addStampToHand(handIndex, kind, owner) {
      const wrap = owner === 'dealer' ? this.el.dealerHandWrap : (this.playerHandEls[handIndex] && this.playerHandEls[handIndex].wrap);
      if (!wrap) return;
      const stamp = document.createElement('div');
      stamp.className = 'bj-stamp ' + (kind === 'bust' ? 'bj-bust-stamp' : 'bj-blackjack-stamp');
      stamp.textContent = kind === 'bust' ? 'Bust' : 'Blackjack!';
      wrap.appendChild(stamp);
      setTimeout(() => stamp.remove(), 2600);
    }

    /* ---------- betting UI ---------- */
    getShoeRect() { return this.el.shoeIcon.getBoundingClientRect(); }
    getBetSpotRect() { return this.el.betSpot.getBoundingClientRect(); }

    addChipToBetStack(value) {
      const chip = this.chips.createChip(value, false);
      const idx = this.el.betStack.children.length;
      chip.style.bottom = (idx * 4) + 'px';
      chip.style.left = (idx % 2 === 0 ? 0 : 6) + 'px';
      this.el.betStack.appendChild(chip);
    }

    clearBetStack() { this.el.betStack.innerHTML = ''; }

    updateBetDisplay(currentBet) {
      this.el.betAmountSpan.querySelector('#bj-bet-amt').textContent = fmtMoney(currentBet);
    }

    updateChipTrayAvailability(bankroll, currentBet, phase, busy) {
      const chips = this.el.chipTray.querySelectorAll('.bj-chip');
      chips.forEach((chip) => {
        const value = parseInt(chip.dataset.value, 10);
        const wouldExceed = currentBet + value > CONFIG.MAX_BET || currentBet + value > bankroll;
        chip.disabled = busy || phase !== PHASE.BETTING || wouldExceed;
      });
      this.el.clearBetBtn.disabled = busy || phase !== PHASE.BETTING || currentBet === 0;
    }

    flashBetWarning(text) {
      this.showMessage(text, 'lose');
      this.el.betSpot.style.animation = 'none';
      // eslint-disable-next-line no-unused-expressions
      this.el.betSpot.offsetHeight;
      this.el.betSpot.style.animation = '';
    }

    /* ---------- stats & bankroll ---------- */
    updateBankroll(player) {
      this.statValueEls.bankroll.textContent = fmtMoney(player.bankroll);
      const profit = player.bankroll - CONFIG.STARTING_BANKROLL;
      this.statValueEls.profit.textContent = (profit >= 0 ? '+' : '') + fmtMoney(profit);
      this.statValueEls.profit.className = 'bj-stat-value ' + (profit > 0 ? 'positive' : (profit < 0 ? 'negative' : ''));
      this.statValueEls.winnings.textContent = fmtMoney(player.stats.totalWinnings);
      this.statValueEls.wins.textContent = String(player.stats.wins);
      this.statValueEls.losses.textContent = String(player.stats.losses);
      this.statValueEls.pushes.textContent = String(player.stats.pushes);
      this.statValueEls.blackjacks.textContent = String(player.stats.blackjacks);
      this.statValueEls.streak.textContent = String(player.stats.winStreak);
      this.statValueEls.largest.textContent = fmtMoney(player.stats.largestWin);
    }

    updateShoeBadge(shoe) {
      this.el.shoeText.textContent = 'Shoe: ' + shoe.remaining + ' / ' + shoe.totalCards;
    }

    /* ---------- messages ---------- */
    showMessage(text, kind) {
      const el = this.el.messageBanner;
      el.textContent = text;
      el.className = 'bj-message-banner bj-show' + (kind === 'win' ? ' bj-win-text' : kind === 'lose' ? ' bj-lose-text' : kind === 'push' ? ' bj-push-text' : '');
    }
    hideMessage() { this.el.messageBanner.classList.remove('bj-show'); }

    /* ---------- insurance modal ---------- */
    openInsuranceModal(cost, handlers) {
      this._pendingInsurance = handlers;
      this.el.insuranceCopy.textContent = 'Dealer shows an Ace. Insurance costs ' + fmtMoney(cost) + ' and pays 2:1 if the dealer has Blackjack.';
      this.el.insuranceOverlay.classList.add('bj-open');
      this.el.insuranceAcceptBtn.onclick = () => { this._pendingInsurance && this._pendingInsurance.onAccept(); };
      this.el.insuranceDeclineBtn.onclick = () => { this._pendingInsurance && this._pendingInsurance.onDecline(); };
    }
    closeInsuranceModal() {
      this.el.insuranceOverlay.classList.remove('bj-open');
      this._pendingInsurance = null;
    }
    acceptInsuranceFromButton() { if (this._pendingInsurance) this._pendingInsurance.onAccept(); }
    declineInsuranceViaEscape() { if (this._pendingInsurance) this._pendingInsurance.onDecline(); }

    /* ---------- buttons ---------- */
    setButtonEnabled(key, enabled) {
      const btn = this.buttons[key];
      if (btn) btn.disabled = !enabled;
    }
  }

  /* ============================================================
     BLACKJACK GAME — orchestrates state, rules, and flow.
     ============================================================ */
  class BlackjackGame {
    constructor() {
      this.shoe = new Shoe(CONFIG.NUM_DECKS);
      this.player = new Player(CONFIG.STARTING_BANKROLL);
      this.dealer = new Dealer();
      this.sound = new SoundManager();
      this.chips = new ChipManager();
      this.animator = new AnimationManager(this.sound);
      this.ui = new UIManager();
      this.ui.chips = this.chips;
      this.phase = PHASE.BETTING;
      this.currentBet = 0;
      this.busy = false;
    }

    init() {
      this.ui.init();
      this.ui.updateShoeBadge(this.shoe);
      this.ui.updateBankroll(this.player);
      this.ui.updateBetDisplay(this.currentBet);
      this.ui.onChipClickHandler = (value, chip) => this.onChipClick(value, chip);
      this.bindEvents();
      this.updateButtonStates();
      this.animator.ambientParticles(this.ui.el.particleCanvas);
    }

    bindEvents() {
      const u = this.ui;
      u.buttons.deal.addEventListener('click', () => { this.sound.click(); this.dealRound(); });
      u.buttons.hit.addEventListener('click', () => { this.sound.click(); this.playerHit(); });
      u.buttons.stand.addEventListener('click', () => { this.sound.click(); this.playerStand(); });
      u.buttons.double.addEventListener('click', () => { this.sound.click(); this.playerDouble(); });
      u.buttons.split.addEventListener('click', () => { this.sound.click(); this.playerSplit(); });
      u.buttons.insurance.addEventListener('click', () => { this.sound.click(); u.acceptInsuranceFromButton(); });
      u.buttons.surrender.addEventListener('click', () => { this.sound.click(); this.playerSurrender(); });
      u.buttons.newshoe.addEventListener('click', () => { this.sound.click(); this.newShoe(); });
      u.el.clearBetBtn.addEventListener('click', () => { this.sound.click(); this.clearBet(); });
      document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    handleKeydown(e) {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'h') this._clickIfEnabled('hit');
      else if (key === 's') this._clickIfEnabled('stand');
      else if (key === 'd') this._clickIfEnabled('double');
      else if (key === 'p') this._clickIfEnabled('split');
      else if (key === 'i') this._clickIfEnabled('insurance');
      else if (key === 'r') this._clickIfEnabled('deal');
      else if (key === 'escape') { if (this.phase === PHASE.INSURANCE) this.ui.declineInsuranceViaEscape(); }
    }

    _clickIfEnabled(name) {
      const btn = this.ui.buttons[name];
      if (btn && !btn.disabled) btn.click();
    }

    /* ---------- betting ---------- */
    onChipClick(value, chipEl) {
      if (this.busy || this.phase !== PHASE.BETTING) return;
      if (this.currentBet + value > CONFIG.MAX_BET) { this.ui.flashBetWarning('Maximum bet is ' + fmtMoney(CONFIG.MAX_BET) + '.'); return; }
      if (this.currentBet + value > this.player.bankroll) { this.ui.flashBetWarning('Not enough bankroll for that bet.'); return; }
      this.currentBet += value;
      this.sound.chip();
      const fromRect = chipEl.getBoundingClientRect();
      const toRect = this.ui.getBetSpotRect();
      this.chips.flyChip(value, fromRect, toRect, () => this.ui.addChipToBetStack(value));
      this.ui.updateBetDisplay(this.currentBet);
      this.updateButtonStates();
    }

    clearBet() {
      if (this.busy || this.phase !== PHASE.BETTING) return;
      this.currentBet = 0;
      this.ui.clearBetStack();
      this.ui.updateBetDisplay(this.currentBet);
      this.updateButtonStates();
    }

    /* ---------- dealing ---------- */
    async dealRound() {
      if (this.busy || this.phase !== PHASE.BETTING) return;
      if (this.currentBet < CONFIG.MIN_BET) { this.ui.flashBetWarning('Minimum bet is ' + fmtMoney(CONFIG.MIN_BET) + '.'); return; }
      this.busy = true;
      this.phase = PHASE.DEALING;
      this.updateButtonStates();
      this.ui.hideMessage();

      if (this.shoe.needsReshuffle()) {
        this.ui.showMessage('Reshuffling the shoe\u2026', 'push');
        this.shoe.build();
        this.ui.updateShoeBadge(this.shoe);
        this.sound.chip();
        await wait(650);
        this.ui.hideMessage();
      }

      this.player.resetHands();
      const hand = new Hand({ bet: this.currentBet });
      this.player.hands.push(hand);
      this.player.activeHandIndex = 0;
      this.player.bankroll -= this.currentBet;
      this.dealer.reset();
      this.ui.clearTable();
      this.ui.updateBankroll(this.player);
      this.ui.ensurePlayerHandColumn(0);
      this.ui.updateBetDisplay(this.currentBet);

      const shoeRect = this.ui.getShoeRect();
      await this._dealCardTo(hand, shoeRect);
      await this._dealCardTo(this.dealer.hand, shoeRect);
      await this._dealCardTo(hand, shoeRect);
      await this._dealCardTo(this.dealer.hand, shoeRect);

      await this.ui.flipAllInHand('player', 0, this.animator);
      await this.ui.flipCardAt('dealer', null, 0, this.animator);
      this.ui.updateAllScores(this.player, this.dealer);

      if (hand.isBlackjack) this.ui.addStampToHand(0, 'blackjack');

      let dealerHasBJ = false;
      if (this.dealer.upCard.isAce) {
        await this._offerInsurance();
        dealerHasBJ = this.dealer.hand.isBlackjack;
        this._settleInsurance(dealerHasBJ);
      } else if (this.dealer.upCard.baseValue === 10) {
        dealerHasBJ = this.dealer.hand.isBlackjack;
      }

      if (dealerHasBJ || hand.isBlackjack) {
        await this.ui.flipCardAt('dealer', null, 1, this.animator);
        this.dealer.holeHidden = false;
        this.ui.updateAllScores(this.player, this.dealer);
        this.busy = false;
        await this._resolveRound();
        return;
      }

      this.phase = PHASE.PLAYER_TURN;
      this.busy = false;
      this.updateButtonStates();
    }

    async _dealCardTo(hand, shoeRect) {
      const card = this.shoe.draw();
      hand.addCard(card);
      const owner = hand === this.dealer.hand ? 'dealer' : 'player';
      const handIndex = owner === 'dealer' ? null : this.player.hands.indexOf(hand);
      const slot = this.ui.appendCardToHand(owner, handIndex, card);
      await this.animator.dealCard(slot, shoeRect);
      this.ui.updateShoeBadge(this.shoe);
      return card;
    }

    _offerInsurance() {
      return new Promise((resolve) => {
        const hand = this.player.hands[0];
        const cost = Math.min(hand.bet / 2, this.player.bankroll);
        if (cost <= 0) { resolve(); return; }
        this.phase = PHASE.INSURANCE;
        this.updateButtonStates();
        this.ui.openInsuranceModal(cost, {
          onAccept: () => {
            this.player.bankroll -= cost;
            this.player.insuranceBet = cost;
            this.ui.updateBankroll(this.player);
            this.ui.closeInsuranceModal();
            this.sound.chip();
            resolve();
          },
          onDecline: () => {
            this.player.insuranceBet = 0;
            this.ui.closeInsuranceModal();
            resolve();
          },
        });
      });
    }

    _settleInsurance(dealerHasBJ) {
      if (this.player.insuranceBet > 0) {
        if (dealerHasBJ) {
          const stake = this.player.insuranceBet;
          this.player.bankroll += stake * 3;
          this.player.stats.totalWinnings += stake * 2;
          this.ui.showMessage('Insurance pays 2:1!', 'win');
        } else {
          this.ui.showMessage('Insurance lost.', 'lose');
        }
        this.player.insuranceBet = 0;
        this.ui.updateBankroll(this.player);
      }
    }

    /* ---------- player actions ---------- */
    playerHit() {
      if (this.busy || this.phase !== PHASE.PLAYER_TURN) return;
      const hand = this.player.activeHand;
      if (!hand.canHit) return;
      this.busy = true;
      this.updateButtonStates();
      (async () => {
        const shoeRect = this.ui.getShoeRect();
        await this._dealCardTo(hand, shoeRect);
        await this.ui.flipCardAt('player', this.player.activeHandIndex, hand.cards.length - 1, this.animator);
        this.ui.updateAllScores(this.player, this.dealer);
        if (hand.isBust) {
          hand.isDone = true;
          this.ui.addStampToHand(this.player.activeHandIndex, 'bust');
          this.sound.bust();
        } else if (hand.value === 21) {
          hand.isDone = true;
        }
        this.busy = false;
        this._advanceOrFinish();
      })();
    }

    playerStand() {
      if (this.busy || this.phase !== PHASE.PLAYER_TURN) return;
      const hand = this.player.activeHand;
      if (hand.isDone) return;
      hand.isDone = true;
      this._moveToNextHandOrDealer();
    }

    playerDouble() {
      if (this.busy || this.phase !== PHASE.PLAYER_TURN) return;
      const hand = this.player.activeHand;
      if (!hand.canDouble || this.player.bankroll < hand.bet) return;
      this.busy = true;
      this.updateButtonStates();
      (async () => {
        this.player.bankroll -= hand.bet;
        hand.bet *= 2;
        hand.isDoubled = true;
        this.ui.updateBankroll(this.player);
        this.sound.chip();
        const shoeRect = this.ui.getShoeRect();
        await this._dealCardTo(hand, shoeRect);
        await this.ui.flipCardAt('player', this.player.activeHandIndex, hand.cards.length - 1, this.animator);
        this.ui.updateAllScores(this.player, this.dealer);
        hand.isDone = true;
        if (hand.isBust) { this.ui.addStampToHand(this.player.activeHandIndex, 'bust'); this.sound.bust(); }
        this.busy = false;
        this._moveToNextHandOrDealer();
      })();
    }

    playerSplit() {
      if (this.busy || this.phase !== PHASE.PLAYER_TURN) return;
      const hand = this.player.activeHand;
      if (!this._canSplitHand(hand)) return;
      this.busy = true;
      this.updateButtonStates();
      (async () => {
        const idx = this.player.activeHandIndex;
        const movedCard = hand.cards.pop();
        const wasAces = movedCard.isAce && hand.cards[0].isAce;
        hand.fromSplit = true;
        hand.fromSplitAces = wasAces;
        const newHand = new Hand({ bet: hand.bet, fromSplit: true, fromSplitAces: wasAces });
        newHand.addCard(movedCard);
        this.player.bankroll -= hand.bet;
        this.player.hands.splice(idx + 1, 0, newHand);
        this.ui.updateBankroll(this.player);
        this.ui.rebuildPlayerHandsUI(this.player);
        this.sound.chip();

        const shoeRect = this.ui.getShoeRect();
        await this._dealCardTo(hand, shoeRect);
        await this.ui.flipCardAt('player', idx, hand.cards.length - 1, this.animator);
        if (hand.fromSplitAces) hand.isDone = true;
        this.ui.updateAllScores(this.player, this.dealer);
        if (hand.isBust) { this.ui.addStampToHand(idx, 'bust'); this.sound.bust(); hand.isDone = true; }

        await this._dealCardTo(newHand, shoeRect);
        await this.ui.flipCardAt('player', idx + 1, newHand.cards.length - 1, this.animator);
        if (newHand.fromSplitAces) newHand.isDone = true;
        this.ui.updateAllScores(this.player, this.dealer);
        if (newHand.isBust) { this.ui.addStampToHand(idx + 1, 'bust'); this.sound.bust(); newHand.isDone = true; }

        this.busy = false;
        this._advanceOrFinish();
      })();
    }

    playerSurrender() {
      if (this.busy || this.phase !== PHASE.PLAYER_TURN) return;
      const hand = this.player.activeHand;
      if (!this._canSurrenderHand(hand)) return;
      hand.isSurrendered = true;
      hand.isDone = true;
      const refund = hand.bet / 2;
      this.player.bankroll += refund;
      this.ui.updateBankroll(this.player);
      this.ui.showMessage('Hand surrendered \u2014 half the bet returned.', 'lose');
      this._moveToNextHandOrDealer();
    }

    _canSplitHand(hand) {
      return hand.cards.length === 2 &&
        hand.cards[0].baseValue === hand.cards[1].baseValue &&
        !hand.isDoubled && !hand.fromSplitAces &&
        (this.player.hands.length - 1) < CONFIG.MAX_RESPLITS &&
        this.player.bankroll >= hand.bet;
    }

    _canSurrenderHand(hand) {
      return this.player.hands.length === 1 && hand.cards.length === 2 &&
        !hand.fromSplit && !hand.isDoubled && !hand.isDone;
    }

    _advanceOrFinish() {
      const hand = this.player.activeHand;
      if (hand.isDone) this._moveToNextHandOrDealer();
      else this.updateButtonStates();
    }

    _moveToNextHandOrDealer() {
      const hands = this.player.hands;
      let next = -1;
      for (let i = this.player.activeHandIndex + 1; i < hands.length; i++) {
        if (!hands[i].isDone) { next = i; break; }
      }
      if (next === -1) {
        for (let i = 0; i < hands.length; i++) {
          if (!hands[i].isDone) { next = i; break; }
        }
      }
      if (next === -1) {
        this._beginDealerTurn();
      } else {
        this.player.activeHandIndex = next;
        this.ui.highlightActiveHand(next);
        this.updateButtonStates();
      }
    }

    /* ---------- dealer turn & resolution ---------- */
    async _beginDealerTurn() {
      this.phase = PHASE.DEALER_TURN;
      this.updateButtonStates();
      this.ui.highlightActiveHand(-1);

      if (this.dealer.holeHidden) {
        await this.ui.flipCardAt('dealer', null, 1, this.animator);
        this.dealer.holeHidden = false;
        this.ui.updateAllScores(this.player, this.dealer);
      }

      const liveHands = this.player.hands.some((h) => !h.isBust && !h.isSurrendered);
      if (liveHands) {
        const shoeRect = this.ui.getShoeRect();
        while (this.dealer.shouldHit()) {
          await this._dealCardTo(this.dealer.hand, shoeRect);
          await this.ui.flipCardAt('dealer', null, this.dealer.hand.cards.length - 1, this.animator);
          this.ui.updateAllScores(this.player, this.dealer);
        }
        if (this.dealer.hand.isBust) {
          this.sound.bust();
          this.ui.addStampToHand(null, 'bust', 'dealer');
        }
      }
      await this._resolveRound();
    }

    async _resolveRound() {
      this.phase = PHASE.RESOLUTION;
      this.updateButtonStates();

      const dealerVal = this.dealer.hand.value;
      const dealerBust = this.dealer.hand.isBust;
      const dealerBJ = this.dealer.hand.isBlackjack;
      const messages = [];
      let anyBigWin = false;

      this.player.hands.forEach((hand, i) => {
        let result, label, profit = 0;
        if (hand.isSurrendered) {
          result = 'lose'; label = 'Surrendered';
        } else if (hand.isBust) {
          result = 'lose'; label = 'Bust';
        } else if (hand.isBlackjack) {
          if (dealerBJ) { result = 'push'; this.player.bankroll += hand.bet; label = 'Push \u2014 both Blackjack'; }
          else {
            profit = hand.bet * CONFIG.BLACKJACK_PAYOUT;
            this.player.bankroll += hand.bet + profit;
            result = 'win'; label = 'Blackjack! +' + fmtMoney(profit);
            this.player.stats.blackjacks++;
          }
        } else if (dealerBJ) {
          result = 'lose'; label = 'Dealer Blackjack';
        } else if (dealerBust) {
          profit = hand.bet; this.player.bankroll += hand.bet * 2; result = 'win'; label = 'Dealer busts! +' + fmtMoney(profit);
        } else if (hand.value > dealerVal) {
          profit = hand.bet; this.player.bankroll += hand.bet * 2; result = 'win'; label = '+' + fmtMoney(profit);
        } else if (hand.value === dealerVal) {
          result = 'push'; this.player.bankroll += hand.bet; label = 'Push';
        } else {
          result = 'lose'; label = 'Lose';
        }

        hand.result = result;
        if (result === 'win') {
          this.player.stats.wins++;
          this.player.stats.winStreak++;
          this.player.stats.totalWinnings += profit;
          this.player.stats.largestWin = Math.max(this.player.stats.largestWin, profit);
          if (hand.isBlackjack || profit >= Math.max(100, hand.bet)) anyBigWin = true;
        } else if (result === 'lose') {
          this.player.stats.losses++;
          this.player.stats.winStreak = 0;
        } else {
          this.player.stats.pushes++;
        }
        this.ui.setHandResult(i, result);
        const prefix = this.player.hands.length > 1 ? 'Hand ' + (i + 1) + ': ' : '';
        messages.push(prefix + label);
      });

      this.player.stats.roundsPlayed++;
      this.ui.updateBankroll(this.player);

      const overall = messages.join('   \u00B7   ');
      const anyWin = this.player.hands.some((h) => h.result === 'win');
      const allPush = this.player.hands.every((h) => h.result === 'push');
      const bannerKind = anyWin ? 'win' : (allPush ? 'push' : 'lose');
      this.ui.showMessage(overall, bannerKind);

      if (bannerKind === 'win') this.sound.win(); else if (bannerKind === 'lose') this.sound.lose(); else this.sound.chip();
      if (anyBigWin) {
        this.animator.confetti(this.ui.el.confettiCanvas);
        this.sound.blackjack();
      }

      setTimeout(() => this._prepareNextRound(), CONFIG.NEXT_ROUND_DELAY_MS);
    }

    _prepareNextRound() {
      this.player.resetHands();
      this.dealer.reset();
      this.currentBet = 0;
      this.phase = PHASE.BETTING;
      this.ui.clearTable();
      this.ui.clearBetStack();
      this.ui.updateBetDisplay(this.currentBet);
      this.ui.hideMessage();
      if (this.player.bankroll < CONFIG.MIN_BET) {
        this.ui.showMessage('Bankroll too low to continue \u2014 click "New Shoe" to reset your bankroll.', 'lose');
      }
      this.updateButtonStates();
    }

    newShoe() {
      if (this.busy || this.phase !== PHASE.BETTING) return;
      this.shoe.build();
      this.ui.updateShoeBadge(this.shoe);
      this.sound.chip();
      if (this.player.bankroll < CONFIG.MIN_BET) {
        this.player.bankroll = CONFIG.STARTING_BANKROLL;
        this.ui.updateBankroll(this.player);
        this.ui.showMessage('New shoe shuffled in. Bankroll reset to ' + fmtMoney(CONFIG.STARTING_BANKROLL) + '.', 'win');
      } else {
        this.ui.showMessage('New shoe shuffled in.', 'push');
      }
    }

    /* ---------- button state machine ---------- */
    updateButtonStates() {
      const p = this.phase;
      const hand = this.player.hands[this.player.activeHandIndex];
      this.ui.setButtonEnabled('deal', p === PHASE.BETTING && this.currentBet >= CONFIG.MIN_BET && !this.busy);
      this.ui.setButtonEnabled('hit', p === PHASE.PLAYER_TURN && !!hand && hand.canHit && !this.busy);
      this.ui.setButtonEnabled('stand', p === PHASE.PLAYER_TURN && !!hand && !hand.isDone && !this.busy);
      this.ui.setButtonEnabled('double', p === PHASE.PLAYER_TURN && !!hand && hand.canDouble && this.player.bankroll >= (hand ? hand.bet : Infinity) && !this.busy);
      this.ui.setButtonEnabled('split', p === PHASE.PLAYER_TURN && !!hand && this._canSplitHand(hand) && !this.busy);
      this.ui.setButtonEnabled('insurance', p === PHASE.INSURANCE && !this.busy);
      this.ui.setButtonEnabled('surrender', p === PHASE.PLAYER_TURN && !!hand && this._canSurrenderHand(hand) && !this.busy);
      this.ui.setButtonEnabled('newshoe', p === PHASE.BETTING && !this.busy);
      this.ui.updateChipTrayAvailability(this.player.bankroll, this.currentBet, p, this.busy);
    }
  }

  /* ============================================================
     BOOTSTRAP
     ============================================================ */
  function start() {
    const game = new BlackjackGame();
    game.init();
    window.__blackjackGame = game; // exposed for debugging only
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();