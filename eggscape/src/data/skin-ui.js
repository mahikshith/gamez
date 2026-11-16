// Skin-themed UI (mykee 2026-11-16): the hen outfit the player wears re-themes the menus too: button colours, the card
// frame, ribbons, a decoration on the buttons and a couple of icons. Keyed by hen skin id (economy.js HEN_SKINS);
// 'classic' (and any id without a row) is the normal farm look. The map imports this too, for its header and ribbons.
// Rows are append-only: new outfits add their own row.
//
// kinds:  overrides of ui.js button palettes by kind ({a, b, lip, line, ink}); primary stays a "go" green
// ribbon: the default ribbon colour; stripes: candy-cane stripes on ribbons
// wood:   the card frame's three wood stops [light, mid, dark]
// deco:   'snow' (a snow cap on button tops), 'sparkle' (twinkles on button corners) or null
// fx:     the living effect over every menu screen (ui/menufx.js): snow, marsh, glitter, crystal, sparks, leaves, petals, embers, rain, coins, bubbles, fireflies
// icons:  { shop: 'gift' | 'coin', settings: 'snowflake' | 'gear' }

const face = (a, b, lip, line, ink = '#fff') => ({ a, b, lip, line, ink });


// Theme packs (2026-11-16): the pack is the LOOK (painters live in ui/theme.js), `pal` the colours; a row names its pack and
// may override pal. Shared: winter = santa, snowy, elf, reindeer, skier; cabin = cocoa; castle = royal, golden;
// forest = farmer, lumberjack, fisher; sea = pirate, diver, raincoat; deep = miner, firefighter, scientist.
//   bg     the full-screen scene (title, shop, extras, practice)   frame  corner ornaments on every card
//   border [stripe, stripe] two-colour dashed border on cards      button wrapped present | stitched | studded
//   icon   shapes of the pause bars + levels grid                  logo   how the title letters are dressed
export const PACKS = {
  winter: { name: 'Winter holiday', bg: 'village', frame: 'holly', border: ['#ffffff', '#d8302a'], button: 'present', icon: 'bauble', logo: 'santa',
    pal: { sky: ['#0c1838', '#3a5a96'], far: '#5a78b0', mid: '#8aa8d8', ground: ['#eef6ff', '#b8d4f0'], wash: 'rgba(10,30,70,0.5)', tint: 'rgba(40,70,140,0.1)' } },
  cabin: { name: 'Cosy cabin', bg: 'cabin', frame: 'stitch', border: ['#f4e4c8', '#8a4a26'], button: 'stitch', icon: 'mug', logo: 'beanie',
    pal: { sky: ['#7a4420', '#9a6230'], ground: ['#5a3418', '#2e1608'], wash: 'rgba(50,20,0,0.55)', tint: 'rgba(140,70,10,0.12)' } },
  castle: { name: 'Castle hall', bg: 'hall', frame: 'filigree', border: ['#ffe08a', '#a87810'], button: 'studs', icon: 'gem', logo: 'crown',
    pal: { sky: ['#3a2468', '#5a3a98'], win: ['#1a2a5a', '#4a6ac8'], trim: '#ffd24a', accent: '#8a3ae8', ground: ['#2a1a4a', '#160c30'], wash: 'rgba(30,10,70,0.55)', tint: 'rgba(120,70,200,0.1)' } },
  forest: { name: 'Countryside', bg: 'hills', frame: 'leaf', border: ['#bfe890', '#3a7a1a'], button: 'stitch', icon: 'leaf', logo: 'leaf',
    pal: { sky: ['#7ac8f4', '#e8f6ff'], sun: 'rgba(255,240,160,0.6)', far: '#8ac86a', mid: '#5aa83a', tree: '#3f8a2a', tree2: '#5aa83a', trees: 'round', ground: ['#7ac850', '#4a8a2a'], wash: 'rgba(10,50,10,0.4)', tint: 'rgba(60,140,40,0.08)' } },
  sea: { name: 'Harbour', bg: 'harbor', frame: 'rope', border: ['#f0dcaa', '#7a5a28'], button: 'studs', stud: '#ffe9a0', icon: 'bubble', logo: 'bubble',
    pal: { mode: 'ship', ship: true, sky: ['#ff9a5a', '#ffe0a8'], ground: ['#2a6aa8', '#143a68'], wash: 'rgba(0,30,70,0.5)', tint: 'rgba(30,100,180,0.1)' } },
  deep: { name: 'Deep places', bg: 'cave', frame: 'rivet', border: ['#cfc8f0', '#4a3a78'], button: 'studs', stud: '#d8d4f8', icon: 'gem', logo: 'gems',
    pal: { mode: 'crystal', sky: ['#1a1432', '#2e1e52'], rock: '#3a2a62', glow: ['rgb(200,120,255)', 'rgb(90,210,255)', 'rgb(255,140,220)'], ground: ['#2a2048', '#140e28'], wash: 'rgba(20,10,50,0.55)', tint: 'rgba(100,60,200,0.1)' } },
};

export const SKIN_UI = {
  classic: null,
  santa: {
    name: 'Christmas',
    kinds: {
      primary: face('#7fdc6a', '#1f9a3c', '#126a28', '#0a4018'),
      secondary: face('#ff8a7a', '#d8302a', '#962018', '#5a0f0a'),
      orange: face('#ffb36a', '#e2572a', '#a33612', '#5e1d06'),
    },
    ribbon: '#d8302a', stripes: true,
    wood: ['#e8a59a', '#b8423a', '#8a2620'],
    deco: 'snow',
    fx: 'snow',
    pack: 'winter',
    icons: { shop: 'gift', settings: 'snowflake' },
  },
  snowy: {
    name: 'Frost',
    kinds: {
      secondary: face('#bfe8ff', '#4aa3e8', '#2a6fb0', '#153e6e'),
      ad: face('#d6c8ff', '#7d6ae8', '#4d3fb0', '#2a2070'),
    },
    ribbon: '#4aa3e8',
    wood: ['#e6f4ff', '#a9cbe8', '#7aa2c8'],
    deco: 'snow',
    fx: 'snow',
    pack: 'winter',
    pal: { sky: ['#1a2a4a', '#6a90c0'], far: '#8aa8d0', mid: '#b8d0ec' },
    icons: { shop: 'gift', settings: 'snowflake' },
  },
  elf: {
    name: 'Elf',
    kinds: {
      primary: face('#8fe070', '#28a040', '#16702a', '#0a4018'),
      secondary: face('#ff8a7a', '#d8302a', '#962018', '#5a0f0a'),
    },
    ribbon: '#28a040', stripes: true,
    wood: ['#a8e0a0', '#3f9a4a', '#22702e'],
    deco: 'snow',
    fx: 'snow',
    pack: 'winter',
    pal: { sky: ['#06281e', '#2a7a5a'], far: '#4a9a7a', mid: '#7ac0a0' },
    icons: { shop: 'gift', settings: 'snowflake' },
  },
  reindeer: {
    name: 'Reindeer',
    kinds: {
      secondary: face('#ff8a7a', '#d8302a', '#962018', '#5a0f0a'),
      orange: face('#e8b07a', '#a8642e', '#6e3c14', '#40200a'),
    },
    ribbon: '#a8642e',
    wood: ['#e0b48a', '#9a6236', '#6e3e1a'],
    deco: 'snow',
    fx: 'snow',
    pack: 'winter',
    pal: { sky: ['#2a1a34', '#7a5a8a'], far: '#8a6aa0', mid: '#b09ac8' },
    icons: { shop: 'gift', settings: 'snowflake' },
  },
  cocoa: {
    name: 'Cocoa',
    kinds: {
      secondary: face('#e8b98a', '#9a5a2e', '#683814', '#3e1e08'),
      orange: face('#ffd0a0', '#d88a4a', '#9a5420', '#5a2e0a'),
    },
    ribbon: '#8a4e26', stripes: true,
    wood: ['#d8a878', '#8a5226', '#5e3210'],
    deco: null,
    fx: 'marsh',
    pack: 'cabin',
    icons: { shop: 'coin', settings: 'gear' },
  },
  royal: {
    name: 'Royal',
    kinds: {
      secondary: face('#c8a8ff', '#6a3ac8', '#46208e', '#28105a'),
      ad: face('#e8a8ff', '#a03ac8', '#6e208e', '#40105a'),
    },
    ribbon: '#6a3ac8',
    wood: ['#ffe9a0', '#e0b030', '#a87810'],
    deco: 'sparkle',
    fx: 'glitter',
    pack: 'castle',
    icons: { shop: 'coin', settings: 'gear' },
  },
  golden: {
    name: 'Golden',
    kinds: {
      secondary: face('#ffe9a0', '#e0a020', '#a06a08', '#5e3c04'),
    },
    ribbon: '#e0a020',
    wood: ['#fff0b0', '#f0c040', '#b88a10'],
    deco: 'sparkle',
    fx: 'glitter',
    pack: 'castle',
    pal: { sky: ['#8a6a1c', '#c8a040'], win: ['#fff0b0', '#ffd060'], accent: '#c8201a', ground: ['#7a5a12', '#3e2a08'], wash: 'rgba(70,40,0,0.5)', tint: 'rgba(255,200,60,0.1)' },
    icons: { shop: 'coin', settings: 'gear' },
  },
  // 2026-11-16 world outfits (one per world): each re-themes the menus in its world's colours
  farmer: {
    name: 'Farm',
    kinds: { secondary: face('#a8c8ff', '#3d6fb8', '#264a82', '#122a52'), orange: face('#ffe08a', '#e8a42a', '#a86a0a', '#5e3a04') },
    ribbon: '#3d6fb8',
    wood: ['#f2d488', '#c89a3a', '#8a6418'],
    deco: null,
    fx: 'petals',
    pack: 'forest',
    pal: { fence: true },
    icons: { shop: 'coin', settings: 'gear' },
  },
  lumberjack: {
    name: 'Woods',
    kinds: { secondary: face('#ff9a80', '#c42a1a', '#7a160c', '#4a0a04'), orange: face('#a8e090', '#3f9a4a', '#22702e', '#0e4a1a') },
    ribbon: '#c42a1a',
    wood: ['#c8946a', '#7a4a22', '#4a2a10'],
    deco: null,
    fx: 'leaves',
    pack: 'forest',
    pal: { sky: ['#f4a040', '#ffe0a8'], far: '#b06a2a', mid: '#8a5a1e', tree: '#2a5a2a', trees: 'pine', ground: ['#6a4a22', '#3a2610'], wash: 'rgba(60,30,0,0.45)', tint: 'rgba(200,100,20,0.1)' },
    icons: { shop: 'coin', settings: 'gear' },
  },
  skier: {
    name: 'Slopes',
    kinds: { secondary: face('#9af0f8', '#1fa6b8', '#126f7c', '#0a4048'), orange: face('#ffc0a0', '#ff6a3a', '#b8401a', '#6a200a') },
    ribbon: '#1fa6b8',
    wood: ['#e6f4ff', '#a9cbe8', '#7aa2c8'],
    deco: 'snow',
    fx: 'snow',
    pack: 'winter',
    pal: { sky: ['#2a6ab8', '#bfe4ff'], far: '#9ab8d8', mid: '#cfe2f4', wash: 'rgba(20,60,120,0.4)' },
    icons: { shop: 'coin', settings: 'snowflake' },
  },
  miner: {
    name: 'Mine',
    kinds: { secondary: face('#d8b8ff', '#8a5ad8', '#5a3098', '#30185a'), orange: face('#ffd0a0', '#ff8a1e', '#b85a08', '#6a3004') },
    ribbon: '#8a5ad8',
    wood: ['#c8b8a8', '#7a6a5a', '#4a3e34'],
    deco: 'sparkle',
    fx: 'crystal',
    pack: 'deep',
    icons: { shop: 'coin', settings: 'gear' },
  },
  firefighter: {
    name: 'Fire',
    kinds: { secondary: face('#ffa080', '#e2532a', '#a02e10', '#5a1406'), orange: face('#fff0a0', '#ffc81e', '#b8860a', '#6a4a04') },
    ribbon: '#e2532a',
    wood: ['#c89870', '#7a4a2a', '#4a2412'],
    deco: null,
    fx: 'embers',
    pack: 'deep',
    pal: { mode: 'fire', sky: ['#5a1e16', '#2a0e0a'], ground: ['#2a1410', '#140806'], wash: 'rgba(50,10,0,0.55)', tint: 'rgba(255,100,20,0.1)' },
    icons: { shop: 'coin', settings: 'gear' },
  },
  raincoat: {
    name: 'Storm',
    kinds: { secondary: face('#b8c8f0', '#5a72a8', '#384a78', '#1c2848'), orange: face('#fff090', '#ffd02a', '#b88a08', '#6a4e04') },
    ribbon: '#5a72a8',
    wood: ['#c8d0dc', '#7a8698', '#4a5466'],
    deco: null,
    fx: 'rain',
    pack: 'sea',
    pal: { mode: 'storm', sky: ['#3a4258', '#7a869c'], ground: ['#2a3a58', '#141e38'] },
    icons: { shop: 'coin', settings: 'gear' },
  },
  pirate: {
    name: 'Treasure',
    kinds: { secondary: face('#a8b8f0', '#22408a', '#14285a', '#0a1430'), orange: face('#ffe9a0', '#e0a020', '#a06a08', '#5e3c04') },
    ribbon: '#22408a',
    wood: ['#ffe9a0', '#c89a2a', '#8a6410'],
    deco: 'sparkle',
    fx: 'coins',
    pack: 'sea',
    icons: { shop: 'coin', settings: 'gear' },
  },
  diver: {
    name: 'Reef',
    kinds: { secondary: face('#a0ecf8', '#1f9ad0', '#126890', '#083a52'), orange: face('#ffc0a0', '#ff7a2a', '#b8481a', '#6a2408') },
    ribbon: '#1f9ad0',
    wood: ['#bfe8f0', '#5aa8c0', '#2e7088'],
    deco: null,
    fx: 'bubbles',
    pack: 'sea',
    pal: { mode: 'under', sky: ['#2ab0d8', '#0a3060'], ground: ['#e8d4a0', '#8a7a50'] },
    icons: { shop: 'coin', settings: 'gear' },
  },
  fisher: {
    name: 'Bayou',
    kinds: { secondary: face('#c8e0a0', '#5a8a3a', '#3a5e22', '#1e3610'), orange: face('#e8e0a8', '#9a9058', '#66602e', '#3a3618') },
    ribbon: '#5a8a3a',
    wood: ['#c8c090', '#7d7a4a', '#4e4c28'],
    deco: null,
    fx: 'fireflies',
    pack: 'forest',
    pal: { sky: ['#9ac8b8', '#e0f0d8'], far: '#6a9a7a', mid: '#4a7a52', tree: '#3a6a42', tree2: '#5a8a4a', ground: ['#5a7a4a', '#34502a'], mist: true },
    icons: { shop: 'coin', settings: 'gear' },
  },
  scientist: {
    name: 'Lab',
    kinds: { secondary: face('#b8e4ff', '#4aa0e0', '#2a6ea8', '#123e66'), orange: face('#d0f0d0', '#4ac07a', '#2a8050', '#10462a') },
    ribbon: '#4aa0e0',
    wood: ['#e8eef4', '#a8b8c8', '#6a7a8c'],
    deco: 'sparkle',
    fx: 'sparks',
    pack: 'deep',
    pal: { mode: 'lab', sky: ['#2a4a6a', '#4a7a9a'], glow: ['rgb(90,230,160)', 'rgb(255,120,200)', 'rgb(120,200,255)'], ground: ['#8a9aaa', '#5a6a7a'], wash: 'rgba(10,40,70,0.45)', tint: 'rgba(80,180,255,0.08)' },
    icons: { shop: 'coin', settings: 'gear' },
  },
};

// the resolved row: pack object + merged palette, built once per skin
const RES = {};
export const skinUI = (id) => {
  const r = SKIN_UI[id];
  if (!r) return null;
  if (!RES[id]) { const P = PACKS[r.pack]; RES[id] = P ? { ...r, id, pack: P, pal: { ...P.pal, ...(r.pal || {}) } } : { ...r, id }; }
  return RES[id];
};
