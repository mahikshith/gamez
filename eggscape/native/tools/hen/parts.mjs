// Mama Hen, the app mascot: every part as SVG on one 512 x 512 canvas (feet on y = 470, centre x = 256).
// Design rules (from the Duolingo shape-language study, applied to an original hen): one round body that is head
// and body at once, huge eyes, a small beak, detached feet, flat fills with one shadow tone and one highlight, no
// outlines, one locked identity colour (ginger). tools/hen/build.mjs renders a model sheet and exports each part
// as its own cropped SVG for the Godot rig (assets/hen/*.svg + parts.json with each crop's origin).
export const C = {
  body: '#FF9B3D', bodySh: '#F07D22', dark: '#DD6A16', hi: '#FFC685',
  belly: '#FFE7C4', bellySh: '#FFD49E',
  comb: '#FF5148', combSh: '#DE3730',
  beak: '#FFC83A', beakSh: '#EFA21A', mouth: '#9E3426', tongue: '#FF7468',
  eye: '#FFFFFF', eyeSh: '#EEE4DA', pupil: '#3A2618',
  feet: '#FFB52E', feetSh: '#E99417', cheek: '#FF6E6E" fill-opacity="0.42', tear: '#7FD0FF',
};
const BODY = 'M256,120 C356,120 414,212 414,318 C414,402 348,452 256,452 C164,452 98,402 98,318 C98,212 156,120 256,120 Z';
const LIT = '<circle cx="222" cy="262" r="206"/>';
const ell = (cx, cy, rx, ry, fill, rot = 0, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}${extra}/>`;
const toe = (x, y, rot, s = 1) => ell(x, y, 12 * s, 23 * s, C.feet, rot);

// pivots are the points each part turns or scales about (in canvas units)
export const PARTS = {
  tail: {
    pivot: [140, 240],
    svg: ell(118, 206, 40, 16, C.dark, -60) + ell(106, 234, 44, 17, C.bodySh, -36) + ell(108, 262, 38, 15, C.dark, -14),
  },
  foot_l: { pivot: [214, 452], svg: `<rect x="206" y="430" width="16" height="26" rx="8" fill="${C.feetSh}"/>` + toe(194, 462, 55) + toe(214, 466, 90, 1.05) + toe(234, 462, 125) },
  foot_r: { pivot: [302, 452], svg: `<rect x="294" y="430" width="16" height="26" rx="8" fill="${C.feetSh}"/>` + toe(282, 462, 55) + toe(302, 466, 90, 1.05) + toe(322, 462, 125) },
  body: {
    pivot: [256, 452],
    svg: `<defs><clipPath id="bc"><path d="${BODY}"/></clipPath><clipPath id="lc">${LIT}</clipPath></defs>
      <path d="${BODY}" fill="${C.bodySh}"/>
      <g clip-path="url(#bc)"><path d="${BODY}" fill="${C.body}" clip-path="url(#lc)"/>
        ${ell(268, 380, 116, 82, C.bellySh)}
        <g clip-path="url(#lc)">${ell(268, 380, 116, 82, C.belly)}</g>
        <path d="M206,330 q12,14 24,0 M238,322 q12,14 24,0 M270,326 q12,14 24,0 M222,354 q12,14 24,0 M254,350 q12,14 24,0" stroke="${C.bellySh}" stroke-width="7" fill="none" stroke-linecap="round"/>
      </g>
      <path d="M146,236 C160,186 196,154 238,146" stroke="${C.hi}" stroke-width="15" stroke-linecap="round" fill="none" opacity="0.85"/>
      <circle cx="140" cy="268" r="8" fill="${C.hi}" opacity="0.85"/>`,
  },
  comb: {
    pivot: [266, 150],
    svg: `<defs><clipPath id="cc"><circle cx="232" cy="132" r="25"/><circle cx="268" cy="110" r="31"/><circle cx="304" cy="128" r="24"/><ellipse cx="268" cy="146" rx="48" ry="20"/></clipPath></defs>
      <g clip-path="url(#cc)"><rect x="190" y="70" width="150" height="110" fill="${C.combSh}"/><circle cx="252" cy="104" r="62" fill="${C.comb}"/></g>
      <circle cx="258" cy="96" r="8" fill="#FF8C7E"/>`,
  },
  cheek_l: { pivot: [170, 318], svg: ell(170, 318, 22, 13, C.cheek) },
  cheek_r: { pivot: [370, 314], svg: ell(370, 314, 22, 13, C.cheek) },
  eye_l: {
    pivot: [208, 240],
    svg: `<defs><clipPath id="el"><ellipse cx="208" cy="240" rx="58" ry="66"/></clipPath></defs>
      <ellipse cx="208" cy="240" rx="58" ry="66" fill="${C.eye}"/><g clip-path="url(#el)">${ell(202, 310, 70, 26, C.eyeSh)}</g>`,
  },
  eye_r: {
    pivot: [322, 236],
    svg: `<defs><clipPath id="er"><ellipse cx="322" cy="236" rx="62" ry="70"/></clipPath></defs>
      <ellipse cx="322" cy="236" rx="62" ry="70" fill="${C.eye}"/><g clip-path="url(#er)">${ell(316, 310, 74, 28, C.eyeSh)}</g>`,
  },
  pupil_l: { pivot: [222, 248], svg: `<circle cx="222" cy="248" r="30" fill="${C.pupil}"/><circle cx="210" cy="234" r="10" fill="#fff"/><circle cx="233" cy="262" r="4" fill="#fff"/>` },
  pupil_r: { pivot: [336, 244], svg: `<circle cx="336" cy="244" r="32" fill="${C.pupil}"/><circle cx="323" cy="229" r="10.5" fill="#fff"/><circle cx="348" cy="258" r="4.2" fill="#fff"/>` },
  eyes_happy: { pivot: [264, 240], svg: `<path d="M164,262 Q208,198 252,262 M276,258 Q322,192 368,258" stroke="${C.pupil}" stroke-width="20" stroke-linecap="round" fill="none"/>` },
  eyes_shut: { pivot: [264, 240], svg: `<path d="M166,236 Q208,274 250,236 M278,232 Q322,272 366,232" stroke="${C.pupil}" stroke-width="18" stroke-linecap="round" fill="none"/>` },
  brows_worry: { pivot: [264, 160], svg: `<path d="M168,170 L236,148 M294,146 L364,168" stroke="${C.pupil}" stroke-width="15" stroke-linecap="round"/>` },
  brows_proud: { pivot: [264, 160], svg: `<path d="M172,160 Q204,142 236,154 M294,150 Q328,136 360,152" stroke="${C.pupil}" stroke-width="13" stroke-linecap="round" fill="none"/>` },
  mouth: { pivot: [270, 314], svg: ell(270, 328, 26, 20, C.mouth) + ell(270, 338, 15, 8, C.tongue) },
  beak_bot: { pivot: [270, 314], svg: `<path d="M242,318 C250,346 290,346 298,318 C284,328 256,328 242,318 Z" fill="${C.beakSh}"/>` },
  beak_top: {
    pivot: [270, 306],
    svg: `<defs><clipPath id="bk"><path d="M230,304 C242,280 298,278 310,302 C300,320 284,330 270,334 C256,330 240,320 230,304 Z"/></clipPath></defs>
      <path d="M230,304 C242,280 298,278 310,302 C300,320 284,330 270,334 C256,330 240,320 230,304 Z" fill="${C.beakSh}"/>
      <g clip-path="url(#bk)">${ell(260, 296, 44, 22, C.beak)}</g><ellipse cx="254" cy="294" rx="9" ry="5" fill="#FFE596"/>`,
  },
  wing_l: { pivot: [114, 300], svg: ell(96, 346, 32, 66, C.dark, 22) + ell(90, 370, 16, 30, C.bodySh, 22) },
  wing_r: { pivot: [398, 300], svg: ell(416, 346, 32, 66, C.dark, -22) + ell(422, 370, 16, 30, C.bodySh, -22) },
  tear: { pivot: [178, 262], svg: `<path d="M178,250 C170,264 166,274 178,282 C190,274 186,264 178,250 Z" fill="${C.tear}"/>` },
  sweat: { pivot: [376, 170], svg: `<path d="M376,150 C366,168 362,180 376,190 C390,180 386,168 376,150 Z" fill="${C.tear}"/>` },
};
// draw order, back to front
export const ORDER = ['tail', 'foot_l', 'foot_r', 'body', 'comb', 'cheek_l', 'cheek_r', 'eye_l', 'eye_r', 'pupil_l', 'pupil_r',
  'eyes_happy', 'eyes_shut', 'brows_worry', 'brows_proud', 'mouth', 'beak_bot', 'beak_top', 'wing_l', 'wing_r', 'tear', 'sweat'];
