import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteTime, shouldUseOffsetSeek, withTimeOffset } from '../src/lib/streamSeek.ts';

test('transcoded AAC and Opus use server offsets', () => {
  assert.equal(shouldUseOffsetSeek('aac', 'flac'), true);
  assert.equal(shouldUseOffsetSeek('opus', 'flac'), true);
  assert.equal(shouldUseOffsetSeek('mp3', 'flac'), true);
});

test('direct-play and raw streams keep native seeking', () => {
  assert.equal(shouldUseOffsetSeek('flac', 'flac'), false);
  assert.equal(shouldUseOffsetSeek('aac', 'm4a'), false);
  assert.equal(shouldUseOffsetSeek('opus', 'ogg'), false);
  assert.equal(shouldUseOffsetSeek(null, 'flac'), false);
});

test('timeline remains absolute after an offset seek', () => {
  assert.equal(absoluteTime(85, 3.5), 88.5);
  assert.equal(absoluteTime(85, Number.NaN), 85);
});

test('offset URL uses whole seconds and replaces an old offset', () => {
  const base = '/api/stream/t1?format=aac';
  assert.equal(withTimeOffset(base, 85.9), '/api/stream/t1?format=aac&timeOffset=85');
  assert.equal(withTimeOffset(base + '&timeOffset=12', 0), base);
});
