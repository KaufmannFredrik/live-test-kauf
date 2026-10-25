/* =========================================================
   GUTTA.NO — common.js
   Felles for hele siden: meny, lommebok (Gutta-kroner),
   prestasjoner, innstillinger, lyd-motor, toast og konfetti.
   Lastes som vanlig <script> nederst i <body> på hver side,
   så alt fungerer også når filene åpnes direkte fra disk.
   ========================================================= */

// ---------- Lagring (localStorage med trygg fallback) ----------
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* privat modus o.l. */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignorer */ }
  }
};

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function formatGK(n) {
  return Math.round(n).toLocaleString('nb-NO') + ' GK';
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// ---------- Innstillinger (lyd, drikkemodus) ----------
const Settings = (() => {
  const KEY = 'gutta_settings';
  const s = Object.assign({ sound: true, drink: false }, Store.get(KEY, {}));
  return {
    get(k) { return s[k]; },
    set(k, v) {
      s[k] = v;
      Store.set(KEY, s);
      document.dispatchEvent(new CustomEvent('gutta:settings', { detail: { key: k, value: v } }));
    }
  };
})();

/* =========================================================
   PROCEDURAL SOUND ENGINE (Web Audio API)
   Genererer alle lyder live — promper, ølklink, jubel, men
   også kasinolyder som kortutdeling, sjetonger og rulettkule.
   Ingen lydfiler. Alt går gjennom én master-gain, og ingenting
   spilles når lyden er skrudd av.
   ========================================================= */
const GuttaSFX = (() => {
  let ctx = null;
  let master = null;
  const noiseCache = {};

  function ready() {
    if (!Settings.get('sound')) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.7;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function noiseBuffer(duration, c) {
    const key = Math.round(duration * 1000);
    if (noiseCache[key]) return noiseCache[key];
    const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * duration)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache[key] = buffer;
    return buffer;
  }

  function tone(freq, dur, type, gain, delay, slideTo) {
    const c = ready(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(gain || 0.1, 0.001), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, filterType, freq, gain, delay, q) {
    const c = ready(); if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur, c);
    const f = c.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.value = freq || 1000;
    if (q) f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  /* ---------- Gutta-lydene ---------- */
  function fart() {
    const c = ready(); if (!c) return;
    const dur = 0.9 + Math.random() * 0.5;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur, c);
    const bandpass = c.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(120, c.currentTime);
    bandpass.frequency.exponentialRampToValueAtTime(60, c.currentTime + dur);
    bandpass.Q.value = 4;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.9, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 18 + Math.random() * 12;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(bandpass.frequency);
    lfo.start(); lfo.stop(c.currentTime + dur);
    src.connect(bandpass).connect(gain).connect(master);
    src.start();
  }

  function beerCrack() {
    noise(0.6, 'highpass', 3000, 0.5);
    tone(900, 0.1, 'square', 0.5, 0, 80);
  }

  function glassClink() {
    [1800, 2600, 3400].forEach((f, i) => tone(f + Math.random() * 60, 0.5, 'sine', 0.22, i * 0.02));
  }

  function burp() {
    const c = ready(); if (!c) return;
    const dur = 0.5;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, c.currentTime + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 30;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(osc.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(g).connect(master);
    lfo.start(); osc.start();
    lfo.stop(c.currentTime + dur); osc.stop(c.currentTime + dur);
  }

  function cheer() {
    const c = ready(); if (!c) return;
    const dur = 1.4;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur, c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700, c.currentTime);
    bp.frequency.linearRampToValueAtTime(1600, c.currentTime + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(500, c.currentTime + dur);
    bp.Q.value = 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.6, c.currentTime + 0.2);
    g.gain.linearRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(bp).connect(g).connect(master);
    src.start();
  }

  function airhorn() {
    const c = ready(); if (!c) return;
    const dur = 1.0;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.35, c.currentTime + 0.05);
    g.gain.setValueAtTime(0.35, c.currentTime + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.001, c.currentTime + dur);
    g.connect(master);
    [220, 221].forEach((f) => {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(g);
      osc.start(); osc.stop(c.currentTime + dur);
    });
  }

  function drumroll() {
    for (let i = 0; i < 16; i++) noise(0.05, 'lowpass', 4000, 0.4, i * 0.06);
    noise(0.8, 'highpass', 2000, 0.5, 16 * 0.06 + 0.1);
  }

  function hiccup() { tone(300, 0.15, 'sine', 0.5, 0, 700); }

  function slur() { tone(500, 0.7, 'triangle', 0.4, 0, 120); }

  function applause() {
    const c = ready(); if (!c) return;
    const dur = 1.6;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur, c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4000;
    bp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.35, c.currentTime + 0.3);
    g.gain.linearRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(bp).connect(g).connect(master);
    src.start();
  }

  /* ---------- Kasinolyder ---------- */
  function cardDeal() { noise(0.07, 'bandpass', 2600, 0.35, 0, 0.8); }
  function cardFlip() { noise(0.04, 'highpass', 3500, 0.25); tone(420, 0.05, 'triangle', 0.06); }
  function chip() { tone(2400 + Math.random() * 200, 0.08, 'sine', 0.09); tone(3300, 0.06, 'sine', 0.06, 0.03); }
  function chips() { for (let i = 0; i < 4; i++) tone(2200 + Math.random() * 900, 0.06, 'sine', 0.07, i * 0.045); }
  function click() { tone(1200, 0.035, 'square', 0.03); }
  function win() { [660, 880, 1100].forEach((f, i) => tone(f, 0.2, 'sine', 0.12, i * 0.09)); }
  function bigWin() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'triangle', 0.14, i * 0.08));
    setTimeout(cheer, 350);
  }
  function lose() { tone(220, 0.3, 'sawtooth', 0.08); tone(160, 0.35, 'sawtooth', 0.07, 0.08); }
  function bust() { tone(180, 0.28, 'sawtooth', 0.09); }
  function tick() { tone(1700 + Math.random() * 300, 0.025, 'square', 0.025); }
  function ballDrop() { tone(900, 0.06, 'sine', 0.12); tone(600, 0.08, 'sine', 0.1, 0.07); tone(750, 0.06, 'sine', 0.08, 0.15); }
  function coin() { tone(988, 0.08, 'square', 0.06); tone(1319, 0.25, 'square', 0.06, 0.08); }
  function reelStop() { tone(140, 0.12, 'sine', 0.3, 0, 60); noise(0.05, 'lowpass', 900, 0.2); }
  function diceRoll() { for (let i = 0; i < 7; i++) noise(0.04, 'bandpass', 1800 + Math.random() * 1500, 0.3, i * 0.055 + Math.random() * 0.02, 2); }
  function shuffle() { for (let i = 0; i < 10; i++) noise(0.05, 'bandpass', 3000, 0.18, i * 0.04, 0.9); }
  function fanfare() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.1)); }
  function swoosh() { noise(0.35, 'bandpass', 1200, 0.25, 0, 0.6); }

  return {
    fart, beerCrack, glassClink, burp, cheer, airhorn, drumroll, hiccup, slur, applause,
    cardDeal, cardFlip, chip, chips, click, win, bigWin, lose, bust, tick, ballDrop, coin,
    reelStop, diceRoll, shuffle, fanfare, swoosh, tone, noise,
    // For sider som lager egne lyder (f.eks. beat-maskinen): gir {c, out} eller null når lyden er av.
    ready() { const c = ready(); return c ? { c, out: master } : null; }
  };
})();

// ---------- TOAST (stables når flere kommer samtidig) ----------
function showToast(msg, opts) {
  opts = opts || {};
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = 'toast' + (opts.cls ? ' ' + opts.cls : '');
  if (opts.html) toast.innerHTML = msg; else toast.textContent = msg;
  stack.appendChild(toast);
  while (stack.children.length > 4) stack.firstChild.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 450);
  }, opts.duration || 2400);
}

/* =========================================================
   LOMMEBOK — Gutta-kroner (GK). Lekepenger som deles av alle
   kasinospillene og som man også tjener andre steder på siden.
   ========================================================= */
const Wallet = (() => {
  const KEY = 'gutta_wallet';
  const START = 1000;
  const LOAN = 500;
  const fresh = () => ({ balance: START, loans: 0, lastBonus: null, peak: START });
  let state = Store.get(KEY, null);
  if (!state || typeof state.balance !== 'number' || !isFinite(state.balance)) state = fresh();

  function save() { Store.set(KEY, state); }
  function emit(delta, reason) {
    document.dispatchEvent(new CustomEvent('gutta:wallet', { detail: { balance: state.balance, delta, reason } }));
  }

  // Hold flere åpne faner i synk.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const next = JSON.parse(e.newValue);
      if (typeof next.balance === 'number') { const d = next.balance - state.balance; state = next; emit(d, 'sync'); }
    } catch (err) { /* ignorer */ }
  });

  return {
    START,
    LOAN,
    get balance() { return state.balance; },
    get loans() { return state.loans; },
    get peak() { return state.peak; },
    canAfford(n) { return state.balance >= n; },
    add(n, reason) {
      n = Math.round(n);
      if (!n) return;
      state.balance += n;
      if (state.balance > state.peak) state.peak = state.balance;
      save();
      emit(n, reason);
      if (state.balance >= 10000) Achievements.unlock('rich');
    },
    spend(n, reason) {
      n = Math.round(n);
      if (n <= 0) return true;
      if (state.balance < n) return false;
      state.balance -= n;
      save();
      emit(-n, reason);
      return true;
    },
    bonusAvailable() { return state.lastBonus !== todayKey(); },
    claimBonus(amount) {
      if (!this.bonusAvailable()) return false;
      state.lastBonus = todayKey();
      save();
      this.add(amount, 'bonus');
      return true;
    },
    canBorrow() { return state.balance < 50; },
    borrow() {
      if (!this.canBorrow()) return 0;
      state.loans += 1;
      save();
      this.add(LOAN, 'loan');
      Achievements.unlock('broke');
      return LOAN;
    },
    reset() { state = fresh(); save(); emit(0, 'reset'); }
  };
})();

// ---------- Statistikk (per spill) ----------
const Stats = (() => {
  const KEY = 'gutta_stats';
  let s = Store.get(KEY, {});
  function walk(path, create) {
    const parts = path.split('.');
    let o = s;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') { if (!create) return [null, null]; o[parts[i]] = {}; }
      o = o[parts[i]];
    }
    return [o, parts[parts.length - 1]];
  }
  return {
    get(path, fb) { const [o, k] = walk(path, false); return o && o[k] != null ? o[k] : (fb === undefined ? 0 : fb); },
    add(path, n) { const [o, k] = walk(path, true); o[k] = (o[k] || 0) + (n === undefined ? 1 : n); Store.set(KEY, s); return o[k]; },
    set(path, v) { const [o, k] = walk(path, true); o[k] = v; Store.set(KEY, s); },
    max(path, v) { const [o, k] = walk(path, true); if (o[k] == null || v > o[k]) { o[k] = v; Store.set(KEY, s); } },
    reset() { s = {}; Store.set(KEY, s); }
  };
})();

/* =========================================================
   PRESTASJONER — gir en liten GK-premie første gang.
   ========================================================= */
const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🥇', name: 'Første gevinst', desc: 'Vinn din første runde i kasinoet.', reward: 100 },
  { id: 'blackjack', icon: '🃏', name: 'Naturtalent', desc: 'Få blackjack.', reward: 100 },
  { id: 'bj_streak', icon: '🔥', name: 'Varm hånd', desc: 'Vinn 5 blackjack-hender på rad.', reward: 250 },
  { id: 'split_double', icon: '✂️', name: 'Splitt og hersk', desc: 'Vinn begge hendene etter en splitt.', reward: 150 },
  { id: 'coach', icon: '🎓', name: 'Skoleflink', desc: 'Følg basic strategy 25 trekk på rad i blackjack.', reward: 200 },
  { id: 'bj_tournament', icon: '🏆', name: 'Turneringshai', desc: 'Vinn en blackjack-turnering.', reward: 300 },
  { id: 'roulette_straight', icon: '🎯', name: 'Rett i blinken', desc: 'Treff et enkeltnummer i rulett.', reward: 200 },
  { id: 'roulette_zero', icon: '🟢', name: 'Null stress', desc: 'Vinn på grønn null.', reward: 250 },
  { id: 'roulette_big', icon: '🎡', name: 'Hjulets herre', desc: 'Vinn minst 1 000 GK på ett rulett-spinn.', reward: 300 },
  { id: 'poker_win', icon: '♠️', name: 'Haien', desc: 'Vinn en pokerturnering.', reward: 300 },
  { id: 'poker_hard', icon: '🦈', name: 'Pokerprofessor', desc: 'Vinn en pokerturnering på Vanskelig.', reward: 750 },
  { id: 'poker_bluff', icon: '😐', name: 'Pokerfjes', desc: 'Få alle til å kaste mens du bare har høyt kort.', reward: 150 },
  { id: 'poker_monster', icon: '💎', name: 'Monsterhånd', desc: 'Vinn en pott med fire like eller bedre.', reward: 400 },
  { id: 'meyer_win', icon: '🎲', name: 'Løgnhals', desc: 'Vinn et spill Meyer.', reward: 200 },
  { id: 'meyer_hard', icon: '🤥', name: 'Mesterbløffer', desc: 'Vinn Meyer på Vanskelig.', reward: 500 },
  { id: 'slots_jackpot', icon: '🍺', name: 'Jackpot!', desc: 'Tre ølkrus på rad på Ølautomaten.', reward: 300 },
  { id: 'rich', icon: '💰', name: 'Oljefondet', desc: 'Ha 10 000 GK i lommeboka.', reward: 0 },
  { id: 'broke', icon: '🪫', name: 'Blakk', desc: 'Gå tom og ta et mammalån.', reward: 0 },
  { id: 'snake_20', icon: '🐍', name: 'Tørst', desc: 'Drikk 20 øl i én runde Ølsnake.', reward: 200 },
  { id: 'wheel', icon: '🎡', name: 'Skjebnen bestemmer', desc: 'Spinn hjulet på «Hva skal vi nå?».', reward: 50 },
  { id: 'beer_rater', icon: '🍻', name: 'Ølsommelier', desc: 'Ranger 5 øl.', reward: 150 },
  { id: 'bar_rater', icon: '🏙️', name: 'Barflue', desc: 'Ranger 3 barer.', reward: 100 },
  { id: 'drink_mode', icon: '🥴', name: 'Ekte gutta', desc: 'Skru på Drikkemodus.', reward: 50 }
];

const Achievements = (() => {
  const KEY = 'gutta_achievements';
  let got = Store.get(KEY, {});
  return {
    list: ACHIEVEMENTS,
    has(id) { return !!got[id]; },
    count() { return Object.keys(got).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length; },
    unlock(id) {
      if (got[id]) return false;
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a) return false;
      got[id] = new Date().toISOString();
      Store.set(KEY, got);
      setTimeout(() => {
        GuttaSFX.fanfare();
        showToast(
          '🏆 ' + escapeHtml(a.icon + ' ' + a.name) + '<small>' + escapeHtml(a.desc) +
          (a.reward ? ' · +' + formatGK(a.reward) : '') + '</small>',
          { html: true, cls: 'achv-toast', duration: 3600 }
        );
        if (a.reward) Wallet.add(a.reward, 'achievement');
      }, 300);
      document.dispatchEvent(new CustomEvent('gutta:achievement', { detail: { id } }));
      return true;
    },
    reset() { got = {}; Store.set(KEY, got); }
  };
})();

/* =========================================================
   DRIKKEMODUS — valgfritt. Spillene sender inn hendelser, og
   når modusen er på dukker det opp en liten skål-beskjed.
   ========================================================= */
function drinkPrompt(title, sub) {
  if (!Settings.get('drink')) return;
  document.querySelectorAll('.drink-pop').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'drink-pop';
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="de">🍺</div><div class="dt">' + escapeHtml(title) + '</div>' +
    (sub ? '<div class="ds">' + escapeHtml(sub) + '</div>' : '');
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', close);
  document.body.appendChild(el);
  GuttaSFX.glassClink();
  setTimeout(close, 2600);
}

/* =========================================================
   MENY — bygges fra én liste, så alle sider er like.
   ========================================================= */
const SITE_NAV = [
  { href: '../index.html', label: 'Start' },
  { href: 'index.html', label: 'Hjem' },
  { label: 'Kasino', items: [
    { href: 'kasino.html', label: 'Kasino-lobby', icon: '🪙' },
    { href: 'blackjack.html', label: 'Blackjack', icon: '🃏' },
    { href: 'rulett.html', label: 'Rulett', icon: '🔴' },
    { href: 'poker.html', label: 'Poker', icon: '♠️' },
    { href: 'meyer.html', label: 'Meyer', icon: '🎲' },
    { href: 'olautomat.html', label: 'Ølautomaten', icon: '🎰' }
  ] },
  { label: 'Fest', items: [
    { href: 'hva-skal-vi-na.html', label: 'Hva skal vi nå?', icon: '🎡' },
    { href: 'drikkeregler.html', label: 'Drikkeregler', icon: '📜' },
    { href: 'sjekkereplikk.html', label: 'Sjekkereplikker', icon: '💬' },
    { href: 'olsnake.html', label: 'Ølsnake', icon: '🐍' },
    { href: 'lyd-bilder.html', label: 'Lyd & Bilder', icon: '📸' }
  ] },
  { label: 'Ratings', items: [
    { href: 'ol-ratings.html', label: 'Øl Ratings', icon: '🍺' },
    { href: 'bar-ratinger.html', label: 'Bar Ratinger', icon: '🏙️' }
  ] }
];

const BRAND_SVG =
  '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<rect x="14" y="20" width="30" height="34" rx="4" fill="#f4a825" stroke="#3a1f0f" stroke-width="3"/>' +
  '<rect x="10" y="14" width="38" height="10" rx="3" fill="#fff8e7" stroke="#3a1f0f" stroke-width="3"/>' +
  '<path d="M44 26 Q56 26 56 36 Q56 46 44 44" stroke="#3a1f0f" stroke-width="3" fill="none"/></svg>';

function renderSiteHeader() {
  const slot = document.getElementById('site-header');
  if (!slot) return;
  const current = location.pathname.split('/').pop() || 'index.html';

  const header = document.createElement('header');
  header.className = 'site-header';
  let navHtml = '';
  SITE_NAV.forEach((entry, gi) => {
    if (!entry.items) {
      navHtml += '<a href="' + entry.href + '"' + (entry.href === current ? ' class="active" aria-current="page"' : '') + '>' + entry.label + '</a>';
      return;
    }
    const groupActive = entry.items.some((it) => it.href === current);
    navHtml += '<div class="nav-group' + (groupActive ? ' active' : '') + '">' +
      '<button type="button" aria-expanded="false" aria-controls="navdrop' + gi + '">' + entry.label + '</button>' +
      '<div class="nav-drop" id="navdrop' + gi + '">' +
      entry.items.map((it) => '<a href="' + it.href + '"' + (it.href === current ? ' class="active" aria-current="page"' : '') +
        '><span class="ni">' + it.icon + '</span>' + it.label + '</a>').join('') +
      '</div></div>';
  });

  header.innerHTML =
    '<div class="nav-wrap">' +
      '<a href="index.html" class="brand">' + BRAND_SVG + 'GUTTA</a>' +
      '<nav class="main-nav" aria-label="Hovedmeny">' + navHtml + '</nav>' +
      '<div class="header-tools">' +
        '<a class="wallet-badge" href="kasino.html" title="Lommeboka di (Gutta-kroner)">🪙 <span class="wb-amount">' + formatGK(Wallet.balance) + '</span></a>' +
        '<button type="button" class="icon-btn sound-toggle" aria-label="Lyd av/på"></button>' +
        '<button type="button" class="burger" aria-label="Meny" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '</div>' +
    '</div>';
  slot.replaceWith(header);

  // --- menu behaviour ---
  const nav = header.querySelector('.main-nav');
  const burger = header.querySelector('.burger');
  const closeMobile = () => {
    nav.classList.remove('open'); burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('nav-open');
  };
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open); burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('nav-open', open);
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMobile));
  header.querySelectorAll('.nav-group > button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const group = btn.parentElement;
      const willOpen = !group.classList.contains('open');
      header.querySelectorAll('.nav-group.open').forEach((g) => { g.classList.remove('open'); g.firstChild.setAttribute('aria-expanded', 'false'); });
      group.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });
  document.addEventListener('click', () => header.querySelectorAll('.nav-group.open').forEach((g) => g.classList.remove('open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeMobile(); header.querySelectorAll('.nav-group.open').forEach((g) => g.classList.remove('open')); }
  });

  // --- sound toggle ---
  const soundBtn = header.querySelector('.sound-toggle');
  const paintSound = () => {
    const on = Settings.get('sound');
    soundBtn.textContent = on ? '🔊' : '🔇';
    soundBtn.title = on ? 'Skru av lyden' : 'Skru på lyden';
    soundBtn.setAttribute('aria-pressed', String(on));
  };
  soundBtn.addEventListener('click', () => { Settings.set('sound', !Settings.get('sound')); paintSound(); GuttaSFX.click(); });
  document.addEventListener('gutta:settings', paintSound);
  paintSound();

  // --- wallet badge ---
  const badge = header.querySelector('.wallet-badge');
  const amountEl = badge.querySelector('.wb-amount');
  document.addEventListener('gutta:wallet', (e) => {
    amountEl.textContent = formatGK(e.detail.balance);
    const d = e.detail.delta;
    if (!d) return;
    badge.classList.remove('up', 'down');
    void badge.offsetWidth;
    badge.classList.add(d > 0 ? 'up' : 'down');
    const fl = document.createElement('span');
    fl.className = 'wallet-delta ' + (d > 0 ? 'plus' : 'minus');
    fl.textContent = (d > 0 ? '+' : '−') + Math.abs(d).toLocaleString('nb-NO');
    badge.appendChild(fl);
    setTimeout(() => fl.remove(), 1200);
  });
}

// ---------- Floating beer bubbles background ----------
function spawnBubbles() {
  if (document.querySelector('.bubble-field')) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const field = document.createElement('div');
  field.className = 'bubble-field';
  field.setAttribute('aria-hidden', 'true');
  document.body.prepend(field);
  const isGame = document.body.classList.contains('game-page');
  const count = isGame ? 8 : (window.innerWidth < 700 ? 14 : 26);
  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = 6 + Math.random() * 22;
    b.style.width = size + 'px';
    b.style.height = size + 'px';
    b.style.left = Math.random() * 100 + 'vw';
    b.style.animationDuration = (6 + Math.random() * 10) + 's';
    b.style.animationDelay = (Math.random() * 10) + 's';
    field.appendChild(b);
  }
}

/* =========================================================
   Simple confetti burst (DOM based) for wins etc.
   ========================================================= */
function confettiBurst(x, y, count) {
  if (x === undefined) x = window.innerWidth / 2;
  if (y === undefined) y = window.innerHeight / 3;
  count = count || 40;
  const colors = ['#f4a825', '#e6432f', '#3fae5a', '#ffb92e', '#fff8e7'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const size = 6 + Math.random() * 8;
    el.style.cssText =
      'position:fixed; left:' + x + 'px; top:' + y + 'px; width:' + size + 'px; height:' + size + 'px;' +
      'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
      'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px') + '; z-index:999; pointer-events:none;';
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 100;
    if (el.animate) {
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx + 'px, ' + (dy + 300) + 'px) rotate(' + (Math.random() * 720) + 'deg)', opacity: 0 }
      ], { duration: 1200 + Math.random() * 800, easing: 'cubic-bezier(.17,.67,.16,.99)' });
    }
    setTimeout(() => el.remove(), 2100);
  }
}

// Bygg menyen med en gang (scriptet ligger nederst i <body>), boblene når siden er klar.
renderSiteHeader();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spawnBubbles);
else spawnBubbles();
