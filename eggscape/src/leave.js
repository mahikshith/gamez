// 0.8.19 (mykee: "We forgot the quit option. Don't put quit on the pause menu, but we need a way to show it ... dynamic
// things like 'momma chick needs your help'"): the one line the hen says when the player is about to leave. There is no
// Quit button: Home on the pause page and the phone's Back ask once with a small scene (main.js drawLeaveAsk), STAY and
// LEAVE under it; one tap on LEAVE leaves. The lines are honest: each says only what is true in the run or the save.
// Pure, so tools/test-leave.mjs can check it. At most five words a line.
//
// leaving a level. run: { villain (the kind of a villain in this level, or null), short (eggs still needed for the
//   target), streak (the star streak a leave would end), bossLeft (the share of the boss's bar still standing, 0..1;
//   null when there is no boss) }. First match wins. -> { id, line, n, villain }
export function leaveLine(run = {}) {
  const short = Math.max(0, run.short | 0), streak = Math.max(0, run.streak | 0);
  if (run.villain) return { id: 'villain', line: 'Mama hen needs your help!', villain: run.villain };
  if (short === 1) return { id: 'short', line: 'Just 1 egg to go!', n: 1 };
  if (streak >= 2) return { id: 'streak', line: `Streak of ${streak} goes out`, n: streak };
  if (run.bossLeft != null && run.bossLeft > 0 && run.bossLeft <= 1 / 3) return { id: 'boss', line: 'He is almost beaten!' };
  return { id: 'eggs', line: "Eggs are not home yet" };
}
// leaving the app from the home page. st: { gift (a gift or a free spin waits) } -> { id, line }
// (no day-streak line: the save keeps no day streak, and a line must be true)
export function exitLine(st = {}) {
  if (st.gift) return { id: 'gift', line: 'A gift is waiting!' };
  return { id: 'bye', line: 'See you soon!' };
}
export const LEAVE_LINES = ['villain', 'short', 'streak', 'boss', 'eggs'], EXIT_LINES = ['gift', 'bye'];
