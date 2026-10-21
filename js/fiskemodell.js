/* =========================================================
   GUTTA.NO — fiskemodell.js
   Kjernen i fiskekalenderen: sol, måne, tidevann og poeng for
   hver fiskemåte i Trondheimsfjorden. Ingen DOM her, så både
   fiskekalender.html og forsiden bruker samme modell.
   FiskeVaer (nederst) henter timesvarsel fra Yr (MET Norway),
   sjøtemperatur (MET Norway) og flo og fjære (Kartverket).
   Krever Store fra js/common.js.
   ========================================================= */

/* ===== Dato, sol og måne ===== */
const LAT = 63.4305, LON = 10.3951, SYN = 29.530588853;
const MND = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'];
const DAG = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
const PHASE_IDS = ['dag','lavt','skumring','morkt','natt'];
const PHASE_NAME = {dag:'Dagslys', lavt:'Lav sol', skumring:'Skumring', morkt:'Mørkt', natt:'Natt'};
const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI;
const pad = n => String(n).padStart(2, '0');

function fmtTime(h){
  h = ((h % 24) + 24) % 24;
  let hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return pad(hh) + ':' + pad(mm);
}
function dowOf(y, m, d){ return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function fmtDate(y, m, d, short){ return (short ? '' : DAG[dowOf(y, m, d)] + ' ') + d + '. ' + MND[m - 1]; }
function daysIn(y, m){ return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function lastSunday(y, mi){ const dt = new Date(Date.UTC(y, mi + 1, 0)); return dt.getUTCDate() - dt.getUTCDay(); }
function osloOffset(y, m, d, h){
  const t = Date.UTC(y, m - 1, d, h);
  return (t >= Date.UTC(y, 2, lastSunday(y, 2), 2) && t < Date.UTC(y, 9, lastSunday(y, 9), 3)) ? 2 : 1;
}
function toUTC(y, m, d, h){ return Date.UTC(y, m - 1, d, 0) + (h - osloOffset(y, m, d, h)) * 3600000; }
let osloFmt = null;
function osloParts(ms){
  try {
    osloFmt = osloFmt || new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Oslo', year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', hourCycle:'h23'});
    const p = osloFmt.formatToParts(new Date(ms));
    const g = t => +p.find(x => x.type === t).value;
    return {y:g('year'), m:g('month'), d:g('day'), h:g('hour') + g('minute') / 60};
  } catch (e) {
    const n = new Date(ms);
    return {y:n.getFullYear(), m:n.getMonth() + 1, d:n.getDate(), h:n.getHours() + n.getMinutes() / 60};
  }
}
function osloNow(){ return osloParts(Date.now()); }
function inRange(m, d, m1, d1, m2, d2){
  const k = m * 100 + d, a = m1 * 100 + d1, b = m2 * 100 + d2;
  return a <= b ? (k >= a && k <= b) : (k >= a || k <= b);
}

function sunAlt(ms){
  const jd = ms / 86400000 + 2440587.5, n = jd - 2451545.0;
  const L = 280.460 + 0.9856474 * n;
  const g = rad(357.528 + 0.9856003 * n);
  const lam = rad(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const eps = rad(23.439 - 0.0000004 * n);
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = 280.46061837 + 360.98564736629 * n;
  const ha = rad(gmst + LON) - ra, phi = rad(LAT);
  return deg(Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha)));
}
function sunTimes(y, m, d){
  let rise = null, set = null, prev = sunAlt(toUTC(y, m, d, 0));
  for (let t = 5; t <= 1440; t += 5){
    const a = sunAlt(toUTC(y, m, d, t / 60));
    if (prev < -0.833 && a >= -0.833 && rise === null) rise = (t - 5 + 5 * (-0.833 - prev) / (a - prev)) / 60;
    if (prev >= -0.833 && a < -0.833) set = (t - 5 + 5 * (prev + 0.833) / (prev - a)) / 60;
    prev = a;
  }
  return {rise, set};
}
function phaseOf(alt){ return alt >= 10 ? 'dag' : alt >= 2 ? 'lavt' : alt >= -6 ? 'skumring' : alt >= -12 ? 'morkt' : 'natt'; }

function moonAge(ms){ const jd = ms / 86400000 + 2440587.5; return (((jd - 2451550.1) % SYN) + SYN) % SYN; }
function springness(age){ return (1 + Math.cos(4 * Math.PI * (age - 1.5) / SYN)) / 2; }
function daysToSpring(age){ const P = SYN / 2; return (((1.5 - age) % P) + P) % P; }
function moonName(age){
  if (age < 1.0 || age >= 28.5) return 'Nymåne';
  if (age < 6.4) return 'Tiltakende sigd';
  if (age < 8.4) return 'Første kvarter';
  if (age < 13.8) return 'Tiltakende måne';
  if (age < 15.8) return 'Fullmåne';
  if (age < 21.0) return 'Avtakende måne';
  if (age < 23.0) return 'Siste kvarter';
  return 'Avtakende sigd';
}
function tideLabel(sp){ return sp >= 0.8 ? 'Springflo' : sp <= 0.25 ? 'Nippflo' : 'Middels tidevann'; }
function springText(age){
  const x = daysToSpring(age);
  if (springness(age) >= 0.8) return 'Sterk strøm nå';
  const n = Math.round(x);
  return n <= 0 ? 'Springflo i dag' : n === 1 ? 'Springflo i morgen' : 'Springflo om ca. ' + n + ' dager';
}
function windName(w){
  const t = [[0.3,'Stille'],[1.6,'Flau vind'],[3.4,'Svak vind'],[5.5,'Lett bris'],[8,'Laber bris'],[10.8,'Frisk bris'],[13.9,'Liten kuling'],[17.2,'Stiv kuling']];
  for (const [lim, n] of t) if (w < lim) return n;
  return 'Sterk kuling';
}
const fmtNum = x => String(x).replace('.', ',');

/* ----- Alternativer ----- */
const SPOTS = {
  ostmarkneset: {navn:'Østmarkneset (Tyskerkaia)', notat:'Ladestien. Hard bunn, så bruk billige søkker. TOFA fraråder å spise bunnfisk herfra (renseanlegg i nærheten).'},
  ilsvikora: {navn:'Ilsvikøra', notat:'Kaien ved Felleskjøpet, ca. 10 m dyp. Mudderbunn og strøm fra Nidelvas kanaler.'},
  hurtigrutekaia: {navn:'Hurtigrutekaia (Pir 1)', notat:'Mest brukte plass i sentrum. Best på stigende sjø. Sjekk fredningssonen ved Nidelvas munning.'},
  trolla: {navn:'Trolla (Trollakaia)', notat:'Enkel adkomst. Overhengskant som lett tar fast redskapen.'},
  storsand: {navn:'Storsand (brygge)', notat:'Mye sild på kveldstid. Bryggen er forbeholdt campinggjester 13. mai til 1. september.', stengt:(m,d)=>inRange(m,d,5,13,9,1)},
  skansen: {navn:'Skansen (flytebrygger)', notat:'Små agn og artsfiske. Vis hensyn til båttrafikk. Bruk hodelykt om kvelden.'},
  sjobadet: {navn:'Sjøbadet ved Pirsenteret', notat:'Nær sentrum. Havmus og kloskate etter mørkets frembrudd. Vis hensyn til badende.'},
  korsvika: {navn:'Korsvika og Ilsvika', notat:'TOFA nevner dem som verdt å undersøke, uten detaljer. Her må du prøve deg frem.'}
};

const OPTIONS = [
{ id:'torsk', navn:'Torsk på pilk eller shad', kort:'Torsk', arter:'Torsk, hvitting og hyse', undertekst:'Hele året, størst om vinteren',
  sesong:[.85,.85,.75,.6,.4,.3,.25,.35,.5,.7,.8,.9],
  tid:[.72,.9,1,.95,.9], w50:10, lysSky:true, tide:.85, fredet:null, hensyn:1, farge:'sluk',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm og fluorokarbon-forfang 0,35 til 0,45 mm.',
  slukType:'Pilk, tung skjesluk eller shad på 10 til 15 cm på jigghode',
  vekt:{normal:[20,40], tung:[40,60]},
  teknikk:'Kast så langt du kan og la sluket synke helt til bunnen. Løft stangtuppen rolig 30 til 60 cm, la det synke igjen og ta inn slakken. Hugget kommer ofte når sluket faller.',
  steder:['ostmarkneset','ilsvikora','trolla','hurtigrutekaia'],
  fordeler:['Størst fisk fra land: torsk ofte over 5 kg ved Østmarkneset og Ilsvikøra om vinteren','Virker når det er kaldt og mørkt, da mange andre arter er borte','Samme stang og snelle som til alt annet','Du fisker nær bunnen, så du er ikke avhengig av stimer eller vak'],
  ulemper:['Henger lett fast på hard bunn og stein, så du mister sluk','Sakte fiske som krever tålmodighet','Korte dager og glatte svaber om vinteren','Minstemål 55 cm, så mye fisk må slippes ut','TOFA fraråder å spise bunnfisk fra Østmarkneset'],
  regel:'Minstemål: torsk 55 cm, hyse 40 cm, hvitting 32 cm. Kveite må slippes ut 20. desember til 20. april.' },

{ id:'sei', navn:'Sei og lyr på blankt sluk', kort:'Sei og lyr', arter:'Sei og lyr', undertekst:'Sommer og høst, best morgen og kveld',
  sesong:[.1,.1,.1,.15,.3,.55,.7,.85,.9,.85,.55,.2],
  tid:[.65,1,1,.6,.45], w50:9, lysSky:true, tide:.75, fredet:null, hensyn:1, farge:'sluk',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm og fluorokarbon-forfang 0,35 til 0,45 mm.',
  slukType:'Blank skjesluk eller slank sildesluk',
  vekt:{normal:[12,15], tung:[15,30]},
  teknikk:'Kast ut, tell noen sekunder mens sluket synker, og hent inn jevnt og raskt med små stopp. Se etter fugler og vak, for fisken følger småfisk som jages mot land på kvelden.',
  steder:['trolla','hurtigrutekaia','ostmarkneset'],
  fordeler:['Kraftig kamp, og du er aktiv hele tiden','Ingen minstemål til eget bruk','Enkelt oppsett: ett blankt sluk på 12 til 15 g','Best morgen og kveld, når lyset er lavt'],
  ulemper:['Fisken kommer i perioder, så det kan være dødt mellom hver stim','Du må lete etter vak og fugler','Sluk tar lett fast på overhengskanter, for eksempel ved Trolla','Lite å hente i vinterhalvåret'],
  regel:'Ingen minstemål på sei og lyr til eget bruk.' },

{ id:'makrell', navn:'Makrell på makrelltakkel', kort:'Makrell', arter:'Makrell', undertekst:'Sommer og tidlig høst',
  sesong:[.02,.02,.02,.02,.08,.4,.8,.95,.85,.45,.1,.03],
  tid:[.95,1,.8,.35,.15], w50:8, sunLover:true, tide:.8, fredet:null, hensyn:1, farge:'blank',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm.',
  slukType:'Makrelltakkel med flere små kroker, og et tungt sluk eller søkke i enden for å få det ut',
  vekt:{normal:[40,50], tung:[40,50]}, vektFor:'Takkel ca. 11 g, pluss ', vektEtter:' sluk eller søkke i enden',
  teknikk:'Kast, la det synke litt og hent inn med korte rykk. Treffer du stimen kan du få flere fisk på en gang, så ha tang og bøtte klar.',
  steder:['ilsvikora','ostmarkneset','hurtigrutekaia'],
  fordeler:['Flere fisk på hvert kast når stimen er inne','Lett å lære og morsomt for barn og nybegynnere','Ingen minstemål','Enkelt utstyr: ferdig takkel og et tungt sluk'],
  ulemper:['Kort sesong, og den varierer fra år til år','Stimen kan stå for langt ute til at du når den','Takkelet floker seg lett','Rot og blod: rydd etter deg og ikke sløy fisk på kaiene'],
  regel:'Ingen minstemål på makrell.' },

{ id:'sild', navn:'Småsild på sildehekler', kort:'Småsild', arter:'Småsild', undertekst:'Sensommer og høst, ofte om kvelden',
  sesong:[.15,.1,.05,.05,.1,.2,.4,.7,.8,.6,.4,.2],
  tid:[.55,.85,1,.95,.85], w50:9, tide:.8, fredet:null, hensyn:1, farge:'blank',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm.',
  slukType:'Sildehekler: små kroker med blanke fjær',
  vekt:{normal:[20,30], tung:[20,30]}, vektEtter:' søkke nederst',
  teknikk:'Lett takkel med søkke. Fisk sildestimene på kveldstid, for eksempel ved Storsand og Østmarkneset.',
  steder:['storsand','ostmarkneset'],
  fordeler:['Mange fisk på kort tid, særlig om kvelden','Sild er godt agn til torsk og bunnfiske','Enkelt og barnevennlig'],
  ulemper:['Liten fisk','Kort sesong, og mest på kveldstid','Heklene floker seg lett','Storsand-bryggen er reservert campinggjester 13. mai til 1. september'],
  regel:'Ingen minstemål på sild.' },

{ id:'bunn', navn:'Bunnfiske med agn', kort:'Bunnagn', arter:'Hvitting, hyse, torsk og noen ganger kveite', undertekst:'Hele året, best høst og vinter',
  sesong:[.6,.6,.65,.6,.45,.35,.35,.4,.55,.7,.75,.65],
  tid:[.7,.85,1,1,.95], w50:11, tide:.9, fredet:null, hensyn:1, farge:'agn',
  agn:'Sild- eller makrellbiter til torsk og hvitting, reke eller blåskjell til småfisk. Større kroker til torsk gir mindre fisk under minstemål.',
  stang:'Allroundstang 9 til 10 fot. Flettesnor 0,15 til 0,20 mm og fluorokarbon-forfang 0,35 til 0,45 mm.',
  slukType:'Bunntakkel eller glidende takkel med agn',
  vekt:{normal:[40,70], tung:[70,100]}, vektEtter:' søkke',
  teknikk:'Legg agnet ut og vent. Fisket er best på stigende sjø, men det er trekk i vannet også på fallende sjø. Bruk gjerne hodelykt og finn fisken med lyset ved småbåthavner.',
  steder:['hurtigrutekaia','storsand','trolla','ilsvikora'],
  fordeler:['Virker hele året, også når sluk gir lite','Rolig fiske: legg ut agnet og vent','Mange arter: hvitting, hyse, torsk, flatfisk og noen ganger kveite','Fungerer fint i mørket'],
  ulemper:['Du må ha ferskt agn: sild, makrell, reke eller blåskjell','Mye småfisk under minstemål som må slippes ut','Lite action mens du venter','Kveite må slippes ut 20. desember til 20. april'],
  regel:'Minstemål: hyse 40 cm, hvitting 32 cm, torsk 55 cm, kveite 84 cm.' },

{ id:'flatfisk', navn:'Flatfisk med reke på bunnen', kort:'Flatfisk', arter:'Rødspette, flyndre, lomre og skrubbe', undertekst:'Sen vår til sommer',
  sesong:[.05,.05,.15,.4,.65,.75,.75,.7,.55,.3,.1,.05],
  tid:[.9,.95,.9,.8,.7], w50:11, tide:.95, fredet:null, hensyn:1, farge:'agn',
  agn:'Rekebiter eller blåskjell på små kroker.',
  stang:'Allroundstang 9 til 10 fot, eller en lettere stang. Flettesnor 0,15 til 0,20 mm.',
  slukType:'Bunntakkel med små kroker',
  vekt:{normal:[40,70], tung:[70,100]}, vektEtter:' søkke',
  teknikk:'Legg agnet på bunnen og vent. Bruk små kroker og rekebiter til flyndre og småfisk.',
  steder:['hurtigrutekaia','storsand','skansen'],
  fordeler:['Rolig og enkelt, passer godt for familier','Fungerer midt på dagen, du trenger ikke skumring','Billig utstyr: små kroker og reke','Flytebryggene på Skansen har enkel adkomst'],
  ulemper:['Best når sjøen blir varmere, og dårligere resten av året','Småfisk: rødspette må være minst 29 cm, lysing 30 cm','Lite kamp','Fisk fra havneområder kan inneholde miljøgifter, så sjekk Mattilsynets råd'],
  regel:'Minstemål: rødspette 29 cm, lysing 30 cm.' },

{ id:'sjoorret', navn:'Sjøørret på lite sluk (slipp ut)', kort:'Sjøørret', arter:'Sjøørret', undertekst:'Fredet 1. mars til 31. mai',
  sesong:[.25,.25,0,0,0,.5,.45,.5,.65,.6,.4,.3],
  tid:[.5,.95,1,.85,.7], w50:8, lysSky:true, tide:.85, fredet:[3,1,5,31], hensyn:.75, farge:'orret',
  stang:'Lettere stang på 8 til 9 fot, kastevekt 7 til 28 g. Fluorokarbon-forfang 0,25 til 0,30 mm, ca. 1 til 1,5 m.',
  slukType:'Lite sluk, kystwobbler eller flue',
  vekt:{normal:[7,12], tung:[12,18]},
  teknikk:'Fisk nær land og grunt, ofte på under 3 m. Ta de første kastene et godt stykke fra kanten, og vad aldri lenger ut enn nødvendig.',
  steder:[],
  fordeler:['Flott fisk og god kamp på lett utstyr','Du fisker grunt og nær land','Spennende fiske om kvelden og natten om sommeren'],
  ulemper:['Fredet 1. mars til 31. mai','Svak bestand: TOFA ber deg slippe ut all sjøørret i indre fjord hele året','Skremmes lett, så du må fiske rolig','Hold 100 m fra elvemunninger og sjekk Nidelva-sonen'],
  regel:'Minstemål 35 cm, men TOFA ber om at all sjøørret fra indre fjord slippes ut. Sjekk gjeldende regler før du fisker.' }
];

/* ----- Beregning ----- */
function seasonAt(opt, y, m, d){
  let p = (m - 1) + (d - 0.5) / daysIn(y, m) - 0.5;
  if (p < 0) p += 12;
  const i0 = Math.floor(p) % 12, i1 = (i0 + 1) % 12, f = p - Math.floor(p);
  return opt.sesong[i0] * (1 - f) + opt.sesong[i1] * f;
}
function isClosed(opt, m, d){ return !!(opt.fredet && inRange(m, d, opt.fredet[0], opt.fredet[1], opt.fredet[2], opt.fredet[3])); }
function windFit(w, w50){ return 1 / (1 + Math.pow(w / w50, 5)); }

function makeCtx(y, m, d, h, wx){
  const ms = toUTC(y, m, d, h), alt = sunAlt(ms), ph = phaseOf(alt), age = moonAge(ms);
  return {y, m, d, h, alt, ph, phIdx: PHASE_IDS.indexOf(ph), age, spring: springness(age), wx: (wx && wx.known) ? wx : null};
}
function lysNivaa(ctx){
  const c = ctx.wx ? ctx.wx.cloud : 0.5;
  let b = {dag:3, lavt:2, skumring:1, morkt:0, natt:0}[ctx.ph];
  if (ctx.ph === 'dag') b = 3 - c;
  if (ctx.ph === 'lavt') b = 2 - 0.5 * c;
  if (ctx.wx && ctx.wx.rain === 'mye') b = Math.max(0, b - 0.5);
  return b;
}
function weatherFit(opt, ctx){
  const wx = ctx.wx;
  if (!wx) return 0.8;
  let f = 1;
  if (ctx.ph === 'dag' || ctx.ph === 'lavt'){
    if (opt.sunLover) f *= 1 - 0.2 * wx.cloud;
    else if (opt.lysSky) f *= 0.8 + 0.2 * wx.cloud;
  }
  f *= {tort:1, lett:0.95, mye:0.65, sno:0.8}[wx.rain];
  if (wx.temp <= -8) f *= 0.85;
  return f;
}
function scoreOption(opt, ctx){
  const closed = isClosed(opt, ctx.m, ctx.d);
  const S = seasonAt(opt, ctx.y, ctx.m, ctx.d);
  const T = opt.tid[ctx.phIdx];
  const Wx = weatherFit(opt, ctx);
  const Wd = ctx.wx ? windFit(ctx.wx.wind, opt.w50) : 1;
  const M = opt.tide + (1 - opt.tide) * ctx.spring;
  const mix = 0.45 * T + 0.30 * Wx + 0.25 * M;
  const raw = 100 * S * Wd * (0.35 + 0.65 * mix) * opt.hensyn;
  const score = closed ? 0 : Math.round(raw);
  const f = {S, T, Wx, Wd, M, hensyn: opt.hensyn, closed, wxKnown: !!ctx.wx};
  return {opt, score, f, ...reasons(opt, f, ctx)};
}
function reasons(opt, f, ctx){
  const pro = [], con = [];
  if (f.closed){ con.push(opt.undertekst); return {pro, con}; }
  if (f.S >= 0.75) pro.push('Toppsesong'); else if (f.S >= 0.45) pro.push('Greit i sesong');
  else if (f.S < 0.25) con.push('Utenfor sesong'); else con.push('Svak sesong');
  const ph = PHASE_NAME[ctx.ph].toLowerCase();
  if (f.T >= 0.95) pro.push('Godt lys (' + ph + ')'); else if (f.T < 0.6) con.push('Dårlig lys for dette fisket (' + ph + ')');
  if (ctx.wx){
    const w = fmtNum(ctx.wx.wind);
    if (f.Wd >= 0.85) pro.push('Vinden (' + w + ' m/s) passer'); else if (f.Wd < 0.5) con.push('Vinden (' + w + ' m/s) er for sterk');
    else if (f.Wd < 0.85) con.push('Litt mye vind (' + w + ' m/s)');
    if (f.Wx < 0.7) con.push('Været drar ned');
  }
  if (ctx.spring >= 0.8 && opt.tide < 0.95) pro.push('Springflo gir mye strøm');
  else if (ctx.spring <= 0.25 && opt.tide < 0.85) con.push('Nippflo, lite strøm');
  if (opt.hensyn < 1) con.push('Svak bestand, slipp ut fisken');
  return {pro, con};
}
function rankOptions(ctx){
  const r = OPTIONS.map(o => scoreOption(o, ctx));
  return r.map((x, i) => ({x, i})).sort((a, b) => (b.x.score - a.x.score) || (a.i - b.i)).map(o => o.x);
}
function verdict(s, closed){
  if (closed) return 'Fredet';
  return s >= 70 ? 'Veldig bra' : s >= 50 ? 'Bra' : s >= 30 ? 'Middels' : s >= 12 ? 'Svakt' : 'Ikke aktuelt';
}
// wx er enten ett vær for hele døgnet, eller en funksjon som gir været for hvert klokkeslett.
function dayCtxs(y, m, d, wx){
  const a = [];
  for (let i = 0; i < 48; i++){
    const h = i / 2 + 0.25;
    a.push(makeCtx(y, m, d, h, typeof wx === 'function' ? wx(h) : wx));
  }
  return a;
}
function curveFor(opt, ctxs){ return ctxs.map(c => scoreOption(opt, c).score); }
function bestWindow(arr){
  let mx = -1, im = 0;
  arr.forEach((v, i) => { if (v > mx){ mx = v; im = i; } });
  if (mx <= 0) return null;
  const thr = mx * 0.9;
  let a = im, b = im;
  while (a > 0 && arr[a - 1] >= thr) a--;
  while (b < arr.length - 1 && arr[b + 1] >= thr) b++;
  return {from: a / 2, to: (b + 1) / 2, score: mx};
}
// Beste poeng for en dag. Med wxFn regnes været inn time for time der det finnes varsel.
function dayBest(y, m, d, wxFn){
  if (wxFn){
    const wctxs = dayCtxs(y, m, d, wxFn);
    if (wctxs.some(c => c.wx)){
      let best = {score: 0, opt: null};
      for (const c of wctxs) for (const o of OPTIONS){
        const s = scoreOption(o, c).score;
        if (s > best.score) best = {score: s, opt: o};
      }
      return best;
    }
  }
  const ctxs = dayCtxs(y, m, d, null);
  const phs = new Set(ctxs.map(c => c.phIdx));
  const spring = ctxs[24].spring;
  let best = {score: 0, opt: null};
  for (const o of OPTIONS){
    if (isClosed(o, m, d)) continue;
    const S = seasonAt(o, y, m, d), M = o.tide + (1 - o.tide) * spring;
    let T = 0; phs.forEach(i => { T = Math.max(T, o.tid[i]); });
    const sc = 100 * S * (0.35 + 0.65 * (0.45 * T + 0.30 * 0.8 + 0.25 * M)) * o.hensyn;
    if (sc > best.score) best = {score: Math.round(sc), opt: o};
  }
  return best;
}

/* ----- Råd: vekt, farge, varsler, pakkeliste ----- */
function pickWeight(opt, ctx){
  const wind = ctx.wx ? ctx.wx.wind : 0;
  const strom = ctx.spring >= 0.8;
  const differs = opt.vekt.tung[0] !== opt.vekt.normal[0] || opt.vekt.tung[1] !== opt.vekt.normal[1];
  const heavy = differs && (strom || wind >= 7);
  const r = heavy ? opt.vekt.tung : opt.vekt.normal;
  const why = [];
  if (heavy && strom) why.push('springflo gir sterk strøm');
  if (heavy && wind >= 7) why.push('vinden på ' + fmtNum(wind) + ' m/s gjør lange kast tyngre');
  return {lo: r[0], hi: r[1], heavy, why: why.join(' og ')};
}
function weightText(opt, w){
  return (opt.vektFor || '') + w.lo + ' til ' + w.hi + ' g' + (opt.vektEtter || '');
}
function colorAdvice(opt, ctx){
  const b = lysNivaa(ctx), murky = !!(ctx.wx && ctx.wx.rain === 'mye');
  if (opt.farge === 'agn') return opt.agn;
  if (opt.farge === 'blank'){
    return opt.id === 'makrell' ? 'Blankt og sølvfarget' : 'Blanke fjær';
  }
  if (opt.farge === 'orret'){
    return b >= 2.5 ? 'Hvit eller sølv i sol' : 'Svart eller mørkt, fordi lyset er lavt';
  }
  if (murky) return 'Sterke farger som gul, rød eller kobber, fordi vannet er grumsete etter regn';
  if (b >= 2.5) return 'Sølv, hvit og naturfarger i klart vann og sterkt lys';
  if (b >= 1.5) return 'Sølv, eventuelt med litt blått eller grønt. Bytt til mørkere hvis det ikke skjer noe';
  return 'Mørke sluk (svart eller mørk blå), fordi de synes best mot himmelen når det er mørkt eller overskyet';
}
function warnings(ctx){
  const out = [], {m, d} = ctx, wx = ctx.wx;
  if (inRange(m, d, 3, 1, 5, 31)) out.push({lvl:'stop', t:'<b>Laks og sjøørret er fredet</b> til og med 31. mai. Slipp ut det du får.'});
  if (inRange(m, d, 12, 20, 4, 20)) out.push({lvl:'warn', t:'<b>Kveite må slippes ut</b> til og med 20. april. Kveite over 2 meter skal alltid slippes ut.'});
  else if (inRange(m, d, 12, 6, 12, 19)) out.push({lvl:'info', t:'Fra 20. desember må all kveite slippes ut.'});
  if (wx){
    if (wx.wind >= 13.9) out.push({lvl:'stop', t:'<b>Stiv kuling eller mer.</b> Ikke fisk fra svaberg og kaier i dag.'});
    else if (wx.wind >= 10.8) out.push({lvl:'warn', t:'<b>Liten kuling.</b> Bølger og tang på linen. Hold deg til skjermede kaier og bruk flytevest.'});
    else if (wx.wind >= 8) out.push({lvl:'info', t:'Frisk bris. Velg et sted der vinden ikke står rett inn mot land.'});
    if (wx.temp <= 1) out.push({lvl:'warn', t:'<b>Frost eller nær frost.</b> Kaier og svaber er glatte, så bruk brodder.'});
  } else if (inRange(m, d, 12, 1, 2, 28)){
    out.push({lvl:'info', t:'Vinter: kaier og svaber kan være glatte. Bruk brodder.'});
  }
  if (ctx.ph === 'morkt' || ctx.ph === 'natt') out.push({lvl:'warn', t:'<b>Mørkt.</b> Hodelykt med ekstra batterier og flytevest, og fortell noen hvor du er.'});
  if (ctx.spring >= 0.8) out.push({lvl:'info', t:'Springflo gir sterk strøm. Bruk tyngre sluk og sjekk tidevannstabellen, for flo kan stenge veien tilbake.'});
  return out;
}
function packList(opt, ctx){
  const wx = ctx.wx, dark = ['skumring','morkt','natt'].includes(ctx.ph);
  const items = [];
  items.push({t: 'Stang, snelle og forfang: ' + (opt.stang.split('. ')[0]), must:false});
  items.push({t: opt.farge === 'agn' ? 'Agn: ' + opt.agn : opt.slukType + ' (' + weightText(opt, pickWeight(opt, ctx)) + ')', must:false});
  if (opt.farge === 'agn') items.push({t:'Søkker og krokene du trenger, og bøtte til fisken', must:false});
  items.push({t:'Flytevest, alltid hvis du er alene eller i mørket', must: dark || !!(wx && wx.wind >= 8)});
  items.push({t:'Landingshåv med langt skaft, tang og fiskekniv', must:false});
  items.push({t:'Mål til minstemålene', must:false});
  items.push({t:'Hodelykt med ekstra batterier', must: ['morkt','natt'].includes(ctx.ph)});
  items.push({t:'Tidevannstabell sjekket, så flo ikke stenger veien tilbake', must: ctx.spring >= 0.8});
  if ((wx && wx.temp <= 1) || (!wx && inRange(ctx.m, ctx.d, 12, 1, 2, 28))) items.push({t:'Brodder', must: !!(wx && wx.temp <= 1)});
  if (wx && wx.temp <= 5) items.push({t:'Varme klær og hansker', must:false});
  if (wx && (wx.rain === 'lett' || wx.rain === 'mye' || wx.rain === 'sno')) items.push({t:'Regntøy', must:false});
  if (ctx.ph === 'dag' && (!wx || wx.cloud < 1)) items.push({t:'Polariserte solbriller (de hjelper også mot treblekroker)', must:false});
  items.push({t:'Vernebriller, Ladestien har mange turgåere og treblekroker er skarpe', must:false});
  items.push({t:'Mobil i vanntett pose, og søppelpose til slitt line', must:false});
  return items;
}
function spotsFor(opt, ctx){
  return opt.steder.map(id => ({id, ...SPOTS[id], stengtNaa: !!(SPOTS[id].stengt && SPOTS[id].stengt(ctx.m, ctx.d))}));
}
function activeRules(m, d){
  return {
    kveite: inRange(m, d, 12, 20, 4, 20),
    laks: inRange(m, d, 3, 1, 5, 31),
    storsand: inRange(m, d, 5, 13, 9, 1)
  };
}

/* ===== Værtekster ===== */
const WIND_DIR = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'];
function windDir(deg){ return WIND_DIR[Math.round((((deg % 360) + 360) % 360) / 45) % 8]; }
// Yr-symbolet uten tid på døgnet. MET skriver noen få koder med dobbel s («lightssnowshowers…»).
function symBase(sym){ return (sym || '').replace(/_(day|night|polartwilight)$/, '').replace(/^lightss/, 'lights'); }
function symText(sym){
  let s = symBase(sym);
  const thunder = /andthunder$/.test(s);
  s = s.replace(/andthunder$/, '');
  const fixed = {clearsky:'Klarvær', fair:'Lettskyet', partlycloudy:'Delvis skyet', cloudy:'Skyet', fog:'Tåke'}[s];
  if (fixed) return fixed;
  const k = /^(light|heavy)?(rain|sleet|snow)(showers)?$/.exec(s);
  if (!k) return 'Skiftende';
  let t = k[3] ? {rain:'regnbyger', sleet:'sluddbyger', snow:'snøbyger'}[k[2]] : {rain:'regn', sleet:'sludd', snow:'snø'}[k[2]];
  if (k[1]) t = (k[1] === 'light' ? 'lett' : 'kraftig') + (k[3] ? 'e ' : ' ') + t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return thunder ? t + ' og torden' : t;
}
function wxIcon(wx){
  if (!wx) return '';
  if (wx.sym){
    const s = symBase(wx.sym), night = /_night$/.test(wx.sym);
    if (/thunder/.test(s)) return '⛈️';
    if (/snow|sleet/.test(s)) return '🌨️';
    if (/showers/.test(s)) return '🌦️';
    if (/rain/.test(s)) return '🌧️';
    if (s === 'fog') return '🌫️';
    if (s === 'cloudy' || (night && s === 'partlycloudy')) return '☁️';
    if (s === 'partlycloudy') return '⛅';
    return night ? '🌙' : s === 'fair' ? '🌤️' : '☀️';
  }
  return {sno:'🌨️', mye:'🌧️', lett:'🌦️'}[wx.rain] || ['☀️', '⛅', '☁️'][wx.cloud * 2];
}
// Oversetter Yr-varselet til de grove kategoriene modellen bruker.
// Skyene følger symbolet, så teksten og valgene alltid sier det samme.
function cloudKind(sym, fraction){
  const s = symBase(sym);
  if (s === 'clearsky' || s === 'fair') return 0;
  if (s === 'partlycloudy' || /showers/.test(s)) return 0.5;
  if (s) return 1;
  return fraction < 30 ? 0 : fraction < 75 ? 0.5 : 1;
}
function rainKind(sym, mmPerHour){
  if (/snow|sleet/.test(sym)) return 'sno';
  if (mmPerHour >= 1.5 || /heavyrain/.test(sym)) return 'mye';
  if (mmPerHour >= 0.1 || /rain/.test(sym)) return 'lett';
  return 'tort';
}

/* =========================================================
   FiskeVaer — henter og lagrer data fra nett. Alle tre kildene
   tillater kall rett fra nettleseren (CORS), også fra file://.
   Varselet lagres i localStorage, så siden ikke henter på nytt
   ved hver sidevisning, og virker en stund uten nett.
   ========================================================= */
const FiskeVaer = (() => {
  const WX_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=63.4305&lon=10.3951';
  const SEA_URL = 'https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=63.44&lon=10.4';
  const TIDE_URL = 'https://vannstand.kartverket.no/tideapi.php?tide_request=locationdata&lat=63.4365&lon=10.3917' +
    '&datatype=TAB&lang=nb&dst=1&refcode=CD&interval=10';
  const KEY = {wx:'gutta_fiske_vaer', sea:'gutta_fiske_sjo', tide:'gutta_fiske_tidevann'};
  const FRESH = 30 * 60000;    // yngre lagret varsel enn dette brukes uten ny henting
  const KEEP = 12 * 3600000;   // eldre lagret varsel enn dette kastes
  const RETRY = 5 * 60000;     // vent så lenge før et mislykket tidevannskall prøves igjen

  const usable = c => (c && Array.isArray(c.series) && Date.now() - c.fetched < KEEP) ? c : null;
  let wx = usable(Store.get(KEY.wx, null));
  let sea = usable(Store.get(KEY.sea, null));
  const tide = Object.assign({months: {}, days: {}}, Store.get(KEY.tide, {}));
  let status = wx ? 'ok' : 'idle', version = 0, busy = null;
  const tidePending = {}, tideFailed = {}, listeners = [];

  function changed(){
    version++;
    listeners.forEach(fn => { try { fn(); } catch (e) { /* ignorer */ } });
  }

  async function getText(url){
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 12000) : 0;
    try {
      const r = await fetch(url, ctl ? {signal: ctl.signal} : undefined);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } finally { clearTimeout(timer); }
  }

  // Hvor mange timer hvert punkt gjelder: 1 time de første døgnene, så 6 timer.
  function withSteps(series){
    series.forEach((e, i) => {
      const nx = series[i + 1];
      e.step = nx ? (nx.t - e.t) / 3600000 : (i ? series[i - 1].step : 1);
    });
    return series;
  }
  function parseWx(j){
    return {
      fetched: Date.now(),
      updated: Date.parse(j.properties.meta.updated_at),
      series: withSteps(j.properties.timeseries.map(e => {
        const d = e.data, i = d.instant.details;
        const n = d.next_1_hours || d.next_6_hours || d.next_12_hours || null;
        const mm = n && n.details && n.details.precipitation_amount != null ? n.details.precipitation_amount : 0;
        return {
          t: Date.parse(e.time), wind: i.wind_speed, dir: i.wind_from_direction,
          cloud: i.cloud_area_fraction, temp: i.air_temperature,
          rain: d.next_1_hours ? mm : mm / 6, sym: n && n.summary ? n.summary.symbol_code : ''
        };
      }))
    };
  }
  function parseSea(j){
    return {
      fetched: Date.now(),
      series: withSteps(j.properties.timeseries.map(e => {
        const i = e.data.instant.details;
        return {t: Date.parse(e.time), temp: i.sea_water_temperature, wave: i.sea_surface_wave_height};
      }).filter(e => typeof e.temp === 'number'))
    };
  }

  // Punktet som gjelder for tidspunktet ms. Før første punkt brukes det første, men bare for i dag.
  let dayStart = 0, dayStamp = -1;
  function todayStart(){
    const stamp = Math.floor(Date.now() / 60000);
    if (stamp !== dayStamp){ const n = osloNow(); dayStart = toUTC(n.y, n.m, n.d, 0); dayStamp = stamp; }
    return dayStart;
  }
  function lookup(c, ms){
    const s = c && c.series;
    if (!s || !s.length) return null;
    if (ms < s[0].t) return ms >= todayStart() ? s[0] : null;
    for (let i = s.length - 1; i >= 0; i--){
      if (s[i].t <= ms) return ms < s[i].t + s[i].step * 3600000 ? s[i] : null;
    }
    return null;
  }
  function toModel(e){
    return {
      known: true, src: 'yr', wind: Math.round(e.wind * 10) / 10,
      cloud: cloudKind(e.sym, e.cloud), rain: rainKind(e.sym, e.rain),
      temp: Math.round(e.temp), sym: e.sym, dir: e.dir
    };
  }

  function load(force){
    if (busy) return busy;
    const now = Date.now();
    const needWx = force || !wx || now - wx.fetched > FRESH;
    const needSea = force || !sea || now - sea.fetched > FRESH;
    if (!needWx && !needSea) return Promise.resolve();
    status = 'loading';
    changed();
    busy = Promise.all([
      needWx ? getText(WX_URL).then(t => { wx = parseWx(JSON.parse(t)); Store.set(KEY.wx, wx); }) : null,
      // Sjøtemperaturen er en bonus, så feil her stopper ikke resten.
      needSea ? getText(SEA_URL).then(t => { sea = parseSea(JSON.parse(t)); Store.set(KEY.sea, sea); }).catch(() => {}) : null
    ]).then(() => { status = 'ok'; }, () => { status = 'error'; })
      .then(() => { busy = null; changed(); });
    return busy;
  }

  const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
  // Henter flo og fjære for en hel måned, pluss dagen før og etter.
  function loadTide(y, m){
    const key = y + '-' + pad(m);
    if (tide.months[key] || tidePending[key] || Date.now() - (tideFailed[key] || 0) < RETRY) return;
    const day = dt => dt.toISOString().slice(0, 10) + 'T00:00';
    const url = TIDE_URL + '&fromtime=' + day(new Date(Date.UTC(y, m - 1, 0))) + '&totime=' + day(new Date(Date.UTC(y, m, 2)));
    tidePending[key] = getText(url).then(xml => {
      const days = {}, re = /<waterlevel\b([^>]*)>/g;
      let mt;
      while ((mt = re.exec(xml))){
        const at = n => (new RegExp(n + '="([^"]*)"').exec(mt[1]) || [])[1];
        // Tiden har norsk sommer- eller vintertid (dst=1), så klokkeslettet kan leses rett ut.
        const tm = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(at('time') || ''), flag = at('flag');
        if (!tm || (flag !== 'high' && flag !== 'low')) continue;
        const k = ymd(+tm[1], +tm[2], +tm[3]);
        (days[k] = days[k] || []).push([+tm[4] + tm[5] / 60, flag === 'high' ? 1 : 0, Math.round(+at('value'))]);
      }
      if (!Object.keys(days).length) throw new Error('Tomt svar');
      Object.assign(tide.days, days);
      tide.months[key] = Date.now();
      const months = Object.keys(tide.months).sort();
      while (months.length > 6){
        const old = months.shift();
        delete tide.months[old];
        Object.keys(tide.days).forEach(k => { if (k.slice(0, 7) === old) delete tide.days[k]; });
      }
      Store.set(KEY.tide, tide);
      changed();
    }).catch(() => { tideFailed[key] = Date.now(); })
      .then(() => { delete tidePending[key]; });
  }
  function tides(y, m, d){
    const a = tide.days[ymd(y, m, d)];
    return a ? a.map(e => ({h: e[0], high: !!e[1], cm: e[2]})) : null;
  }
  // Stiger eller faller sjøen klokka h, og når er neste flo eller fjære?
  function tideAt(y, m, d, h){
    if (!tide.days[ymd(y, m, d)]) return null;
    const evs = [];
    [-1, 0, 1].forEach(k => {
      const dt = new Date(Date.UTC(y, m - 1, d + k));
      (tides(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) || []).forEach(e => evs.push({...e, h: e.h + 24 * k}));
    });
    const next = evs.filter(e => e.h > h).sort((a, b) => a.h - b.h)[0];
    return next ? {rising: next.high, next} : null;
  }

  return {
    load, loadTide, tides, tideAt,
    wxAt(ms){ const e = lookup(wx, ms); return e ? (e.model || (e.model = toModel(e))) : null; },
    seaAt(ms){ const e = lookup(sea, ms); return e ? {temp: e.temp, wave: e.wave} : null; },
    onChange(fn){ listeners.push(fn); },
    get status(){ return status; },
    get hasData(){ return !!wx; },
    get updated(){ return wx ? wx.updated : null; },
    get version(){ return version; }
  };
})();
