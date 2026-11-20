// Entry point loaded by index.html. The workshop is split into steps; `step`
// selects which one is shown on the page. Steps 1–3 are small self-contained
// demos; step 4 (the default branch) is the complete game from canvas.js.
import {mountGame} from './canvas.js';
import './style.css'; // Vite injects the stylesheet into the page

const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
const step = Number(4); // change to 1, 2 or 3 to display an earlier step
const title = document.querySelector('#step-title');
const instructions = document.querySelector('#instructions');
const status = document.querySelector('#status');
const controls = document.querySelector('.controls');
// Each step replaces this with a function that stops its loop and listeners.
let cleanup = () => {};

// Helper for steps 1–3: clear the canvas and draw the player at horizontal position x.
function rectangle(x) {
  context.fillStyle = '#102b29'; context.fillRect(0, 0, 640, 400);
  context.fillStyle = '#a8e4c4'; context.fillRect(x, 350, 40, 20);
}

if (step === 1) {
  // Step 1: a single static drawing, no animation.
  title.textContent = '01 · Dessiner un joueur';
  instructions.textContent = 'Origine en haut à gauche. x va vers la droite, y vers le bas.';
  rectangle(300);
  controls.hidden = true;
} else if (step === 2) {
  // Step 2: time-based animation. Position advances by speed × dt (seconds),
  // so speed is the same at 30 or 144 fps.
  title.textContent = '02 · Déplacer avec le temps';
  instructions.textContent = 'Le joueur avance à 120 pixels par seconde et repart du bord.';
  controls.hidden = true;
  let x = 0, previous = null, frameId;
  function frame(now) {
    // dt in seconds, capped at 0.05 s to avoid jumps after a pause.
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    x = (x + 120 * dt) % 600; // modulo: wrap back to the left edge at 600 (= 640 - 40)
    rectangle(x);
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  cleanup = () => cancelAnimationFrame(frameId);
} else if (step === 3) {
  // Step 3: keyboard. We store which keys are currently held in a Set,
  // and read that Set in the loop (rather than moving inside the event handler).
  title.textContent = '03 · Lire le clavier';
  instructions.textContent = 'Cliquer dans le Canvas, puis maintenir une flèche. Le joueur reste dans les limites.';
  controls.hidden = true;
  let x = 300, previous = null, frameId;
  const keys = new Set();
  // preventDefault stops the arrows from scrolling the page.
  const down = event => { if (event.key.startsWith('Arrow')) { event.preventDefault(); keys.add(event.key); } };
  const up = event => keys.delete(event.key);
  const clear = () => keys.clear(); // on blur, keyup would be missed: forget all keys
  canvas.addEventListener('keydown', down);
  canvas.addEventListener('keyup', up);
  canvas.addEventListener('blur', clear);
  function frame(now) {
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    // direction (-1, 0, +1) × 280 px/s × dt, clamped to [0, 600].
    x = Math.max(0, Math.min(600, x + (Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * 280 * dt));
    rectangle(x);
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
  cleanup = () => {
    cancelAnimationFrame(frameId);
    canvas.removeEventListener('keydown', down);
    canvas.removeEventListener('keyup', up);
    canvas.removeEventListener('blur', clear);
  };
} else {
  // Step 4: the full game. mountGame handles the loop and keyboard;
  // here we only connect the HTML buttons and the status line.
  title.textContent = '04 · Une partie complète';
  instructions.textContent = 'Flèches pour bouger, espace pour tirer. 10 points par cible ; les secondes restantes donnent un bonus à la victoire.';
  const game = mountGame(canvas, state => {
    // Called on each status change; #status has role="status", so screen readers announce it.
    status.textContent = state.status === 'playing' ? 'Partie en cours.' : `${state.status === 'won' ? 'Victoire' : 'Fin de partie'} : ${state.score} points.`;
  });
  // On-screen buttons (mouse/touch): pressed while the pointer is down.
  for (const key of ['left', 'right', 'fire']) {
    const button = document.querySelector(`#${key}`);
    // setPointerCapture: we still receive pointerup even if the finger/mouse
    // slides off the button, so the input cannot stay stuck "on".
    button.addEventListener('pointerdown', event => { button.setPointerCapture(event.pointerId); game.setInput(key, true); });
    button.addEventListener('pointerup', () => game.setInput(key, false));
    button.addEventListener('pointercancel', () => game.setInput(key, false));
  }
  document.querySelector('#pause').onclick = () => { game.pause(); status.textContent = 'En pause.'; };
  document.querySelector('#resume').onclick = () => { game.resume(); status.textContent = 'Partie reprise.'; };
  document.querySelector('#restart').onclick = () => game.restart();
  cleanup = () => game.destroy();
}

// Stop the current step when leaving the page…
window.addEventListener('pagehide', cleanup, {once: true});
// …and when Vite hot-reloads this module during development, otherwise
// the old loop would keep running alongside the new one.
if (import.meta.hot) import.meta.hot.dispose(cleanup);
