import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('../src/hooks/useSynapseTelemetry.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  plugins: [{ name: 'telemetry-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(react|@\/api\/synapse|@\/lib\/audioService|@\/store\/.*)$/ }, args =>
      ({ path: args.path, namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, args => {
      const context = 'const ctx = new Proxy({}, {get:(_,key)=>globalThis.__telemetryTest[key],set:(_,key,value)=>{globalThis.__telemetryTest[key]=value;return true;}});';
      const store = (name: string) => `${context} export const ${name} = Object.assign(fn=>fn(ctx.${name}), {getState:()=>ctx.${name}, subscribe:fn=>{ctx.listener=fn;return()=>{};}});`;
      if (args.path === 'react') return { contents: `${context} export const useRef=value=>({current:value}); export const useEffect=fn=>{ctx.cleanup=fn();};` };
      if (args.path === '@/api/synapse') return { contents: `${context} export const synapseApi={events:async events=>{ctx.batches.push(structuredClone(events));}};` };
      if (args.path === '@/lib/audioService') return { contents: `${context} export const audioService={getAudio:()=>ctx.audio,getCurrentTime:()=>ctx.position};` };
      return { contents: store(args.path.split('/').at(-1) === 'playerStore' ? 'usePlayerStore'
        : args.path.split('/').at(-1) === 'sessionStore' ? 'useSessionStore' : 'useSynapseStore') };
    });
  }}]
});

function setup() {
  const audio = Object.assign(new EventTarget(), { paused: true, ended: false, seeking: false });
  const ctx = { audio, position: 0, now: 0, batches: [] as any[], cleanup: () => {}, listener: (_a: any, _b: any) => {},
    useSessionStore: { user: { id: 'alice' } }, useSynapseStore: { profileVersion: 0 },
    usePlayerStore: { currentTrack: null as any, playbackId: 0, queueEnded: false } };
  Object.assign(globalThis, { __telemetryTest: ctx });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => ctx.now } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true, sendBeacon: () => true } });
  const storage = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) },
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    window: Object.assign(new EventTarget(), { location: { href: 'http://localhost/', origin: 'http://localhost' },
      setInterval: () => 1, clearInterval: () => {} }) });
  return ctx;
}

const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`;
const { useSynapseTelemetry } = await import(moduleUrl);
const track = { id: 'one', duration: 200, synapse: { session_id: 'mix' } };

test('switching tabs keeps the listening attempt open and natural playback completes it', async () => {
  const ctx = setup();
  useSynapseTelemetry();
  ctx.usePlayerStore.currentTrack = track;
  ctx.audio.paused = false;
  ctx.audio.dispatchEvent(new Event('playing'));
  for (let second = 1; second <= 100; second++) {
    ctx.now = second * 1000; ctx.position = second;
    ctx.audio.dispatchEvent(new Event('timeupdate'));
  }
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(ctx.batches.flat().map(event => event.event_type), ['start']);
  for (let second = 101; second <= 200; second++) {
    ctx.now = second * 1000; ctx.position = second;
    ctx.audio.dispatchEvent(new Event('timeupdate'));
  }
  ctx.audio.ended = true;
  ctx.audio.dispatchEvent(new Event('ended'));
  await Promise.resolve();
  const end = ctx.batches.flat().find(event => event.event_type === 'complete');
  assert.equal(end.context.played_seconds, 200);
  assert.equal(end.percent, 1);
  ctx.cleanup();
});

test('ordinary playback and a queue left by a previous account produce no events', () => {
  const ctx = setup();
  ctx.usePlayerStore.currentTrack = track;
  useSynapseTelemetry();
  ctx.audio.paused = false;
  ctx.audio.dispatchEvent(new Event('playing'));
  ctx.audio.dispatchEvent(new Event('ended'));
  assert.equal(ctx.batches.length, 0);
  ctx.usePlayerStore.currentTrack = { id: 'ordinary', duration: 200 };
  ctx.audio.dispatchEvent(new Event('playing'));
  ctx.audio.dispatchEvent(new Event('ended'));
  assert.equal(ctx.batches.length, 0);
  ctx.cleanup();
});
