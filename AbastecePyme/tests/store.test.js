import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CatalogStore } from '../src/store.js';
import { fixture } from './helpers.js';

test('Los elementos y las dependencias sobreviven a la reapertura del almacén', t => {
  const files = fixture();
  t.after(() => files.cleanup());
  const store = new CatalogStore(files.dataFile, files.seedFile);
  store.addElement({ id: 'IN-1', nombre: 'Madera', tipo: 'insumo' });
  store.addElement({ id: 'PT-1', nombre: 'Mesa', tipo: 'producto' });
  store.addDependency({ origen: 'IN-1', destino: 'PT-1' });
  const reopened = new CatalogStore(files.dataFile, files.seedFile);
  assert.deepEqual(reopened.graph(), store.graph());
});

test('Una operación inválida no altera el archivo persistente', t => {
  const files = fixture();
  t.after(() => files.cleanup());
  const store = new CatalogStore(files.dataFile, files.seedFile);
  const before = readFileSync(files.dataFile, 'utf8');
  assert.throws(() => store.addDependency({ origen: 'AA', destino: 'BB' }));
  assert.equal(readFileSync(files.dataFile, 'utf8'), before);
});

test('Si falla el guardado, el cambio tampoco se publica en memoria', t => {
  const files = fixture();
  t.after(() => files.cleanup());
  const store = new CatalogStore(files.dataFile, files.seedFile);
  const before = store.graph();
  unlinkSync(files.dataFile);
  mkdirSync(files.dataFile);
  writeFileSync(join(files.dataFile, 'obstaculo.txt'), 'impide reemplazar el directorio');
  assert.throws(() => store.addElement({ id: 'IN-1', nombre: 'Madera', tipo: 'insumo' }));
  assert.deepEqual(store.graph(), before);
});

test('Un archivo corrupto no se sobrescribe con los ejemplos', t => {
  const files = fixture();
  t.after(() => files.cleanup());
  writeFileSync(files.dataFile, '{datos incompletos');
  assert.throws(() => new CatalogStore(files.dataFile, files.seedFile));
  assert.equal(readFileSync(files.dataFile, 'utf8'), '{datos incompletos');
});
