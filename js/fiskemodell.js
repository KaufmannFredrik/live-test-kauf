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
// Med tidevannstabell brukes høydeforskjellen den dagen (m). I Trondheim er den ca. 0,7 m
// ved den svakeste nippfloen og 2,8 m ved den sterkeste springfloen.
function tideLabel(sp, range){
  if (range != null) return range >= 2.4 ? 'Springflo' : range <= 1.4 ? 'Nippflo' : 'Middels tidevann';
  return sp >= 0.8 ? 'Springflo' : sp <= 0.25 ? 'Nippflo' : 'Middels tidevann';
}
const SPRING_HALF = Math.acos(0.6) * SYN / (4 * Math.PI);   // springness er minst 0,8 så mange døgn før og etter toppen
function springText(age){
  if (springness(age) >= 0.8) return 'Sterk strøm nå';
  const n = Math.max(1, Math.round(daysToSpring(age) - SPRING_HALF));
  return n === 1 ? 'Springflo fra i morgen' : 'Springflo om ca. ' + n + ' dager';
}
function windName(w){
  const t = [[0.3,'Stille'],[1.6,'Flau vind'],[3.4,'Svak vind'],[5.5,'Lett bris'],[8,'Laber bris'],[10.8,'Frisk bris'],[13.9,'Liten kuling'],[17.2,'Stiv kuling']];
  for (const [lim, n] of t) if (w < lim) return n;
  return 'Sterk kuling';
}
const fmtNum = x => String(x).replace('.', ',');

/* ----- Plassene -----
   De seks plassene TOFA beskriver i Trondheim (tofa.no, «Sjøfiskemuligheter rundt Trondheim», nr. 7 til 12).
   notat, arter, flo og stigende er det TOFA skriver om plassen.
   pos: fiskeposisjonen, funnet i sjøkartet og kartdata fra Kartverket og OpenStreetMap, og for Trolla ut fra TOFA sine bilder.
   fetch: åpent vann (m) når vinden kommer fra 0, 10, 20 ... 350 grader. Målt i dybdedataene i Kartverket sitt sjøkart,
     som snittet av ni stråler med 3 graders mellomrom (metoden i Shore Protection Manual, US Army Corps of Engineers).
   dybde: største dybde innen 25 og 70 m fra posisjonen, fra dybdedataene i sjøkartet.
   sider: for plasser der flere sider kan brukes, med pos, dybde og fetch for hver side.
   best: månedene TOFA sier en fiskemåte er best her. Da får plassen fiskemåtens toppsesong.
   vekt og utstyr: søkkevekten og stanga TOFA sier du trenger her.
   sjoNormal: snittet av sjøtemperaturen hver måned i modellruta havvarselet bruker for plassen
     (NorKyst800 2017 til 2025, samme rute som i varselet).
   sone: ligger i munningsfredningssone 2 utenfor Nidelva og Ilabekken (forskrift 18.06.2024 nr. 1098, sonekart fra Statsforvalteren).
   arter: artene TOFA nevner for hver fiskemåte her. Uten liste brukes fiskemåtens egne arter. */
const SPOTS = {
  ostmarkneset: {navn:'Østmarkneset (Tyskerkaia)', kort:'Østmarkneset', pos:[63.45738, 10.44656], ikkeSpis:true,
    notat:'TOFA: Fisk rett utenfor den lille havnen ved kranene. Stor torsk i desember til februar, som regel godt over 5 kg. Lett å sette seg fast, så ikke bruk de dyreste søkkene. Stimer av småsild på sensommeren, og leppefisk i steinfyllingene. Plassen ligger nær Ladehammeren renseanlegg, og TOFA fraråder å spise flatfisk og bunnfisk herfra.',
    arter:{torsk:['torsk'], sild:['småsild']}, dybde:[10, 20],
    best:{torsk:[12,1,2], sild:[8]},
    sjoNormal:[4.77,4.48,4.95,6.11,8.93,12.78,14.67,13.9,11.6,8.79,6.62,5.07],
    fetch:[15500,18960,20912,20340,17030,18974,18898,17759,9229,3802,4,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,4,3650,8851,13569,15095,14222,13573,13218,13916]},
  ilsvikora: {navn:'Ilsvikøra (Ila pir)', kort:'Ilsvikøra', pos:[63.43358, 10.36187], sone:2, ekstra:{fisk:['hågjel','svarthå'], med:'bunn'},
    notat:'TOFA: Kaien ved Felleskjøpet. Ca. 10 m dypt, og med et langt kast når du 20 m. Mudderbunn og strøm inn og ut av kanalene til Nidelva. Stor torsk passerer om vinteren, masse makrell om sommeren, og spennende nattefiske etter hågjel og svarthå. Slimål kan være plagsom.',
    arter:{torsk:['torsk'], bunn:['hvitting','skate'], flatfisk:['sandflyndre','rødspette'], makrell:['makrell']}, dybde:[25, 40],
    best:{torsk:[12,1,2], bunn:[12,1,2], makrell:[6,7,8]},
    sjoNormal:[5.01,4.74,4.95,5.71,8.06,11.41,13.5,13.23,11.2,8.65,6.73,5.35],
    fetch:[15478,18102,15497,22430,19804,17769,9248,754,3,2,2,2,2,2,2,2,2,2,2,2,2,2,3,7,133,260,374,454,534,587,644,766,4060,10136,14561,14738]},
  // Hele Pir I kan brukes, så hver side er målt for seg, og siden med minst bølger gjelder.
  hurtigrutekaia: {navn:'Hurtigrutekaia (hele Pir I)', kort:'Pir I', pos:[63.44350, 10.40460], sone:2, stigende:true,
    notat:'TOFA: Det mest artsrike stedet i sentrum. Bunnmeite med makrell, sild, reke eller blåskjell er mest effektivt, og bunnen er stort sett ren. Best på stigende sjø, men god trekk i vannet også når den faller. Ikke fisk øst for Pir II: Nedre Elvehavna og Nyhavna er sone 1 med totalforbud mot fiske.',
    arter:{bunn:['kveite','vanlig fløyfisk','paddetorsk','kvabbe','leppefisk'], flatfisk:['lomre'], makrell:['makrell'], sild:['sild']},
    best:{makrell:[6,7,8], sild:[6,7,8]},
    sjoNormal:[4.81,4.54,4.87,5.84,8.4,11.96,14.03,13.48,11.33,8.66,6.64,5.12],
    sider:[
      {navn:'vestsiden mot fjorden', pos:[63.44270, 10.40220], dybde:[12, 20],
        fetch:[15828,15768,8490,2440,26,19,16,14,13,12,12,11,11,12,13,15,19,28,52,101,163,347,838,1457,2189,2525,2697,3099,7919,13663,13914,7414,4271,8341,12747,14230]},
      {navn:'nordspissen', pos:[63.44447, 10.40469], dybde:[19, 27],
        fetch:[15670,18297,22843,23080,22049,10571,5354,963,485,367,299,204,104,38,23,17,15,14,14,14,14,14,15,17,646,1899,2903,5224,9868,12274,7735,4326,7210,12788,14045,14106]},
      {navn:'østsiden mot Basseng IV', pos:[63.44266, 10.40701], dybde:[12, 10],
        fetch:[6029,13630,23276,23225,15237,5848,146,122,108,100,95,93,95,99,108,121,134,143,151,122,67,18,10,9,8,7,6,6,6,6,6,6,7,10,12,23]}]},
  trolla: {navn:'Trolla (Texacobryggen)', kort:'Trolla', pos:[63.44988, 10.32486], flo:true,
    vekt:{bunn:[150, 200], flatfisk:[150, 200]}, utstyr:'TOFA anbefaler surfstang, fordi du må kaste langt',
    notat:'TOFA: Kast langt med surfstang og søkke på 150 til 200 g, med sild eller makrellfilet som agn. Reker er bra til flatfisk. Desember er best for stor hvitting, og fisket er best på full flo. Mikromeite bak kaien i tangen og under steinene gir kutlinger, paddetorsk og kvabber.',
    arter:{bunn:['hvitting','hyse','torsk','kveite'], flatfisk:['flatfisk']}, dybde:[15, 40],
    best:{bunn:[12]},
    sjoNormal:[5.03,4.74,5.15,6.32,9.49,13.33,15.11,14.14,11.82,9.02,6.79,5.29],
    fetch:[12939,14486,18412,27656,26414,26465,23016,21036,12179,6308,3594,2053,700,134,12,10,8,8,8,10,13,16,18,20,27,52,97,158,256,2849,7860,11513,11688,12020,12278,12330]},
  storsand: {navn:'Storsand (Storsandbrygga)', kort:'Storsand', pos:[63.43538, 10.71405], stengt:(m,d)=>inRange(m,d,5,13,9,1),
    notat:'TOFA: Fin bunn der redskapen sjelden setter seg fast. Agnfiske gir flest arter. Tidvis mye sild på kveldstid, og da er sildehekle svært effektivt. Det tas også sjøørret fra bryggene, men TOFA ber deg slippe den ut. Bryggen er bare for campinggjester 13. mai til 1. september.',
    arter:{bunn:['hvitting','hyse','torsk','lysing','kveite','havmus','kloskate','vanlig fløyfisk','hai'], flatfisk:['rødspette','sandflyndre'], sild:['sild'], sjoorret:['sjøørret']}, dybde:[20, 50],
    sjoNormal:[4.93,4.56,5.02,6.32,9.69,14.16,15.68,14.58,11.92,9.1,6.95,5.36],
    fetch:[13257,11637,8085,6545,6320,7027,8076,7916,4350,1332,285,135,10,17,24,27,24,22,21,20,20,20,22,24,28,34,45,56,72,6176,11249,18106,22271,19625,15274,13357]},
  skansen: {navn:'Skansen (småbåthavna)', kort:'Skansen', pos:[63.43197, 10.37609], sone:2,
    notat:'TOFA: Best om kvelden og natten med hodelykt. Finn fisken med lyset, slå det av og prøv å få den til å ta agnet. Plassen er kjent for panserulke.',
    annet:{navn:'Artsfiske med små kroker og agn', tekst:'Ingen av fiskemåtene på siden passer, så plassen får ikke poeng.', fisk:['panserulke','stor kantnål','hårvar','tangsprell','kutlinger','ulker']}, dybde:[7, 8],
    sjoNormal:[5.01,4.74,4.95,5.71,8.06,11.41,13.5,13.23,11.2,8.65,6.73,5.35],
    fetch:[180,155,140,133,134,137,148,123,93,52,52,54,52,48,44,42,42,42,42,43,43,46,50,54,53,48,45,109,372,548,448,252,199,177,182,188]}
};

// sesong: hvor godt fisket er hver måned, fra fiskeguiden (0 til 1).
// tid: hvor godt lyset passer i dagslys, lav sol, skumring, mørkt og natt (0 til 1).
// vekting: hvor mye lys, strøm og vær teller for denne fiskemåten (summen er 1).
// temp: sjøtemperaturen fisken liker (°C): under første og over siste er dårlig, mellom de to midterste er best
//   (null: ingen kjent øvre grense). Kildene står ved hver fiskemåte.
// steder: plassene TOFA nevner for denne fiskemåten.
// w50: vinden (m/s) som halverer poengene fordi det blir vanskelig å fiske.
const OPTIONS = [
{ id:'torsk', navn:'Torsk på pilk eller shad', kort:'Torsk', arter:'Torsk, hvitting og hyse', fisk:['torsk','hvitting','hyse'], undertekst:'Hele året, størst om vinteren',
  sesong:[.85,.85,.75,.6,.4,.3,.25,.35,.5,.7,.8,.9],
  // temp: torsk merket med lagringsmerker levde i −1,5 til 19 °C og vokste best ved 8 til 10 °C (Righton mfl. 2010, MEPS 420).
  tid:[.45,.8,1,.85,.7], vekting:[.45,.40,.15], temp:[-1.5,8,10,19], w50:10, bunnfisk:true, fredet:null, hensyn:1, farge:'sluk',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm og fluorokarbon-forfang 0,35 til 0,45 mm.',
  slukType:'Pilk, tung skjesluk eller shad på 10 til 15 cm på jigghode',
  vekt:{normal:[20,40], tung:[40,60]},
  teknikk:'Kast så langt du kan og la sluket synke helt til bunnen. Løft stangtuppen rolig 30 til 60 cm, la det synke igjen og ta inn slakken. Hugget kommer ofte når sluket faller.',
  // Ilsvikøra først ved like poeng: TOFA fraråder å spise bunnfisken fra Østmarkneset.
  steder:['ilsvikora','ostmarkneset'],
  fordeler:['Størst fisk fra land: torsk ofte over 5 kg ved Østmarkneset og Ilsvikøra om vinteren','Virker når det er kaldt og mørkt, da mange andre arter er borte','Samme stang og snelle som til alt annet','Du fisker nær bunnen, så du er ikke avhengig av stimer eller vak'],
  ulemper:['Henger lett fast på hard bunn og stein, så du mister sluk','Sakte fiske som krever tålmodighet','Korte dager og glatte svaber om vinteren','Minstemål 55 cm, så mye fisk må slippes ut','TOFA fraråder å spise bunnfisk fra Østmarkneset'],
  regel:'Minstemål: torsk 55 cm, hyse 40 cm, hvitting 32 cm. Kveite må slippes ut 20. desember til 20. april.' },

{ id:'sei', navn:'Sei og lyr på blankt sluk', kort:'Sei og lyr', arter:'Sei og lyr', fisk:['sei','lyr'], undertekst:'Sommer og høst, best morgen og kveld',
  sesong:[.1,.1,.1,.15,.3,.55,.7,.85,.9,.85,.55,.2],
  // temp: ideelt ca. 4 til 12 °C, tåler ned mot 2 °C (Havrannsóknastofnun, Island). Ingen kjent øvre grense.
  tid:[.4,.95,1,.5,.3], vekting:[.55,.30,.15], temp:[2,4,12,null], w50:9, fredet:null, hensyn:1, farge:'sluk',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm og fluorokarbon-forfang 0,35 til 0,45 mm.',
  slukType:'Blank skjesluk eller slank sildesluk',
  vekt:{normal:[12,15], tung:[15,30]},
  teknikk:'Kast ut, tell noen sekunder mens sluket synker, og hent inn jevnt og raskt med små stopp. Se etter fugler og vak, for fisken følger småfisk som jages mot land på kvelden.',
  steder:[],
  fordeler:['Kraftig kamp, og du er aktiv hele tiden','Ingen minstemål til eget bruk','Enkelt oppsett: ett blankt sluk på 12 til 15 g','Best morgen og kveld, når lyset er lavt'],
  ulemper:['Fisken kommer i perioder, så det kan være dødt mellom hver stim','Du må lete etter vak og fugler','TOFA nevner ikke sei ved noen av plassene i Trondheim','Lite å hente i vinterhalvåret'],
  regel:'Ingen minstemål på sei og lyr til eget bruk.' },

{ id:'makrell', navn:'Makrell på makrelltakkel', kort:'Makrell', arter:'Makrell', fisk:['makrell'], undertekst:'Sommer og tidlig høst',
  sesong:[.02,.02,.02,.02,.08,.4,.8,.95,.85,.45,.1,.03],
  // temp: funnet i 5 til 15 °C, foretrekker 9 til 13 °C i Norskehavet (Havforskningsinstituttet).
  tid:[1,.9,.55,.2,.1], vekting:[.55,.30,.15], temp:[5,9,13,15], w50:8, fredet:null, hensyn:1, farge:'blank',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm.',
  slukType:'Makrelltakkel med flere små kroker, og et tungt sluk eller søkke i enden for å få det ut',
  vekt:{normal:[40,50], tung:[40,50]}, vektFor:'Takkel ca. 11 g, pluss ', vektEtter:' sluk eller søkke i enden',
  teknikk:'Kast, la det synke litt og hent inn med korte rykk. Treffer du stimen kan du få flere fisk på en gang, så ha tang og bøtte klar.',
  steder:['ilsvikora','hurtigrutekaia'],
  fordeler:['Flere fisk på hvert kast når stimen er inne','Lett å lære og morsomt for barn og nybegynnere','Ingen minstemål','Enkelt utstyr: ferdig takkel og et tungt sluk'],
  ulemper:['Kort sesong, og den varierer fra år til år','Stimen kan stå for langt ute til at du når den','Takkelet floker seg lett','Rot og blod: rydd etter deg og ikke sløy fisk på kaiene'],
  regel:'Ingen minstemål på makrell.' },

{ id:'sild', navn:'Småsild på sildehekler', kort:'Småsild', arter:'Småsild', fisk:['småsild'], undertekst:'Sensommer og høst, ofte om kvelden',
  sesong:[.15,.1,.05,.05,.1,.2,.4,.7,.8,.6,.4,.2],
  // temp: 0 til 18 °C, foretrukket 8 °C (FishBase).
  tid:[.3,.65,1,.9,.7], vekting:[.60,.25,.15], temp:[0,8,8,18], w50:9, fredet:null, hensyn:1, farge:'blank',
  stang:'Allroundstang 9 til 10 fot, kastevekt 15 til 60 g. Flettesnor 0,15 til 0,20 mm.',
  slukType:'Sildehekler: små kroker med blanke fjær',
  vekt:{normal:[20,30], tung:[20,30]}, vektEtter:' søkke nederst',
  teknikk:'Lett takkel med søkke. Fisk sildestimene på kveldstid, for eksempel ved Storsand og Østmarkneset.',
  steder:['storsand','ostmarkneset','hurtigrutekaia'],
  fordeler:['Mange fisk på kort tid, særlig om kvelden','Sild er godt agn til torsk og bunnfiske','Enkelt og barnevennlig'],
  ulemper:['Liten fisk','Kort sesong, og mest på kveldstid','Heklene floker seg lett','Storsand-bryggen er reservert campinggjester 13. mai til 1. september'],
  regel:'Ingen minstemål på sild.' },

{ id:'bunn', navn:'Bunnfiske med agn', kort:'Bunnagn', arter:'Hvitting, hyse, torsk og noen ganger kveite', fisk:['hvitting','hyse','torsk','kveite'], undertekst:'Hele året, best høst og vinter',
  sesong:[.6,.6,.65,.6,.45,.35,.35,.4,.55,.7,.75,.65],
  // temp: som torsk (Righton mfl. 2010), den best undersøkte av torskefiskene dette fisket tar.
  tid:[.55,.8,1,1,.9], vekting:[.35,.50,.15], temp:[-1.5,8,10,19], w50:11, bunnfisk:true, fredet:null, hensyn:1, farge:'agn',
  agn:'Sild- eller makrellbiter til torsk og hvitting, reke eller blåskjell til småfisk. Større kroker til torsk gir mindre fisk under minstemål.',
  stang:'Allroundstang 9 til 10 fot. Flettesnor 0,15 til 0,20 mm og fluorokarbon-forfang 0,35 til 0,45 mm.',
  slukType:'Bunntakkel eller glidende takkel med agn',
  vekt:{normal:[40,70], tung:[70,100]}, vektEtter:' søkke',
  teknikk:'Legg agnet ut og vent. Fisket er best på stigende sjø, men det er trekk i vannet også på fallende sjø. Bruk gjerne hodelykt og finn fisken med lyset ved småbåthavner.',
  steder:['hurtigrutekaia','storsand','trolla','ilsvikora'],
  fordeler:['Virker hele året, også når sluk gir lite','Rolig fiske: legg ut agnet og vent','Mange arter: hvitting, hyse, torsk, flatfisk og noen ganger kveite','Fungerer fint i mørket'],
  ulemper:['Du må ha ferskt agn: sild, makrell, reke eller blåskjell','Mye småfisk under minstemål som må slippes ut','Lite action mens du venter','Kveite må slippes ut 20. desember til 20. april'],
  regel:'Minstemål: hyse 40 cm, hvitting 32 cm, torsk 55 cm, kveite 84 cm.' },

{ id:'flatfisk', navn:'Flatfisk med reke på bunnen', kort:'Flatfisk', arter:'Rødspette, flyndre, lomre og skrubbe', fisk:['rødspette','flyndre','lomre','skrubbe'], undertekst:'Sen vår til sommer',
  sesong:[.05,.05,.15,.4,.65,.75,.75,.7,.55,.3,.1,.05],
  // temp: rødspette lever i 2 til 15 °C (FishBase). Ingen kjent foretrukket temperatur innenfor det.
  tid:[1,.95,.8,.55,.45], vekting:[.35,.45,.20], temp:[2,2,15,15], w50:11, bunnfisk:true, fredet:null, hensyn:1, farge:'agn',
  agn:'Rekebiter eller blåskjell på små kroker.',
  stang:'Allroundstang 9 til 10 fot, eller en lettere stang. Flettesnor 0,15 til 0,20 mm.',
  slukType:'Bunntakkel med små kroker',
  vekt:{normal:[40,70], tung:[70,100]}, vektEtter:' søkke',
  teknikk:'Legg agnet på bunnen og vent. Bruk små kroker og rekebiter til flyndre og småfisk.',
  steder:['storsand','hurtigrutekaia','trolla','ilsvikora'],
  fordeler:['Rolig og enkelt, passer godt for familier','Fungerer midt på dagen, du trenger ikke skumring','Billig utstyr: små kroker og reke','TOFA: reker fungerer godt til flatfisk'],
  ulemper:['Best når sjøen blir varmere, og dårligere resten av året','Småfisk: rødspette må være minst 29 cm, lysing 30 cm','Lite kamp','Fisk fra havneområder kan inneholde miljøgifter, så sjekk Mattilsynets råd'],
  regel:'Minstemål: rødspette 29 cm, lysing 30 cm.' },

{ id:'sjoorret', navn:'Sjøørret på lite sluk (slipp ut)', kort:'Sjøørret', arter:'Sjøørret', fisk:['sjøørret'], undertekst:'Fredet 1. mars til 31. mai',
  sesong:[.25,.25,0,0,0,.5,.45,.5,.65,.6,.4,.3],
  // temp: ørret tar føde fra like over 0 °C og velger selv ca. 16 °C. Merket sjøørret går dypere når sjøen er over 17 °C.
  tid:[.35,.85,1,.8,.55], vekting:[.55,.30,.15], temp:[0,16,16,17], w50:8, fredet:[3,1,5,31], hensyn:.75, farge:'orret',
  stang:'Lettere stang på 8 til 9 fot, kastevekt 7 til 28 g. Fluorokarbon-forfang 0,25 til 0,30 mm, ca. 1 til 1,5 m.',
  slukType:'Lite sluk, kystwobbler eller flue',
  vekt:{normal:[7,12], tung:[12,18]},
  teknikk:'Fisk nær land og grunt, ofte på under 3 m. Ta de første kastene et godt stykke fra kanten, og vad aldri lenger ut enn nødvendig.',
  steder:['storsand'],
  fordeler:['Flott fisk og god kamp på lett utstyr','Du fisker grunt og nær land','Spennende fiske om kvelden og natten om sommeren'],
  ulemper:['Fredet 1. mars til 31. mai','Svak bestand: TOFA ber deg slippe ut all sjøørret i indre fjord hele året','Skremmes lett, så du må fiske rolig','Forbudt hele året i munningsfredningssonen i Trondheim, fra Ila til Lade'],
  regel:'Minstemål 35 cm, men TOFA ber om at all sjøørret fra indre fjord slippes ut. Sjekk gjeldende regler før du fisker.' }
];

/* ----- Beregning -----
   Poengene er bygget som habitatmodellene i fiskeforskningen (HSI): hver faktor blir et tall
   fra 0 til 1, og faktorene ganges sammen. Lys, strøm og vær vektes som et geometrisk snitt,
   så én dårlig faktor drar mye ned, og hver faktor kan vises som en egen prosent.
   Poeng = 100 × Sesong × Lys × Strøm × Vær × Vind × Bestand */

// Snittet av sjøtemperaturen i overflaten hver måned (°C) utenfor Brattøra, fra døgnmidlene i MET sin
// havmodell NorKyst800 2017 til 2025. Det er samme modell som gir sjøtemperaturen i varselet.
const SEA_NORMAL = [4.79, 4.53, 4.81, 5.72, 8.20, 11.68, 13.79, 13.33, 11.23, 8.57, 6.59, 5.11];
// Middelvinden på Trondheim – Voll (MET, stasjon 68860) 1991 til 2020, delt i ti like store deler per måned (m/s).
// Hvert tall er midten av en tidel, så snittet over tallene er snittet over alle målingene.
const WIND_DECILES = [
  [0.5,1.1,1.6,2.1,2.5,3.0,3.5,4.2,5.2,7.3], [0.4,1.1,1.5,2.0,2.4,2.9,3.4,4.1,5.1,7.2], [0.6,1.2,1.6,2.0,2.4,2.8,3.3,3.9,4.9,6.6],
  [0.5,1.1,1.5,1.9,2.2,2.5,2.9,3.4,4.2,5.8], [0.7,1.3,1.6,1.9,2.2,2.5,2.9,3.3,3.9,5.2], [0.6,1.2,1.5,1.8,2.1,2.4,2.7,3.1,3.7,4.8],
  [0.5,1.1,1.4,1.6,1.9,2.2,2.4,2.8,3.2,4.2], [0.4,0.9,1.3,1.5,1.8,2.0,2.4,2.7,3.3,4.5], [0.4,0.9,1.3,1.6,1.9,2.2,2.6,3.1,4.0,5.6],
  [0.4,0.9,1.3,1.7,2.0,2.4,2.8,3.4,4.2,5.8], [0.3,0.8,1.2,1.6,2.0,2.5,3.0,3.5,4.5,6.5], [0.5,1.0,1.5,1.9,2.3,2.8,3.3,3.8,4.7,6.8]];
const STROM_REF = 0.65;           // m/t: så fort sjøen stiger midt mellom fjære og flo ved springflo i Trondheim (Kartverket)
const LYS_ALT = [14, 5, -3, -9, -15];   // solhøyden der hvert tall i tid gjelder fullt ut
const RAIN_SI = {tort:1, lett:0.95, mye:0.65, sno:0.8};
// Bølgehøyden som halverer poengene på en plass: grensen mellom lett og moderat sjø i WMO sin sjøgangsskala (kode 3700).
const WAVE50 = 1.25;

// Glir jevnt mellom månedene, med tallet for måneden midt i måneden.
function monthly(arr, y, m, d){
  let p = (m - 1) + (d - 0.5) / daysIn(y, m) - 0.5;
  if (p < 0) p += 12;
  const i0 = Math.floor(p) % 12, i1 = (i0 + 1) % 12, f = p - Math.floor(p);
  return arr[i0] * (1 - f) + arr[i1] * f;
}
function seasonAt(opt, y, m, d){ return monthly(opt.sesong, y, m, d); }
function isClosed(opt, m, d){ return !!(opt.fredet && inRange(m, d, opt.fredet[0], opt.fredet[1], opt.fredet[2], opt.fredet[3])); }
function windFit(w, w50){ return 1 / (1 + Math.pow(w / w50, 5)); }

// Skyer gjør det mørkere: helt overskyet midt på dagen er omtrent som lav sol.
function effAlt(alt, cloud){ return alt - cloud * (alt > 0 ? 8 : alt > -6 ? 3 : 0); }
function lightSI(opt, alt){
  const a = LYS_ALT, t = opt.tid;
  if (alt >= a[0]) return t[0];
  for (let i = 1; i < a.length; i++){
    if (alt >= a[i]) return t[i] + (t[i - 1] - t[i]) * (alt - a[i]) / (a[i - 1] - a[i]);
  }
  return t[t.length - 1];
}
// r er strømmen delt på STROM_REF. Stille vann ved flo og fjære gir 0,3.
function currentSI(r){ return 0.3 + 0.7 * Math.pow(Math.min(1, r), 0.7); }
// Uten tidevannstabell: snittet over en hel tidevannssyklus, med styrken anslått fra månefasen.
function currentExpected(spring){
  const peak = Math.min(1.1, 0.26 + 0.83 * spring);
  let s = 0;
  for (let i = 0; i < 16; i++) s += currentSI(peak * Math.sin(Math.PI * (i + 0.5) / 16));
  return s / 16;
}
function tempSI(opt, t){
  const [a, b, c, d] = opt.temp;
  if (t <= a || (d != null && t >= d)) return 0.2;
  if (t < b) return 0.2 + 0.8 * (t - a) / (b - a);
  if (d != null && t > c) return 0.2 + 0.8 * (d - t) / (d - c);
  return 1;
}
// Uten varsel regnes det som oppholdsvær. Det finnes ikke en målt «vanlig» nedbør per time å bruke i stedet,
// og nedbør trekker uansett lite (mye regn gir 6 % lavere poeng).
function weatherSI(wx){ return wx ? RAIN_SI[wx.rain] * (wx.temp <= -8 ? 0.85 : 1) : 1; }
// Uten varsel: snittet over vinden som er målt på Voll i denne måneden, så dager uten varsel
// verken ser bedre eller dårligere ut enn dager med.
function windExpected(w50, m){
  const a = WIND_DECILES[m - 1];
  return a.reduce((s, v) => s + windFit(v, w50), 0) / a.length;
}
function windFactor(opt, ctx){ return ctx.wx ? windFit(ctx.wx.wind, opt.w50) : windExpected(opt.w50, ctx.m); }

// Signifikant bølgehøyde (m) fra vind U (m/s) over F meter åpent vann, med formelen for vindbølger
// i Coastal Engineering Manual (US Army Corps of Engineers 2002): Hm0 = 0,0413 · u* · √(F/g).
function waveHeight(U, F){
  if (!(U > 0) || !(F > 0)) return 0;
  const ustar = Math.sqrt(0.001 * (1.1 + 0.035 * U)) * U;
  return 0.0413 * ustar * Math.sqrt(F / 9.81);
}
// Åpent vann for vind fra retning dir, mellom de målte retningene hver tiende grad.
function fetchAt(s, dir){
  const a = (((dir % 360) + 360) % 360) / 10, i = Math.floor(a) % 36, f = a - Math.floor(a);
  return s.fetch[i] * (1 - f) + s.fetch[(i + 1) % 36] * f;
}
// Sidene du kan fiske fra: hver side for seg, eller hele plassen som én side.
function spotSides(s){ return s.sider || [s]; }
// Himmelretningene (av åtte) der siden i snitt har mer enn 1 km åpent vann.
function openSides(side){
  return WIND_DIR.filter((n, k) => [-20, -10, 0, 10, 20].reduce((a, o) => a + fetchAt(side, k * 45 + o), 0) / 5 >= 1000);
}
// Bølgene på plassen nå, på siden med minst bølger, eller null når varselet ikke har vindretning.
function spotWaves(s, ctx){
  if (!ctx.wx || ctx.wx.dir == null) return null;
  let best = null;
  for (const side of spotSides(s)){
    const F = fetchAt(side, ctx.wx.dir), H = waveHeight(ctx.wx.wind, F);
    if (!best || H < best.H) best = {F, H, side: s.sider ? side : null};
  }
  return best;
}
function waveFit(H){ return 1 / (1 + Math.pow(H / WAVE50, 3)); }

// noSea: regn uten sjøtemperatur (valget «Uten vær»).
function makeCtx(y, m, d, h, wx, noSea){
  const ms = toUTC(y, m, d, h), alt = sunAlt(ms), ph = phaseOf(alt), age = moonAge(ms);
  const sea = noSea ? null : FiskeVaer.seaAt(ms);
  return {y, m, d, h, alt, ph, phIdx: PHASE_IDS.indexOf(ph), age, spring: springness(age),
    wx: (wx && wx.known) ? wx : null, tide: FiskeVaer.tideState(y, m, d, h), sea: sea ? sea.temp : null};
}
// Springflo: fra tidevannstabellen når den finnes, ellers fra månefasen.
function isSpring(ctx){ return ctx.tide ? ctx.tide.range >= 2.4 : ctx.spring >= 0.8; }
function strongCurrent(ctx){ return ctx.tide ? ctx.tide.rate >= 0.5 : ctx.spring >= 0.8; }
function lysNivaa(ctx){
  const c = ctx.wx ? ctx.wx.cloud : 0.5;
  let b = {dag:3, lavt:2, skumring:1, morkt:0, natt:0}[ctx.ph];
  if (ctx.ph === 'dag') b = 3 - c;
  if (ctx.ph === 'lavt') b = 2 - 0.5 * c;
  if (ctx.wx && ctx.wx.rain === 'mye') b = Math.max(0, b - 0.5);
  return b;
}
// Sjøtemperaturen t flytter sesongen: varmere eller kaldere sjø enn vanlig for datoen.
// normal: snittet for modellruta temperaturen kommer fra (uten: ruta utenfor Brattøra).
function seaShift(opt, t, ctx, normal){
  if (t == null) return 1;
  return Math.min(1.5, Math.max(0.5, tempSI(opt, t) / tempSI(opt, monthly(normal || SEA_NORMAL, ctx.y, ctx.m, ctx.d))));
}
// Alle faktorene for én fiskemåte, uten plass. A, L, C, R, Wd, B og hensyn ganges rett sammen til poengene.
function factors(opt, ctx){
  const S = seasonAt(opt, ctx.y, ctx.m, ctx.d), k = seaShift(opt, ctx.sea, ctx);
  const Lsi = lightSI(opt, effAlt(ctx.alt, ctx.wx ? ctx.wx.cloud : 0));
  const Csi = ctx.tide ? currentSI(ctx.tide.rate / STROM_REF) : currentExpected(ctx.spring);
  const Rsi = weatherSI(ctx.wx);
  const [wL, wC, wR] = opt.vekting;
  return {S, k, A: Math.min(1, S * k), Lsi, Csi, Rsi,
    L: Math.pow(Lsi, wL), C: Math.pow(Csi, wC), R: Math.pow(Rsi, wR), Wd: windFactor(opt, ctx), B: 1,
    hensyn: opt.hensyn, closed: isClosed(opt, ctx.m, ctx.d), seaT: ctx.sea, waves: null, tofaBest: false, flo: false,
    wxKnown: !!ctx.wx, tideKnown: !!ctx.tide, seaKnown: ctx.sea != null};
}
function scoreOf(f){ return f.closed ? 0 : Math.round(100 * f.A * f.L * f.C * f.R * f.Wd * f.B * f.hensyn); }

/* ----- Valgene: plass, fiskemåte og utstyr -----
   sel = {spot, method, gear}. null betyr «la siden velge». gear er {min, max} kastevekt i gram, eller null for
   «ta med det som trengs». Det som ikke passer valgene, vises med en advarsel, men kan aldri bli «best». */

// Stangtypene du kan velge. Kastevekten er vanlige verdier for slike stenger, og du kan endre den selv.
const RODS = [
  {id:'lett', navn:'Lett, 7–8 fot', vekt:[5, 25]},
  {id:'allround', navn:'Allround, 9–10 fot', vekt:[15, 60]},
  {id:'tung', navn:'Tung/surf, 11–13 fot', vekt:[100, 250]}
];
// Vekten du trenger: TOFA sin vekt for plassen når den finnes (Trolla), ellers fiskemåtens egen.
function weightFor(opt, s, ctx){
  const t = s && s.vekt && s.vekt[opt.id];
  return t ? {lo: t[0], hi: t[1], heavy: false, why: '', tofa: true} : pickWeight(opt, ctx);
}
// Én fiskemåte på én plass (s), eller uten plass (s = null). base er factors(opt, ctx).
// Plassen gir sjøtemperaturen i sin modellrute mot sin egen normal, TOFA sine beste måneder,
// bølgene ut fra vindretningen og sjøkartet, og vannstanden der TOFA sier full flo er best.
function evalAt(opt, base, s, ctx){
  if (!s) return {opt, spot: null, base, f: base, score: scoreOf(base)};
  const sea = spotSea(s, ctx), w = spotWaves(s, ctx);
  const tofaBest = !!(s.best && s.best[opt.id] && s.best[opt.id].includes(ctx.m));
  const S = tofaBest ? Math.max(base.S, ...opt.sesong) : base.S;
  const k = sea ? seaShift(opt, sea.temp, ctx, s.sjoNormal) : base.k;
  const flo = !!(s.flo && ctx.tide), Csi = flo ? floSI(ctx.tide) : base.Csi;
  const f = {...base, S, k, A: Math.min(1, S * k), seaT: sea ? sea.temp : base.seaT, seaKnown: !!sea || base.seaKnown,
    Csi, C: Math.pow(Csi, opt.vekting[1]), B: w ? waveFit(w.H) : 1, waves: w, tofaBest, flo};
  return {opt, spot: s, base, f, score: scoreOf(f)};
}
// Det som gjør at en kombinasjon ikke passer valgene dine.
function issuesFor(e, ctx, sel){
  const out = [], s = e.spot, o = e.opt;
  if (s && !o.steder.includes(s.id)) out.push(s.annet ? 'Plassen er for artsfiske, ikke for denne fiskemåten' : 'TOFA nevner ikke denne fiskemåten her');
  if (s && s.stengt && s.stengt(ctx.m, ctx.d)) out.push('Bryggen er bare for campinggjester nå');
  if (sel && sel.gear){
    const w = weightFor(o, s, ctx);
    if (w.lo > sel.gear.max || w.hi < sel.gear.min){
      out.push(`Trenger ${w.lo} til ${w.hi} g${w.tofa ? ' (TOFA)' : ''}, stanga di tar ${sel.gear.min} til ${sel.gear.max} g` + (s && s.utstyr ? '. ' + s.utstyr : ''));
    }
  }
  return out;
}
// Alle kombinasjoner av fiskemåte og plass for tidspunktet i ctx som valgene tillater.
function candidates(ctx, sel){
  sel = sel || {};
  const out = [];
  for (const opt of OPTIONS){
    if (sel.method && opt.id !== sel.method) continue;
    const base = factors(opt, ctx);
    let spots = sel.spot ? [SPOT_BY_ID[sel.spot]] : opt.steder.map(id => SPOT_BY_ID[id]);
    // Er alle plassene TOFA nevner stengt, regnes fiskemåten også uten fast plass, som for sei.
    if (!sel.spot && spots.length && spots.every(s => s.stengt && s.stengt(ctx.m, ctx.d))) spots = spots.concat([null]);
    for (const s of spots.length ? spots : [null]){
      const e = evalAt(opt, base, s, ctx);
      e.issues = issuesFor(e, ctx, sel);
      e.ok = !e.issues.length;
      out.push(e);
    }
  }
  return out;
}
// Den beste: høyest poeng blant det som passer valgene, ellers høyest poeng av resten.
function pickBest(list){
  let b = null;
  for (const e of list) if (!b || (e.ok && !b.ok) || (e.ok === b.ok && e.score > b.score)) b = e;
  return b;
}
function bestOk(ctx, sel){ const b = pickBest(candidates(ctx, sel)); return b && b.ok ? b : null; }
// Én fiskemåte: den beste plassen for den som passer valgene. lite: uten tekstene (for døgn og måneder).
function scoreOption(opt, ctx, lite, sel){
  const e = pickBest(candidates(ctx, {...(sel || {}), method: opt.id}));
  return lite ? e : {...e, ...reasons(e, ctx)};
}
function reasons(e, ctx){
  const pro = [], con = [], f = e.f, opt = e.opt, s = e.spot;
  if (f.closed){ con.push(opt.undertekst); return {pro, con}; }
  if (f.tofaBest) pro.push('TOFA: beste tiden for dette ved ' + s.kort);
  else if (f.S >= 0.75) pro.push('Toppsesong'); else if (f.S >= 0.45) pro.push('Greit i sesong');
  else if (f.S < 0.25) con.push('Utenfor sesong'); else con.push('Svak sesong');
  if (f.seaKnown && f.seaT != null){
    const t = fmtNum(f.seaT.toFixed(1)) + ' °C';
    if (f.k >= 1.1) pro.push('Sjøen (' + t + ') passer bedre enn vanlig');
    else if (f.k <= 0.9) con.push('Sjøen (' + t + ') passer dårligere enn vanlig');
  }
  const ph = PHASE_NAME[ctx.ph].toLowerCase();
  if (f.Lsi >= 0.9) pro.push('Godt lys (' + ph + ')'); else if (f.Lsi < 0.55) con.push('Dårlig lys for dette fisket (' + ph + ')');
  if (f.flo){
    if (f.Csi >= 0.9) pro.push('Nær full flo, som TOFA sier er best her');
    else if (f.Csi < 0.55) con.push('Lavt vann, og TOFA sier full flo er best her');
  } else if (ctx.tide){
    if (f.Csi >= 0.85) pro.push('God strøm, sjøen ' + (ctx.tide.rising ? 'stiger' : 'faller'));
    else if (f.Csi < 0.55) con.push('Lite strøm rundt ' + ((ctx.tide.p < 0.5) !== ctx.tide.rising ? 'flo' : 'fjære'));
  } else if (ctx.spring >= 0.8) pro.push('Springflo gir mye strøm');
  else if (ctx.spring <= 0.25) con.push('Nippflo, lite strøm');
  if (ctx.wx){
    const w = fmtNum(ctx.wx.wind);
    if (f.Wd >= 0.85) pro.push('Vinden (' + w + ' m/s) passer'); else if (f.Wd < 0.5) con.push('Vinden (' + w + ' m/s) er for sterk');
    else con.push('Litt mye vind (' + w + ' m/s)');
    if (f.Rsi < 0.8) con.push('Været drar ned');
  }
  if (f.waves){
    if (f.B < 0.85) con.push('Bølger på ca. ' + fmtNum(f.waves.H.toFixed(1)) + ' m ved plassen');
    else if (f.waves.H < 0.05 && ctx.wx.wind >= 6) pro.push('Plassen ligger i le for vinden');
  }
  if (opt.hensyn < 1) con.push('Svak bestand, slipp ut fisken');
  return {pro, con};
}
// Alle fiskemåtene for tidspunktet, det som passer valgene først. Fiskemåte-valget gjelder ikke her.
function rankOptions(ctx, sel){
  const s = {...(sel || {}), method: null};
  const r = OPTIONS.map(o => scoreOption(o, ctx, false, s));
  return r.map((x, i) => ({x, i})).sort((a, b) => (b.x.ok - a.x.ok) || (b.x.score - a.x.score) || (a.i - b.i)).map(o => o.x);
}
// Grensene er satt ut fra et vanlig år (2027) uten varsel, med beste fiskemåte og plass hver time:
// «Veldig bra» er de beste 10 % av timene, «Bra» de neste 25 %, «Middels» de neste 35 %.
// Under «Svakt» er det knapt noe å hente.
const VERDICT = {veldig: 82, bra: 69, middels: 55, svakt: 12};
function verdict(s, closed){
  if (closed) return 'Fredet';
  return s >= VERDICT.veldig ? 'Veldig bra' : s >= VERDICT.bra ? 'Bra' : s >= VERDICT.middels ? 'Middels' : s >= VERDICT.svakt ? 'Svakt' : 'Ikke aktuelt';
}
// wx er enten ett vær for hele døgnet, eller en funksjon som gir været for hvert klokkeslett.
function dayCtxs(y, m, d, wx, noSea){
  const a = [];
  for (let i = 0; i < 48; i++){
    const h = i / 2 + 0.25;
    a.push(makeCtx(y, m, d, h, typeof wx === 'function' ? wx(h) : wx, noSea));
  }
  return a;
}
function curveFor(opt, ctxs, sel){ return ctxs.map(c => { const e = scoreOption(opt, c, true, sel); return e.ok ? e.score : 0; }); }
// Det beste som passer valgene for hver halvtime, og det beste tidsrommet ut fra det.
// from: første halvtime som teller. For i dag er det halvtimen som pågår, så forslaget aldri ligger bakover i tid.
function dayPlan(ctxs, from, sel){
  from = from || 0;
  const env = ctxs.map(c => bestOk(c, sel));
  const sc = i => env[i] ? env[i].score : 0;
  let im = -1;
  for (let i = from; i < env.length; i++) if (im < 0 || sc(i) > sc(im)) im = i;
  if (im < 0 || sc(im) <= 0) return {env, best: null, win: null};
  const thr = sc(im) * 0.9;
  let a = im, b = im;
  while (a > from && sc(a - 1) >= thr) a--;
  while (b < env.length - 1 && sc(b + 1) >= thr) b++;
  return {env, best: {h: ctxs[im].h, score: sc(im), opt: env[im].opt, spot: env[im].spot}, win: {from: a / 2, to: (b + 1) / 2}};
}
// Beste poeng for en dag som passer valgene. Med wxFn regnes været inn time for time der det finnes varsel.
function dayBest(y, m, d, wxFn, noSea, sel){
  let best = {score: 0, opt: null, spot: null};
  for (const c of dayCtxs(y, m, d, wxFn || null, noSea)){
    const e = bestOk(c, sel);
    if (e && e.score > best.score) best = {score: e.score, opt: e.opt, spot: e.spot};
  }
  return best;
}

/* ----- Råd: vekt, farge, varsler, pakkeliste ----- */
function pickWeight(opt, ctx){
  const wind = ctx.wx ? ctx.wx.wind : 0;
  const strom = strongCurrent(ctx);
  const differs = opt.vekt.tung[0] !== opt.vekt.normal[0] || opt.vekt.tung[1] !== opt.vekt.normal[1];
  const heavy = differs && (strom || wind >= 7);
  const r = heavy ? opt.vekt.tung : opt.vekt.normal;
  const why = [];
  if (heavy && strom) why.push(ctx.tide ? 'tidevannet gir sterk strøm nå' : 'springflo gir sterk strøm');
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
  if (inRange(m, d, 12, 20, 4, 20)) out.push({lvl:'warn', t:'<b>Kveite er fredet</b> til og med 20. april, så kveite du får må slippes ut. Kveite over 2 meter skal alltid slippes ut.'});
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
  if (isSpring(ctx)) out.push({lvl:'info', t:'Springflo gir sterk strøm. Bruk tyngre sluk og sjekk tidevannstabellen, for flo kan stenge veien tilbake.'});
  return out;
}
// id er fast, så avkrysningen står seg selv om teksten endrer seg (for eksempel vekten).
// w: vekten du trenger på plassen (weightFor). Uten den brukes fiskemåtens egen.
function packList(opt, ctx, w){
  w = w || pickWeight(opt, ctx);
  const wx = ctx.wx, dark = ['skumring','morkt','natt'].includes(ctx.ph);
  const items = [];
  items.push({id:'stang', t: 'Stang, snelle og forfang: ' + (opt.stang.split('. ')[0]), must:false});
  items.push({id:'sluk', t: opt.farge === 'agn' ? 'Agn: ' + opt.agn : opt.slukType + ' (' + weightText(opt, w) + ')', must:false});
  if (opt.farge === 'agn') items.push({id:'sokke', t:'Søkker på ' + w.lo + ' til ' + w.hi + ' g, krokene du trenger, og bøtte til fisken', must:false});
  items.push({id:'vest', t:'Flytevest, alltid hvis du er alene eller i mørket', must: dark || !!(wx && wx.wind >= 8)});
  items.push({id:'hav', t:'Landingshåv med langt skaft, tang og fiskekniv', must:false});
  items.push({id:'maal', t:'Mål til minstemålene', must:false});
  items.push({id:'lykt', t:'Hodelykt med ekstra batterier', must: ['morkt','natt'].includes(ctx.ph)});
  items.push({id:'tide', t:'Tidevannstabell sjekket, så flo ikke stenger veien tilbake', must: isSpring(ctx)});
  if ((wx && wx.temp <= 1) || (!wx && inRange(ctx.m, ctx.d, 12, 1, 2, 28))) items.push({id:'brodd', t:'Brodder', must: !!(wx && wx.temp <= 1)});
  if (wx && wx.temp <= 5) items.push({id:'varm', t:'Varme klær og hansker', must:false});
  if (wx && (wx.rain === 'lett' || wx.rain === 'mye' || wx.rain === 'sno')) items.push({id:'regn', t:'Regntøy', must:false});
  if (ctx.ph === 'dag' && (!wx || wx.cloud < 1)) items.push({id:'sol', t:'Polariserte solbriller (de hjelper også mot treblekroker)', must:false});
  items.push({id:'vern', t:'Vernebriller, Ladestien har mange turgåere og treblekroker er skarpe', must:false});
  items.push({id:'mobil', t:'Mobil i vanntett pose, og søppelpose til slitt line', must:false});
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

/* ----- Rangering av plassene ----- */
const SPOT_IDS = ['ostmarkneset','hurtigrutekaia','trolla','ilsvikora','storsand','skansen'];
const SPOT_BY_ID = {};
SPOT_IDS.forEach(id => { SPOT_BY_ID[id] = {...SPOTS[id], id}; });
// Hvor høyt vannet står mellom fjære (0,3) og flo (1), med samme form som strømmen.
function floSI(t){ return 0.3 + 0.7 * (t.rising ? 1 - Math.cos(Math.PI * t.p) : 1 + Math.cos(Math.PI * t.p)) / 2; }
// Sjøen ved plassen (fra modellruta nærmest), eller null når den ikke er hentet eller vær er slått av.
function spotSea(s, ctx){
  return ctx.sea == null || !s.id ? null : FiskeVaer.seaAt(toUTC(ctx.y, ctx.m, ctx.d, ctx.h), s.id);
}
// Plassene TOFA nevner for en fiskemåte, best først for tidspunktet i ctx, med det som passer valgene først.
function bestSpotsFor(opt, ctx, sel){
  const base = factors(opt, ctx);
  return opt.steder.map((id, i) => {
    const e = evalAt(opt, base, SPOT_BY_ID[id], ctx);
    e.issues = issuesFor(e, ctx, {gear: sel && sel.gear}); e.ok = !e.issues.length; e.i = i;
    return e;
  }).sort((a, b) => (b.ok - a.ok) || (b.score - a.score) || (a.i - b.i));
}
// Hver plass med fiskemåtene TOFA nevner der, rangert for tidspunktet i ctx og utstyret ditt.
// Like poeng sorteres etter hvor høyt guiden setter plassen for den fiskemåten.
function rankSpots(ctx, sel){
  const dark = ctx.ph === 'morkt' || ctx.ph === 'natt', gear = {gear: sel && sel.gear};
  const bases = {};
  OPTIONS.forEach(o => { bases[o.id] = factors(o, ctx); });
  return SPOT_IDS.map((id, i) => {
    const s = SPOT_BY_ID[id], stengt = !!(s.stengt && s.stengt(ctx.m, ctx.d));
    const opts = OPTIONS.filter(o => o.steder.includes(id)).map(o => {
      const e = evalAt(o, bases[o.id], s, ctx);
      e.issues = issuesFor(e, ctx, gear).filter(t => !/campinggjester/.test(t)); e.ok = !e.issues.length;
      return e;
    }).sort((a, b) => (b.ok - a.ok) || (b.score - a.score) || (a.opt.steder.indexOf(id) - b.opt.steder.indexOf(id)));
    // Har du valgt fiskemåte, er det den som gjelder (og plasser uten den kommer sist).
    const best = (sel && sel.method ? opts.find(r => r.opt.id === sel.method) : opts[0]) || null;
    // Artene du realistisk kan få: fra fiskemåtene som er nær den beste her.
    const fisk = [], lim = best ? Math.max(VERDICT.svakt, best.score * 0.6) : 0;
    const add = list => list.forEach(f => { if (!fisk.includes(f)) fisk.push(f); });
    opts.forEach(r => { if (r.score >= lim) add((s.arter && s.arter[r.opt.id]) || r.opt.fisk); });
    const med = s.ekstra && opts.find(r => r.opt.id === s.ekstra.med);
    const ekstra = !!(med && dark && med.score >= VERDICT.svakt);
    if (ekstra) add(s.ekstra.fisk);
    if (!best && s.annet) add(s.annet.fisk);
    return {...s, stengt, opts, best, fisk, ekstra, waves: spotWaves(s, ctx), sea: spotSea(s, ctx),
      rank: best && !stengt ? best.score + (best.ok ? 1000 : 0) : -1, pref: best ? best.opt.steder.indexOf(id) : 99, i};
  }).sort((a, b) => (b.rank - a.rank) || (a.pref - b.pref) || (a.i - b.i));
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
  if (mmPerHour >= 1.5 || /heavy(rain|sleet|snow)/.test(sym)) return 'mye';
  if (/snow|sleet/.test(sym)) return 'sno';
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
  // Havvarselet gir verdiene i modellruta (800 m) nærmest punktet du spør om.
  const SEA_BASE = 'https://api.met.no/weatherapi/oceanforecast/2.0/complete';
  const SEA_URL = SEA_BASE + '?lat=63.44&lon=10.4';
  const TIDE_URL = 'https://vannstand.kartverket.no/tideapi.php?tide_request=locationdata&lat=63.4365&lon=10.3917' +
    '&datatype=TAB&lang=nb&dst=1&refcode=CD&interval=10';
  const KEY = {wx:'gutta_fiske_vaer', sea:'gutta_fiske_sjo', seaSpots:'gutta_fiske_sjo_plasser', tide:'gutta_fiske_tidevann'};
  const FRESH = 30 * 60000;    // yngre lagret varsel enn dette brukes uten ny henting
  const KEEP = 12 * 3600000;   // eldre lagret varsel enn dette kastes
  const RETRY = 5 * 60000;     // vent så lenge før et mislykket tidevannskall prøves igjen

  const usable = c => (c && Array.isArray(c.series) && Date.now() - c.fetched < KEEP) ? c : null;
  let wx = usable(Store.get(KEY.wx, null));
  let sea = usable(Store.get(KEY.sea, null));
  // Sjøtemperaturen for hver plass, fra modellruta nærmest plassen.
  const seaSpots = {};
  Object.entries(Store.get(KEY.seaSpots, null) || {}).forEach(([id, c]) => { if (usable(c)) seaSpots[id] = c; });
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
      fetched: Date.now(), pt: j.geometry && j.geometry.coordinates,
      series: withSteps(j.properties.timeseries.map(e => {
        const i = e.data.instant.details;
        return {t: Date.parse(e.time), temp: i.sea_water_temperature, wave: i.sea_surface_wave_height};
      }).filter(e => typeof e.temp === 'number'))
    };
  }

  // Punktet som gjelder for tidspunktet ms. Før første punkt brukes det første, men bare for i dag
  // og høyst tre timer bakover. Tidligere på dagen regnes det med vanlig vær i stedet.
  let dayStart = 0, dayStamp = -1;
  function todayStart(){
    const stamp = Math.floor(Date.now() / 60000);
    if (stamp !== dayStamp){ const n = osloNow(); dayStart = toUTC(n.y, n.m, n.d, 0); dayStamp = stamp; }
    return dayStart;
  }
  function lookup(c, ms){
    const s = c && c.series;
    if (!s || !s.length) return null;
    if (ms < s[0].t) return ms >= todayStart() && s[0].t - ms <= 3 * 3600000 ? s[0] : null;
    // Siste punkt som ikke er etter ms (punktene ligger i tidsrekkefølge).
    let lo = 0, hi = s.length - 1;
    while (lo < hi){ const mid = (lo + hi + 1) >> 1; if (s[mid].t <= ms) lo = mid; else hi = mid - 1; }
    return ms < s[lo].t + s[lo].step * 3600000 ? s[lo] : null;
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
    const needSpots = SPOT_IDS.filter(id => force || !seaSpots[id] || now - seaSpots[id].fetched > FRESH);
    if (!needWx && !needSea && !needSpots.length) return Promise.resolve();
    status = 'loading';
    changed();
    busy = Promise.all([
      needWx ? getText(WX_URL).then(t => { wx = parseWx(JSON.parse(t)); Store.set(KEY.wx, wx); }) : null,
      // Sjøtemperaturen er en bonus, så feil her stopper ikke resten.
      needSea ? getText(SEA_URL).then(t => { sea = parseSea(JSON.parse(t)); Store.set(KEY.sea, sea); }).catch(() => {}) : null,
      ...needSpots.map(id => {
        const p = SPOTS[id].pos;
        return getText(SEA_BASE + '?lat=' + p[0].toFixed(4) + '&lon=' + p[1].toFixed(4))
          .then(t => { seaSpots[id] = parseSea(JSON.parse(t)); }).catch(() => {});
      })
    ]).then(() => { status = 'ok'; }, () => { status = 'error'; })
      .then(() => { busy = null; if (needSpots.length) Store.set(KEY.seaSpots, seaSpots); changed(); });
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
      Object.keys(tideMemo).forEach(k => { delete tideMemo[k]; });
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
  // Flo og fjære dagen før, samme dag og dagen etter (klokkeslett regnet fra midnatt samme dag),
  // og den største høydeforskjellen mellom flo og fjære den dagen (m).
  const tideMemo = {};
  function dayEvents(y, m, d){
    const key = ymd(y, m, d);
    if (!tide.days[key]) return null;
    if (!tideMemo[key]){
      const evs = [];
      [-1, 0, 1].forEach(k => {
        const dt = new Date(Date.UTC(y, m - 1, d + k));
        (tides(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) || []).forEach(e => evs.push({...e, h: e.h + 24 * k}));
      });
      evs.sort((a, b) => a.h - b.h);
      let range = 0;
      for (let i = 1; i < evs.length; i++) if (evs[i].h > 0 && evs[i - 1].h < 24) range = Math.max(range, Math.abs(evs[i].cm - evs[i - 1].cm));
      tideMemo[key] = {evs, range: range / 100};
    }
    return tideMemo[key];
  }
  // Tidevannet klokka h: stiger eller faller sjøen, neste flo eller fjære, og hvor fort vannstanden
  // endrer seg (m/t). Vannstanden følger en cosinus mellom fjære og flo, så strømmen er sterkest midt imellom.
  function tideState(y, m, d, h){
    const day = dayEvents(y, m, d);
    if (!day) return null;
    const i = day.evs.findIndex(e => e.h > h);
    if (i < 1) return null;
    const a = day.evs[i - 1], b = day.evs[i], dur = b.h - a.h, p = (h - a.h) / dur;
    const rate = Math.abs(b.cm - a.cm) / 100 * Math.PI / (2 * dur) * Math.sin(Math.PI * p);
    return {rate, p, rising: b.high, prev: a, next: b, range: day.range};
  }

  return {
    load, loadTide, tides, tideState,
    tideRange(y, m, d){ const day = dayEvents(y, m, d); return day ? day.range : null; },
    wxAt(ms){ const e = lookup(wx, ms); return e ? (e.model || (e.model = toModel(e))) : null; },
    // Med id: sjøen ved den plassen, og pt er modellruta verdien gjelder for ([lon, lat]).
    seaAt(ms, id){
      const c = id && seaSpots[id] ? seaSpots[id] : (id ? null : sea), e = lookup(c, ms);
      return e ? {temp: e.temp, wave: e.wave, pt: c.pt} : null;
    },
    onChange(fn){ listeners.push(fn); },
    get status(){ return status; },
    get hasData(){ return !!wx; },
    get updated(){ return wx ? wx.updated : null; },
    get version(){ return version; }
  };
})();
