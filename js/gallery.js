/* =========================================================
   GALLERY — håndlagde SVG-illustrasjoner av rampete øyeblikk
   (Ekte bilder kan ikke hentes fra nettet i denne editoren,
   så her er stemningsfulle illustrasjoner i samme ånd.)
   ========================================================= */

function svgWrap(inner, bg = '#2a1608') {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="300" fill="${bg}"/>
    ${inner}
  </svg>`;
}

function person(x, y, shirtColor, armUp = false, scale = 1) {
  return `
  <g transform="translate(${x},${y}) scale(${scale})">
    <circle cx="0" cy="-38" r="14" fill="#e8b382"/>
    <path d="M-14,-38 a14,14 0 0,1 28,0" fill="#5a3820"/>
    <rect x="-11" y="-24" width="22" height="34" rx="8" fill="${shirtColor}"/>
    <rect x="-11" y="10" width="9" height="26" rx="4" fill="#2c2c34"/>
    <rect x="2" y="10" width="9" height="26" rx="4" fill="#2c2c34"/>
    ${armUp
      ? `<rect x="9" y="-22" width="8" height="26" rx="4" fill="${shirtColor}" transform="rotate(-40 9 -22)"/>
         <circle cx="24" cy="-38" r="6" fill="#f4a825"/>`
      : `<rect x="9" y="-20" width="8" height="24" rx="4" fill="${shirtColor}" transform="rotate(15 9 -20)"/>`
    }
    <rect x="-19" y="-20" width="8" height="24" rx="4" fill="${shirtColor}" transform="rotate(-15 -19 -20)"/>
  </g>`;
}

function beerMug(x, y, scale = 1) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <rect x="-10" y="-14" width="20" height="24" rx="3" fill="#f4a825" stroke="#3a1f0f" stroke-width="1.5"/>
    <circle cx="4" cy="-14" r="10" fill="#fff8e7" stroke="#3a1f0f" stroke-width="1"/>
    <path d="M10,-6 a8,8 0 0,1 0,14" fill="none" stroke="#f4a825" stroke-width="3"/>
  </g>`;
}

function confettiDots(count = 30) {
  let out = '';
  const colors = ['#f4a825','#e6432f','#3fae5a','#ffb92e','#fff8e7'];
  for (let i=0;i<count;i++){
    const cx = Math.random()*400;
    const cy = Math.random()*300;
    const c = colors[Math.floor(Math.random()*colors.length)];
    const r = 2+Math.random()*3;
    out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" opacity="0.8"/>`;
  }
  return out;
}

function spotlight() {
  return `<defs>
    <radialGradient id="spot" cx="50%" cy="20%" r="70%">
      <stop offset="0%" stop-color="#ffedb0" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="300" fill="url(#spot)"/>`;
}

const scenes = [
  {
    title: "Skål for gutta! 🍻",
    svg: svgWrap(`
      ${spotlight()}
      ${confettiDots(20)}
      ${person(140, 220, '#e6432f', true)}
      ${person(200, 220, '#3fae5a', true)}
      ${person(260, 220, '#2694c9', true)}
      ${beerMug(140, 165, 1.1)}
      ${beerMug(200, 165, 1.1)}
      ${beerMug(260, 165, 1.1)}
    `)
  },
  {
    title: "Dansegulvet tar helt av 🕺",
    svg: svgWrap(`
      ${spotlight()}
      ${confettiDots(35)}
      ${person(120, 210, '#ffb92e', true, 1.1)}
      ${person(200, 230, '#e6432f', false, 0.9)}
      ${person(280, 205, '#7a3ea1', true, 1.2)}
    `, '#1c0f05')
  },
  {
    title: "Fyren datt av stolen igjen 😂",
    svg: svgWrap(`
      <ellipse cx="200" cy="250" rx="90" ry="14" fill="#000" opacity="0.3"/>
      <g transform="translate(200,235) rotate(75)">
        ${person(0,0,'#3fae5a')}
      </g>
      ${beerMug(280, 240, 0.8)}
      <text x="200" y="60" font-family="sans-serif" font-size="40" text-anchor="middle">😵💫</text>
    `)
  },
  {
    title: "Shots for alle! 🥃",
    svg: svgWrap(`
      ${spotlight()}
      ${[100,150,200,250,300].map(x => `<rect x="${x-6}" y="190" width="12" height="18" fill="#ffe08a" stroke="#3a1f0f"/>`).join('')}
      ${person(80, 230, '#e6432f', true, 0.9)}
      ${person(320, 230, '#2694c9', true, 0.9)}
    `)
  },
  {
    title: "Ølpong-mestere 🏓",
    svg: svgWrap(`
      <rect x="60" y="200" width="280" height="16" fill="#8a5a06"/>
      ${[100,140,180].map(x=>`<circle cx="${x}" cy="192" r="9" fill="#fff8e7" stroke="#3a1f0f"/>`).join('')}
      ${[220,260,300].map(x=>`<circle cx="${x}" cy="192" r="9" fill="#fff8e7" stroke="#3a1f0f"/>`).join('')}
      ${person(80, 250, '#f4a825', true, 0.9)}
      ${person(320, 250, '#e6432f', true, 0.9)}
      <circle cx="200" cy="130" r="7" fill="#fff" stroke="#3a1f0f"/>
    `)
  },
  {
    title: "17. mai-feiring i fullt kaos 🇳🇴",
    svg: svgWrap(`
      ${spotlight()}
      ${confettiDots(40)}
      ${person(130, 220, '#e6432f', true)}
      ${person(200, 210, '#fff8e7', true)}
      ${person(270, 220, '#2694c9', true)}
      <rect x="190" y="40" width="6" height="60" fill="#8a5a06"/>
      <rect x="196" y="40" width="40" height="26" fill="#e6432f"/>
      <rect x="196" y="52" width="40" height="6" fill="#fff8e7"/>
      <rect x="210" y="40" width="6" height="26" fill="#2694c9"/>
    `)
  },
  {
    title: "Nachspiel-filosofene 🧠🍺",
    svg: svgWrap(`
      <circle cx="200" cy="150" r="60" fill="none" stroke="#f4a825" stroke-width="2" opacity="0.3"/>
      ${person(150, 230, '#3fae5a', false, 0.9)}
      ${person(250, 230, '#ffb92e', false, 0.9)}
      ${beerMug(150, 175, 0.9)}
      ${beerMug(250, 175, 0.9)}
      <text x="200" y="80" font-family="sans-serif" font-size="30" text-anchor="middle">🤔💭</text>
    `)
  },
  {
    title: "Karaoke-katastrofen 🎤",
    svg: svgWrap(`
      ${spotlight()}
      ${person(200, 220, '#7a3ea1', true, 1.2)}
      <rect x="196" y="130" width="8" height="50" fill="#333"/>
      <ellipse cx="200" cy="122" rx="12" ry="10" fill="#888"/>
      ${confettiDots(15)}
    `)
  },
  {
    title: "Taxi-kø klokken 03:00 🚕",
    svg: svgWrap(`
      <rect x="0" y="240" width="400" height="60" fill="#111"/>
      ${person(120, 230, '#e6432f', false, 0.85)}
      ${person(160, 230, '#2694c9', false, 0.85)}
      ${person(200, 230, '#3fae5a', false, 0.85)}
      <rect x="260" y="200" width="90" height="40" rx="6" fill="#ffe08a"/>
      <circle cx="278" cy="242" r="10" fill="#222"/>
      <circle cx="332" cy="242" r="10" fill="#222"/>
      <text x="305" y="225" font-size="14" text-anchor="middle" font-family="sans-serif">TAXI</text>
    `, '#0a0a0a')
  },
  {
    title: "Grillfest med de gode gutta 🔥🍖",
    svg: svgWrap(`
      <ellipse cx="200" cy="260" rx="60" ry="10" fill="#000" opacity="0.3"/>
      <rect x="170" y="220" width="60" height="14" rx="4" fill="#555"/>
      <circle cx="185" cy="215" r="8" fill="#8a5a06"/>
      <circle cx="215" cy="215" r="8" fill="#8a5a06"/>
      ${person(100, 230, '#f4a825', true, 0.9)}
      ${person(300, 230, '#e6432f', true, 0.9)}
      <text x="200" y="190" font-size="26" text-anchor="middle">🔥</text>
    `)
  },
  {
    title: "Sofa-kollaps etter fest 🛋️",
    svg: svgWrap(`
      <rect x="60" y="200" width="280" height="60" rx="16" fill="#5a3820"/>
      <g transform="translate(150,190) rotate(20)">${person(0,0,'#2694c9',false,0.9)}</g>
      <g transform="translate(250,195) rotate(-15)">${person(0,0,'#ffb92e',false,0.9)}</g>
      ${beerMug(200,255,0.7)}
    `)
  },
  {
    title: "Forhåndsfesten (vorspiel) 🎉",
    svg: svgWrap(`
      ${spotlight()}
      ${confettiDots(25)}
      ${person(110, 225, '#e6432f', true, 0.95)}
      ${person(170, 210, '#3fae5a', false, 0.95)}
      ${person(230, 225, '#2694c9', true, 0.95)}
      ${person(290, 210, '#ffb92e', false, 0.95)}
      ${beerMug(110,170,0.8)}${beerMug(230,170,0.8)}
    `)
  }
];

const gallery = document.getElementById('gallery');
const lightbox = document.getElementById('lightbox');
const lightboxInner = document.getElementById('lightboxInner');

scenes.forEach(scene => {
  const fig = document.createElement('figure');
  fig.innerHTML = `${scene.svg}<figcaption>${scene.title}</figcaption>`;
  fig.addEventListener('click', () => openLightbox(scene));
  gallery.appendChild(fig);
});

function openLightbox(scene) {
  lightboxInner.innerHTML = `${scene.svg}<figcaption style="padding:14px; text-align:center; font-size:1.1rem; color:var(--amber);">${scene.title}</figcaption>`;
  lightbox.classList.add('open');
  GuttaSFX.glassClink();
}
function closeLightbox() {
  lightbox.classList.remove('open');
}
lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});
