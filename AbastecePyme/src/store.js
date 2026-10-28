import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Catalog } from './catalog.js';

// Un único proceso atiende las escrituras en serie. Primero se guarda el
// candidato; solo después se publica como nuevo estado en memoria.
export class CatalogStore {
  #catalog;
  #file;

  constructor(file, seedFile) {
    this.#file = file;
    let raw;
    try {
      raw = readFileSync(file, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      raw = readFileSync(seedFile, 'utf8');
      this.#catalog = new Catalog(JSON.parse(raw));
      this.#save(this.#catalog);
      return;
    }
    // Un archivo corrupto detiene el inicio; nunca se sustituye silenciosamente.
    this.#catalog = new Catalog(JSON.parse(raw));
  }

  #save(catalog) {
    mkdirSync(dirname(this.#file), { recursive: true });
    const temporary = `${this.#file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(catalog.snapshot(), null, 2) + '\n', { encoding: 'utf8', flag: 'wx', flush: true });
      renameSync(temporary, this.#file);
    } finally {
      try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }

  #commit(method, input) {
    const candidate = new Catalog(this.#catalog.snapshot());
    const result = candidate[method](input);
    this.#save(candidate);
    this.#catalog = candidate;
    return result;
  }

  addElement(input) { return this.#commit('addElement', input); }
  addDependency(input) { return this.#commit('addDependency', input); }
  elements() { return this.#catalog.elements(); }
  dependencies() { return this.#catalog.dependencies(); }
  graph() { return this.#catalog.graph(); }
}
