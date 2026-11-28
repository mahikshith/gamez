// lint819: the layout breaks still open on tools/test-layout.mjs's key states. NOT exemptions: a worklist.
// Every ONSCREEN, TAPSIZE, CROWD, EVENGAP, ALIGN and BALANCE break here was fixed (2026-11-27); what is left is
// FONTS (more than 3 type sizes on a page) and WORDS (more words than a glance reads). Fixing those means merging
// text roles or cutting words, which changes what a page says: the owner's call, not a layout fix.
// test-layout fails on any break not here and not in tools/layout-allow.cjs, and names entries here that no longer
// happen (fixed: delete them). Written by `node tools/test-layout.mjs --baseline`; never add a line by hand to get green.
module.exports = [
  "450x1000 L6-intro FONTS page", // 6 font sizes: 13, 15, 20, 22, 27, 31
  "450x1000 fail FONTS page", // 5 font sizes: 15/16, 18/19, 21, 26, 29
  "450x1000 fail WORDS page", // 25 words: Too many eggs broke Too many eggs lost more wins to a free spin ...
  "450x1000 levels FONTS page", // 5 font sizes: 13, 15/16, 18, 21, 24
  "450x1000 store FONTS page", // 5 font sizes: 13/14, 15/16, 18, 22, 26
  "450x1000 store WORDS page", // 72 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "450x1000 title FONTS page", // 5 font sizes: 13, 15, 18/19, 21, 29
  "450x1000 title WORDS page", // 13 words: Get every egg home to the hen FREE PLAY Level Levels Daily Extras
  "450x1000 win FONTS page", // 8 font sizes: 14/15, 17/18, 19, 23, 25/26, 31, 41, 68
  "853x384 L12-play FONTS page", // 4 font sizes: 11, 13/14, 16, 18
  "853x384 fail FONTS page", // 5 font sizes: 12/13, 15/16, 17, 21, 24
  "853x384 fail WORDS page", // 22 words: Too many eggs broke more wins to a free spin A farm friend can ...
  "853x384 levels FONTS page", // 4 font sizes: 11, 13, 15, 18
  "853x384 store FONTS page", // 5 font sizes: 10/11, 12/13, 16, 18, 22
  "853x384 store WORDS page", // 42 words: Shop Free Power-ups Hens Eggs Classic Equipped Speckled First crack is free Striped Takes ...
  "853x384 title FONTS page", // 6 font sizes: 11, 13, 15, 18/19, 22, 30
  "853x384 title WORDS page", // 13 words: Get every egg home to the hen FREE PLAY Level Levels Daily Extras
  "853x384 win FONTS page", // 8 font sizes: 12/13, 15/16, 17, 19, 22, 26, 35, 42
];
