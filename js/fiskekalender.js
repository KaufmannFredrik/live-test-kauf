/* =========================================================
   GUTTA.NO — fiskekalender.js
   Grensesnittet til fiskekalenderen. Modellen (sol, måne, poeng)
   og hentingen av vær, sjø og tidevann ligger i js/fiskemodell.js.
   ========================================================= */

const $ = id => document.getElementById(id);
const nowInit = osloNow();
const state = {
  today: {y:nowInit.y, m:nowInit.m, d:nowInit.d},
  sel: {y:nowInit.y, m:nowInit.m, d:nowInit.d},
  view: {y:nowInit.y, m:nowInit.m},
  hour: nowInit.h, follow: true,
  wxMode: 'auto',                                          // auto = varsel fra Yr, manual = lagt inn selv, off = uten vær
  wx: {known:true, wind:4, cloud:0.5, rain:'tort', temp:8},  // været du legger inn selv
  openSet: new Set(), touched: false, checked: new Set(), lastKey: '', monthKey: '', mapKey: ''
};
const isToday = () => state.sel.y === state.today.y && state.sel.m === state.today.m && state.sel.d === state.today.d;

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
const LEGEND = '<span><i style="background:var(--ph0)"></i>Dagslys</span><span><i style="background:var(--ph1)"></i>Lav sol</span>' +
  '<span><i style="background:var(--ph2)"></i>Skumring</span><span><i style="background:var(--ph3)"></i>Mørkt</span><span><i style="background:var(--ph4)"></i>Natt</span>';

function moonSvg(age, size){
  const p = age / SYN, waxing = p < 0.5, q = waxing ? p : 1 - p;
  const k = Math.cos(2 * Math.PI * q), rx = (Math.abs(k) * 10).toFixed(2), sweep = k > 0 ? 0 : 1;
  const lit = `M12 2 A10 10 0 0 1 12 22 A${rx} 10 0 0 ${sweep} 12 2 Z`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="var(--moon-dark)"/><path d="${lit}" fill="var(--moon-lit)"${waxing ? '' : ' transform="translate(24 0) scale(-1 1)"'}/></svg>`;
}
const pct = x => Math.round(x * 100);
function whenLabel(ctx){
  if (isToday() && state.follow) return 'akkurat nå';
  return (isToday() ? 'i dag' : fmtDate(ctx.y, ctx.m, ctx.d)) + ' kl. ' + fmtTime(ctx.h);
}

/* ----- Vær: Yr, lagt inn selv eller ingen ----- */
function wxFor(y, m, d, h){
  if (state.wxMode === 'manual') return state.wx;
  if (state.wxMode === 'auto') return FiskeVaer.wxAt(toUTC(y, m, d, h));
  return null;
}
const wxFn = (y, m, d) => h => wxFor(y, m, d, h);
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
  return 'Yr har ikke varsel for dette tidspunktet, så poengene er regnet uten vær.';
}

function renderDatebar(ctx){
  const {y, m, d} = state.sel, t = sunTimes(y, m, d), age = moonAge(toUTC(y, m, d, 12)), sp = springness(age);
  const len = t.set - t.rise, lh = Math.floor(len), lm = Math.round((len - lh) * 60);
  const tides = FiskeVaer.tides(y, m, d), sea = FiskeVaer.seaAt(toUTC(y, m, d, ctx.h)), wx = ctx.wx;
  const times = high => tides.filter(e => e.high === high).map(e => fmtTime(e.h)).join(' og ');
  $('datebar').innerHTML = `
    <div class="dateline"><span class="dow">${DAG[dowOf(y, m, d)]}</span><span class="dnum">${d}. ${MND[m - 1]} ${y}</span>${isToday() ? '<span class="fk-tag">I dag</span>' : ''}</div>
    <dl class="facts">
      <div><dt>Sol opp og ned</dt><dd class="num">${fmtTime(t.rise)}–${fmtTime(t.set)}<small>${lh} t ${lm} min dagslys</small></dd></div>
      <div><dt>Måne</dt><dd>${moonSvg(age, 18)} ${moonName(age)}</dd></div>
      <div><dt>Tidevann</dt><dd>${tideLabel(sp)}<small>${springText(age)}</small></dd></div>
      ${tides && tides.length ? `<div><dt>Flo og fjære</dt><dd class="num">Flo ${times(true)}<small>Fjære ${times(false)}</small></dd></div>` : ''}
      ${wx ? `<div><dt>Vær kl. ${fmtTime(ctx.h)}</dt><dd>${wxIcon(wx)} ${wx.temp} °C<small>${windName(wx.wind)}, ${fmtNum(wx.wind)} m/s</small></dd></div>` : ''}
      ${sea ? `<div><dt>Sjøen</dt><dd class="num">${fmtNum(sea.temp.toFixed(1))} °C${typeof sea.wave === 'number' ? `<small>Bølger ${fmtNum(sea.wave.toFixed(1))} m</small>` : ''}</dd></div>` : ''}
    </dl>`;
}

function renderTimeline(ctx, top, ctxs, anyWx){
  const {y, m, d} = state.sel;
  $('hour').value = state.hour;
  const tide = FiskeVaer.tideAt(y, m, d, state.hour);
  $('timeLabel').innerHTML = `Klokka <b class="num">${fmtTime(state.hour)}</b> · ${PHASE_NAME[ctx.ph].toLowerCase()}` +
    (tide ? ` · sjøen ${tide.rising ? 'stiger mot flo' : 'faller mot fjære'} kl. ${fmtTime(tide.next.h)}` : '') +
    (isToday() && state.follow ? ' · følger klokka' : '');
  $('btnNow').hidden = isToday() && state.follow;
  $('strip').innerHTML = ctxs.map(c => `<i style="background:var(--ph${c.phIdx})"></i>`).join('');
  const arr = curveFor(top.opt, ctxs);
  const pts = arr.map((v, i) => `${(i + 0.5).toFixed(1)},${(38 - v / 100 * 36).toFixed(1)}`);
  $('curve').innerHTML = `<polygon points="0,40 ${pts.join(' ')} 48,40" fill="var(--heat)" opacity=".28"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--heat)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
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

  $('curveNote').textContent = 'Kurven viser poengene for «' + top.opt.kort.toLowerCase() + '» gjennom døgnet' +
    (!anyWx ? '.' : state.wxMode === 'auto' ? ', med værvarselet fra Yr.' : ', med været du har lagt inn.');
  return bestWindow(arr);
}

function renderAlerts(ctx){
  $('alerts').innerHTML = warnings(ctx).map(w => `<div class="alert ${w.lvl}">${w.t}</div>`).join('');
}

function renderHero(ctx, res, win, anyWx){
  const top = res[0], o = top.opt, f = top.f;
  const wx = ctx.wx, w = pickWeight(o, ctx);
  const spots = spotsFor(o, ctx).filter(s => !s.stengtNaa).slice(0, 2);
  const lowTop = top.score < 20;
  const joinList = a => a.map((t, i) => i ? t.charAt(0).toLowerCase() + t.slice(1) : t).join(', ');
  const why = top.pro.length ? joinList(top.pro.slice(0, 3)) + '.' : 'Lite taler for noe nå.';
  const bad = top.con.length ? ' Mot: ' + joinList(top.con.slice(0, 2)).toLowerCase() + '.' : '';
  const wxSrc = !anyWx ? '' : state.wxMode === 'auto' ? ' (med værvarselet fra Yr)' : ' (med været du har lagt inn)';
  const winTxt = win ? `Beste tidsrom ${isToday() ? 'i dag' : 'denne dagen'}: <b class="num">${fmtTime(win.from)} til ${fmtTime(win.to)}</b>${wxSrc}` : '';
  const hint = wxHint(ctx);
  const next = res.slice(1, 4).map(r => `<span>${r.opt.kort}: <b class="num">${r.score}</b></span>`).join('');
  const colorLabel = o.farge === 'agn' ? 'Agn' : 'Farge';
  const pack = packList(o, ctx).map(it => {
    const key = o.id + '|' + it.t;
    return `<label class="chk"><input type="checkbox" data-k="${key.replace(/"/g, '&quot;')}"${state.checked.has(key) ? ' checked' : ''}><span>${it.t}${it.must ? '<span class="must">Må ha</span>' : ''}</span></label>`;
  }).join('');
  $('hero').innerHTML = `
    <p class="eyebrow">Anbefaling ${whenLabel(ctx)}</p>
    <h2>${lowTop ? 'Lite å hente nå. Best er ' + o.navn.toLowerCase() : o.navn}</h2>
    ${o.arter !== o.kort ? `<p class="arter">${o.arter}</p>` : ''}
    <div class="scorerow">
      <div class="score num">${top.score}<small>/100</small></div>
      <div><span class="verdict">${verdict(top.score, f.closed)}</span>${winTxt ? `<p class="win" style="margin-top:6px">${winTxt}</p>` : ''}</div>
    </div>
    <p class="why">${why}${bad}</p>
    ${hint ? `<p class="win" style="margin:-4px 0 14px">${hint}</p>` : ''}
    <dl class="setup">
      <div><dt>Stang</dt><dd>${o.stang}</dd></div>
      <div><dt>${o.farge === 'agn' ? 'Takkel' : 'Sluk'}</dt><dd>${o.slukType}</dd></div>
      <div><dt>Vekt</dt><dd>${weightText(o, w)}${w.heavy ? `<small>Litt tyngre i dag: ${w.why}.</small>` : ''}</dd></div>
      <div><dt>${colorLabel}</dt><dd>${colorAdvice(o, ctx)}</dd></div>
      <div><dt>Teknikk</dt><dd>${o.teknikk}</dd></div>
      <div><dt>Plass</dt><dd>${spots.length ? spots.map(s => `<b>${s.navn}</b>`).join(' eller ') : 'Brygger og svaberg. Guiden har ingen faste plasser for denne arten.'}${wx && wx.wind >= 8 ? '<small>Vind mot land gir bølger og tang på linen, så velg et sted der vinden ikke står rett inn.</small>' : ''}</dd></div>
    </dl>
    <div class="pack"><h4>Pakkeliste</h4>${pack}</div>
    <div class="next"><span>Deretter:</span>${next}</div>`;
}

function factorRows(r){
  const f = r.f, rows = [
    ['Sesong', f.S, pct(f.S) + '%'],
    ['Lys', f.T, pct(f.T) + '%'],
    ['Vær og vind', f.wxKnown ? f.Wd * f.Wx : null, f.wxKnown ? pct(f.Wd * f.Wx) + '%' : '–'],
    ['Tidevann', f.M, pct(f.M) + '%']
  ];
  if (f.hensyn < 1) rows.push(['Bestand', f.hensyn, pct(f.hensyn) + '%']);
  return rows.map(([n, v, t]) => `<div class="fr"><span>${n}</span><div class="bar"><i style="width:${v === null ? 0 : pct(v)}%"></i></div><em>${t}</em></div>`).join('');
}
function renderRanking(ctx, res){
  $('optlist').innerHTML = res.map((r, i) => {
    const o = r.opt, open = state.openSet.has(o.id) || (!state.touched && i === 0);
    const spots = spotsFor(o, ctx);
    return `<details class="opt${r.score < 12 ? ' off' : ''}" data-id="${o.id}"${open ? ' open' : ''}>
      <summary>
        <span class="nm">${o.navn}${i === 0 && r.score >= 12 ? '<span class="rk">Best nå</span>' : ''}</span>
        <span class="sc"><span><b>${r.score}</b><small>${verdict(r.score, r.f.closed)}</small></span><span class="chev" aria-hidden="true"></span></span>
        <span class="sub">${o.undertekst}</span>
        <span class="bar"><i style="width:${r.score}%"></i></span>
      </summary>
      <div class="optbody">
        <div class="nowchips">${r.pro.map(t => `<span class="ok">${t}</span>`).join('')}${r.con.map(t => `<span class="no">${t}</span>`).join('')}</div>
        <div class="pc">
          <div class="pro"><h4>Fordeler</h4><ul>${o.fordeler.map(t => `<li>${t}</li>`).join('')}</ul></div>
          <div class="con"><h4>Ulemper</h4><ul>${o.ulemper.map(t => `<li>${t}</li>`).join('')}</ul></div>
        </div>
        <div><h4>Slik får du poengene</h4><div class="factors">${factorRows(r)}</div></div>
        <div><h4>Steder</h4>${spots.length ? `<ul class="plain">${spots.map(s => `<li><b>${s.navn}</b>${s.stengtNaa ? ' (stengt for andre enn campinggjester nå)' : ''}<br><small>${s.notat}</small></li>`).join('')}</ul>` : '<p class="note">Fra brygger og svaberg. Guiden har ingen faste plasser for sjøørret.</p>'}</div>
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
function renderMonth(){
  const {y, m} = state.view, n = daysIn(y, m), off = (dowOf(y, m, 1) + 6) % 7, auto = state.wxMode === 'auto';
  // Måneden avhenger ikke av klokkeslettet, så den tegnes bare på nytt når noe annet endrer seg.
  const key = JSON.stringify([state.view, state.sel, state.today, auto, auto ? FiskeVaer.version : 0]);
  if (key === state.monthKey) return;
  state.monthKey = key;
  $('monthTitle').textContent = MND[m - 1] + ' ' + y;
  let h = '', anyWx = false;
  for (let i = 0; i < off; i++) h += '<span class="day empty"></span>';
  for (let d = 1; d <= n; d++){
    const w = auto ? FiskeVaer.wxAt(toUTC(y, m, d, 12)) : null;
    const b = dayBest(y, m, d, auto ? wxFn(y, m, d) : null), age = moonAge(toUTC(y, m, d, 12));
    const isT = state.today.y === y && state.today.m === m && state.today.d === d;
    const isS = state.sel.y === y && state.sel.m === m && state.sel.d === d;
    if (w) anyWx = true;
    h += `<button type="button" class="day${isT ? ' today' : ''}${isS ? ' sel' : ''}" data-d="${d}" aria-pressed="${isS}" aria-label="${fmtDate(y, m, d)}${isT ? ', i dag' : ''}${w ? ', ' + symText(w.sym).toLowerCase() : ''}, ${b.opt ? 'beste valg ' + b.opt.kort.toLowerCase() + ' ' + b.score + ' poeng' : 'lite å hente'}"><span class="dn">${d}</span><span class="ic">${moonSvg(age, 14)}${w ? `<span class="dwx">${wxIcon(w)}</span>` : ''}</span><span class="hb"><i style="width:${b.score}%"></i></span></button>`;
  }
  $('days').innerHTML = h;
  const rl = activeRules(m, 15), notes = [];
  if (rl.laks) notes.push('Laks og sjøørret er fredet denne måneden.');
  if (rl.kveite) notes.push('Kveite må slippes ut i denne perioden.');
  notes.push(anyWx ? 'Stolpen under hver dag viser beste poeng. Dagene med værikon har varsel fra Yr, og der er været regnet med.'
    : 'Stolpen under hver dag viser beste poeng uten vær.');
  notes.push('Månen viser fasen, og ny- og fullmåne gir springflo.');
  $('monthNote').textContent = notes.join(' ');
}
function renderSelSum(ctx, top, anyWx){
  const t = sunTimes(state.sel.y, state.sel.m, state.sel.d);
  let wxNote = '';
  if (state.wxMode === 'manual') wxNote = ' Været du har lagt inn er med.';
  else if (state.wxMode === 'auto' && anyWx) wxNote = ' Værvarselet fra Yr er med.';
  else if (state.wxMode === 'auto' && FiskeVaer.hasData) wxNote = ' Yr har ikke varsel for denne dagen, så været er ikke med.';
  $('selSum').innerHTML = `<b>${fmtDate(state.sel.y, state.sel.m, state.sel.d)}</b>: best er <b>${top.opt.navn.toLowerCase()}</b> (${top.score} poeng kl. ${fmtTime(state.hour)}). Sol opp ${fmtTime(t.rise)}, ned ${fmtTime(t.set)}.` + wxNote;
}

function renderRules(ctx){
  const a = activeRules(ctx.m, ctx.d);
  const badge = '<span class="now-badge">Gjelder nå</span>';
  const item = (t, body, on) => `<details class="acc"><summary><span>${t}${on ? badge : ''}</span><span class="chev" aria-hidden="true"></span></summary><div class="accb">${body}</div></details>`;
  $('rules').innerHTML =
    item('Fiskekort og tillatelse', '<p>Du trenger ikke fiskekort i saltvann, og ikke grunneierens tillatelse til fiske med stang.</p>', false) +
    item('Minstemål', `<div class="table-wrap"><table><tr><th>Art</th><th>Minstemål</th></tr>
      <tr><td>Torsk</td><td>55 cm</td></tr><tr><td>Hyse</td><td>40 cm</td></tr><tr><td>Hvitting</td><td>32 cm</td></tr>
      <tr><td>Lysing</td><td>30 cm</td></tr><tr><td>Rødspette</td><td>29 cm</td></tr><tr><td>Kveite</td><td>84 cm</td></tr><tr><td>Sjøørret</td><td>35 cm</td></tr></table></div>
      <p>Ingen minstemål på makrell, sei, lyr, brosme og steinbit. Er fisken under minstemål: fukt hendene, løsne den forsiktig og slipp den ut.</p>`, false) +
    item('Kveite', '<p>Må slippes ut fra 20. desember til og med 20. april. Kveite over 2 meter skal alltid slippes ut.</p>', a.kveite) +
    item('Laks og sjøørret', '<p>Fredet i sjøen 1. mars til 31. mai i hele Trøndelag. TOFA ber om at all sjøørret fra indre fjord slippes ut hele året. Trondheimsfjorden var stengt for laksefiske med stang i 2024, og jeg fant ingen sak om 2026, så sjekk gjeldende regler før du fisker etter laks og slipp ut laks du får som bifangst.</p>', a.laks) +
    item('Elvemunninger og Nidelva', '<p>Ikke fisk nærmere enn 100 meter fra grensen mellom elv og sjø. Nidelvas munning har egen fredningssone innenfor linjen fra Pir 1 til Ladehammeren, så sjekk kartet før du fisker ved Pir 1, Brattøra og Skansen.</p>', false) +
    item('Ål', '<p>Alt fiske etter ål i sjøen er forbudt.</p>', false) +
    item('Sikkerhet', `<ul class="plain"><li>Bruk flytevest på svaberg og kaier, og alltid hvis du er alene eller i mørket.</li><li>Sko med godt grep, og brodder om vinteren. Gå ikke ut på tang eller våte steiner.</li><li>Sjekk tidevann og vind før du går ned til vannet, for flo kan stenge veien tilbake.</li><li>Fortell noen hvor du fisker. Ha mobilen i en vanntett pose og hodelykt med ekstra batterier.</li></ul>`, false) +
    item('Miljø og mat', `<ul class="plain"><li>Ta med søppel og slitt line, og la ikke fiskeslo eller blod ligge på kaiene.</li><li>Fisk fra havneområder kan inneholde miljøgifter. Sjekk Mattilsynets råd før du spiser fisk fra havnebassenget.</li><li>TOFA fraråder å spise flatfisk og bunnfisk fra Østmarkneset.</li></ul>`, false);
}
function renderSpots(){
  const order = ['ostmarkneset','hurtigrutekaia','trolla','ilsvikora','storsand','skansen','sjobadet','korsvika'];
  $('spots').innerHTML = order.map(id => {
    const s = SPOTS[id], best = OPTIONS.filter(o => o.steder.includes(id)).map(o => o.kort).join(', ');
    return `<details class="acc"><summary><span>${s.navn}</span><span class="chev" aria-hidden="true"></span></summary><div class="accb"><p>${s.notat}</p>${best ? `<p class="note">Passer til: ${best}</p>` : ''}</div></details>`;
  }).join('');
}
function renderAlgo(ctx, top){
  const f = top.f;
  $('algo').innerHTML = `
    <p>Siden regner ut et tall fra 0 til 100 for hvert alternativ. Tallet bygger på fem ting som du kan se i hvert kort.</p>
    <div class="formula">Poeng = Sesong × Vind × (0,35 + 0,65 × (0,45 × Lys + 0,30 × Vær + 0,25 × Tidevann))</div>
    <ul class="plain">
      <li><b>Sesong</b> kommer fra månedskalenderen i fiskeguiden og glir jevnt mellom månedene. Utenfor sesong blir poengene lave uansett vær. Fredet art gir 0.</li>
      <li><b>Lys</b> regnes ut fra solhøyden i Trondheim: dagslys, lav sol, skumring, mørkt eller natt. Sei og sjøørret liker lavt lys, makrell liker dagslys.</li>
      <li><b>Vind</b> trekker kraftig ned fra ca. 8 til 11 m/s, avhengig av fiskemetode, og nesten til null ved kuling.</li>
      <li><b>Vær</b> er skyer og nedbør: fisk som er var for lys liker overskyet, mye regn drar ned. Uten vær bruker siden en nøytral verdi.</li>
      <li><b>Tidevann</b> kommer fra månefasen. Ny- og fullmåne gir springflo og mest strøm, som hjelper de fleste alternativene.</li>
    </ul>
    <p class="note">Akkurat nå for ${top.opt.kort.toLowerCase()}: sesong ${pct(f.S)} %, lys ${pct(f.T)} %, vind ${f.wxKnown ? pct(f.Wd) + ' %' : 'ikke med'}, vær ${f.wxKnown ? pct(f.Wx) + ' %' : 'ikke med'}, tidevann ${pct(f.M)} %.</p>
    <p class="note">Vind, skyer, nedbør og temperatur hentes fra timesvarselet til Yr (MET Norway) for hvert klokkeslett, opptil ca. ni dager frem. Det gamle varselet brukes også bakover i tid resten av dagen i dag. Styrken på tidevannet i poengene anslås fra månefasen, mens klokkeslettene for flo og fjære kommer fra Kartverket.</p>`;
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
    : mode === 'manual' ? 'Du har lagt inn været selv, og det gjelder hele den valgte dagen. Trykk «Fra Yr» for å bruke varselet igjen.'
    : 'Siden regner bare med dato, lys og tidevann.';
}

/* ----- Tegn alt ----- */
function render(force){
  const {y, m, d} = state.sel;
  const key = JSON.stringify([state.sel, state.view, Math.round(state.hour * 4), state.wxMode, state.wx, FiskeVaer.version, state.touched, [...state.openSet]]);
  if (!force && key === state.lastKey) return;
  state.lastKey = key;
  FiskeVaer.loadTide(y, m);
  const wxf = wxFn(y, m, d), ctx = makeCtx(y, m, d, state.hour, wxf(state.hour)), res = rankOptions(ctx), ctxs = dayCtxs(y, m, d, wxf);
  const anyWx = ctxs.some(c => c.wx);
  renderDatebar(ctx);
  const win = renderTimeline(ctx, res[0], ctxs, anyWx);
  renderAlerts(ctx);
  renderHero(ctx, res, win, anyWx);
  renderRanking(ctx, res);
  renderSeasonMap();
  renderMonth();
  renderSelSum(ctx, res[0], anyWx);
  renderRules(ctx);
  renderAlgo(ctx, res[0]);
  syncWx(ctx);
}

function setDate(y, m, d, scroll){
  state.sel = {y, m, d}; state.view = {y, m};
  if (!isToday()) state.follow = false;
  render(true);
  if (scroll) $('results').scrollIntoView({behavior:'smooth', block:'start'});
}
function goNow(){
  const n = osloNow();
  state.today = {y:n.y, m:n.m, d:n.d};
  state.sel = {y:n.y, m:n.m, d:n.d}; state.view = {y:n.y, m:n.m};
  state.hour = n.h; state.follow = true;
  render(true);
}
function useYr(){
  state.wxMode = 'auto';
  FiskeVaer.load();
  render(true);
}

function init(){
  buildChips(); renderSpots();
  const wide = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
  if (wide) $('wxDetails').open = true;

  $('hour').addEventListener('input', e => { state.hour = +e.target.value; state.follow = false; render(); });
  $('btnNow').addEventListener('click', goNow);
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

  setInterval(() => {
    if (!state.follow) return;
    const n = osloNow();
    state.today = {y:n.y, m:n.m, d:n.d};
    state.sel = {y:n.y, m:n.m, d:n.d}; state.hour = n.h;
    render();
  }, 60000);

  render(true);
}
init();
