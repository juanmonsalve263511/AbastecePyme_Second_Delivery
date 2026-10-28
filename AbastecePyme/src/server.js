import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CatalogError } from './catalog.js';
import { CatalogStore } from './store.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

async function readBody(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new CatalogError(415, 'TIPO_CONTENIDO_INVALIDO', 'Use Content-Type: application/json.');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16_384) throw new CatalogError(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo no puede superar 16 KB.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new CatalogError(400, 'JSON_INVALIDO', 'El cuerpo no contiene un JSON válido.');
  }
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function createApp({ store }) {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(request.url, 'http://localhost');
      const path = url.pathname;
      const apiRoutes = ['/api/elementos', '/api/dependencias', '/api/grafo'];
      if (apiRoutes.includes(path)) {
        const allowed = path === '/api/grafo' ? ['GET'] : ['GET', 'POST'];
        if (!allowed.includes(request.method)) {
          response.setHeader('Allow', allowed.join(', '));
          throw new CatalogError(405, 'METODO_NO_PERMITIDO', `Métodos permitidos: ${allowed.join(', ')}.`);
        }
        if (request.method === 'POST') {
          // Formularios de otros sitios no pueden escribir en la demo local.
          if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) {
            throw new CatalogError(403, 'ORIGEN_NO_PERMITIDO', 'La solicitud debe provenir de esta aplicación.');
          }
          const input = await readBody(request);
          if (path === '/api/elementos') return json(response, 201, { elemento: store.addElement(input) });
          return json(response, 201, { dependencia: store.addDependency(input) });
        }
        if (path === '/api/grafo') return json(response, 200, store.graph());
        if (path === '/api/elementos') {
          const elementos = store.elements();
          return json(response, 200, { elementos, total: elementos.length });
        }
        const dependencias = store.dependencies();
        return json(response, 200, { dependencias, total: dependencias.length });
      }
      const asset = staticFiles.get(path);
      if (asset && ['GET', 'HEAD'].includes(request.method)) {
        const content = readFileSync(resolve(root, 'public', asset[0]));
        response.writeHead(200, { 'Content-Type': asset[1] });
        response.end(request.method === 'HEAD' ? undefined : content);
        return;
      }
      throw new CatalogError(404, 'RUTA_INEXISTENTE', 'La ruta solicitada no existe.');
    } catch (error) {
      if (error instanceof CatalogError) {
        return json(response, error.status, { error: { codigo: error.codigo, mensaje: error.message } });
      }
      console.error('Error de aplicación:', error.message);
      json(response, 500, { error: { codigo: 'ERROR_INTERNO', mensaje: 'No se pudo completar la operación. Revise el registro del servidor.' } });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto entre 1 y 65535.');
  const dataFile = process.env.DATA_FILE ? resolve(process.env.DATA_FILE) : resolve(root, 'data/catalogo.json');
  const store = new CatalogStore(dataFile, resolve(root, 'data/ejemplo.json'));
  const server = createApp({ store });
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Use otro puerto con la variable PORT.` : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`AbastecePyme · Feature 1\nAbrir http://127.0.0.1:${port}\nDatos: ${dataFile}\nCtrl+C para detener.`);
  });
}
