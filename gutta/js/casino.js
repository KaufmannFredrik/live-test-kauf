/* =========================================================
   GUTTA KASINO — casino.js
   Felles motor for alle kasinospillene: tilfeldighet, kort,
   sjetonger, AI-gutta, snakkebobler, dialoger og animasjoner.
   Bruker Wallet / Stats / Achievements / GuttaSFX fra common.js.
   ========================================================= */
const Casino = (() => {
  'use strict';

  /* ---------- tempo ----------
     Alle pauser i spillene går gjennom wait(), så hele kasinoet kan
     kjøres raskere ("Rask"-knappen) eller nesten uten pauser (?fast i
     adressen, brukes til automatiske tester). */
  const params = new URLSearchParams(location.search);
  let speed = params.has('fast') ? 0.002 : (Store.get('gutta_casino_speed', 1) || 1);
  function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms * speed)); }
  function setSpeed(s) { speed = s; if (!params.has('fast')) Store.set('gutta_casino_speed', s); }

  /* Venter på en Web Animation, men aldri lenger enn varigheten + litt.
     Nettlesere pauser animasjoner i bakgrunnsfaner; da skal spillet
     likevel gå videre i stedet for å henge. */
  function settled(anim, ms) {
    return Promise.race([
      anim.finished.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, ms + 80))
    ]).then(() => { try { anim.finish(); } catch (e) { /* allerede ferdig */ } });
  }

  /* ---------- rettferdig tilfeldighet (crypto) ---------- */
  const buf = new Uint32Array(1);
  function randInt(n) {
    if (n <= 1) return 0;
    if (window.crypto && crypto.getRandomValues) {
      const limit = Math.floor(0x100000000 / n) * n;
      let x;
      do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------- kort ---------- */
  const SUITS = ['s', 'h', 'd', 'c'];
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_NAME = { s: 'spar', h: 'hjerter', d: 'ruter', c: 'kløver' };
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let cardUid = 0;
  function makeCard(rank, suit) {
    return { rank, suit, value: RANKS.indexOf(rank) + 2, id: 'k' + (++cardUid) };
  }
  function makeDeck(decks) {
    const out = [];
    for (let d = 0; d < (decks || 1); d++) for (const s of SUITS) for (const r of RANKS) out.push(makeCard(r, s));
    return out;
  }
  function isRed(card) { return card.suit === 'h' || card.suit === 'd'; }
  function cardLabel(card) { return card.rank + SUIT_SYMBOL[card.suit]; }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* Bygger et kort. Uten kort (null) blir det et ukjent kort med baksiden opp. */
  function cardEl(card, opts) {
    opts = opts || {};
    const c = el('div', 'pcard' + (opts.mini ? ' mini' : '') + (opts.up && card ? ' up' : ''));
    const inner = el('div', 'pcard-inner');
    const back = el('div', 'pcard-back');
    if (card) {
      const sym = SUIT_SYMBOL[card.suit];
      const face = el('div', 'pcard-face ' + (isRed(card) ? 'red' : 'black'));
      const corner = '<b>' + card.rank + '</b><i>' + sym + '</i>';
      const isFace = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
      face.innerHTML =
        '<span class="pc-corner tl">' + corner + '</span>' +
        (isFace ? '<span class="pc-pip face">' + card.rank + '<i>' + sym + '</i></span>'
                : '<span class="pc-pip' + (card.rank === 'A' ? ' ace' : '') + '">' + sym + '</span>') +
        '<span class="pc-corner br">' + corner + '</span>';
      face.setAttribute('aria-label', card.rank + ' ' + SUIT_NAME[card.suit]);
      inner.appendChild(face);
      c.dataset.id = card.id;
    }
    inner.appendChild(back);
    c.appendChild(inner);
    return c;
  }

  /* Legger et ekte kort inn i et ukjent kort (brukes når AI-kort vises ved showdown). */
  function revealInto(cEl, card) {
    if (!cEl.querySelector('.pcard-face')) {
      const fresh = cardEl(card, { mini: cEl.classList.contains('mini') });
      cEl.replaceChildren(...fresh.childNodes);
      cEl.dataset.id = card.id;
      void cEl.offsetWidth;
    }
    cEl.classList.add('up');
  }

  function setFaceUp(cEl, up) {
    if (up) GuttaSFX.cardFlip();
    cEl.classList.toggle('up', !!up);
    return wait(380);
  }

  /* Sklir et element inn fra et annet elements posisjon (FLIP med Web Animations). */
  function flyFrom(target, fromEl, ms) {
    if (!fromEl || !target.animate || speed < 0.01) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!b.width) return Promise.resolve();
    const dx = (a.left + a.width / 2) - (b.left + b.width / 2);
    const dy = (a.top + a.height / 2) - (b.top + b.height / 2);
    const rot = (Math.random() * 30 - 15).toFixed(1);
    const dur = (ms || 420) * speed;
    const anim = target.animate([
      { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg) scale(0.6)', opacity: 0.2 },
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 }
    ], { duration: dur, easing: 'cubic-bezier(.22,.9,.32,1.08)' });
    return settled(anim, dur);
  }

  async function dealTo(container, card, opts) {
    opts = opts || {};
    const cEl = cardEl(card, { mini: opts.mini });
    container.appendChild(cEl);
    GuttaSFX.cardDeal();
    await flyFrom(cEl, opts.from, opts.ms || 300);
    if (opts.up && card) {
      // the flip finishes on its own; the next card can start flying meanwhile
      GuttaSFX.cardFlip();
      cEl.classList.add('up');
      await wait(opts.flipWait == null ? 110 : opts.flipWait);
    }
    return cEl;
  }

  /* ---------- sjetonger ---------- */
  const CHIP_COLORS = { 1: '#d8d2c0', 5: '#e6432f', 10: '#2694c9', 25: '#3fae5a', 50: '#f08a24', 100: '#2b2b2b', 500: '#7a3ea1', 1000: '#f4a825', 5000: '#c41e6a' };
  const CHIP_DENOMS = [5000, 1000, 500, 100, 50, 25, 10, 5, 1];
  function chipLabel(v) { return v >= 1000 ? (v / 1000) + 'k' : String(v); }
  function chipColor(v) {
    for (const d of CHIP_DENOMS) if (v >= d) return CHIP_COLORS[d];
    return CHIP_COLORS[1];
  }

  function chipEl(value, opts) {
    opts = opts || {};
    const c = el(opts.button ? 'button' : 'div', 'chip' + (opts.small ? ' small' : ''));
    if (opts.button) { c.type = 'button'; c.setAttribute('aria-label', 'Sjetong ' + value); }
    c.style.setProperty('--chip', chipColor(value));
    c.dataset.v = value;
    c.innerHTML = '<span>' + chipLabel(value) + '</span>';
    return c;
  }

  /* En liten stabel som viser et beløp (brukes til innsatser på bordet). */
  function chipPile(amount, opts) {
    opts = opts || {};
    const pile = el('div', 'chip-pile' + (opts.small ? ' small' : ''));
    const chips = el('div', 'pile-chips');
    let rest = Math.round(amount);
    const parts = [];
    for (const d of CHIP_DENOMS) { while (rest >= d && parts.length < 6) { parts.push(d); rest -= d; } }
    if (!parts.length && amount > 0) parts.push(1);
    // biggest chips at the bottom of the stack
    parts.forEach((v) => {
      const c = chipEl(v, { small: true });
      c.innerHTML = '';
      chips.appendChild(c);
    });
    pile.appendChild(chips);
    if (opts.label !== false) pile.appendChild(el('span', 'pile-label', fmtChips(amount)));
    return pile;
  }

  function flyChip(value, fromEl, toEl, ms) {
    if (!fromEl || !toEl || speed < 0.01) return Promise.resolve();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const c = chipEl(value, { small: true });
    c.classList.add('flying');
    c.style.left = (a.left + a.width / 2 - 14) + 'px';
    c.style.top = (a.top + a.height / 2 - 14) + 'px';
    document.body.appendChild(c);
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    const dur = (ms || 450) * speed;
    const anim = c.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 40) + 'px) scale(1.15)', offset: 0.5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.9)' }
    ], { duration: dur, easing: 'cubic-bezier(.3,.6,.3,1)' });
    return settled(anim, dur).then(() => c.remove());
  }

  function fmtChips(n) { return Math.round(n).toLocaleString('nb-NO'); }

  /* ---------- AI-gutta ---------- */
  const BOT_ROSTER = [
    { name: 'Kjetil', avatar: '🧔', color: '#e6432f' },
    { name: 'Sindre', avatar: '😎', color: '#2694c9' },
    { name: 'Magnus', avatar: '🤠', color: '#3fae5a' },
    { name: 'Henrik', avatar: '🎩', color: '#7a3ea1' },
    { name: 'Jonas', avatar: '🧢', color: '#f08a24' },
    { name: 'Eirik', avatar: '🥸', color: '#c96a1a' },
    { name: 'Torstein', avatar: '🦊', color: '#ffb92e' },
    { name: 'Ola', avatar: '🍺', color: '#5fd17a' }
  ];
  function pickBots(n) { return shuffle(BOT_ROSTER.slice()).slice(0, n).map((b) => Object.assign({}, b)); }

  function speak(anchor, text, ms, opts) {
    if (!anchor) return;
    opts = opts || {};
    const old = anchor.querySelector(':scope > .say');
    if (old) old.remove();
    const b = el('div', 'say' + (opts.below ? ' below' : '') + (opts.cls ? ' ' + opts.cls : ''));
    b.textContent = text;
    anchor.appendChild(b);
    setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 260); }, Math.max(900, (ms || 1900) * Math.max(speed, 0.5)));
  }

  /* ---------- dialoger ---------- */
  function modal(opts) {
    return new Promise((resolve) => {
      const overlay = el('div', 'modal-overlay casino-modal');
      const box = el('div', 'modal' + (opts.wide ? ' wide' : ''));
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.innerHTML = (opts.icon ? '<div class="modal-icon">' + opts.icon + '</div>' : '') +
        (opts.title ? '<h2>' + opts.title + '</h2>' : '') + (opts.html || '');
      const actions = el('div', 'modal-actions');
      (opts.actions || [{ label: 'OK', value: true }]).forEach((a) => {
        if (a.href) {
          const link = el('a', 'btn small ' + (a.cls || ''), a.label);
          link.href = a.href;
          actions.appendChild(link);
          return;
        }
        const b = el('button', 'btn small ' + (a.cls || ''), a.label);
        b.type = 'button';
        b.addEventListener('click', () => close(a.value));
        actions.appendChild(b);
      });
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));
      const first = actions.querySelector('button');
      if (first) setTimeout(() => first.focus(), 60);
      function onKey(e) { if (e.key === 'Escape' && opts.dismissValue !== undefined) close(opts.dismissValue); }
      document.addEventListener('keydown', onKey);
      if (opts.dismissValue !== undefined) overlay.addEventListener('click', (e) => { if (e.target === overlay) close(opts.dismissValue); });
      function close(v) {
        document.removeEventListener('keydown', onKey);
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 260);
        resolve(v);
      }
    });
  }

  /* Oppsettdialog med valgknapper. fields: [{key,label,options:[{value,label,desc}],value}]
     validate(values) kan returnere {key: [verdier som skal deaktiveres]} for avhengigheter. */
  function setupDialog(opts) {
    return new Promise((resolve) => {
      const values = {};
      opts.fields.forEach((f) => { values[f.key] = f.value; });
      const overlay = el('div', 'modal-overlay casino-modal');
      const box = el('div', 'modal setup');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.innerHTML = (opts.icon ? '<div class="modal-icon">' + opts.icon + '</div>' : '') +
        '<h2>' + opts.title + '</h2>' + (opts.intro ? '<p class="setup-intro">' + opts.intro + '</p>' : '');
      const groups = {};
      opts.fields.forEach((f) => {
        const lab = el('span', 'choice-label', f.label);
        const row = el('div', 'choice-row' + (f.compact ? ' compact' : ''));
        row.setAttribute('role', 'radiogroup');
        row.setAttribute('aria-label', f.label);
        groups[f.key] = [];
        f.options.forEach((o) => {
          const b = el('button', 'choice', '<strong>' + o.label + '</strong>' + (o.desc ? '<span>' + o.desc + '</span>' : ''));
          b.type = 'button';
          b.setAttribute('role', 'radio');
          b.addEventListener('click', () => { values[f.key] = o.value; GuttaSFX.click(); paint(); });
          groups[f.key].push({ b, o });
          row.appendChild(b);
        });
        box.appendChild(lab);
        box.appendChild(row);
      });
      const note = el('p', 'setup-note', opts.note || '');
      box.appendChild(note);
      const actions = el('div', 'modal-actions');
      const start = el('button', 'btn', opts.startLabel || 'Start');
      start.type = 'button';
      actions.appendChild(start);
      if (opts.backHref) {
        const back = el('a', 'btn small ghost', opts.backLabel || '← Lobbyen');
        back.href = opts.backHref;
        actions.appendChild(back);
      }
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      function paint() {
        const disabled = opts.validate ? (opts.validate(values) || {}) : {};
        Object.keys(groups).forEach((k) => {
          const dis = disabled[k] || [];
          groups[k].forEach(({ b, o }) => {
            b.disabled = dis.indexOf(o.value) !== -1;
            if (b.disabled && values[k] === o.value) {
              const firstOk = groups[k].find((g) => dis.indexOf(g.o.value) === -1);
              if (firstOk) values[k] = firstOk.o.value;
            }
          });
          groups[k].forEach(({ b, o }) => {
            b.classList.toggle('selected', values[k] === o.value);
            b.setAttribute('aria-checked', String(values[k] === o.value));
          });
        });
        const n = opts.describe ? opts.describe(values) : '';
        note.innerHTML = n || '';
        note.style.display = n ? '' : 'none';
        const err = opts.canStart ? opts.canStart(values) : null;
        start.disabled = !!err;
        start.title = err || '';
      }
      start.addEventListener('click', () => {
        GuttaSFX.chips();
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 260);
        resolve(values);
      });
      paint();
      setTimeout(() => start.focus(), 80);
    });
  }

  /* Resultatliste for turneringer: rows [{name, avatar, amount, you}] sortert. */
  function standingsHtml(rows, unit) {
    return '<ol class="standings">' + rows.map((r, i) =>
      '<li class="' + (r.you ? 'you' : '') + '"><span class="pos">' + (i === 0 ? '🏆' : (i + 1) + '.') + '</span>' +
      '<span class="who">' + (r.avatar || '') + ' ' + escapeHtml(r.name) + '</span>' +
      '<span class="amt">' + fmtChips(r.amount) + (unit ? ' ' + unit : '') + '</span></li>').join('') + '</ol>';
  }

  /* ---------- spillstatistikk ---------- */
  function recordResult(game, net) {
    Stats.add(game + '.net', Math.round(net));
    if (net > 0) {
      Stats.add(game + '.wins');
      Stats.max(game + '.best', Math.round(net));
      Achievements.unlock('first_win');
    }
  }

  /* Liten flytende "+50"-tekst over et element. */
  function floatText(anchor, text, cls) {
    if (!anchor) return;
    const f = el('div', 'float-text ' + (cls || ''), text);
    anchor.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }

  /* Sørg for at lommeboka har penger før et nytt spill. */
  async function ensureFunds(min) {
    if (Wallet.balance >= min) return true;
    const canLoan = Wallet.canBorrow();
    const v = await modal({
      icon: '🪫',
      title: 'Tom lommebok',
      html: '<p>Du har ' + formatGK(Wallet.balance) + ', men trenger minst ' + formatGK(min) + '.</p>' +
        (canLoan ? '<p>Mamma kan låne deg ' + formatGK(Wallet.LOAN) + '. Hun spør ikke hva det skal brukes til.</p>' : '<p>Hent daglig bonus i lobbyen, eller tjen GK i Ølsnake.</p>'),
      actions: canLoan ? [{ label: '💌 Ta mammalån', value: 'loan' }, { label: 'Til lobbyen', href: 'kasino.html', cls: 'ghost' }]
                       : [{ label: 'Til lobbyen', href: 'kasino.html' }]
    });
    if (v === 'loan') { Wallet.borrow(); GuttaSFX.coin(); }
    return Wallet.balance >= min;
  }

  return {
    wait, setSpeed, settled, get speed() { return speed; },
    randInt, shuffle, pick, chance, clamp, el,
    SUITS, SUIT_SYMBOL, SUIT_NAME, RANKS, makeCard, makeDeck, isRed, cardLabel,
    cardEl, revealInto, setFaceUp, flyFrom, dealTo,
    CHIP_COLORS, chipEl, chipPile, chipColor, chipLabel, flyChip, fmtChips,
    BOT_ROSTER, pickBots, speak, modal, setupDialog, standingsHtml,
    recordResult, floatText, ensureFunds
  };
})();
