// lint819: the one allow list of the layout rules (src/ui/layout-rules.js). Each entry exempts the findings it matches:
// rule (exact), tag / state / page / msg (regexes, all optional), and why: a written reason, required. An exemption is a
// design decision, not a way to get green: never add one for a page that is simply wrong (fix the page instead).
module.exports = [
  // BALANCE: the play screen is exempt by the rule itself (lint o.play). These are the other full-scene pages where the
  // scene IS the content (no recorded rect for the art), so an empty band there is a picture, not a hole.
  { rule: 'BALANCE', page: /^(levels|spin)\b/, why: 'the map and the Lucky Spin are one painted scene; their art is not recorded, so the bands between rects are the scene' },
  { rule: 'BALANCE', page: /^wonder\b/, state: /^side-w\d+-(play|pause)$|^wonder-[a-z]+(-zoom)?$/, why: 'a bonus vault in play is a play screen (the vault board is not recorded)' },
  // the map's level stops stand on a winding road: two stops that happen to share a line or a column are not a row
  { rule: 'EVENGAP', page: /^levels\b/, tag: /^lv\[/, why: 'map stops follow the road, not a grid' },
  { rule: 'ALIGN', page: /^levels\b/, tag: /^lv\[/, why: 'map stops follow the road, not a grid' },
];
