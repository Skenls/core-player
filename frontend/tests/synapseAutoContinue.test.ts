import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('../src/hooks/useSynapseAutoContinue.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  plugins: [{ name: 'continue-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(react|@\/api\/synapse|@\/store\/.*)$/ }, args =>
      ({ path: args.path, namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, args => {
      const prefix = 'const ctx = new Proxy({}, {get:(_,key)=>globalThis.__continueTest[key],set:(_,key,value)=>{globalThis.__continueTest[key]=value;return true;}});';
      if (args.path === 'react') return { contents: `${prefix} export const useEffect=fn=>{ctx.cleanup=fn()||(()=>{});};` };
      if (args.path === '@/api/synapse') return { contents: `${prefix} export const synapseApi={status:async()=>{ctx.statusCalls++;return ctx.status;},getMix:async(...args)=>{ctx.mixCalls.push(args);return ctx.mix;}};` };
      const name = args.path.endsWith('/playerStore') ? 'usePlayerStore' : args.path.endsWith('/sessionStore') ? 'useSessionStore'
        : args.path.endsWith('/uiStore') ? 'useUIStore' : 'useSynapseStore';
      return { contents: `${prefix} export const ${name}=Object.assign(fn=>fn(ctx.${name}),{getState:()=>ctx.${name}});` };
    });
  }}]
});
const { useSynapseAutoContinue } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const tracks = Array.from({ length: 15 }, (_, index) => ({ id: `new-${index}`, synapse: { session_id: 'continued' } }));
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
};
function setup() {
  const appended: any[] = [];
  const notices: string[] = [];
  const ctx = { statusCalls: 0, mixCalls: [] as any[], appended, notices, cleanup: () => {},
    status: Promise.resolve({ status: 'ready' }), mix: Promise.resolve({ tracks }),
    usePlayerStore: { queueEnded: true, queueVersion: 4, repeat: 'off', queue: [{ id: 'album-track' }],
      currentTrack: { id: 'album-track' }, appendToQueue: (items: any[]) => appended.push(items) },
    useSessionStore: { user: { id: 'alice' } }, useUIStore: { continuePlayback: true },
    useSynapseStore: { profileVersion: 0, profileResetting: false,
      filters: { familiarity: ['unfamiliar'], mood: 'sad' }, setNotice: (notice: string) => notices.push(notice) } };
  Object.assign(globalThis, { __continueTest: ctx });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  return ctx;
}

test('ordinary queue end requests 15 tracks with latest filters and queue exclusions', async () => {
  const ctx = setup();
  useSynapseAutoContinue();
  await tick();
  assert.deepEqual(ctx.mixCalls, [[ctx.useSynapseStore.filters, 15, ['album-track']]]);
  assert.deepEqual(ctx.appended, [tracks]);
  assert.deepEqual(ctx.notices, ['Synapse добавил 15 треков']);
  ctx.cleanup();
});

test('offline, disabled playback and repeat modes do not request continuation', async () => {
  for (const mode of ['offline', 'disabled', 'one', 'all']) {
    const ctx = setup();
    if (mode === 'offline') navigator.onLine = false;
    else if (mode === 'disabled') ctx.useUIStore.continuePlayback = false;
    else ctx.usePlayerStore.repeat = mode;
    useSynapseAutoContinue();
    await tick();
    assert.equal(ctx.statusCalls, 0, mode);
    assert.equal(ctx.mixCalls.length, 0, mode);
    assert.equal(ctx.appended.length, 0, mode);
    ctx.cleanup();
  }
});

test('a new queue or account while the mix is pending cannot append stale tracks', async () => {
  for (const change of ['queue', 'account', 'cancel']) {
    const ctx = setup();
    const pending = deferred();
    ctx.mix = pending.promise;
    useSynapseAutoContinue();
    await tick();
    assert.equal(ctx.mixCalls.length, 1);
    if (change === 'queue') { ctx.usePlayerStore.queueVersion++; ctx.usePlayerStore.queueEnded = false; }
    else if (change === 'account') ctx.useSessionStore.user = { id: 'bob' };
    else ctx.cleanup();
    pending.resolve({ tracks });
    await tick();
    assert.equal(ctx.appended.length, 0, change);
    assert.equal(ctx.notices.length, 0, change);
    ctx.cleanup();
  }
});

test('a queue changed during status lookup does not even request a mix', async () => {
  const ctx = setup();
  const pending = deferred();
  ctx.status = pending.promise;
  useSynapseAutoContinue();
  ctx.usePlayerStore.queueVersion++;
  pending.resolve({ status: 'ready' });
  await tick();
  assert.equal(ctx.mixCalls.length, 0);
  assert.equal(ctx.appended.length, 0);
  ctx.cleanup();
});
