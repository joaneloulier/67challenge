// Browser side of the game: drawing on the Canvas, reading the keyboard and
// running the requestAnimationFrame loop. The rules live in game.js.
import {HEIGHT, WIDTH, newGame, press, tick} from './game.js';

export const CHARACTERS = {
  gazmou: {label: 'Gazmou', color: '#f26b1d'}, // orange
  tracto: {label: 'Tracto', color: '#e23c7a'}, // pink
};

// Canvas palette (same accents as style.css, on a flat dark background).
const COLORS = {
  background: '#1f1d2b', panel: '#2a2838', line: '#3a3748',
  text: '#f7f5f2', muted: '#a9a6b6', orange: '#f26b1d', pink: '#e23c7a',
  // End-of-game card, matching the page palette in style.css.
  cardPink: '#feb9e5', magenta: '#f21de7', purple: '#896fff', ink: '#1f1d2b',
};

// Picture files, served by Vite from frontend/public/characters/.
export function picturePath(character, pose) {
  return `/characters/${character}-${pose}.png`;
}

// Starts loading the two pictures of a character. A picture that is missing or
// still loading is replaced by a drawn placeholder (see drawCharacter).
export function loadPictures(character) {
  const pictures = {};
  for (const pose of ['6', '7']) {
    const image = new Image();
    image.src = picturePath(character, pose);
    pictures[pose] = image;
  }
  return pictures;
}

// Keys that count as 6 and 7. `code` names the physical key, so the top-row
// keys work on an AZERTY keyboard too (where `key` would be "-" or "è").
const CODES = {Digit6: '6', Numpad6: '6', Digit7: '7', Numpad7: '7'};
export function keyToDigit(event) {
  if (event.key === '6' || event.key === '7') return event.key;
  return CODES[event.code] ?? null;
}

// ---------- Drawing ----------

// Web font loaded in index.html (Google Fonts); the others are fallbacks
// used while it downloads or if there is no Internet connection.
const FONT = "'Courier Prime', 'Courier New', monospace";
const font = (size, bold = false) => `${bold ? 'bold ' : ''}${size}px ${FONT}`;

// Where the character goes: centred, between the HUD and the hint line.
const BOX = {w: 300, h: 500, x: (WIDTH - 300) / 2, y: 70};

function drawCharacter(context, state, view) {
  const picture = view.pictures?.[state.pose];
  const ready = picture && picture.complete && picture.naturalWidth > 0;
  if (ready) {
    // Fit the picture inside BOX while keeping its proportions.
    const scale = Math.min(BOX.w / picture.naturalWidth, BOX.h / picture.naturalHeight);
    const w = picture.naturalWidth * scale;
    const h = picture.naturalHeight * scale;
    context.drawImage(picture, BOX.x + (BOX.w - w) / 2, BOX.y + (BOX.h - h) / 2, w, h);
    return;
  }
  // Placeholder: a rounded card in the character's colour, with the digit and name.
  const {label, color} = CHARACTERS[view.character] ?? {label: '?', color: COLORS.orange};
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(BOX.x, BOX.y, BOX.w, BOX.h, 16);
  context.fill();
  context.fillStyle = COLORS.text;
  context.textAlign = 'center';
  context.font = font(240, true);
  context.fillText(state.pose, WIDTH / 2, BOX.y + BOX.h / 2 + 80);
  context.font = font(32, true);
  context.fillText(label, WIDTH / 2, BOX.y + BOX.h - 40);
  context.textAlign = 'left';
}

// Flat background with subtle polka dots, alternating orange and pink.
// Every other row is shifted by half a step, like a classic polka pattern.
function drawBackground(context) {
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const step = 60;
  for (let row = 0; row * step < HEIGHT + step; row++) {
    const y = row * step + step / 2;
    const offset = row % 2 ? step / 2 : 0;
    for (let col = 0; col * step < WIDTH + step; col++) {
      const x = col * step + offset;
      context.fillStyle = (row + col) % 2 ? '#f26b1d26' : '#e23c7a26'; // ~15% opacity
      context.beginPath();
      context.arc(x, y, 6, 0, Math.PI * 2);
      context.fill();
    }
  }
}

// Paints one frame from a state. Drawing never changes the state.
export function draw(context, state, view = {}) {
  drawBackground(context);

  drawCharacter(context, state, view);

  // HUD: small labels above the time (left) and the score (right).
  context.textAlign = 'left';
  context.font = font(14, true);
  context.fillStyle = COLORS.muted;
  context.fillText('TEMPS', 28, 30);
  context.font = font(34, true);
  // The time turns pink in the last 5 seconds.
  context.fillStyle = state.status === 'playing' && state.remaining <= 5 ? COLORS.pink : COLORS.text;
  context.fillText(`${Math.ceil(state.remaining)} s`, 28, 64);

  context.textAlign = 'right';
  context.font = font(14, true);
  context.fillStyle = COLORS.muted;
  context.fillText('SCORE', WIDTH - 28, 30);
  context.font = font(34, true);
  context.fillStyle = COLORS.pink;
  context.fillText(`${state.score} × 67`, WIDTH - 28, 64);

  context.textAlign = 'center';
  context.font = font(24);
  context.fillStyle = COLORS.muted;
  const hintY = HEIGHT - 28; // below the character box
  if (state.status === 'waiting') {
    context.fillText('Appuie sur 6 pour commencer', WIDTH / 2, hintY);
  } else if (state.status === 'playing') {
    context.fillText(`Prochaine touche : ${state.expected}`, WIDTH / 2, hintY);
  } else {
    // End-of-game card: light pink with a magenta border (same colours as the page panels).
    const card = {w: 600, h: 300, x: (WIDTH - 600) / 2, y: HEIGHT / 2 - 150};
    context.beginPath();
    context.roundRect(card.x, card.y, card.w, card.h, 20);
    context.fillStyle = COLORS.cardPink;
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = COLORS.magenta;
    context.stroke();

    context.fillStyle = COLORS.ink;
    context.font = font(40, true);
    const title = state.endReason === 'time' ? 'TEMPS ÉCOULÉ' : `RATÉ : DEUX ${state.wrongKey} DE SUITE`;
    context.fillText(title, WIDTH / 2, card.y + 68);

    context.fillStyle = COLORS.magenta;
    context.font = font(110, true);
    context.fillText(String(state.score), WIDTH / 2, card.y + 175);

    context.fillStyle = COLORS.purple;
    context.font = font(28, true);
    context.fillText(state.score === 1 ? '× 67 réussi' : '× 67 réussis', WIDTH / 2, card.y + 218);

    context.fillStyle = COLORS.ink;
    context.font = font(20);
    context.fillText('Clique sur Rejouer pour recommencer', WIDTH / 2, card.y + 268);
  }
  context.textAlign = 'left'; // context settings persist between frames
}

// ---------- Loop and keyboard ----------

// Starts a game on `canvas` and returns a controller.
// - onState(state) is called each time the status changes (waiting → playing → over).
// - view = {character, pictures} is what draw() needs to show the character.
// - render(state), if given, replaces draw(); the tests use it to run in Node.
export function mountGame(canvas, {onState = () => {}, view = {}, render = null} = {}) {
  const context = render ? null : canvas.getContext('2d');
  const paint = render || (state => draw(context, state, view));
  let state = newGame();
  let previous = null;   // timestamp of the previous frame
  let frameId;
  let lastStatus = '';

  // Keys are read on the whole window, so the player does not need to click
  // the Canvas first. Typing in a form field is ignored.
  function keydown(event) {
    const digit = keyToDigit(event);
    if (!digit) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    event.preventDefault();
    // A held key auto-repeats; without this check, holding 6 would send 6,6 and lose.
    if (event.repeat) return;
    state = press(state, digit);
  }

  function frame(now) {
    const dt = previous === null ? 0 : (now - previous) / 1000;
    previous = now;
    state = tick(state, dt);
    paint(state);
    if (state.status !== lastStatus) {
      lastStatus = state.status;
      onState({...state}); // a copy, so the caller cannot alter our state
    }
    frameId = requestAnimationFrame(frame);
  }

  // Ask the browser to download the web font now: some browsers only fetch a
  // font once the page itself uses it, and the Canvas alone may not count.
  if (!render && document.fonts) document.fonts.load(font(32)).catch(() => {});

  window.addEventListener('keydown', keydown);
  frameId = requestAnimationFrame(frame);

  return {
    restart() { state = newGame(); lastStatus = ''; previous = null; },
    destroy() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', keydown);
    },
  };
}
