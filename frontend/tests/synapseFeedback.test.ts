import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlayback, heardDelta } from '../src/lib/synapseFeedback.ts';

test('feedback distinguishes strong, weak, neutral skips and completion', () => {
  assert.deepEqual(classifyPlayback(5, 200), { event_type: 'skip', percent: 0.025, skip_kind: 'strong' });
  assert.equal(classifyPlayback(20, 200).skip_kind, 'weak');
  assert.equal(classifyPlayback(60, 200).skip_kind, 'neutral');
  assert.equal(classifyPlayback(170, 200).event_type, 'complete');
  assert.equal(classifyPlayback(10, 20).skip_kind, 'neutral');
});

test('seeks, pauses and backwards progress do not train completion', () => {
  assert.equal(heardDelta(180, 1, true, false), 0);
  assert.equal(heardDelta(-30, 1, true, false), 0);
  assert.equal(heardDelta(1, 1, false, false), 0);
  assert.equal(heardDelta(1, 1, true, true), 0);
  assert.equal(heardDelta(1, 1, true, false), 1);
  assert.equal(classifyPlayback(5, 200).event_type, 'skip');
});
