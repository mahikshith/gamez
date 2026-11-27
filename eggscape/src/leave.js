// 0.8.19: the one line the hen says when the player is about to leave. There is no Quit button: Home on the pause page
// and the phone's Back ask once (main.js drawLeaveAsk): the hen, this line, STAY and LEAVE; one tap on LEAVE leaves.
// (mykee, 2026-11-27 16:21: "Exit the app or no. Mama needs your help or no. That's it": the first build chose among
// five lines and showed the villain, the boss, the eggs, a flame, a nest. All of that is gone.) Pure, for tools/test-leave.mjs.
export function leaveLine() { return { id: 'help', line: 'Mama hen needs your help!' }; } // leaving a level
export function exitLine() { return { id: 'exit', line: 'Leave the game?' }; } // leaving the app from the home page
export const LEAVE_LINES = ['help'], EXIT_LINES = ['exit'];
