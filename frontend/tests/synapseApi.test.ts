import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('../src/api/synapse.ts', import.meta.url).pathname],
  bundle: true, write: false, platform: 'node', format: 'esm',
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  plugins: [{ name: 'axios-boundary', setup(builder) {
    builder.onResolve({ filter: /^\.\/client$/ }, () => ({ path: 'client', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
      const request = async (method, url, body) => {
        globalThis.__synapseRequests.push({method,url,body});
        return {data:{mix_id:'mix',tracks:[]}};
      };
      export const axiosClient = {get:(...args)=>request('GET',...args),post:(...args)=>request('POST',...args)};
    ` }));
  }}]
});
const { synapseApi } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('large queue exclusions use a JSON POST body without truncation or URL expansion', async () => {
  const requests: any[] = [];
  Object.assign(globalThis, { __synapseRequests: requests });
  const filters = { familiarity: ['familiar', 'unfamiliar'], mood: 'productive' };
  const excluded = Array.from({ length: 1500 }, (_, index) => `song-${index},full-id`);
  const response = await synapseApi.getMix(filters, 15, excluded);
  assert.equal(response.mix_id, 'mix');
  assert.deepEqual(requests, [{ method: 'POST', url: '/synapse/mix', body: {
    familiarity: filters.familiarity, mood: 'productive', limit: 15, exclude_track_ids: excluded
  } }]);
});

test('home mixes preserve the existing GET endpoint and default limit', async () => {
  const requests: any[] = [];
  Object.assign(globalThis, { __synapseRequests: requests });
  await synapseApi.getMix({ familiarity: ['favorites'], mood: null });
  assert.deepEqual(requests, [{ method: 'GET', url: '/synapse/mix', body: {
    params: { familiarity: 'favorites', mood: undefined, limit: 20 }
  } }]);
});
