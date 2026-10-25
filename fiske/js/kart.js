/* =========================================================
   FISKE — kart.js
   Kartet over fiskeplassene. Sjøkartet er fra Kartverket, sonene
   fra Statsforvalteren (js/soner.js), og poengene, artene, bølgene
   og åpent vann rundt hver plass fra modellen i js/fiskemodell.js,
   så kartet viser det samme som kalenderen.
   ========================================================= */

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const km = m => m >= 1000 ? fmtNum((m / 1000).toFixed(m >= 10000 ? 0 : 1)) + ' km' : Math.round(m) + ' m';
// Plassene fra vest mot øst, nummerert som figurene på en plansje.
const ORDEN = SPOT_IDS.slice().sort((a, b) => SPOTS[a].pos[1] - SPOTS[b].pos[1]);
const NR = {};
ORDEN.forEach((id, i) => { NR[id] = i + 1; });
const ROMER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const ui = {valgt: null, follow: true, h: osloNow().h};

const SONE = {
  sone1: {t: 'Munningsfredningssone 1', txt: 'Alt fiske er forbudt, også med stang fra land.', stil: {color: '#9b3522', weight: 1.2, fillColor: '#9b3522', fillOpacity: .2}},
  sone2: {t: 'Munningsfredningssone 2', txt: 'Bare fiske etter saltvannsfisk med stang fra land. Fiske etter laks og sjøørret er forbudt hele året.', stil: {color: '#8a5f36', weight: 1, dashArray: '5 4', fillColor: '#c9a46a', fillOpacity: .12}},
  hundre: {t: '100 meter fra elvemunningen', txt: 'Alt fiske er forbudt nærmere enn 100 m fra grensen mellom elv og sjø.', stil: {color: '#9b3522', weight: 1, fillColor: '#9b3522', fillOpacity: .4}}
};

/* ----- Tidspunktet og modellen ----- */
function ctxNow(){
  const n = osloNow(), h = ui.follow ? n.h : ui.h;
  FiskeVaer.loadTide(n.y, n.m);
  return makeCtx(n.y, n.m, n.d, h, FiskeVaer.wxAt(toUTC(n.y, n.m, n.d, h)));
}
let ctx = null, rows = {};
function compute(){
  ctx = ctxNow();
  rows = {};
  rankSpots(ctx, {spot: null, method: null, gear: null}).forEach(r => { rows[r.id] = r; });
}
const live = r => !!r.best && !r.stengt;
const fishName = f => cap(f === 'kveite' ? (activeRules(ctx.m, ctx.d).kveite ? 'kveite (må slippes ut nå)' : 'kveite (sjelden)') : f);
const fishLinks = list => list.map(f => { const h = artHref(f); return h ? `<a href="${h}">${fishName(f)}</a>` : fishName(f); }).join(', ');

/* ----- Kartet ----- */
const map = L.map('kart', {zoomControl: false, scrollWheelZoom: true, zoomSnap: .5});
L.control.zoom({position: 'topright', zoomInTitle: 'Zoom inn', zoomOutTitle: 'Zoom ut'}).addTo(map);
const kv = (lag, navn) => L.tileLayer(`https://cache.kartverket.no/v1/wmts/1.0.0/${lag}/default/webmercator/{z}/{y}/{x}.png`,
  {maxZoom: 19, maxNativeZoom: 18, attribution: `${navn} &copy; <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a>`});
const bakgrunn = {'Sjøkart': kv('sjokartraster', 'Sjøkart'), 'Gråtonekart': kv('topograatone', 'Kart'), 'Topografisk kart': kv('topo', 'Kart')};
bakgrunn['Sjøkart'].addTo(map);

// Sonene, største først så de minste ligger øverst.
const order = {sone2: 0, sone1: 1, hundre: 2};
const soneLag = L.layerGroup(SONER.slice().sort((a, b) => order[a.type] - order[b.type]).map(z =>
  L.polygon(z.ringer, {...SONE[z.type].stil, className: 'sone'})
    .bindPopup(`<b>${SONE[z.type].t}</b><br>${esc(z.navn)}. ${SONE[z.type].txt} <a href="kalender.html#rules">Reglene</a>`)
)).addTo(map);

// Pir I har tre sider som er målt hver for seg. De vises når du zoomer inn.
const sideLag = L.layerGroup();
SPOT_IDS.forEach(id => (SPOTS[id].sider || []).forEach(d =>
  L.circleMarker(d.pos, {radius: 4, color: '#211b14', weight: 1, fillColor: '#f5efe1', fillOpacity: 1})
    .bindTooltip(cap(d.navn), {direction: 'top'}).addTo(sideLag)));

const pins = {};
function pinIcon(id){
  const r = rows[id], s = live(r) ? r.best.score : null, c = poengFarge(s);
  const dark = s != null && s >= VERDICT.bra;
  return L.divIcon({className: 'pin' + (ui.valgt === id ? ' on' : '') + (dark ? ' dark' : ''), iconSize: [32, 32], iconAnchor: [16, 16],
    html: `<span style="background:${c}">${NR[id]}</span>`});
}
function drawPins(){
  ORDEN.forEach(id => {
    const s = SPOTS[id], r = rows[id];
    const tip = `<b>${NR[id]}. ${esc(s.kort)}</b> · ${live(r) ? r.best.score + ' ' + verdict(r.best.score, r.best.f.closed).toLowerCase() : r.stengt ? 'stengt nå' : 'artsfiske'}`;
    if (!pins[id]){
      pins[id] = L.marker(s.pos, {icon: pinIcon(id), keyboard: true, title: s.navn, riseOnHover: true}).addTo(map);
      pins[id].on('click', () => velg(id));
      pins[id].bindTooltip(tip, {direction: 'top', offset: [0, -14]});
    } else {
      pins[id].setIcon(pinIcon(id));
      pins[id].setTooltipContent(tip);
    }
    pins[id].setZIndexOffset(ui.valgt === id ? 1000 : 0);
  });
}
L.control.layers(bakgrunn, {'Fredningssoner': soneLag, 'Sidene på Pir I': sideLag}, {position: 'topright'}).addTo(map);
map.on('zoomend', () => { if (map.getZoom() >= 15) sideLag.addTo(map); else sideLag.remove(); });

// Tegnforklaring nederst til venstre, som på et gammelt kart.
const legend = L.control({position: 'bottomleft'});
legend.onAdd = () => {
  const d = L.DomUtil.create('div', 'legend-box');
  const sw = (c, t) => `<span><i style="background:${c}"></i>${t}</span>`;
  d.innerHTML = `<b>Tegnforklaring</b>` +
    sw(poengFarge(VERDICT.veldig), 'Veldig bra') + sw(poengFarge(VERDICT.bra), 'Bra') + sw(poengFarge(VERDICT.middels), 'Middels') + sw(poengFarge(VERDICT.svakt), 'Svakt') + sw(poengFarge(null), 'Stengt eller uten poeng') +
    `<span><i class="z1"></i>Sone 1: alt fiske forbudt</span><span><i class="z2"></i>Sone 2: bare saltvannsfisk med stang</span>`;
  L.DomEvent.disableClickPropagation(d);
  return d;
};
legend.addTo(map);
map.fitBounds(SPOT_IDS.map(id => SPOTS[id].pos), {padding: [40, 40]});

/* ----- Åpent vann rundt plassen: en vindrose ----- */
// Strålene viser hvor langt det er åpent vann i hver retning (logaritmisk). Pila er vinden nå.
function rose(side, size, label){
  const R = size / 2 - 18, c = size / 2, lg = F => Math.max(0, Math.min(1, Math.log10(Math.max(1, F)) / Math.log10(30000)));
  const pt = (b, r) => [(c + r * Math.sin(rad(b))).toFixed(1), (c - r * Math.cos(rad(b))).toFixed(1)];
  const poly = side.fetch.map((F, i) => pt(i * 10, R * lg(F)).join(',')).join(' ');
  const rings = [100, 1000, 10000].map(F => `<circle cx="${c}" cy="${c}" r="${(R * lg(F)).toFixed(1)}" class="rr"/>` +
    `<text x="${c + 3}" y="${(c - R * lg(F) - 2).toFixed(1)}" class="rt">${km(F)}</text>`).join('');
  const spokes = Array.from({length: 36}, (_, i) => { const [x, y] = pt(i * 10, R); return `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="${i % 9 ? 'sp' : 'sp main'}"/>`; }).join('');
  const card = [['N', 0], ['Ø', 90], ['S', 180], ['V', 270]].map(([t, b]) => { const [x, y] = pt(b, R + 10); return `<text x="${x}" y="${y}" class="cd">${t}</text>`; }).join('');
  let wind = '';
  if (ctx.wx && ctx.wx.dir != null){
    const [x1, y1] = pt(ctx.wx.dir, R + 4), [x2, y2] = pt(ctx.wx.dir, R * .45);
    wind = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wa" marker-end="url(#ah)"/>`;
  }
  return `<figure class="rose"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Åpent vann rundt ${esc(label)}">
    <defs><pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" class="ht"/></pattern>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="wh"/></marker></defs>
    ${spokes}${rings}<polygon points="${poly}" class="fp"/>${card}${wind}<circle cx="${c}" cy="${c}" r="2.5" class="ctr"/></svg>
    <figcaption>${esc(cap(label))}</figcaption></figure>`;
}

/* ----- Registeret ved siden av kartet ----- */
function scoreTxt(r){
  if (r.stengt) return ['–', 'Stengt nå'];
  if (!r.best) return ['–', r.annet ? 'Artsfiske' : 'Ikke nevnt'];
  return [r.best.score, verdict(r.best.score, r.best.f.closed)];
}
function renderList(){
  $('register').innerHTML = ORDEN.map(id => {
    const r = rows[id], [sc, v] = scoreTxt(r);
    return `<li><button type="button" class="reg${ui.valgt === id ? ' on' : ''}" data-id="${id}" aria-pressed="${ui.valgt === id}">
      <span class="fig">${ROMER[NR[id] - 1]}</span>
      <span class="rn"><b>${esc(r.navn)}</b><small>${r.best ? esc(r.best.opt.kort) : r.annet ? 'Artsfiske med små kroker' : ''}</small></span>
      <span class="rs"><b>${sc}</b><small>${v}</small></span></button></li>`;
  }).join('');
}
function renderWhen(){
  const n = osloNow(), h = ui.follow ? n.h : ui.h, w = ctx.wx, t = ctx.tide;
  $('tid').value = h;
  $('tidOut').textContent = (ui.follow ? 'Nå, kl. ' : 'I dag kl. ') + fmtTime(h);
  $('btnNa').hidden = ui.follow;
  $('forhold').innerHTML = [
    PHASE_NAME[ctx.ph],
    w ? `<span class="wxi">${wxIcon(w)}</span> ${w.temp} °C, ${fmtNum(w.wind)} m/s` + (w.dir != null ? ' fra ' + windDir(w.dir) : '') : 'Venter på været fra Yr',
    t ? `sjøen ${t.rising ? 'stiger' : 'faller'}, ${t.next.high ? 'flo' : 'fjære'} kl. ${fmtTime(t.next.h)}` : ''
  ].filter(Boolean).join(' · ');
}
function renderDetail(){
  const box = $('detalj');
  if (!ui.valgt){ box.hidden = true; $('liste').hidden = false; return; }
  const id = ui.valgt, s = SPOTS[id], r = rows[id], [sc, v] = scoreTxt(r);
  const rl = activeRules(ctx.m, ctx.d);
  const sides = s.sider || [s];
  const depth = sides.map(d => `<tr><td>${s.sider ? cap(d.navn) : 'Fra kanten'}</td><td class="num">${d.dybde[0]} m</td><td class="num">${d.dybde[1]} m</td></tr>`).join('');
  const w = r.waves;
  const waves = w ? (w.H < 0.05 ? `I le for vinden${w.side ? ' på ' + w.side.navn : ''}.` : `Ca. ${fmtNum(w.H.toFixed(1))} m bølger${w.side ? ' på ' + w.side.navn : ''}, med ${km(w.F)} åpent vann mot vinden.`) : '';
  const fisk = r.fisk.length ? fishLinks(r.fisk) : (r.best ? 'Lite å hente her nå.' : 'Guiden sier ikke hva som tas her.');
  const how = r.best ? `<b>${esc(r.best.opt.navn)}</b>` + (r.best.ok ? '' : `<small class="warnline">${esc(r.best.issues[0])}</small>`)
    : r.annet ? `<b>${esc(r.annet.navn)}</b><small>${esc(r.annet.tekst)}</small>` : '';
  const others = r.opts.filter(o => o !== r.best && o.ok && o.score >= VERDICT.svakt).map(o => `${esc(o.opt.kort)} ${o.score}`).join(', ');
  const rules = [];
  if (r.stengt) rules.push('Bryggen er bare for campinggjester nå (13. mai til 1. september).');
  if (s.sone === 2) rules.push('Ligger i munningsfredningssone 2: bare saltvannsfisk, med stang fra land. Ikke fisk etter laks eller sjøørret.');
  if (s.ikkeSpis) rules.push('TOFA fraråder å spise flatfisk og bunnfisk herfra.');
  if (rl.kveite && r.fisk.includes('kveite')) rules.push('Kveite er fredet nå og må slippes ut.');
  box.innerHTML = `<button type="button" class="fk-btn tilbake" id="btnTilbake">&larr; Alle plassene</button>
    <p class="eyebrow">Fig. ${ROMER[NR[id] - 1]} · ${s.pos[0].toFixed(4)}° N, ${s.pos[1].toFixed(4)}° Ø</p>
    <h2>${esc(s.navn)}</h2>
    <div class="dscore"><span class="big num">${sc}</span><span><b>${v}</b><small>${esc($('tidOut').textContent)}</small></span></div>
    <dl class="ddl">
      ${how ? `<div><dt>Fisk med</dt><dd>${how}${others ? `<small>Også: ${others}</small>` : ''}</dd></div>` : ''}
      <div><dt>Du kan få</dt><dd>${fisk}</dd></div>
      ${r.sea ? `<div><dt>Sjøen</dt><dd>${fmtNum(r.sea.temp.toFixed(1))} °C<small>Fra MET sin havmodell, nærmeste rute.</small></dd></div>` : ''}
      ${waves ? `<div><dt>Bølger</dt><dd>${waves}</dd></div>` : ''}
    </dl>
    <h4>Dybde fra sjøkartet</h4>
    <div class="table-wrap"><table><tr><th></th><th>25 m ut</th><th>70 m ut</th></tr>${depth}</table></div>
    <h4>Åpent vann i alle retninger</h4>
    <div class="roses">${sides.map(d => rose(d, sides.length > 1 ? 150 : 210, s.sider ? d.navn : s.kort)).join('')}</div>
    <p class="note">Strålene viser hvor langt det er åpent vann, målt i dybdedataene til Kartverket for hver tiende grad. ${ctx.wx && ctx.wx.dir != null ? 'Den røde pila er vinden nå.' : ''} Lang stråle mot vinden betyr bølger.</p>
    ${rules.length ? `<h4>Regler her</h4><ul class="plain rules">${rules.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    <h4>Fiskeguiden (TOFA)</h4>
    <p class="tofa">${esc(s.notat.replace(/^TOFA: /, ''))}</p>
    <div class="dact"><a class="fk-btn primary" href="kalender.html?plass=${id}${r.best ? '&fisk=' + r.best.opt.id : ''}">Planlegg turen hit</a>
      <a class="fk-btn" href="https://www.google.com/maps/search/?api=1&query=${s.pos[0]},${s.pos[1]}" target="_blank" rel="noopener">Veibeskrivelse ↗</a></div>`;
  box.hidden = false;
  $('liste').hidden = true;
  $('btnTilbake').addEventListener('click', () => velg(null));
}
function render(){
  compute();
  renderWhen();
  renderList();
  renderDetail();
  drawPins();
}
function velg(id, fly = true){
  ui.valgt = id;
  render();
  if (id && fly) map.flyTo(SPOTS[id].pos, Math.max(map.getZoom(), 15.5), {duration: .6});
  if (!id) map.flyToBounds(SPOT_IDS.map(k => SPOTS[k].pos), {padding: [40, 40], duration: .6});
  try { history.replaceState(null, '', location.pathname + (id ? '#' + id : '')); } catch (e) { /* file:// */ }
  if (id && window.matchMedia('(max-width: 899px)').matches) $('panel').scrollIntoView({behavior: 'smooth', block: 'start'});
}

$('register').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) velg(b.dataset.id); });
$('tid').addEventListener('input', e => { ui.follow = false; ui.h = +e.target.value; render(); });
$('btnNa').addEventListener('click', () => { ui.follow = true; render(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.valgt) velg(null); });
FiskeVaer.onChange(render);
setInterval(() => { if (ui.follow) render(); }, 5 * 60000);

const start = location.hash.slice(1);
compute();
if (SPOTS[start]){ ui.valgt = start; map.setView(SPOTS[start].pos, 15.5); }
render();
FiskeVaer.load();
