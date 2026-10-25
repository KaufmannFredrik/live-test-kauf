/* =========================================================
   FISKE — artene.js
   Registeret over fiskeartene. Faktaene og bildene ligger i
   js/arter.js, og plassene, fiskemåtene og sesongen hentes fra
   js/fiskemodell.js, så siden viser det samme som kalenderen.
   ========================================================= */

const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const today = osloNow();
const GRUPPE = {};
ART_GRUPPER.forEach(g => { GRUPPE[g.id] = g.t; });
const NO = {};
ARTER.forEach((a, i) => { NO[a.id] = String(i + 1).padStart(2, '0'); });
const ROMER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
// Fredningen som gjelder arten, som nøkkel i activeRules.
const FREDNING = {kveite: 'kveite', laks: 'laks', sjoorret: 'laks'};
const FREDNING_TEKST = {kveite: '20. desember til 20. april', laks: '1. mars til 31. mai'};
// Ordenene i systematisk rekkefølge (etter Nelson, Fishes of the World): slimål først, beinfisk sist.
const ORDENER = ['Myxiniformes', 'Chimaeriformes', 'Carcharhiniformes', 'Squaliformes', 'Rajiformes', 'Clupeiformes', 'Salmoniformes', 'Gadiformes',
  'Syngnathiformes', 'Callionymiformes', 'Gobiiformes', 'Scombriformes', 'Pleuronectiformes', 'Eupercaria incertae sedis', 'Perciformes'];
const KLASSE = {Myxini: 'Slimåler', Holocephali: 'Havmus', Elasmobranchii: 'Haier og skater', Teleostei: 'Beinfisk'};

/* ----- Hva fiskekalenderen sier om arten ----- */
// Fiskemåtene og plassene der arten står i listene til modellen.
function onSite(a){
  const has = list => !!list && list.some(n => a.alias.includes(n));
  const methods = new Set(), spots = new Map();
  const add = (id, m) => { if (!spots.has(id)) spots.set(id, []); if (m && !spots.get(id).includes(m)) spots.get(id).push(m); };
  for (const o of OPTIONS){
    if (has(o.fisk)) methods.add(o);
    for (const id of o.steder){
      const s = SPOTS[id];
      if (has((s.arter && s.arter[o.id]) || o.fisk)){ methods.add(o); add(id, o); }
    }
  }
  for (const id of SPOT_IDS){
    const s = SPOTS[id];
    if (s.ekstra && has(s.ekstra.fisk)){ const o = OPTIONS.find(x => x.id === s.ekstra.med); methods.add(o); add(id, o); }
    if (s.annet && has(s.annet.fisk)) add(id, null);
  }
  return {methods: OPTIONS.filter(o => methods.has(o)), spots: SPOT_IDS.filter(id => spots.has(id)).map(id => ({id, s: SPOTS[id], opts: spots.get(id)}))};
}
const SITE = {};
ARTER.forEach(a => { SITE[a.id] = onSite(a); });
const fredetI = (a, m) => !!FREDNING[a.id] && activeRules(m, 15)[FREDNING[a.id]];
const fredetNaa = a => !!FREDNING[a.id] && activeRules(today.m, today.d)[FREDNING[a.id]];

/* ----- Bildene ----- */
// Plansjene har bredden på originalen sist, så bare størrelsene Commons kan lage kommer med.
function srcset(b, sizes){
  if (!/\/330px-/.test(b[0])) return '';
  const max = b[8] || 600;
  const ws = [330, 500, 960].filter(w => w === 330 || w < max);
  return ws.length > 1 ? ` srcset="${ws.map(w => b[0].replace('/330px-', `/${w}px-`) + ' ' + w + 'w').join(', ')}" sizes="${sizes}"` : '';
}
const isPlate = (a, b) => b === a.plansje;
// Kort kreditering under kortene: plansjen og tavla, eller fotografen og lisensen.
function shortCredit(a, b){
  if (isPlate(a, b)) return esc(b[7].replace(/:.*$/, '').replace('Fishes of the British Islands', 'British Fishes'));
  return `Foto: ${esc(b[3])}, ${esc(b[4])}`;
}
function fullCredit(a, b, n){
  const lic = b[5] ? `<a href="${b[5]}" target="_blank" rel="noopener">${esc(b[4])}</a>` : esc(b[4]);
  const what = isPlate(a, b) ? esc(b[7]).replace(/: (.+)$/, ': <i>$1</i>') : (b[7] ? esc(b[7]) : 'Fotografi');
  return `<b>Fig. ${n}.</b> ${what}. ${isPlate(a, b) ? '' : 'Foto: ' + esc(b[3]) + ', '}${lic}. <a href="${b[6]}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
}

/* ----- Bla og søk ----- */
const ORD_KEY = 'fiske_arter_orden';
const ui = {gruppe: 'alle', orden: Store.get(ORD_KEY, 'gruppe'), open: null};
// Alt det går an å søke i: navn, latin, systematikken, faktaene og plassene.
const haystack = a => [a.navn, a.latin, a.syn, a.familie, a.orden, a.alias.join(' '), a.kort, a.storrelse, a.kjennetegn, a.lever, a.fjorden, a.merk, GRUPPE[a.gruppe],
  SITE[a.id].spots.map(p => p.s.navn).join(' ')].filter(Boolean).join(' ').toLowerCase();
const HAY = {};
ARTER.forEach(a => { HAY[a.id] = haystack(a); });

function shown(){
  const q = $('artQ').value.trim().toLowerCase();
  return ARTER.filter(a => (ui.gruppe === 'alle' || a.gruppe === ui.gruppe) && (!q || HAY[a.id].includes(q)));
}
// Rekkefølgen i registeret: etter gruppene på siden, systematisk etter orden og familie, eller alfabetisk.
function sorted(list){
  if (ui.orden === 'alfa') return list.slice().sort((x, y) => x.navn.localeCompare(y.navn, 'nb'));
  if (ui.orden === 'system') return list.slice().sort((x, y) => (ORDENER.indexOf(x.orden) - ORDENER.indexOf(y.orden)) ||
    x.familie.localeCompare(y.familie) || x.latin.localeCompare(y.latin));
  return list;
}
function card(a){
  const b = artBilde(a), plate = isPlate(a, b);
  return `<a class="spec${plate ? ' is-plate' : ''}" href="#${a.id}" data-id="${a.id}">
    <span class="spec-no">No. ${NO[a.id]}</span>
    <span class="spec-img"><img src="${b[0]}"${srcset(b, '(max-width: 560px) 50vw, 300px')} width="${b[1]}" height="${b[2]}" loading="lazy" alt="${esc(a.navn)}"></span>
    <span class="spec-txt"><b>${esc(a.navn)}</b><span class="binom"><i>${esc(a.latin)}</i> ${esc(a.autor)}</span>
      <span class="fam">${esc(a.familie)}</span><span class="kort">${esc(a.kort)}</span>${fredetNaa(a) ? '<span class="fa-flag">Fredet nå</span>' : ''}</span>
    <small class="credit">${shortCredit(a, b)}</small></a>`;
}
function render(){
  $('artGroups').innerHTML = [{id: 'alle', t: 'Alle'}].concat(ART_GRUPPER).map(g =>
    `<button type="button" class="chip" data-g="${g.id}" aria-pressed="${ui.gruppe === g.id}">${g.t}</button>`).join('');
  $('artOrden').innerHTML = [['gruppe', 'Grupper'], ['system', 'Systematisk'], ['alfa', 'A til Å']].map(([v, t]) =>
    `<button type="button" class="chip" data-o="${v}" aria-pressed="${ui.orden === v}">${t}</button>`).join('');
  const list = sorted(shown()), q = $('artQ').value.trim();
  $('artCount').textContent = list.length ? `Viser ${list.length} av ${ARTER.length} arter.` : `Fant ingen arter for «${q}».`;
  let h = '';
  if (ui.orden === 'gruppe' && ui.gruppe === 'alle' && !q){
    h = ART_GRUPPER.map((g, i) => { const l = list.filter(a => a.gruppe === g.id);
      return `<h2 class="sect"><span>${ROMER[i]}.</span> ${g.t} <small>${l.length} arter</small></h2>` + l.map(card).join(''); }).join('');
  } else if (ui.orden === 'system'){
    let last = '';
    list.forEach(a => {
      if (a.orden !== last){
        last = a.orden;
        h += `<h2 class="sect"><span>Ordo</span> <i>${esc(a.orden.replace(' incertae sedis', ''))}</i>${/incertae/.test(a.orden) ? ' <small><i>incertae sedis</i></small>' : ''} <small>Classis ${esc(a.klasse)} · ${KLASSE[a.klasse] || ''}</small></h2>`;
      }
      h += card(a);
    });
  } else h = list.map(card).join('');
  $('artGrid').innerHTML = h;
}

/* ----- Detaljene om én art ----- */
function season(a, methods){
  if (!methods.length) return '';
  let h = '<span></span>' + MND.map((n, i) => `<span class="mh${i + 1 === today.m ? ' cur' : ''}">${n[0].toUpperCase()}</span>`).join('');
  for (const o of methods){
    h += `<span class="rl" title="${esc(o.navn)}">${esc(o.kort)}</span>`;
    for (let i = 0; i < 12; i++){
      const closed = fredetI(a, i + 1) || (o.fredet && o.sesong[i] === 0);
      h += `<span class="cell${closed ? ' closed' : ''}" style="--v:${o.sesong[i]}" title="${MND[i]}: ${closed ? 'fredet' : Math.round(o.sesong[i] * 100) + ' %'}"><i></i></span>`;
    }
  }
  return `<section><h4>Sesong i fiskekalenderen</h4><div class="smap" role="img" aria-label="Hvor godt fisket er hver måned for fiskemåtene som tar ${esc(a.navn.toLowerCase())}">${h}</div>
    <p class="note">Mørkere betyr bedre sesong, skravert betyr fredet.</p></section>`;
}
function detail(a){
  const b = artBilde(a), alt = b === a.plansje ? a.bilde : a.plansje, site = SITE[a.id];
  const facts = [['Størrelse', a.storrelse], ['Kjennetegn', a.kjennetegn], ['Lever', a.lever], ['I Trondheimsfjorden', a.fjorden], ['Regler', a.regler]]
    .filter(r => r[1]).map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('');
  const naa = fredetNaa(a) ? `<p class="fa-warn">Fredet nå (${FREDNING_TEKST[FREDNING[a.id]]}). Får du den, må den slippes ut.</p>` : '';
  const methods = site.methods.length
    ? site.methods.map(o => `<li><a href="kalender.html?fisk=${o.id}">${esc(o.navn)}</a></li>`).join('')
    : '<li>Ingen av fiskemåtene på siden er laget for denne arten.</li>';
  const spots = site.spots.length
    ? site.spots.map(p => {
        const how = esc(p.opts.length ? p.opts.map(o => o.kort.toLowerCase()).join(', ') : p.s.annet.navn.toLowerCase());
        return `<li><a href="kart.html#${p.id}">${esc(p.s.navn)}</a> <span class="note">${how}</span></li>`;
      }).join('')
    : '<li>Fiskekalenderen viser den ikke ved noen av plassene.</li>';
  const worms = `https://www.marinespecies.org/aphia.php?p=taxdetails&id=${a.aphia}`;
  return `<div class="dlg-top">
      <figure class="plate dlg-pic${isPlate(a, b) ? ' is-plate' : ''}"><a href="${b[6]}" target="_blank" rel="noopener"><img src="${b[0]}"${srcset(b, '(max-width: 760px) 100vw, 460px')} width="${b[1]}" height="${b[2]}" alt="${esc(a.navn)}"></a>
        <figcaption>${fullCredit(a, b, 1)}</figcaption></figure>
      <div class="dlg-id">
        <p class="eyebrow">No. ${NO[a.id]} · ${GRUPPE[a.gruppe]}</p>
        <h2 id="dlgName">${esc(a.navn)}</h2>
        <p class="binom big"><i>${esc(a.latin)}</i> ${esc(a.autor)}</p>
        ${a.syn ? `<p class="note">Kalles også <i>${esc(a.syn)}</i>.</p>` : ''}
        <dl class="label">
          <div><dt>Classis</dt><dd>${esc(a.klasse)}</dd></div>
          <div><dt>Ordo</dt><dd>${esc(a.orden)}</dd></div>
          <div><dt>Familia</dt><dd>${esc(a.familie)}</dd></div>
          <div><dt>Species</dt><dd><i>${esc(a.latin)}</i></dd></div>
        </dl>
      </div>
    </div>
    <p class="fa-kort">${esc(a.kort)}</p>
    ${naa}${a.merk ? `<p class="fa-merk">${esc(a.merk)}</p>` : ''}
    <dl class="fa-facts">${facts}</dl>
    ${season(a, site.methods)}
    <div class="fa-cols">
      <div><h4>Fiskemåter på siden</h4><ul>${methods}</ul></div>
      <div><h4>Plasser (TOFA)</h4><ul>${spots}</ul></div>
    </div>
    ${alt ? `<figure class="plate dlg-alt${alt === a.plansje ? ' is-plate' : ''}"><img src="${alt[0]}" width="${alt[1]}" height="${alt[2]}" loading="lazy" alt="${esc(a.navn)}"><figcaption>${fullCredit(a, alt, 2)}</figcaption></figure>` : ''}
    <p class="note fa-src">Kilder: <a href="${a.kilde[0]}" target="_blank" rel="noopener">${esc(a.kilde[1])}</a> (fakta), <a href="${worms}" target="_blank" rel="noopener">WoRMS</a> (systematikk) og TOFA (plassene). Ord du ikke kjenner? Se <a href="kalender.html#ordliste">ordlisten</a>.</p>`;
}
function setHash(h){
  try { history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : '')); } catch (e) { /* file:// eller sandkasse */ }
}
function openArt(id){
  const a = ARTER.find(x => x.id === id), dlg = $('artDlg');
  if (!a) return;
  ui.open = id;
  // Forrige og neste blar i det som vises, eller i alle artene hvis arten ikke er blant treffene.
  let list = sorted(shown());
  if (!list.includes(a)) list = sorted(ARTER);
  const i = list.indexOf(a);
  ui.prev = list[(i - 1 + list.length) % list.length].id;
  ui.next = list[(i + 1) % list.length].id;
  $('dlgPos').textContent = `${i + 1} av ${list.length}`;
  $('dlgBody').innerHTML = detail(a);
  dlg.scrollTop = 0;
  setHash(id);
  document.title = a.navn + ' — Artene — Fiskene i Trondheimsfjorden';
  if (!dlg.open){
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
}
function closeArt(){
  const dlg = $('artDlg');
  if (dlg.open){ if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
}
// Lenker fra resten av siden: #torsk åpner arten, #gruppe-flat viser gruppen.
function fromHash(){
  const h = decodeURIComponent(location.hash.slice(1));
  const g = /^gruppe-(\w+)$/.exec(h);
  if (g && GRUPPE[g[1]]){ ui.gruppe = g[1]; setHash(''); render(); closeArt(); return; }
  if (ARTER.some(a => a.id === h)) openArt(h);
  else closeArt();
}

$('artQ').addEventListener('input', render);
$('artGroups').addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b) return;
  ui.gruppe = b.dataset.g;
  render();
});
$('artOrden').addEventListener('click', e => {
  const b = e.target.closest('[data-o]'); if (!b) return;
  ui.orden = b.dataset.o;
  Store.set(ORD_KEY, ui.orden);
  render();
});
$('artGrid').addEventListener('click', e => {
  const c = e.target.closest('[data-id]');
  if (!c || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  e.preventDefault();
  openArt(c.dataset.id);
});
$('dlgPrev').addEventListener('click', () => openArt(ui.prev));
$('dlgNext').addEventListener('click', () => openArt(ui.next));
$('dlgClose').addEventListener('click', closeArt);
$('artDlg').addEventListener('close', () => {
  ui.open = null;
  setHash('');
  document.title = 'Artene — Fiskene i Trondheimsfjorden';
});
// Trykk utenfor ruten lukker den.
$('artDlg').addEventListener('click', e => { if (e.target === $('artDlg')) closeArt(); });
$('artDlg').addEventListener('keydown', e => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowLeft') openArt(ui.prev);
  else if (e.key === 'ArrowRight') openArt(ui.next);
});
// Bryteren øverst bytter mellom kobberstikk og fotografi.
document.addEventListener('fiske:bilder', () => { render(); if (ui.open) $('dlgBody').innerHTML = detail(ARTER.find(x => x.id === ui.open)); });
window.addEventListener('hashchange', fromHash);

render();
fromHash();
