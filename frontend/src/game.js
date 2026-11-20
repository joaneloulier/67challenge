// Rules of the 67 Challenge.
//
// The player must alternate 6, 7, 6, 7… Each completed 6→7 pair is one "67"
// and gives 1 point. A repeated key (6,6 or 7,7) ends the game, and so does
// the end of the 30 seconds. The clock starts on the first 6.

export const WIDTH = 960;   // drawing resolution, used by <canvas width> in main.jsx
export const HEIGHT = 640;  // and <canvas height>; CSS only scales the display
export const DURATION = 30; // seconds

// status: 'waiting' (before the first 6) | 'playing' | 'over'
// pose:   which picture of the character is shown ('6' or '7')
// expected: the next correct key
// endReason: null | 'time' | 'wrong'
export function newGame() {
  return {
    status: 'waiting',
    score: 0,
    remaining: DURATION,
    pose: '7',     // the character starts on the "seven" picture
    expected: '6',
    endReason: null,
    wrongKey: null,
  };
}

// A key was pressed ('6' or '7'). Returns a NEW state; `previous` is untouched.
export function press(previous, key) {
  if (key !== '6' && key !== '7') return previous;
  if (previous.status === 'over') return previous;

  if (previous.status === 'waiting') {
    // A 7 before the first 6 is ignored; the first 6 starts the clock.
    if (key !== '6') return previous;
    return {...previous, status: 'playing', pose: '6', expected: '7'};
  }

  if (key !== previous.expected) {
    // Two 6s or two 7s in a row: the game is lost (the score is kept).
    return {...previous, status: 'over', endReason: 'wrong', wrongKey: key};
  }

  return {
    ...previous,
    pose: key,
    expected: key === '6' ? '7' : '6',
    score: key === '7' ? previous.score + 1 : previous.score, // a 7 completes a 67
  };
}

// Time passes. `seconds` is the time since the last frame.
export function tick(previous, seconds) {
  if (previous.status !== 'playing') return previous; // the clock only runs while playing
  // Clamp dt to [0, 0.05] s, like canvas-04-game: no jump after a frozen tab.
  const dt = Math.max(0, Math.min(seconds, 0.05));
  const remaining = Math.max(0, previous.remaining - dt);
  if (remaining === 0) return {...previous, remaining, status: 'over', endReason: 'time'};
  return {...previous, remaining};
}
