// Tests for the rules (game.js). Run with `npm test`.
import assert from 'node:assert/strict';
import test from 'node:test';
import {DURATION, newGame, press, tick} from './game.js';

const play = (keys, state = newGame()) => [...keys].reduce(press, state);

test('a new game waits on the seven picture with a full clock', () => {
  const state = newGame();
  assert.equal(state.status, 'waiting');
  assert.equal(state.pose, '7');
  assert.equal(state.score, 0);
  assert.equal(state.remaining, DURATION);
});

test('the clock does not run before the first 6', () => {
  const state = tick(newGame(), 0.05);
  assert.equal(state.remaining, DURATION);
  assert.equal(state.status, 'waiting');
});

test('a 7 before the first 6 is ignored', () => {
  const before = newGame();
  assert.equal(press(before, '7'), before);
});

test('the first 6 starts the game and shows the six picture', () => {
  const state = press(newGame(), '6');
  assert.equal(state.status, 'playing');
  assert.equal(state.pose, '6');
  assert.equal(state.score, 0);
});

test('each completed 6-7 pair gives one point', () => {
  assert.equal(play('67').score, 1);
  assert.equal(play('6767').score, 2);
  assert.equal(play('676767').score, 3);
  assert.equal(play('67676').score, 2); // a 6 alone is not a 67 yet
});

test('the picture follows the last correct key', () => {
  assert.equal(play('67').pose, '7');
  assert.equal(play('676').pose, '6');
});

test('two 6s in a row lose and keep the score', () => {
  const state = play('6766');
  assert.equal(state.status, 'over');
  assert.equal(state.endReason, 'wrong');
  assert.equal(state.score, 1);
});

test('two 7s in a row lose', () => {
  const state = play('677');
  assert.equal(state.status, 'over');
  assert.equal(state.endReason, 'wrong');
  assert.equal(state.wrongKey, '7');
});

test('a finished game ignores keys and time', () => {
  const over = play('66');
  assert.equal(press(over, '7'), over);
  assert.equal(tick(over, 0.05), over);
});

test('other keys change nothing', () => {
  const state = play('6');
  assert.equal(press(state, '5'), state);
});

test('time runs out after 30 seconds', () => {
  let state = play('67');
  for (let i = 0; i < DURATION / 0.05 + 1; i++) state = tick(state, 0.05);
  assert.equal(state.status, 'over');
  assert.equal(state.endReason, 'time');
  assert.equal(state.remaining, 0);
  assert.equal(state.score, 1);
});

test('a long frozen frame is clamped to 0.05 s', () => {
  const state = tick(play('6'), 10);
  assert.ok(Math.abs(state.remaining - (DURATION - 0.05)) < 1e-9);
});

test('press never mutates its argument', () => {
  const before = play('6');
  const copy = {...before};
  press(before, '7');
  assert.deepEqual(before, copy);
});
