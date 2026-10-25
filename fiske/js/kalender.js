/* =========================================================
   FISKE — kalender.js
   Grensesnittet til fiskekalenderen. Modellen (sol, måne, poeng)
   og hentingen av vær, sjø og tidevann ligger i js/fiskemodell.js.
   ========================================================= */

const $ = id => document.getElementById(id);
const nowInit = osloNow();
const GEAR_KEY = 'gutta_fiske_utstyr';
const state = {
  today: {y:nowInit.y, m:nowInit.m, d:nowInit.d},
  sel: {y:nowInit.y, m:nowInit.m, d:nowInit.d},
  view: {y:nowInit.y, m:nowInit.m},
  hour: nowInit.h, follow: true,
  // Valgene i «Planlegg turen». null og false betyr at siden velger.
  bestDay: false, bestTime: false, spot: null, method: null,
  gear: {rod: 'alle', min: 15, max: 60},                   // rod: alle, en av RODS, eller egen
  wxMode: 'auto',                                          // auto = varsel fra Yr, manual = lagt inn selv, off = uten vær
  wx: {known:true, wind:4, cloud:0.5, rain:'tort', temp:8},  // været du legger inn selv
  openSet: new Set(), touched: false, checked: new Set(), lastKey: '', monthKey: '', mapKey: '', urlQ: null
};
const sameDay = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;
const isToday = () => sameDay(state.sel, state.today);
const iso = t => t.y + '-' + pad(t.m) + '-' + pad(t.d);

const PRESETS = [
  {id:'auto', t:'Fra Yr'},
  {id:'ingen', t:'Uten vær'},
  {id:'stille', t:'Stille og pent', wx:{wind:1.5, cloud:0, rain:'tort'}},
  {id:'bris', t:'Overskyet, lett bris', wx:{wind:5, cloud:1, rain:'tort'}},
  {id:'regn', t:'Regn og frisk vind', wx:{wind:9, cloud:1, rain:'mye'}},
  {id:'storm', t:'Kuling', wx:{wind:15, cloud:1, rain:'mye'}}
];
const CLOUDS = [{v:0, t:'Sol'}, {v:0.5, t:'Delvis skyet'}, {v:1, t:'Overskyet'}];
const RAINS = [{v:'tort', t:'Tørt'}, {v:'lett', t:'Lett regn'}, {v:'mye', t:'Mye regn'}, {v:'sno', t:'Snø'}];
const TIMES = [{h:7, t:'Morgen'}, {h:12, t:'Midt på dagen'}, {h:16, t:'Ettermiddag'}, {h:20, t:'Kveld'}, {h:23, t:'Natt'}];
const LEGEND ='<span><i style="background:var(--ph0)"></i>Dagslys</span><span><i style="background:var(--ph1)"></i>Lav sol</span>' +
  '<span><i style="background:var(--ph2)"></i>Skumring</span><span><i style="background:var(--ph3)"></i>Mørkt</span><span><i style="background:var(--ph4)"></i>Natt</span>';

function moonSvg(age, size){
  const p = age / SYN, waxing = p < 0.5, q = waxing ? p : 1 - p;
  const k = Math.cos(2 * Math.PI * q), rx = (Math.abs(k) * 10).toFixed(2), sweep = k > 0 ? 0 : 1;
  const lit = `M12 2 A10 10 0 0 1 12 22 A${rx} 10 0 0 ${sweep} 12 2 Z`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="var(--moon-dark)"/><path d="${lit}" fill="var(--moon-lit)"${waxing ? '' : ' transform="translate(24 0) scale(-1 1)"'}/></svg>`;
}
const pct = x => Math.round(x * 100);
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const shortDay = t => DAG[dowOf(t.y, t.m, t.d)].slice(0, 3) + ' ' + t.d + '.';
function dayLabel(t){
  if (sameDay(t, state.today)) return 'i dag';
  const tm = new Date(Date.UTC(state.today.y, state.today.m - 1, state.today.d + 1));
  return sameDay(t, {y: tm.getUTCFullYear(), m: tm.getUTCMonth() + 1, d: tm.getUTCDate()}) ? 'i morgen' : fmtDate(t.y, t.m, t.d);
}
function whenLabel(ctx){
  if (isToday() && state.follow) return 'akkurat nå';
  return dayLabel(state.sel) + ' kl. ' + fmtTime(ctx.h);
}

/* ----- Valgene ----- */
// Det modellen trenger: plass, fiskemåte og kastevekten til stanga (null = ta med det som trengs).
function selection(){
  return {spot: state.spot, method: state.method, gear: state.gear.rod === 'alle' ? null : {min: state.gear.min, max: state.gear.max}};
}
function nextDays(n){
  return Array.from({length: n}, (_, k) => {
    const dt = new Date(Date.UTC(state.today.y, state.today.m - 1, state.today.d + k));
    return {y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate()};
  });
}
// Første halvtime som teller når siden foreslår et tidspunkt: for i dag den som pågår nå.
const slotFrom = day => sameDay(day, state.today) ? Math.min(47, Math.floor(osloNow().h * 2)) : 0;
const fromSlot = () => slotFrom(state.sel);
// «Beste dag» og «Beste tid»: finn dagen (de neste sju) og klokkeslettet med høyest poeng som passer valgene.
function resolveWhen(sel){
  if (!state.bestDay && !state.bestTime) return;
  const ns = noSea(), now = osloNow().h;
  let best = null;
  for (const day of state.bestDay ? nextDays(7) : [state.sel]){
    const wxf = wxFn(day.y, day.m, day.d);
    let cand = null;
    if (state.bestTime){
      const p = dayPlan(dayCtxs(day.y, day.m, day.d, wxf, ns), slotFrom(day), sel);
      if (p.best) cand = {day, h: p.best.h, score: p.best.score};
    } else if (!(sameDay(day, state.today) && state.hour < now)){
      const e = bestOk(makeCtx(day.y, day.m, day.d, state.hour, wxf(state.hour), ns), sel);
      cand = {day, h: state.hour, score: e ? e.score : 0};
    }
    if (cand && (!best || cand.score > best.score)) best = cand;
  }
  if (best){ state.sel = best.day; state.view = {y: best.day.y, m: best.day.m}; state.hour = best.h; }
}

/* ----- Lenke og lagret utstyr ----- */
function gearParams(q){
  const g = state.gear;
  if (g.rod === 'alle') return;
  q.set('stang', g.rod);
  const preset = RODS.find(r => r.id === g.rod);
  if (!preset || preset.vekt[0] !== g.min || preset.vekt[1] !== g.max) q.set('vekt', g.min + '-' + g.max);
}
// Valgene slik de står, med «beste» der siden velger. Står i adressefeltet.
function choiceParams(){
  const q = new URLSearchParams();
  if (state.bestDay) q.set('dag', 'beste'); else if (!state.follow) q.set('dag', iso(state.sel));
  if (state.bestTime) q.set('tid', 'beste'); else if (!state.follow) q.set('tid', fmtTime(state.hour));
  if (state.spot) q.set('plass', state.spot);
  if (state.method) q.set('fisk', state.method);
  gearParams(q);
  return q.toString();
}
function syncUrl(){
  const s = choiceParams();
  if (s === state.urlQ) return;
  state.urlQ = s;
  try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* file:// eller sandkasse */ }
}
// Lenken du deler er selve planen: dagen, klokkeslettet, plassen og fiskemåten siden kom fram til.
function shareUrl(plan){
  const q = new URLSearchParams();
  q.set('dag', iso(state.sel)); q.set('tid', fmtTime(state.hour));
  if (plan.spot) q.set('plass', plan.spot.id);
  q.set('fisk', plan.opt.id);
  gearParams(q);
  return location.href.split(/[?#]/)[0] + '?' + q.toString();
}
function setGear(g){
  let min = Math.max(1, Math.round(+g.min || 1)), max = Math.max(1, Math.round(+g.max || 1));
  if (min > max) [min, max] = [max, min];
  state.gear = {rod: g.rod, min, max};
  Store.set(GEAR_KEY, state.gear);
}
function readChoices(){
  const saved = Store.get(GEAR_KEY, null);
  if (saved && (saved.rod === 'alle' || saved.rod === 'egen' || RODS.some(r => r.id === saved.rod))) setGear(saved);
  let q;
  try { q = new URLSearchParams(location.search); } catch (e) { return; }
  const dag = q.get('dag') || '', tid = q.get('tid') || '';
  let m;
  if (dag === 'beste'){ state.bestDay = true; state.follow = false; }
  else if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dag))){ state.sel = {y: +m[1], m: +m[2], d: +m[3]}; state.view = {y: +m[1], m: +m[2]}; state.follow = false; }
  if (tid === 'beste'){ state.bestTime = true; state.follow = false; }
  else if ((m = /^(\d{1,2}):(\d{2})$/.exec(tid))){ state.hour = Math.min(24, +m[1] + m[2] / 60); state.follow = false; }
  if (SPOTS[q.get('plass')]) state.spot = q.get('plass');
  if (OPTIONS.some(o => o.id === q.get('fisk'))) state.method = q.get('fisk');
  const st = q.get('stang'), v = /^(\d+)-(\d+)$/.exec(q.get('vekt') || ''), preset = RODS.find(r => r.id === st);
  if (preset) setGear({rod: st, min: v ? v[1] : preset.vekt[0], max: v ? v[2] : preset.vekt[1]});
  else if (st === 'egen' && v) setGear({rod: 'egen', min: v[1], max: v[2]});
  else if (st === 'alle') setGear({...state.gear, rod: 'alle'});
}

/* ----- Vær: Yr, lagt inn selv eller ingen ----- */
function wxFor(y, m, d, h){
  if (state.wxMode === 'manual') return state.wx;
  if (state.wxMode === 'auto') return FiskeVaer.wxAt(toUTC(y, m, d, h));
  return null;
}
const wxFn = (y, m, d) => h => wxFor(y, m, d, h);
const noSea = () => state.wxMode === 'off';
function wxText(w){
  const sky = w.sym ? symText(w.sym) : CLOUDS.find(c => c.v === w.cloud).t + ', ' + RAINS.find(c => c.v === w.rain).t.toLowerCase();
  return `${wxIcon(w)} ${sky}, ${w.temp} °C, ${windName(w.wind).toLowerCase()} ${fmtNum(w.wind)} m/s` + (w.dir != null ? ' fra ' + windDir(w.dir) : '');
}
// Går over til eget vær. Fra Yr tas varselet for valgt tidspunkt med som utgangspunkt.
function toManual(){
  if (state.wxMode === 'manual') return;
  const cur = state.wxMode === 'auto' ? wxFor(state.sel.y, state.sel.m, state.sel.d, state.hour) : null;
  if (cur) Object.assign(state.wx, {wind: cur.wind, cloud: cur.cloud, rain: cur.rain, temp: cur.temp});
  state.wxMode = 'manual';
}
function wxHint(ctx){
  if (ctx.wx) return '';
  if (state.wxMode === 'off') return 'Uten vær. <button type="button" class="chip" data-act="auto">Bruk været fra Yr</button>';
  if (state.wxMode !== 'auto') return '';
  if (!FiskeVaer.hasData){
    return FiskeVaer.status === 'error' ? 'Fikk ikke hentet været fra Yr. <button type="button" class="chip" data-act="wx">Legg inn selv</button>'
      : 'Henter været fra Yr …';
  }
  return 'Yr har ikke varsel for dette tidspunktet, så poengene er regnet med vanlig vær for årstiden.';
}

function renderDatebar(ctx){
  const {y, m, d} = state.sel, t = sunTimes(y, m, d), age = moonAge(toUTC(y, m, d, 12)), sp = springness(age);
  const len = t.set - t.rise, lh = Math.floor(len), lm = Math.round((len - lh) * 60);
  const tides = FiskeVaer.tides(y, m, d), sea = FiskeVaer.seaAt(toUTC(y, m, d, ctx.h)), wx = ctx.wx;
  const range = FiskeVaer.tideRange(y, m, d);
  const times = high => tides.filter(e => e.high === high).map(e => fmtTime(e.h)).join(' og ');
  $('datebar').innerHTML = `
    <div class="dateline"><span class="dow">${DAG[dowOf(y, m, d)]}</span><span class="dnum">${d}. ${MND[m - 1]} ${y}</span>${isToday() ? '<span class="fk-tag">I dag</span>' : ''}</div>
    <dl class="facts">
      <div><dt>Sol opp og ned</dt><dd class="num">${fmtTime(t.rise)}–${fmtTime(t.set)}<small>${lh} t ${lm} min dagslys</small></dd></div>
      <div><dt>Måne</dt><dd>${moonSvg(age, 18)} ${moonName(age)}</dd></div>
      <div><dt>Tidevann</dt><dd>${tideLabel(sp, range)}<small>${range != null ? fmtNum(range.toFixed(1)) + ' m mellom flo og fjære' : springText(age)}</small></dd></div>
      ${tides && tides.length ? `<div><dt>Flo og fjære</dt><dd class="num">Flo ${times(true)}<small>Fjære ${times(false)}</small></dd></div>` : ''}
      ${wx ? `<div><dt>Vær kl. ${fmtTime(ctx.h)}</dt><dd>${wxIcon(wx)} ${wx.temp} °C<small>${windName(wx.wind)}, ${fmtNum(wx.wind)} m/s</small></dd></div>` : ''}
      ${sea ? `<div><dt>Sjøen</dt><dd class="num">${fmtNum(sea.temp.toFixed(1))} °C${typeof sea.wave === 'number' ? `<small>Bølger ${fmtNum(sea.wave.toFixed(1))} m</small>` : ''}</dd></div>` : ''}
    </dl>`;
}

// Valgene i «Planlegg turen». Plass og fiskemåte viser poengene nå, så du ser hva du velger mellom.
function renderPicks(ctx, dayP, res, sel){
  const chip = (attr, val, label, on, cls) => `<button type="button" class="chip${cls ? ' ' + cls : ''}" ${attr}="${val}" aria-pressed="${on}">${label}</button>`;
  const days = [chip('data-bestday', '1', state.bestDay ? 'Beste dag: ' + shortDay(state.sel) : 'Beste dag', state.bestDay, 'best')];
  nextDays(7).forEach((t, k) => {
    const w = state.wxMode === 'auto' ? FiskeVaer.wxAt(toUTC(t.y, t.m, t.d, state.hour)) : null;
    const label = (k === 0 ? 'I dag' : k === 1 ? 'I morgen' : cap(shortDay(t))) + (w ? ' ' + wxIcon(w) : '');
    days.push(chip('data-day', `${t.y}-${t.m}-${t.d}`, label, !state.bestDay && sameDay(t, state.sel)));
  });
  $('dayChips').innerHTML = days.join('');
  if ($('datePick').value !== iso(state.sel)) $('datePick').value = iso(state.sel);

  const near = h => !state.bestTime && Math.abs(state.hour - h) < 0.01;
  const bt = state.bestTime ? 'Beste tid: ' + fmtTime(state.hour) : dayP.best ? 'Beste tid ' + fmtTime(dayP.best.h) : 'Beste tid';
  $('timeChips').innerHTML = chip('data-besttime', '1', bt, state.bestTime, 'best') +
    TIMES.map(t => chip('data-h', t.h, `${t.t} ${pad(t.h)}`, near(t.h))).join('');

  const spotBest = id => pickBest(candidates(ctx, {...sel, spot: id}));
  $('spotChips').innerHTML = chip('data-spot', '', 'Beste plass', !state.spot, 'best') + SPOT_IDS.map(id => {
    const e = spotBest(id), s = SPOTS[id];
    const label = s.kort + (e && e.ok && !e.f.closed ? ` <b class="num">${e.score}</b>` : '');
    return chip('data-spot', id, label, state.spot === id, e && e.ok ? '' : 'warn');
  }).join('');

  $('methodChips').innerHTML = chip('data-method', '', 'Beste fiskemåte', !state.method, 'best') + OPTIONS.map(o => {
    const r = res.find(x => x.opt.id === o.id);
    const label = o.kort + (r.ok && !r.f.closed ? ` <b class="num">${r.score}</b>` : '');
    return chip('data-method', o.id, label, state.method === o.id, r.ok && !r.f.closed ? '' : 'warn');
  }).join('');

  const g = state.gear;
  $('rodChips').innerHTML = chip('data-rod', 'alle', 'Ta med det som trengs', g.rod === 'alle', 'best') +
    RODS.map(r => chip('data-rod', r.id, r.navn, g.rod === r.id)).join('') + chip('data-rod', 'egen', 'Egen', g.rod === 'egen');
  $('gearRow').hidden = g.rod === 'alle';
  if (document.activeElement !== $('gMin')) $('gMin').value = g.min;
  if (document.activeElement !== $('gMax')) $('gMax').value = g.max;
}

// Kurven er beste poeng som passer valgene for hver halvtime, samme tall som «Beste tid» og beste tidsrom bygger på.
// Den stiplede streken er fiskemåten i planen, når du ikke har valgt fiskemåte selv.
function renderTimeline(ctx, plan, ctxs, anyWx, dayP, sel){
  const {y, m, d} = state.sel;
  $('hour').value = state.hour;
  const tide = ctx.tide;
  $('timeLabel').innerHTML = `Klokka <b class="num">${fmtTime(state.hour)}</b> · ${PHASE_NAME[ctx.ph].toLowerCase()}` +
    (tide ? ` · sjøen ${tide.rising ? 'stiger mot flo' : 'faller mot fjære'} kl. ${fmtTime(tide.next.h)}` : '') +
    (isToday() && state.follow ? ' · følger klokka' : '');
  $('btnNow').hidden = isToday() && state.follow;
  $('strip').innerHTML = ctxs.map(c => `<i style="background:var(--ph${c.phIdx})"></i>`).join('');
  const line = arr => arr.map((v, i) => `${(i + 0.5).toFixed(1)},${(38 - v / 100 * 36).toFixed(1)}`).join(' ');
  const pts = line(dayP.env.map(e => e ? e.score : 0));
  const own = state.method ? pts : line(curveFor(plan.opt, ctxs, sel));
  const past = isToday() ? (osloNow().h * 2).toFixed(2) : 0;
  $('curve').innerHTML = `<polygon points="0,40 ${pts} 48,40" fill="var(--heat)" opacity=".28"/><polyline points="${pts}" fill="none" stroke="var(--heat)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` +
    (own !== pts ? `<polyline points="${own}" fill="none" stroke="var(--ink2)" stroke-width="1.2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` : '') +
    (past > 0 ? `<rect x="0" y="0" width="${past}" height="40" fill="var(--past)"/>` : '');
  $('marker').style.left = (state.hour / 24 * 100) + '%';

  // Været hver tredje time over kurven, og flo og fjære under.
  let wxRow = '';
  if (state.wxMode === 'auto'){
    for (let h = 0; h < 24; h += 3){
      const w = FiskeVaer.wxAt(toUTC(y, m, d, h + 1.5));
      if (w) wxRow += `<span style="left:${(h + 1.5) / 24 * 100}%" title="${pad(h)}–${pad(h + 3)}: ${wxText(w)}"><i>${wxIcon(w)}</i>${Math.round(w.wind)} m/s</span>`;
    }
  }
  $('wxRow').innerHTML = wxRow;
  $('wxRow').hidden = !wxRow;
  const tides = FiskeVaer.tides(y, m, d) || [];
  $('tideRow').innerHTML = tides.map(e => {
    const x = e.h / 24 * 100;
    return `<span class="${e.high ? 'hi' : 'lo'}${x < 7 ? ' l' : x > 93 ? ' r' : ''}" style="left:${x.toFixed(2)}%">${e.high ? '▲' : '▼'} ${fmtTime(e.h)}</span>`;
  }).join('');
  $('tideRow').hidden = !tides.length;
  $('legend').innerHTML = LEGEND + (wxRow ? '<span>⛅ Vær og vind fra Yr</span>' : '') + (tides.length ? '<span>▲ Flo ▼ Fjære</span>' : '');

  const filters = state.spot || state.method || state.gear.rod !== 'alle';
  $('curveNote').textContent = 'Kurven viser beste poeng gjennom døgnet' + (filters ? ' for valgene dine' : '') +
    (!anyWx ? '' : state.wxMode === 'auto' ? ', med værvarselet fra Yr' : ', med været du har lagt inn') + '.' +
    (own !== pts ? ' Den stiplede streken er «' + plan.opt.kort.toLowerCase() + '».' : '') +
    (past > 0 ? ' Det som har vært i dag er skyggelagt.' : '');
}

function renderAlerts(ctx){
  $('alerts').innerHTML = warnings(ctx).map(w => `<div class="alert ${w.lvl}">${w.t}</div>`).join('');
}

// Stanga: anbefalingen når du tar med det som trengs, ellers om stanga di passer.
function rodText(o, s, w){
  const g = state.gear;
  if (g.rod === 'alle') return o.stang + (s && s.utstyr ? `<small>${s.utstyr}.</small>` : '');
  const fits = w.lo <= g.max && w.hi >= g.min, rod = RODS.find(r => r.id === g.rod);
  return `${rod ? rod.navn : 'Din stang'}, ${g.min} til ${g.max} g: ${fits ? 'passer' : '<b>passer ikke</b>'}.<small>Anbefalt: ${o.stang}</small>`;
}
function renderHero(ctx, plan, dayP, anyWx, res, sel){
  const o = plan.opt, f = plan.f, s = plan.spot;
  const w = weightFor(o, s, ctx);
  const lowTop = plan.score < VERDICT.middels;
  const joinList = a => a.map((t, i) => i ? t.charAt(0).toLowerCase() + t.slice(1) : t).join(', ');
  const why = plan.pro.length ? joinList(plan.pro.slice(0, 3)) + '.' : 'Lite taler for noe nå.';
  const bad = plan.con.length ? ' Mot: ' + joinList(plan.con.slice(0, 2)).toLowerCase() + '.' : '';
  const wxSrc = !anyWx ? '' : state.wxMode === 'auto' ? ' (med værvarselet fra Yr)' : ' (med været du har lagt inn)';
  const win = dayP.win, other = dayP.best && (dayP.best.opt !== o || dayP.best.spot !== s)
    ? ', for ' + dayP.best.opt.kort.toLowerCase() + (dayP.best.spot ? ' ved ' + dayP.best.spot.kort : '') : '';
  const winTxt = win ? `Beste tidsrom ${isToday() ? 'resten av dagen' : 'denne dagen'}: <b class="num">${fmtTime(win.from)} til ${fmtTime(win.to)}</b>${other}${wxSrc}` : '';
  const hint = wxHint(ctx);
  const picked = [];
  if (state.bestDay) picked.push('dag');
  if (state.bestTime) picked.push('tid');
  if (!state.spot && s) picked.push('plass');
  if (!state.method) picked.push('fiskemåte');
  const side = f.waves && f.waves.side ? ', ' + f.waves.side.navn : '';
  const where = (s ? `ved <b>${s.navn}</b>${side}` : 'fra brygger og svaberg') + ` · ${dayLabel(state.sel)} kl. <b class="num">${fmtTime(state.hour)}</b>`;
  const alts = s ? bestSpotsFor(o, ctx, sel).filter(x => x.spot.id !== s.id && x.ok).slice(0, 2) : [];
  const next = res.filter(r => r.ok && r.opt !== o && !r.f.closed).slice(0, 3)
    .map(r => `<span>${r.opt.kort}${r.spot ? ' ved ' + r.spot.kort : ''}: <b class="num">${r.score}</b></span>`).join('');
  const colorLabel = o.farge === 'agn' ? 'Agn' : 'Farge';
  $('planSum').innerHTML = `Planen: <b>${o.kort}</b>${s ? ' ved <b>' + s.kort + '</b>' : ''}, ${dayLabel(state.sel)} kl. ${fmtTime(state.hour)} · <b class="num">${plan.score}</b> ${verdict(plan.score, f.closed).toLowerCase()}` +
    `${plan.ok ? '' : ' (passer ikke alle valgene)'} <a href="#hero">Se planen ↓</a>`;
  const pack = packList(o, ctx, w).map(it => {
    const key = o.id + '|' + it.id;
    return `<label class="chk"><input type="checkbox" data-k="${key.replace(/"/g, '&quot;')}"${state.checked.has(key) ? ' checked' : ''}><span>${it.t}${it.must ? '<span class="must">Må ha</span>' : ''}</span></label>`;
  }).join('');
  $('hero').innerHTML = `
    <p class="eyebrow">Planen ${whenLabel(ctx)}</p>
    <h2>${lowTop ? 'Lite å hente. Best er ' + o.navn.toLowerCase() : o.navn}</h2>
    <p class="where">${where}</p>
    ${picked.length ? `<div class="picked">${picked.map(p => `<span>Siden valgte ${p}</span>`).join('')}</div>` : ''}
    <div class="scorerow">
      <div class="score num">${plan.score}<small>/100</small></div>
      <div><span class="verdict">${verdict(plan.score, f.closed)}</span>${winTxt ? `<p class="win" style="margin-top:6px">${winTxt}</p>` : ''}</div>
    </div>
    ${plan.ok ? '' : `<div class="issues"><p><b>Ingenting passer alle valgene dine.</b> Dette er det beste av resten: ${plan.issues.join('. ')}.</p></div>`}
    <p class="why">${why}${bad}</p>
    ${hint ? `<p class="win" style="margin:-4px 0 14px">${hint}</p>` : ''}
    <dl class="setup">
      <div><dt>Stang</dt><dd>${rodText(o, s, w)}</dd></div>
      <div><dt>${o.farge === 'agn' ? 'Takkel' : 'Sluk'}</dt><dd>${o.slukType}</dd></div>
      <div><dt>Vekt</dt><dd>${weightText(o, w)}${w.tofa ? '<small>TOFA sin anbefaling for denne plassen.</small>' : w.heavy ? `<small>Litt tyngre i dag: ${w.why}.</small>` : ''}</dd></div>
      <div><dt>${colorLabel}</dt><dd>${colorAdvice(o, ctx)}</dd></div>
      <div><dt>Teknikk</dt><dd>${o.teknikk}</dd></div>
      <div><dt>Plass</dt><dd>${s ? `<b>${s.navn}</b>` + (alts.length ? `<small>Også: ${alts.map(x => x.spot.kort + ' ' + x.score).join(', ')}</small>` : '')
        : 'TOFA nevner ingen faste plasser for denne fiskemåten i Trondheim. Prøv brygger og svaberg utenfor munningsfredningssonene.'}<small><a href="#plasser">Se alle plassene for dette tidspunktet</a></small></dd></div>
    </dl>
    <div class="pack"><h4>Pakkeliste</h4>${pack}</div>
    ${next ? `<div class="next"><span>Deretter:</span>${next}</div>` : ''}`;
}

// Alle plassene for valgt tidspunkt: beste fiskemåte der (eller den du har valgt), utstyret, og hva du kan få.
function renderSpotList(ctx, spots){
  const rl = activeRules(ctx.m, ctx.d), tide = ctx.tide;
  const fishName = f => cap(f === 'kveite' ? (rl.kveite ? 'kveite (må slippes ut nå)' : 'kveite (sjelden)') : f);
  const firstSentence = t => t.split('. ')[0].replace(/\.$/, '');
  const mapUrl = p => 'https://www.google.com/maps/search/?api=1&query=' + p[0] + ',' + p[1];
  const km = m => m >= 1000 ? fmtNum((m / 1000).toFixed(m >= 10000 ? 0 : 1)) + ' km' : Math.round(m) + ' m';
  const sides = s => { const a = openSides(s); return a.length ? a.join(', ').replace(/, ([^,]*)$/, ' og $1') : ''; };
  const dist = (p, q) => Math.hypot((p[0] - q[0]) * 111.3, (p[1] - q[1]) * 111.3 * Math.cos(rad(p[0])));
  // Det sjøkartet sier om én side: dybden og hvor det er åpent vann.
  const sideText = d => {
    const open = sides(d), far = km(Math.max(...d.fetch));
    return `opptil ca. ${d.dybde[0]} m dypt 25 m ut og ${d.dybde[1]} m 70 m ut, ` +
      (open ? `mer enn 1 km åpent vann mot ${open} (lengst ${far})` : `i le med under ${far} åpent vann i alle retninger`);
  };
  // Hele plassen: hver side, bølgene nå når varselet har vindretning, og sjøtemperaturen ved plassen.
  const chartText = s => {
    let t = s.sider ? s.sider.map(d => `${cap(d.navn)}: ${sideText(d)}.`).join(' ') : cap(sideText(s)) + '.';
    const w = s.waves;
    if (w){
      const where = w.side ? w.side.navn : 'plassen';
      t += `<small>Nå: vind fra ${windDir(ctx.wx.dir)}` +
        (w.H < 0.05 ? `, og ${where} ligger i le for den.` : `, ca. ${fmtNum(w.H.toFixed(1))} m bølger${w.side ? ' på ' + where : ''} (${km(w.F)} åpent vann).`) +
        (w.side ? ' Det er siden med minst bølger nå.' : '') + '</small>';
    }
    if (s.sea) t += `<small>Sjøen her: ${fmtNum(s.sea.temp.toFixed(1))} °C, fra MET sin havmodell i ruta ca. ${km(1000 * dist(s.pos, [s.sea.pt[1], s.sea.pt[0]]))} unna.</small>`;
    return t;
  };
  const method = state.method && OPTIONS.find(o => o.id === state.method);
  $('spotWhen').innerHTML = `Rangert for <b>${whenLabel(ctx)}</b>` + (method ? ` og <b>${method.kort.toLowerCase()}</b>` : '') +
    (ctx.wx ? ` · ${wxIcon(ctx.wx)} ${ctx.wx.temp} °C, ${fmtNum(ctx.wx.wind)} m/s` : '') +
    (tide ? ` · sjøen ${tide.rising ? 'stiger' : 'faller'}` : '') +
    '. Trykk på en plass i kartet eller «Velg plassen» for å planlegge ut fra den.';
  $('spotList').innerHTML = spots.map((s, i) => {
    const b = s.best, live = !!b && !s.stengt, top = i === 0 && live && b.ok && b.score >= VERDICT.svakt, chosen = state.spot === s.id;
    let med;
    if (!b) med = method ? `TOFA nevner ikke ${method.kort.toLowerCase()} her.` : s.annet ? `<b>${s.annet.navn}</b><small>${s.annet.tekst}</small>` : 'Ingen av fiskemåtene på siden passer her.';
    else {
      const o = b.opt;
      med = `<b>${o.navn}</b><small>${o.slukType}, ${weightText(o, weightFor(o, s, ctx))}. ${o.farge === 'agn' ? 'Agn' : 'Farge'}: ${firstSentence(colorAdvice(o, ctx)).toLowerCase()}.</small>`;
    }
    // Hver art lenker til siden med fiskeartene.
    const chip = f => { const href = typeof artHref === 'function' && artHref(f); return href ? `<a href="${href}" title="Les om ${f}">${fishName(f)}</a>` : `<span>${fishName(f)}</span>`; };
    const fisk = s.fisk.length ? `<span class="fishchips">${s.fisk.map(chip).join('')}</span>`
      : b ? 'Lite å hente her nå.' : 'Ukjent, guiden sier ikke hva som tas her.';
    const others = s.opts.filter(r => r !== b && r.ok && r.score >= VERDICT.svakt).map(r => `<span>${r.opt.kort} <b class="num">${r.score}</b></span>`).join('');
    const flags = [];
    if (s.stengt) flags.push(['stop', 'Bryggen er bare for campinggjester nå']);
    if (b && !b.ok) flags.push(['stop', b.issues[0]]);
    if (b && b.f.tofaBest) flags.push(['ok', 'TOFA: beste tiden for ' + b.opt.kort.toLowerCase() + ' her']);
    if (s.stigende && tide) flags.push(tide.rising ? ['ok', 'Sjøen stiger nå, og TOFA sier det er best her da'] : ['', `TOFA: best på stigende sjø, som starter ved fjære kl. ${fmtTime(tide.next.h)}`]);
    if (s.flo && tide){
      const hi = tide.next.high ? tide.next : tide.prev;
      flags.push([floSI(tide) >= 0.9 ? 'ok' : '', `TOFA: best på full flo. Flo kl. ${fmtTime(hi.h)}`]);
    }
    if (s.ekstra) flags.push(['ok', 'Mørkt nå: TOFA nevner nattefiske etter hågjel og svarthå her']);
    if (s.ikkeSpis && b && b.opt.bunnfisk) flags.push(['', 'TOFA fraråder å spise flatfisk og bunnfisk herfra']);
    if (s.sone === 2) flags.push(['', 'Munningsfredningssone: bare saltvannsfisk, med stang fra land']);
    return `<article class="spot${top ? ' top' : ''}${live ? '' : ' off'}${chosen ? ' sel' : ''}">
      <div class="spot-head">
        <div class="spot-name"><h3>${s.navn}</h3>${top ? '<span class="rk">Beste plass</span>' : ''}</div>
        <div class="sc"><b>${live ? b.score : '–'}</b><small>${s.stengt ? 'Stengt' : b ? verdict(b.score, b.f.closed) : s.annet ? 'Artsfiske' : 'Ikke nevnt'}</small></div>
      </div>
      <div class="bar"><i style="width:${live ? b.score : 0}%"></i></div>
      <dl class="spot-dl">
        <div><dt>Fisk med</dt><dd>${med}</dd></div>
        <div><dt>Du kan få</dt><dd>${fisk}</dd></div>
        ${others ? `<div><dt>Også her</dt><dd class="also">${others}</dd></div>` : ''}
        <div><dt>Sjøkartet</dt><dd>${chartText(s)}</dd></div>
      </dl>
      ${flags.length ? `<div class="flags">${flags.map(([c, t]) => `<span class="flag ${c}">${t}</span>`).join('')}</div>` : ''}
      <p class="note">${s.notat}</p>
      <div class="spot-actions">
        <button type="button" class="chip" data-pickspot="${s.id}" aria-pressed="${chosen}">${chosen ? 'Valgt plass' : 'Velg plassen'}</button>
        <a class="maplink" href="${mapUrl(s.pos)}" target="_blank" rel="noopener">Vis i Google Maps ↗</a>
      </div>
    </article>`;
  }).join('');
}

// Kartet over plassene, med fargen etter poengene nå. Trykk på en plass for å velge den.
let spotMap = null;
const spotMarkers = {};
function scoreColor(e){ return poengFarge(e && e.ok && !e.f.closed ? e.score : null); }
function renderMap(spots){
  const el = $('spotMap');
  if (!window.L){ el.classList.add('none'); return; }
  if (!spotMap){
    try {
      spotMap = L.map(el, {scrollWheelZoom: false});
      L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png',
        {maxZoom: 18, attribution: '&copy; <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a>'}).addTo(spotMap);
      spotMap.fitBounds(SPOT_IDS.map(id => SPOTS[id].pos), {padding: [28, 28]});
    } catch (e) { el.classList.add('none'); spotMap = null; return; }
  }
  spots.forEach(s => {
    const e = s.stengt ? null : s.best, chosen = state.spot === s.id;
    const style = {radius: chosen ? 11 : 8, color: chosen ? '#9b3522' : '#211b14', weight: chosen ? 2.5 : 1.5, fillColor: scoreColor(e), fillOpacity: 0.95};
    let mk = spotMarkers[s.id];
    if (!mk){
      mk = spotMarkers[s.id] = L.circleMarker(s.pos, style).addTo(spotMap);
      mk.on('click', () => pickSpot(state.spot === s.id ? null : s.id));
    } else { mk.setStyle(style); mk.setRadius(style.radius); }
    const label = s.stengt ? 'stengt nå' : e ? e.score + ' poeng, ' + e.opt.kort.toLowerCase() : s.annet ? 'artsfiske' : 'ikke nevnt';
    mk.unbindTooltip().bindTooltip(`<b>${s.kort}</b>: ${label}${chosen ? ' (valgt)' : ''}`, {direction: 'top', offset: [0, -8]});
  });
}

// Hver stolpe er det faktoren ganger poengene med, så stolpene ganget sammen (× 100) gir poengene.
function factorRows(r){
  // ≈: ingen varsel eller tidevannstabell for tidspunktet, så siden bruker vanlige verdier for årstiden.
  const f = r.f, rows = [
    ['Sesong', f.A, false],
    ['Lys', f.L, false],
    [f.flo ? 'Vannstand' : 'Strøm', f.C, !f.tideKnown],
    ['Vær', f.R, !f.wxKnown],
    ['Vind', f.Wd, !f.wxKnown]
  ];
  if (r.spot) rows.push(['Bølger', f.B, !f.waves]);
  if (f.hensyn < 1) rows.push(['Bestand', f.hensyn, false]);
  return rows.map(([n, v, est]) => `<div class="fr"><span>${n}</span><div class="bar"><i style="width:${pct(v)}%"></i></div><em>${est ? '≈' : ''}${pct(v)}%</em></div>`).join('') +
    (rows.some(x => x[2]) ? '<p class="note">≈ betyr at det mangler varsel eller tidevannstabell, så siden bruker vanlige verdier for årstiden.</p>' : '');
}
function renderRanking(ctx, res){
  const spot = state.spot && SPOTS[state.spot];
  $('optNote').textContent = 'Sortert etter poeng for valgt dag og tidspunkt' + (spot ? ' ved ' + spot.kort : ', hver på sin beste plass') +
    '. Det som ikke passer valgene dine, står sist. Åpne et alternativ for å se fordeler, ulemper og hvorfor det får poengene det får.';
  $('optlist').innerHTML = res.map((r, i) => {
    const o = r.opt, open = state.openSet.has(o.id) || (!state.touched && i === 0), chosen = state.method === o.id;
    const spots = spotsFor(o, ctx), off = !r.ok || r.score < VERDICT.svakt;
    return `<details class="opt${off ? ' off' : ''}" data-id="${o.id}"${open ? ' open' : ''}>
      <summary>
        <span class="nm">${o.navn}${i === 0 && r.ok && r.score >= VERDICT.svakt ? '<span class="rk">Best nå</span>' : ''}</span>
        <span class="sc"><span><b>${r.score}</b><small>${verdict(r.score, r.f.closed)}</small></span><span class="chev" aria-hidden="true"></span></span>
        <span class="sub">${r.spot ? 'Ved ' + r.spot.kort + ' · ' : ''}${o.undertekst}</span>
        <span class="bar"><i style="width:${r.score}%"></i></span>
      </summary>
      <div class="optbody">
        <div class="nowchips">${r.issues.map(t => `<span class="no">${t}</span>`).join('')}${r.pro.map(t => `<span class="ok">${t}</span>`).join('')}${r.con.map(t => `<span class="no">${t}</span>`).join('')}</div>
        <div><button type="button" class="chip" data-pickmethod="${o.id}" aria-pressed="${chosen}">${chosen ? 'Valgt fiskemåte' : 'Velg fiskemåten'}</button></div>
        <div class="pc">
          <div class="pro"><h4>Fordeler</h4><ul>${o.fordeler.map(t => `<li>${t}</li>`).join('')}</ul></div>
          <div class="con"><h4>Ulemper</h4><ul>${o.ulemper.map(t => `<li>${t}</li>`).join('')}</ul></div>
        </div>
        <div><h4>Slik får du poengene${r.spot ? ' ved ' + r.spot.kort : ''}</h4><div class="factors">${factorRows(r)}</div></div>
        <div><h4>Steder</h4>${spots.length ? `<ul class="plain">${spots.map(s => `<li><b>${s.navn}</b>${s.stengtNaa ? ' (stengt for andre enn campinggjester nå)' : ''}<br><small>${s.notat}</small></li>`).join('')}</ul>` : '<p class="note">TOFA nevner ingen faste plasser for denne fiskemåten i Trondheim. Prøv brygger og svaberg utenfor munningsfredningssonene.</p>'}</div>
        <p class="rule">${o.regel}</p>
      </div>
    </details>`;
  }).join('');
}

function renderSeasonMap(){
  const cur = state.view.m, key = cur + '|' + state.today.m;
  if (key === state.mapKey) return;
  state.mapKey = key;
  let h = '<span></span>' + MND.map((n, i) => `<span class="mh${i + 1 === state.today.m ? ' cur' : ''}">${n[0].toUpperCase()}</span>`).join('');
  for (const o of OPTIONS){
    h += `<span class="rl">${o.kort}</span>`;
    for (let i = 0; i < 12; i++){
      const closed = o.fredet && o.sesong[i] === 0;
      h += `<button type="button" class="cell${closed ? ' closed' : ''}${i + 1 === cur ? ' cur' : ''}" data-m="${i + 1}" style="--v:${o.sesong[i]}" aria-label="${o.kort}, ${MND[i]}, ${closed ? 'fredet' : pct(o.sesong[i]) + ' prosent'}" title="${MND[i]}: ${closed ? 'fredet' : pct(o.sesong[i]) + ' %'}"><i></i></button>`;
    }
  }
  $('smap').innerHTML = h;
}
function renderMonth(sel){
  const {y, m} = state.view, n = daysIn(y, m), off = (dowOf(y, m, 1) + 6) % 7, auto = state.wxMode === 'auto';
  // Måneden avhenger ikke av klokkeslettet, så den tegnes bare på nytt når noe annet endrer seg.
  // Tidevannstabellen kan komme når som helst, så versjonen er alltid med.
  const key = JSON.stringify([state.view, state.sel, state.today, state.wxMode, FiskeVaer.version, sel]);
  if (key === state.monthKey) return;
  state.monthKey = key;
  $('monthTitle').textContent = MND[m - 1] + ' ' + y;
  let h = '', anyWx = false;
  for (let i = 0; i < off; i++) h += '<span class="day empty"></span>';
  for (let d = 1; d <= n; d++){
    const w = auto ? FiskeVaer.wxAt(toUTC(y, m, d, 12)) : null;
    const b = dayBest(y, m, d, auto ? wxFn(y, m, d) : null, noSea(), sel), age = moonAge(toUTC(y, m, d, 12));
    const isT = state.today.y === y && state.today.m === m && state.today.d === d;
    const isS = state.sel.y === y && state.sel.m === m && state.sel.d === d;
    if (w) anyWx = true;
    const what = b.opt ? 'beste valg ' + b.opt.kort.toLowerCase() + (b.spot ? ' ved ' + b.spot.kort : '') + ' ' + b.score + ' poeng' : 'lite å hente';
    h += `<button type="button" class="day${isT ? ' today' : ''}${isS ? ' sel' : ''}" data-d="${d}" aria-pressed="${isS}" aria-label="${fmtDate(y, m, d)}${isT ? ', i dag' : ''}${w ? ', ' + symText(w.sym).toLowerCase() : ''}, ${what}"><span class="dn">${d}</span><span class="ic">${moonSvg(age, 14)}${w ? `<span class="dwx">${wxIcon(w)}</span>` : ''}</span><span class="hb"><i style="width:${b.score}%"></i></span></button>`;
  }
  $('days').innerHTML = h;
  // Reglene som gjelder minst én dag i måneden.
  const rl = {laks: false, kveite: false};
  for (let d = 1; d <= n; d++){ const r = activeRules(m, d); rl.laks = rl.laks || r.laks; rl.kveite = rl.kveite || r.kveite; }
  const notes = [];
  if (rl.laks) notes.push('Laks og sjøørret er fredet fra 1. mars til 31. mai.');
  if (rl.kveite) notes.push('Kveite er fredet fra 20. desember til 20. april.');
  const filters = sel.spot || sel.method || sel.gear;
  notes.push((filters ? 'Stolpen under hver dag viser beste poeng for valgene dine. ' : 'Stolpen under hver dag viser beste poeng. ') +
    (anyWx ? 'Dagene med værikon har varsel fra Yr, og der er været regnet med. De andre dagene regnes med vanlig vær for årstiden, så stolpene kan sammenlignes.'
      : 'Uten varsel regnes det med vanlig vær for årstiden.'));
  notes.push('Månen viser fasen, og ny- og fullmåne gir springflo.');
  $('monthNote').textContent = notes.join(' ');
}
function renderSelSum(ctx, plan, anyWx){
  const t = sunTimes(state.sel.y, state.sel.m, state.sel.d);
  let wxNote = '';
  if (state.wxMode === 'manual') wxNote = ' Været du har lagt inn er med.';
  else if (state.wxMode === 'auto' && anyWx) wxNote = ' Værvarselet fra Yr er med.';
  else if (state.wxMode === 'auto' && FiskeVaer.hasData) wxNote = ' Yr har ikke varsel for denne dagen, så det regnes med vanlig vær for årstiden.';
  $('selSum').innerHTML = `<b>${fmtDate(state.sel.y, state.sel.m, state.sel.d)}</b>: best er <b>${plan.opt.navn.toLowerCase()}</b>${plan.spot ? ' ved ' + plan.spot.kort : ''} (${plan.score} poeng kl. ${fmtTime(state.hour)}). Sol opp ${fmtTime(t.rise)}, ned ${fmtTime(t.set)}.` + wxNote;
}

function renderRules(ctx){
  const a = activeRules(ctx.m, ctx.d);
  const badge = '<span class="now-badge">Gjelder nå</span>';
  const item = (t, body, on) => `<details class="acc"><summary><span>${t}${on ? badge : ''}</span><span class="chev" aria-hidden="true"></span></summary><div class="accb">${body}</div></details>`;
  $('rules').innerHTML =
    '<p class="note" style="margin-bottom:8px">Reglene ble sist sjekket 25. oktober 2026 mot Lovdata, Fiskeridirektoratet, Statsforvalteren i Trøndelag og TOFA. De endres, så sjekk dem før du fisker.</p>' +
    item('Fiskekort og tillatelse', '<p>Du trenger ikke fiskekort i saltvann, og ikke grunneierens tillatelse til fiske med stang.</p>', false) +
    item('Minstemål', `<div class="table-wrap"><table><tr><th>Art</th><th>Minstemål</th></tr>
      <tr><td>Torsk</td><td>55 cm innenfor 4 nautiske mil</td></tr><tr><td>Hyse</td><td>40 cm</td></tr><tr><td>Hvitting</td><td>32 cm</td></tr>
      <tr><td>Lysing</td><td>30 cm</td></tr><tr><td>Rødspette</td><td>29 cm</td></tr><tr><td>Kveite</td><td>84 cm</td></tr><tr><td>Sjøørret</td><td>35 cm</td></tr></table></div>
      <p>Minstemålet på sei og makrell gjelder ikke når fisken ikke skal selges, og lyr, brosme og steinbit har ikke minstemål. Er fisken under minstemål: fukt hendene, løsne den forsiktig og slipp den ut.</p>`, false) +
    item('Kveite', '<p>Nord for 62° er det forbudt å fiske etter kveite fra 20. desember til og med 20. april, så kveite du får da må slippes ut. Kveite over 2 meter skal alltid slippes ut.</p>', a.kveite) +
    item('Laks og sjøørret', '<p>Fredet i sjøen 1. mars til 31. mai i hele Trøndelag. Forskriften om dette gjaldt for 2021 til 2025, og TOFA oppgir fortsatt samme fredning, men et vedtak for 2026 er ikke funnet. TOFA ber om at all sjøørret fra indre fjord slippes ut hele året. Det kom svært lite laks i 2026, og Miljødirektoratet har strammet inn laksefisket i Trøndelag, blant annet åpnes ikke kilenotfisket i Trondheimsfjorden. Sjekk gjeldende regler før du fisker etter laks, og slipp ut laks du får som bifangst.</p>', a.laks) +
    item('Elvemunninger og Nidelva', `<p>Ikke fisk nærmere enn 100 meter fra grensen mellom elv og sjø. Utenfor Nidelva og Ilabekken er det to munningsfredningssoner (forskrift 18. juni 2024 nr. 1098):</p>
      <ul class="plain"><li><b>Sone 1</b> er alt innenfor linjen fra ytterste spiss av Lade molo til øvingsplattformen på Ladehammeren, altså Nedre Elvehavna og Nyhavna. Her er alt fiske forbudt, også med stang fra land.</li>
      <li><b>Sone 2</b> er alt innenfor linjen fra kaispissen ved Bynesvegen 34b til Kjerringberget på Lade, altså hele havna fra Ila til Lade. Her kan du fiske etter saltvannsfisk med stang fra land, men all fisking etter laks og sjøørret er forbudt hele året.</li></ul>
      <p>Ilsvikøra, Skansen og Hurtigrutekaia ligger i sone 2. Se sonekartet hos Statsforvalteren i Trøndelag før du fisker.</p>`, false) +
    item('Ål', '<p>Alt fiske etter ål i sjøen er forbudt.</p>', false) +
    item('Sikkerhet', `<ul class="plain"><li>Bruk flytevest på svaberg og kaier, og alltid hvis du er alene eller i mørket.</li><li>Sko med godt grep, og brodder om vinteren. Gå ikke ut på tang eller våte steiner.</li><li>Sjekk tidevann og vind før du går ned til vannet, for flo kan stenge veien tilbake.</li><li>Fortell noen hvor du fisker. Ha mobilen i en vanntett pose og hodelykt med ekstra batterier.</li></ul>`, false) +
    item('Miljø og mat', `<ul class="plain"><li>Ta med søppel og slitt line, og la ikke fiskeslo eller blod ligge på kaiene.</li><li>Fisk fra havneområder kan inneholde miljøgifter. Sjekk Mattilsynets råd før du spiser fisk fra havnebassenget.</li><li>TOFA fraråder å spise flatfisk og bunnfisk fra Østmarkneset.</li></ul>`, false);
}
function renderAlgo(ctx, plan){
  const f = plan.f;
  const est = t => '≈' + t;
  $('algo').innerHTML = `
    <p>Siden regner ut et tall fra 0 til 100 for hver fiskemåte på hver plass. Metoden er den samme som i habitatmodellene fiskeforskere bruker (HSI): hver faktor blir et tall fra 0 til 1, og faktorene ganges sammen. Da kan én dårlig faktor trekke mye ned, og stolpene i hvert kort ganget sammen gir poengene.</p>
    <div class="formula">Poeng = 100 × Sesong × Lys × Strøm × Vær × Vind × Bølger × Bestand</div>
    <ul class="plain">
      <li><b>Sesong</b> kommer fra månedskalenderen i fiskeguiden og glir jevnt mellom månedene. I månedene TOFA sier en fiskemåte er best på en bestemt plass, får plassen fiskemåtens toppsesong. Sjøtemperaturen ved plassen flytter sesongen etter om sjøen er varmere eller kaldere enn vanlig. «Vanlig» er snittet for akkurat den modellruta i MET sin havmodell NorKyst800 2017 til 2025, og temperaturen hver art liker er hentet fra forskning (makrell for eksempel 9 til 13 °C). Fredet art gir 0.</li>
      <li><b>Lys</b> regnes ut fra solhøyden i Trondheim og glir jevnt fra dagslys til natt. Skyer gjør det mørkere, så overskyet midt på dagen teller omtrent som lav sol. Torsk, sei og sjøørret biter best i skumringen, makrell i dagslys.</li>
      <li><b>Strøm</b> kommer fra flo og fjære hos Kartverket: hvor fort sjøen stiger eller faller akkurat da. Strømmen er sterkest midt mellom flo og fjære og nesten borte ved snuen. Bunnfiske med agn teller strømmen mest, fordi strømmen fører lukten av agnet ut. På Trolla, der TOFA sier fisket er best på full flo, teller vannstanden i stedet.</li>
      <li><b>Vær</b> er nedbør og sterk kulde fra Yr.</li>
      <li><b>Vind</b> trekker kraftig ned fra ca. 8 til 11 m/s, avhengig av fiskemåten, fordi det blir vanskelig å kaste og holde kontakt med redskapen.</li>
      <li><b>Bølger</b> regnes ut for plassen fra vindretningen og hvor langt åpent vann det er i den retningen.</li>
      <li><b>Bestand</b> trekker ned sjøørret, som har svak bestand.</li>
    </ul>
    <p><b>Valgene dine:</b> Lar du siden velge, prøver den alle fiskemåter på alle plassene TOFA nevner for dem, og «Beste dag» og «Beste tid» leter gjennom de neste sju dagene og hver halvtime. Velger du stang, sjekkes kastevekten mot vekten fiskemåten trenger, eller vekten TOFA oppgir for plassen. Det som ikke passer valgene dine, vises med en advarsel, men blir aldri valgt som best.</p>
    <p>Lys, strøm og vær vektes ulikt for hver fiskemåte. For torsk teller lyset 45 %, strømmen 40 % og været 15 %. Mangler varsel eller tidevannstabell, bruker siden vind målt på Trondheim – Voll i samme måned 1991 til 2020, snittet over en hel tidevannssyklus og oppholdsvær, så dager med og uten varsel kan sammenlignes. Ordene «Veldig bra», «Bra» og «Middels» er satt ut fra et vanlig år: de beste 10 % av timene er «Veldig bra».</p>
    <p><b>Plassene</b> er de seks TOFA beskriver i Trondheim. Posisjonen er funnet i sjøkartet, og for hver plass er det målt hvor langt det er åpent vann i 36 retninger og hvor dypt det er innen kastavstand, i dybdedataene til Kartverket. Bølgehøyden regnes ut med formelen for vindbølger i Coastal Engineering Manual (US Army Corps of Engineers), og plassen får halve poeng ved 1,25 m bølger, grensen der WMO kaller det moderat sjø. Hele Pir I kan brukes, så der er hver side målt for seg, og siden med minst bølger gjelder. Sjøtemperaturen hentes for hver plass fra modellruta nærmest i havvarselet til MET. Om plassen ligger i en munningsfredningssone er sjekket mot sonekartet til Statsforvalteren.</p>
    <p class="note">Akkurat nå for ${plan.opt.kort.toLowerCase()}${plan.spot ? ' ved ' + plan.spot.kort : ''}: sesong ${pct(f.A)} %, lys ${pct(f.L)} %, ${f.flo ? 'vannstand' : 'strøm'} ${f.tideKnown ? pct(f.C) : est(pct(f.C))} %, vær ${f.wxKnown ? pct(f.R) : est(pct(f.R))} %, vind ${f.wxKnown ? pct(f.Wd) : est(pct(f.Wd))} %${plan.spot ? `, bølger ${f.waves ? pct(f.B) : est(pct(f.B))} %` : ''}.</p>
    <p class="note">Månefase og «solunar-tabeller» er ikke med som egen faktor. Forskningen finner ingen sikker effekt av dem, men månen styrer tidevannet, og det er med. Lufttrykk er heller ikke med, fordi det ikke finnes kontrollerte studier som viser at det betyr noe.</p>
    <p class="note">Dette er anslag, ikke målinger: sesongkalenderen, hvor godt lyset passer hver fiskemåte, vektingen mellom lys, strøm og vær, hvor mye stille vann ved snuen trekker ned, og kastevekten til stangtypene. Tallene står i js/fiskemodell.js.</p>
    <p class="note">Vind, skyer, nedbør og temperatur hentes fra timesvarselet til Yr (MET Norway) for hvert klokkeslett, opptil ca. ni dager frem. Sjøtemperaturen kommer fra MET sitt havvarsel, flo og fjære fra Kartverket, og kartet fra Kartverket.</p>`;
}

/* ----- Vær-kontroller ----- */
function buildChips(){
  $('presets').innerHTML = PRESETS.map(p => `<button type="button" class="chip" data-p="${p.id}" aria-pressed="false">${p.t}</button>`).join('');
  $('cloudChips').innerHTML = CLOUDS.map(c => `<button type="button" class="chip" data-c="${c.v}" aria-pressed="false">${c.t}</button>`).join('');
  $('rainChips').innerHTML = RAINS.map(c => `<button type="button" class="chip" data-r="${c.v}" aria-pressed="false">${c.t}</button>`).join('');
}
function syncWx(ctx){
  const mode = state.wxMode, cur = mode === 'manual' ? state.wx : ctx.wx, shown = cur || state.wx;
  // Glidebryterne viser været som brukes nå: varselet fra Yr, eller det du har lagt inn.
  $('wind').value = shown.wind; $('temp').value = shown.temp;
  $('windOut').textContent = fmtNum(shown.wind) + ' m/s, ' + windName(shown.wind).toLowerCase();
  $('tempOut').textContent = shown.temp + ' °C';
  document.querySelectorAll('#cloudChips .chip').forEach(b => b.setAttribute('aria-pressed', String(!!cur && +b.dataset.c === cur.cloud)));
  document.querySelectorAll('#rainChips .chip').forEach(b => b.setAttribute('aria-pressed', String(!!cur && b.dataset.r === cur.rain)));
  document.querySelectorAll('#presets .chip').forEach(b => {
    const p = PRESETS.find(x => x.id === b.dataset.p);
    const on = p.id === 'auto' ? mode === 'auto' : p.id === 'ingen' ? mode === 'off' :
      (mode === 'manual' && p.wx.wind === state.wx.wind && p.wx.cloud === state.wx.cloud && p.wx.rain === state.wx.rain);
    b.setAttribute('aria-pressed', String(on));
  });
  $('wxFine').classList.toggle('dim', !cur);

  const st = FiskeVaer.status, has = FiskeVaer.hasData;
  $('wxSum').textContent = mode === 'off' ? 'Ikke med i beregningen'
    : mode === 'manual' ? 'Lagt inn selv: ' + wxText(state.wx)
    : cur ? `Yr kl. ${fmtTime(ctx.h)}: ${wxText(cur)}`
    : !has ? (st === 'error' ? 'Fikk ikke hentet været' : 'Henter fra Yr …')
    : 'Ingen varsel for dette tidspunktet';

  const upd = FiskeVaer.updated ? fmtTime(osloParts(FiskeVaer.updated).h) : '';
  $('wxSrc').innerHTML = st === 'loading' && !has ? 'Henter værvarselet fra Yr …'
    : !has ? 'Fikk ikke kontakt med Yr. Sjekk nettet, eller legg inn været selv. <button type="button" class="chip" data-act="reload">Prøv igjen</button>'
    : `Varsel fra Yr (MET Norway), oppdatert kl. ${upd}.` + (st === 'loading' ? ' Henter nytt …'
      : st === 'error' ? ' Fikk ikke hentet nytt, så dette er det sist lagrede. <button type="button" class="chip" data-act="reload">Prøv igjen</button>'
      : ' <button type="button" class="chip" data-act="reload">Oppdater</button>');

  $('wxNote').textContent = mode === 'auto' ? 'Siden bruker varselet for hvert klokkeslett, opptil ca. ni dager frem. Flytter du på noe her, bruker siden ditt eget vær i stedet.'
    : mode === 'manual' ? 'Du har lagt inn været selv, og det gjelder hele den valgte dagen. Velger du en annen dag, eller trykker «Fra Yr», brukes varselet igjen.'
    : 'Siden regner bare med dato, lys og tidevann.';
}

/* ----- Tegn alt ----- */
let lastPlan = null;
function render(force){
  const sel = selection();
  const key = JSON.stringify([state.sel, state.view, Math.round(state.hour * 4), fromSlot(), state.follow, state.bestDay, state.bestTime, sel,
    state.wxMode, state.wx, FiskeVaer.version, state.touched, [...state.openSet]]);
  if (!force && key === state.lastKey) return;
  state.lastKey = key;
  resolveWhen(sel);
  const {y, m, d} = state.sel;
  FiskeVaer.loadTide(y, m);
  FiskeVaer.loadTide(state.view.y, state.view.m);
  if (state.bestDay) nextDays(7).forEach(t => FiskeVaer.loadTide(t.y, t.m));
  const wxf = wxFn(y, m, d), ns = noSea();
  const ctx = makeCtx(y, m, d, state.hour, wxf(state.hour), ns), ctxs = dayCtxs(y, m, d, wxf, ns);
  const anyWx = ctxs.some(c => c.wx), dayP = dayPlan(ctxs, fromSlot(), sel);
  const plan = pickBest(candidates(ctx, sel));
  Object.assign(plan, reasons(plan, ctx));
  lastPlan = plan;
  const res = rankOptions(ctx, sel), spots = rankSpots(ctx, sel);
  renderDatebar(ctx);
  renderPicks(ctx, dayP, res, sel);
  renderTimeline(ctx, plan, ctxs, anyWx, dayP, sel);
  renderAlerts(ctx);
  renderHero(ctx, plan, dayP, anyWx, res, sel);
  renderSpotList(ctx, spots);
  renderMap(spots);
  renderRanking(ctx, res);
  renderSeasonMap();
  renderMonth(sel);
  renderSelSum(ctx, plan, anyWx);
  renderRules(ctx);
  renderAlgo(ctx, plan);
  syncWx(ctx);
  syncUrl();
}

// Været du har lagt inn selv gjelder bare dagen du la det inn for.
function leaveManual(y, m, d){
  const s = state.sel;
  if (state.wxMode === 'manual' && (s.y !== y || s.m !== m || s.d !== d)) state.wxMode = 'auto';
}
function setDate(y, m, d, scroll){
  leaveManual(y, m, d);
  state.sel = {y, m, d}; state.view = {y, m};
  state.bestDay = false;
  if (!isToday()) state.follow = false;
  render(true);
  if (scroll) $('results').scrollIntoView({behavior:'smooth', block:'start'});
}
function goNow(){
  const n = osloNow();
  leaveManual(n.y, n.m, n.d);
  state.today = {y:n.y, m:n.m, d:n.d};
  state.sel = {y:n.y, m:n.m, d:n.d}; state.view = {y:n.y, m:n.m};
  state.hour = n.h; state.follow = true; state.bestDay = false; state.bestTime = false;
  render(true);
}
function useYr(){
  state.wxMode = 'auto';
  FiskeVaer.load();
  render(true);
}
function pickSpot(id){ state.spot = id || null; render(true); }
function pickMethod(id){ state.method = id || null; render(true); }

function init(){
  buildChips();
  readChoices();
  const wide = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
  if (wide) $('wxDetails').open = true;

  $('hour').addEventListener('input', e => { state.hour = +e.target.value; state.follow = false; state.bestTime = false; render(); });
  $('btnNow').addEventListener('click', goNow);
  $('dayChips').addEventListener('click', e => {
    const b = e.target.closest('[data-day], [data-bestday]'); if (!b) return;
    if (b.dataset.bestday){ state.bestDay = true; state.follow = false; return render(true); }
    const [y, m, d] = b.dataset.day.split('-').map(Number);
    setDate(y, m, d);
  });
  $('datePick').addEventListener('change', e => {
    const v = /^(\d+)-(\d+)-(\d+)$/.exec(e.target.value);
    if (v) setDate(+v[1], +v[2], +v[3]);
  });
  $('timeChips').addEventListener('click', e => {
    const b = e.target.closest('[data-h], [data-besttime]'); if (!b) return;
    if (b.dataset.besttime) state.bestTime = true;
    else { state.hour = +b.dataset.h; state.bestTime = false; }
    state.follow = false;
    render(true);
  });
  $('spotChips').addEventListener('click', e => { const b = e.target.closest('[data-spot]'); if (b) pickSpot(b.dataset.spot); });
  $('methodChips').addEventListener('click', e => { const b = e.target.closest('[data-method]'); if (b) pickMethod(b.dataset.method); });
  $('rodChips').addEventListener('click', e => {
    const b = e.target.closest('[data-rod]'); if (!b) return;
    const preset = RODS.find(r => r.id === b.dataset.rod);
    setGear(preset ? {rod: preset.id, min: preset.vekt[0], max: preset.vekt[1]} : {...state.gear, rod: b.dataset.rod});
    render(true);
  });
  const gearInput = () => { setGear({rod: 'egen', min: $('gMin').value, max: $('gMax').value}); render(true); };
  $('gMin').addEventListener('change', gearInput);
  $('gMax').addEventListener('change', gearInput);
  $('btnShare').addEventListener('click', () => {
    if (!lastPlan) return;
    const url = shareUrl(lastPlan), note = $('shareNote');
    const show = () => { note.innerHTML = 'Kopier lenken: <a href="' + url + '">' + url.replace(/&/g, '&amp;') + '</a>'; };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(() => { note.textContent = 'Lenken til planen er kopiert. Send den til de du skal fiske med.'; }, show);
    } else show();
  });
  $('spotList').addEventListener('click', e => {
    const b = e.target.closest('[data-pickspot]'); if (!b) return;
    pickSpot(state.spot === b.dataset.pickspot ? null : b.dataset.pickspot);
    $('timeCard').scrollIntoView({behavior:'smooth', block:'start'});
  });

  $('presets').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = PRESETS.find(x => x.id === b.dataset.p);
    if (p.id === 'auto') return useYr();
    if (p.id === 'ingen') state.wxMode = 'off';
    else { toManual(); Object.assign(state.wx, p.wx); }
    render(true);
  });
  $('cloudChips').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; toManual(); state.wx.cloud = +b.dataset.c; render(true); });
  $('rainChips').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; toManual(); state.wx.rain = b.dataset.r; render(true); });
  $('wind').addEventListener('input', e => { toManual(); state.wx.wind = +e.target.value; render(true); });
  $('temp').addEventListener('input', e => { toManual(); state.wx.temp = +e.target.value; render(true); });
  $('wxBody').addEventListener('click', e => { if (e.target.closest('[data-act="reload"]')) FiskeVaer.load(true); });

  $('prevM').addEventListener('click', () => { let {y, m} = state.view; m--; if (m < 1){ m = 12; y--; } state.view = {y, m}; render(true); });
  $('nextM').addEventListener('click', () => { let {y, m} = state.view; m++; if (m > 12){ m = 1; y++; } state.view = {y, m}; render(true); });
  $('smap').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; state.view = {y: state.view.y, m: +b.dataset.m}; render(true); });
  $('days').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; setDate(state.view.y, state.view.m, +b.dataset.d, true); });

  $('optlist').addEventListener('click', e => {
    const pm = e.target.closest('[data-pickmethod]');
    if (pm){ pickMethod(state.method === pm.dataset.pickmethod ? null : pm.dataset.pickmethod); return; }
    const sm = e.target.closest('summary'); if (!sm) return;
    const det = sm.parentElement;
    setTimeout(() => {
      state.touched = true;
      if (det.open) state.openSet.add(det.dataset.id); else state.openSet.delete(det.dataset.id);
    }, 0);
  });
  $('hero').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'auto') return useYr();
    $('wxDetails').open = true;
    $('wxDetails').scrollIntoView({behavior:'smooth', block:'center'});
  });
  $('hero').addEventListener('change', e => {
    const c = e.target.closest('input[type=checkbox]'); if (!c) return;
    if (c.checked) state.checked.add(c.dataset.k); else state.checked.delete(c.dataset.k);
  });

  // Nye data fra Yr eller Kartverket tegner siden på nytt.
  FiskeVaer.onChange(() => render(true));
  FiskeVaer.load();
  // load() henter bare når varselet er eldre enn en halvtime.
  setInterval(() => FiskeVaer.load(), 10 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) FiskeVaer.load(); });

  // Hvert minutt: hold «i dag» riktig over midnatt, og følg klokka hvis du ikke har valgt noe selv.
  setInterval(() => {
    const n = osloNow(), t = state.today, newDay = t.y !== n.y || t.m !== n.m || t.d !== n.d;
    state.today = {y:n.y, m:n.m, d:n.d};
    if (state.follow){
      state.sel = {y:n.y, m:n.m, d:n.d}; state.hour = n.h;
    }
    render(newDay);
  }, 60000);

  render(true);
}
init();
