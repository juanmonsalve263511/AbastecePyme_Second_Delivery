import test from 'node:test';
import assert from 'node:assert/strict';
import { Catalog, CatalogError } from '../src/catalog.js';

function example() {
  return new Catalog({
    elementos: [
      { id: 'PR-1', nombre: 'Proveedor', tipo: 'proveedor' },
      { id: 'IN-1', nombre: 'Madera', tipo: 'insumo' },
      { id: 'PT-1', nombre: 'Mesa', tipo: 'producto' },
      { id: 'IN-2', nombre: 'Tela sin uso', tipo: 'insumo' },
    ],
    dependencias: [{ origen: 'PR-1', destino: 'IN-1' }, { origen: 'IN-1', destino: 'PT-1' }],
  });
}

test('La red conserva dirección, tipos y elementos aislados', () => {
  const graph = example().graph();
  assert.equal(graph.direccion, 'requisito -> dependiente');
  assert.equal(graph.nodos.length, 4);
  assert.deepEqual(graph.adyacencia, { 'PR-1': ['IN-1'], 'IN-1': ['PT-1'], 'PT-1': [], 'IN-2': [] });
  assert.equal(graph.nodos.find(node => node.id === 'PT-1').tipo, 'producto');
});

test('Los ID se normalizan y son únicos en todo el catálogo', () => {
  const catalog = example();
  const node = catalog.addElement({ id: '  in-3  ', nombre: '  Barniz  ', tipo: ' INSUMO ' });
  assert.deepEqual(node, { id: 'IN-3', nombre: 'Barniz', tipo: 'insumo' });
  assert.throws(() => catalog.addElement({ id: ' in-3 ', nombre: 'Otro nombre', tipo: 'producto' }), { status: 409, codigo: 'ELEMENTO_DUPLICADO' });
  assert.equal(catalog.elements().length, 5);
});

test('Datos de elemento mal formados se rechazan sin modificar el estado', () => {
  const catalog = example();
  const initial = catalog.snapshot();
  const valid = { id: 'IN-3', nombre: 'Barniz', tipo: 'insumo' };
  const invalid = [null, [], 'texto', {}, { id: 34, nombre: 'Barniz', tipo: 'insumo' },
    { ...valid, id: ' ' }, { ...valid, id: 'A' }, { ...valid, id: '1A' }, { ...valid, id: 'Á-1' },
    { ...valid, id: 'A'.repeat(41) }, { ...valid, nombre: ' ' }, { ...valid, nombre: 'a'.repeat(81) },
    { ...valid, nombre: 'Bar\nniz' }, { ...valid, tipo: 'proceso' }, { ...valid, precio: 10 }];
  for (const input of invalid) {
    assert.throws(() => catalog.addElement(input), CatalogError);
    assert.deepEqual(catalog.snapshot(), initial);
  }
});

test('Ambos extremos deben existir y tener un ID válido', () => {
  const catalog = example();
  const initial = catalog.snapshot();
  for (const edge of [{ origen: 'NO-EXISTE', destino: 'IN-1' }, { origen: 'IN-1', destino: 'NO-EXISTE' }]) {
    assert.throws(() => catalog.addDependency(edge), { status: 404, codigo: 'ELEMENTO_INEXISTENTE' });
  }
  for (const edge of [null, {}, [], { origen: 'IN-1', destino: 9 }, { origen: '', destino: 'IN-1' }, { origen: 'IN-1', destino: 'PT-1', peso: 1 }]) {
    assert.throws(() => catalog.addDependency(edge), CatalogError);
  }
  assert.deepEqual(catalog.snapshot(), initial);
});

test('Una arista repetida se rechaza, pero la inversa es otra relación', () => {
  const catalog = example();
  assert.throws(() => catalog.addDependency({ origen: ' in-1 ', destino: 'pt-1' }), { status: 409, codigo: 'DEPENDENCIA_DUPLICADA' });
  assert.deepEqual(catalog.addDependency({ origen: 'PT-1', destino: 'IN-1' }), { origen: 'PT-1', destino: 'IN-1' });
  assert.equal(catalog.dependencies().length, 3);
});

test('Ciclos y autorrelaciones pueden registrarse sin presentar un orden de producción', () => {
  const catalog = example();
  catalog.addDependency({ origen: 'PT-1', destino: 'PR-1' });
  catalog.addDependency({ origen: 'IN-2', destino: 'IN-2' });
  assert.deepEqual(catalog.graph().adyacencia['IN-2'], ['IN-2']);
  assert.equal(catalog.graph().aristas.length, 4);
  assert.equal('orden' in catalog.graph(), false);
  assert.throws(() => catalog.addDependency({ origen: 'IN-2', destino: 'IN-2' }), { status: 409 });
});

test('Las consultas devuelven copias y no permiten alterar el estado', () => {
  const catalog = example();
  const initial = catalog.snapshot();
  const graph = catalog.graph();
  graph.nodos[0].nombre = 'Alterado';
  graph.adyacencia['PR-1'].push('IN-2');
  graph.aristas[0].destino = 'IN-2';
  assert.deepEqual(catalog.snapshot(), initial);
});

test('El catálogo vacío es válido y una carga inconsistente se rechaza', () => {
  assert.deepEqual(new Catalog().graph(), { direccion: 'requisito -> dependiente', nodos: [], aristas: [], adyacencia: {} });
  assert.throws(() => new Catalog({ elementos: [], dependencias: [{ origen: 'AA', destino: 'BB' }] }), { codigo: 'ELEMENTO_INEXISTENTE' });
  assert.throws(() => new Catalog({}), { codigo: 'CATALOGO_INVALIDO' });
});
