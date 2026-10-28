import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers.js';

const input = { id: 'IN-1', nombre: 'Madera', tipo: 'insumo' };
const product = { id: 'PT-1', nombre: 'Mesa', tipo: 'producto' };

test('GET expone un catálogo vacío y una red vacía sin confundirlos con errores', async t => {
  const { call } = await harness(t);
  assert.deepEqual((await call('/api/elementos')).body, { elementos: [], total: 0 });
  assert.deepEqual((await call('/api/dependencias')).body, { dependencias: [], total: 0 });
  const response = await call('/api/grafo');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { direccion: 'requisito -> dependiente', nodos: [], aristas: [], adyacencia: {} });
});

test('Aceptación: crear, listar y conectar elementos devuelve una red dirigida coherente', async t => {
  const { call } = await harness(t);
  const created = await call('/api/elementos', input);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { elemento: input });
  assert.equal((await call('/api/elementos', product)).status, 201);
  const edge = { origen: 'IN-1', destino: 'PT-1' };
  assert.deepEqual((await call('/api/dependencias', edge)).body, { dependencia: edge });
  const graph = (await call('/api/grafo')).body;
  assert.deepEqual(graph.aristas, [edge]);
  assert.deepEqual(graph.adyacencia, { 'IN-1': ['PT-1'], 'PT-1': [] });
  assert.equal((await call('/api/elementos')).body.total, 2);
  assert.equal((await call('/api/dependencias')).body.total, 1);
});

test('Aceptación: un ID duplicado o una dependencia repetida devuelve 409 sin duplicar', async t => {
  const { call } = await harness(t);
  await call('/api/elementos', input);
  await call('/api/elementos', product);
  const duplicate = await call('/api/elementos', { ...input, id: ' in-1 ' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.codigo, 'ELEMENTO_DUPLICADO');
  await call('/api/dependencias', { origen: 'IN-1', destino: 'PT-1' });
  const repeated = await call('/api/dependencias', { origen: 'IN-1', destino: 'PT-1' });
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.error.codigo, 'DEPENDENCIA_DUPLICADA');
  assert.equal((await call('/api/dependencias')).body.total, 1);
});

test('Aceptación: un extremo inexistente devuelve 404 y no crea una arista parcial', async t => {
  const { call } = await harness(t);
  await call('/api/elementos', input);
  const response = await call('/api/dependencias', { origen: 'IN-1', destino: 'NO-EXISTE' });
  assert.equal(response.status, 404);
  assert.equal(response.body.error.codigo, 'ELEMENTO_INEXISTENTE');
  assert.equal((await call('/api/dependencias')).body.total, 0);
});

test('Aceptación: campos inválidos, JSON roto y formato incorrecto se rechazan', async t => {
  const { call } = await harness(t);
  for (const value of [null, [], {}, { ...input, tipo: 'proceso' }, { ...input, nombre: ' ' }, { ...input, extra: true }]) {
    assert.equal((await call('/api/elementos', value)).status, 400);
  }
  const broken = await call('/api/elementos', {}, { body: '{"id":' });
  assert.equal(broken.status, 400);
  assert.equal(broken.body.error.codigo, 'JSON_INVALIDO');
  assert.equal((await call('/api/elementos', input, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call('/api/elementos')).body.total, 0);
});

test('Un cuerpo excesivo devuelve 413 sin crear datos', async t => {
  const { call } = await harness(t);
  const response = await call('/api/elementos', { ...input, nombre: 'x'.repeat(17_000) });
  assert.equal(response.status, 413);
  assert.equal((await call('/api/elementos')).body.total, 0);
});

test('Las solicitudes simultáneas respetan la unicidad', async t => {
  const { call } = await harness(t);
  const responses = await Promise.all([call('/api/elementos', input), call('/api/elementos', input)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal((await call('/api/elementos')).body.total, 1);
});

test('La API admite un ciclo como datos del catálogo y no afirma tener un orden válido', async t => {
  const { call } = await harness(t);
  await call('/api/elementos', input);
  await call('/api/elementos', product);
  await call('/api/dependencias', { origen: 'IN-1', destino: 'PT-1' });
  assert.equal((await call('/api/dependencias', { origen: 'PT-1', destino: 'IN-1' })).status, 201);
  assert.equal((await call('/api/dependencias', { origen: 'IN-1', destino: 'IN-1' })).status, 201);
  const graph = (await call('/api/grafo')).body;
  assert.equal(graph.aristas.length, 3);
  assert.equal('orden' in graph, false);
});

test('La interfaz se sirve y las rutas o métodos no admitidos responden claramente', async t => {
  const { base, call } = await harness(t);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Catálogo de dependencias/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  for (const path of ['/styles.css', '/app.js', '/favicon.svg']) assert.equal((await fetch(base + path)).status, 200);
  assert.equal((await call('/api/no-existe')).status, 404);
  const response = await call('/api/elementos', undefined, { method: 'DELETE' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, POST');
  assert.equal((await call('/api/elementos', input, { headers: { 'Content-Type': 'application/json', Origin: 'https://otro.example' } })).status, 403);
});
