// The leave page's one line (src/leave.js): node tools/test-leave.mjs
// 2026-11-27: the page is the hen, one line and two buttons, so there is one line for a level and one for the app.
import { leaveLine, exitLine, LEAVE_LINES, EXIT_LINES } from '../src/leave.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const words = (s) => s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
ok(leaveLine({ villain: 'snake', short: 1, streak: 5, bossLeft: 0.1 }).id === 'help' && leaveLine().id === 'help', 'leaving a level: always the same line, whatever the run holds');
ok(/help/i.test(leaveLine().line), 'it says the hen needs help');
ok(leaveLine({ villain: 'snake' }).villain === undefined, 'no villain is handed to the page (nothing peeks in)');
ok(exitLine({ gift: true }).id === 'exit' && exitLine().id === 'exit', 'leaving the app: always the same question');
ok(LEAVE_LINES.length === 1 && EXIT_LINES.length === 1, 'one line each');
ok([leaveLine(), exitLine()].every((l) => words(l.line) <= 5), 'each line is at most five words');
console.log(bad ? bad + ' FAILED' : 'all leave checks pass');
process.exit(bad ? 1 : 0);
