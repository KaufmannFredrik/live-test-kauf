/* =========================================================
   FISKE — felles.js
   Felles for fiskesidene: lagring, tittellinjen med menyen og
   bryteren mellom kobberstikk og fotografi.
   Lastes først av skriptene på hver side.
   ========================================================= */

// Lagring i nettleseren, som tåler privat modus.
const Store = {
  get(key, fallback){
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  },
  set(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* privat modus o.l. */ }
  }
};

const FISKE_NAV = [
  {href: 'kalender.html', n: 'I', t: 'Kalender'},
  {href: 'arter.html', n: 'II', t: 'Artene'},
  {href: 'kart.html', n: 'III', t: 'Kart'},
  {href: 'kalender.html#ordliste', n: 'IV', t: 'Ordliste'}
];

// Fargen til poengene på kartene: fra blekt pergament (svakt) til mørk oliven (veldig bra). null = ingen poeng.
function poengFarge(s){
  if (s == null) return '#c9bb9b';
  return s >= VERDICT.veldig ? '#36401a' : s >= VERDICT.bra ? '#5e6a2f' : s >= VERDICT.middels ? '#9a9a5c' : '#ddd0ac';
}

/* ----- Kobberstikk eller fotografi ----- */
const BILDE_KEY = 'fiske_bilder';
let bildeValg = Store.get(BILDE_KEY, 'plansje') === 'foto' ? 'foto' : 'plansje';
// Bildet av arten slik brukeren vil se det, med det andre som reserve.
function artBilde(a){
  return (bildeValg === 'foto' ? a.bilde : a.plansje) || a.bilde || a.plansje;
}
function setBildeValg(v){
  bildeValg = v;
  Store.set(BILDE_KEY, v);
  document.querySelectorAll('.imgswitch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  document.dispatchEvent(new CustomEvent('fiske:bilder', {detail: v}));
}

function renderMasthead(){
  const slot = document.getElementById('masthead');
  if (!slot) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  const nav = FISKE_NAV.map(l => {
    const cur = l.href === here && here !== 'index.html';
    return `<a href="${l.href}"${cur ? ' aria-current="page"' : ''}><i>${l.n}</i>${l.t}</a>`;
  }).join('');
  const h = document.createElement('header');
  h.className = 'masthead';
  h.innerHTML = `<div class="mast-inner">
      <a class="mast-brand" href="index.html"><span class="mast-title">Fiskene i Trondheimsfjorden</span><span class="mast-sub">Ichthyologia Nidarosiensis</span></a>
      <nav class="mast-nav" aria-label="Fiskesidene">${nav}</nav>
      <div class="mast-tools">
        <div class="imgswitch" role="group" aria-label="Bilder av fiskene">
          <button type="button" data-v="plansje" aria-pressed="${bildeValg === 'plansje'}" title="Gamle håndkolorerte kobberstikk">Stikk</button>
          <button type="button" data-v="foto" aria-pressed="${bildeValg === 'foto'}" title="Fotografier">Foto</button>
        </div>
        <a class="back" href="../index.html">Til start</a>
      </div>
    </div>`;
  slot.replaceWith(h);
  h.querySelector('.imgswitch').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (b && b.dataset.v !== bildeValg) setBildeValg(b.dataset.v);
  });
}
renderMasthead();
