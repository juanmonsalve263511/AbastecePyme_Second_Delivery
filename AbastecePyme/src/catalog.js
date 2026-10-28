// Modelo del negocio. Cada arista va del requisito a su dependiente.
export class CatalogError extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.name = 'CatalogError';
    this.status = status;
    this.codigo = codigo;
  }
}

function fail(codigo, mensaje, status = 400) {
  throw new CatalogError(status, codigo, mensaje);
}

function validateShape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON.');
  }
  if (Object.keys(value).some(key => !keys.includes(key))) {
    fail('DATOS_INVALIDOS', `Solo se permiten estos campos: ${keys.join(', ')}.`);
  }
  if (keys.some(key => typeof value[key] !== 'string')) {
    fail('DATOS_INVALIDOS', `Los campos ${keys.join(', ')} son obligatorios y deben ser texto.`);
  }
}

export function normalizeId(value) {
  if (typeof value !== 'string') fail('ID_INVALIDO', 'El identificador debe ser texto.');
  const id = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,39}$/.test(id)) {
    fail('ID_INVALIDO', 'El identificador debe tener de 2 a 40 caracteres, empezar por una letra y usar letras sin tilde, números, guion o guion bajo.');
  }
  return id;
}

export class Catalog {
  #nodes = new Map();
  #adjacency = new Map();

  constructor(snapshot = { elementos: [], dependencias: [] }) {
    if (!snapshot || !Array.isArray(snapshot.elementos) || !Array.isArray(snapshot.dependencias)) {
      fail('CATALOGO_INVALIDO', 'El catálogo debe contener listas de elementos y dependencias.');
    }
    for (const node of snapshot.elementos) this.addElement(node);
    for (const edge of snapshot.dependencias) this.addDependency(edge);
  }

  addElement(input) {
    validateShape(input, ['id', 'nombre', 'tipo']);
    const id = normalizeId(input.id);
    const nombre = input.nombre.trim();
    const tipo = input.tipo.trim().toLowerCase();
    if (nombre.length < 2 || nombre.length > 80 || /[\u0000-\u001f\u007f]/u.test(nombre)) {
      fail('NOMBRE_INVALIDO', 'El nombre debe tener de 2 a 80 caracteres y no incluir saltos de línea ni caracteres de control.');
    }
    if (!['proveedor', 'insumo', 'producto'].includes(tipo)) {
      fail('TIPO_INVALIDO', 'El tipo debe ser proveedor, insumo o producto.');
    }
    if (this.#nodes.has(id)) fail('ELEMENTO_DUPLICADO', `Ya existe el identificador ${id}.`, 409);
    const node = { id, nombre, tipo };
    this.#nodes.set(id, node);
    this.#adjacency.set(id, new Set());
    return { ...node };
  }

  addDependency(input) {
    validateShape(input, ['origen', 'destino']);
    const origen = normalizeId(input.origen);
    const destino = normalizeId(input.destino);
    for (const id of [origen, destino]) {
      if (!this.#nodes.has(id)) fail('ELEMENTO_INEXISTENTE', `No existe el elemento ${id}. Regístrelo antes de crear la dependencia.`, 404);
    }
    const neighbors = this.#adjacency.get(origen);
    if (neighbors.has(destino)) fail('DEPENDENCIA_DUPLICADA', `La dependencia ${origen} → ${destino} ya existe.`, 409);
    // Los ciclos y autorrelaciones son datos válidos para el catálogo.
    // Su contradicción operativa se analizará en el Feature 3.
    neighbors.add(destino);
    return { origen, destino };
  }

  elements() {
    return [...this.#nodes.values()].map(node => ({ ...node }));
  }

  dependencies() {
    return [...this.#adjacency].flatMap(([origen, destinations]) =>
      [...destinations].map(destino => ({ origen, destino })));
  }

  snapshot() {
    return { elementos: this.elements(), dependencias: this.dependencies() };
  }

  graph() {
    return {
      direccion: 'requisito -> dependiente',
      nodos: this.elements(),
      aristas: this.dependencies(),
      adyacencia: Object.fromEntries([...this.#adjacency].map(([id, neighbors]) => [id, [...neighbors]])),
    };
  }
}
