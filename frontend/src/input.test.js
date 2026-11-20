// Tests for the keyboard handling in mountGame (canvas.js), run in Node.
// Same fake environment as canvas-04-game: window is an EventTarget and the
// test drives the frames by hand with tick(now).
import assert from 'node:assert/strict';
import test from 'node:test';
import {keyToDigit, mountGame} from './canvas.js';

function environment(t) {
  const saved = Object.fromEntries(['window', 'requestAnimationFrame', 'cancelAnimationFrame'].map(k => [k, globalThis[k]]));
  let frame;
  let state;
  const statuses = [];
  globalThis.window = new EventTarget();
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const game = mountGame({}, {onState: s => statuses.push(s.status), render: next => { state = next; }});
  t.after(() => {
    game.destroy();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const key = (props, target) => {
    const event = Object.assign(new Event('keydown', {cancelable: true}), {repeat: false, ...props});
    if (target) Object.defineProperty(event, 'target', {value: target});
    window.dispatchEvent(event);
    return event;
  };
  return {game, key, tick: now => frame(now), state: () => state, statuses};
}

test('top-row keys work on AZERTY and QWERTY, numpad too', () => {
  assert.equal(keyToDigit({key: '6', code: 'Digit6'}), '6');
  assert.equal(keyToDigit({key: '-', code: 'Digit6'}), '6'); // AZERTY without Shift
  assert.equal(keyToDigit({key: 'è', code: 'Digit7'}), '7');
  assert.equal(keyToDigit({key: '7', code: 'Numpad7'}), '7');
  assert.equal(keyToDigit({key: 'a', code: 'KeyA'}), null);
});

test('typing 6, 7 scores one 67 and reports the status changes', t => {
  const {key, tick, state, statuses} = environment(t);
  tick(0);
  key({key: '6', code: 'Digit6'});
  key({key: '7', code: 'Digit7'});
  tick(16);
  assert.equal(state().score, 1);
  assert.deepEqual(statuses, ['waiting', 'playing']);
});

test('a held key that auto-repeats does not lose the game', t => {
  const {key, tick, state} = environment(t);
  tick(0);
  key({key: '6', code: 'Digit6'});
  key({key: '6', code: 'Digit6', repeat: true});
  tick(16);
  assert.equal(state().status, 'playing');
});

test('digits typed in a text field are not game keys', t => {
  const {key, tick, state} = environment(t);
  tick(0);
  const event = key({key: '6', code: 'Digit6'}, {tagName: 'INPUT'});
  tick(16);
  assert.equal(state().status, 'waiting');
  assert.equal(event.defaultPrevented, false);
});

test('restart gives a fresh game', t => {
  const {game, key, tick, state, statuses} = environment(t);
  tick(0);
  key({key: '6', code: 'Digit6'});
  key({key: '6', code: 'Digit6'});
  tick(16);
  assert.equal(state().status, 'over');
  game.restart();
  tick(32);
  assert.equal(state().status, 'waiting');
  assert.equal(state().score, 0);
  assert.deepEqual(statuses, ['waiting', 'over', 'waiting']);
});
