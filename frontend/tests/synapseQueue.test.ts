import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the real store with an in-memory audio boundary; no browser or stream requests.
const bundle = await build({
  entryPoints: [new URL('../src/store/playerStore.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  plugins: [{
    name: 'audio-test-boundary',
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/audioService$/ }, () => ({ path: 'audio', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents:
        'export const audioService = {setSrc(){},play:async()=>{},pause(){},seek(){},setVolume(){}};' }));
    }
  }]
});
const { usePlayerStore } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const track = (id: string) => ({ id, title: id, suffix: 'mp3', duration: 200 });

test('a real queue end stops; appended tracks start without changing the stream API', () => {
  const player = usePlayerStore.getState();
  player.setQueue([track('a')]);
  player.nextTrack();
  assert.equal(usePlayerStore.getState().queueEnded, true);
  assert.equal(usePlayerStore.getState().isPlaying, false);
  player.appendToQueue([track('a'), track('b'), track('b'), track('c')]);
  const continued = usePlayerStore.getState();
  assert.deepEqual(continued.queue.map((item: { id: string }) => item.id), ['a', 'b', 'c']);
  assert.equal(continued.currentTrack.id, 'b');
  assert.equal(continued.queueIndex, 1);
  assert.equal(continued.queueEnded, false);
  assert.equal(continued.isPlaying, true);
});

test('queue replacement and editing invalidate an in-flight continuation', () => {
  const player = usePlayerStore.getState();
  player.setQueue([track('a')]);
  player.nextTrack();
  const captured = usePlayerStore.getState().queueVersion;
  player.setQueue([track('a')]);
  assert.ok(usePlayerStore.getState().queueVersion > captured);
  assert.equal(usePlayerStore.getState().queueEnded, false);
  const replacement = usePlayerStore.getState().queueVersion;
  player.playNext(track('b'));
  assert.ok(usePlayerStore.getState().queueVersion > replacement);
});

test('repeat all and repeat one never report a queue end', () => {
  const player = usePlayerStore.getState();
  player.setQueue([track('a')]);
  player.toggleRepeat();
  player.nextTrack();
  assert.equal(usePlayerStore.getState().queueEnded, false);
  assert.equal(usePlayerStore.getState().currentTrack.id, 'a');
  player.toggleRepeat();
  player.nextTrack();
  assert.equal(usePlayerStore.getState().queueEnded, false);
  player.toggleRepeat();
});
