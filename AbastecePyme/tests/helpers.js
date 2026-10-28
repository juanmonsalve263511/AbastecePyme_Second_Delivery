import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { CatalogStore } from '../src/store.js';
import { createApp } from '../src/server.js';

export function fixture() {
  const base = resolve(tmpdir());
  const directory = mkdtempSync(join(base, 'abastecepyme-feature1-'));
  const seedFile = join(directory, 'ejemplo.json');
  const dataFile = join(directory, 'catalogo.json');
  writeFileSync(seedFile, JSON.stringify({ elementos: [], dependencias: [] }));
  return {
    directory, seedFile, dataFile,
    cleanup() {
      const target = resolve(directory);
      if (!target.startsWith(base + sep) || !basename(target).startsWith('abastecepyme-feature1-')) {
        throw new Error('Ruta de limpieza fuera del directorio temporal de pruebas.');
      }
      rmSync(target, { recursive: true, force: true });
    },
  };
}

export async function harness(t) {
  const files = fixture();
  const store = new CatalogStore(files.dataFile, files.seedFile);
  const server = createApp({ store });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); files.cleanup(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, body, options = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...options,
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  return { ...files, store, base, call };
}
