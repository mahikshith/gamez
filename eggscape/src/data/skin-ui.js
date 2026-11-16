// Skin-themed UI (mykee 2026-11-16): the hen outfit the player wears re-themes the menus too: button colours, the card
// frame, ribbons, a decoration on the buttons and a couple of icons. Keyed by hen skin id (economy.js HEN_SKINS);
// 'classic' (and any id without a row) is the normal farm look. The map imports this too, for its header and ribbons.
// Rows are append-only: new outfits add their own row.
//
// kinds:  overrides of ui.js button palettes by kind ({a, b, lip, line, ink}); primary stays a "go" green
// ribbon: the default ribbon colour; stripes: candy-cane stripes on ribbons
// wood:   the card frame's three wood stops [light, mid, dark]
// deco:   'snow' (a snow cap on button tops), 'sparkle' (twinkles on button corners) or null
// icons:  { shop: 'gift' | 'coin', settings: 'snowflake' | 'gear' }

const face = (a, b, lip, line, ink = '#fff') => ({ a, b, lip, line, ink });

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
    icons: { shop: 'coin', settings: 'gear' },
  },
};

export const skinUI = (id) => SKIN_UI[id] || null;
