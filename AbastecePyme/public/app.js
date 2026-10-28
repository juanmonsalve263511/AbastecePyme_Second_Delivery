const $ = id => document.getElementById(id);
const types = ['proveedor', 'insumo', 'producto'];
const labels = { proveedor: 'Proveedor', insumo: 'Insumo', producto: 'Producto' };
const classes = { proveedor: 'supplier', insumo: 'input', producto: 'product' };
let graph = { nodos: [], aristas: [] };
let selected = null;
let refreshVersion = 0;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function svgEl(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.mensaje ?? 'No se pudo completar la operación.');
  return result;
}

function message(id, text, state) {
  const output = $(id);
  output.textContent = text;
  output.className = `form-message ${state}`;
}

function connectionError() {
  const output = $('connection-message');
  output.replaceChildren(el('span', 'No fue posible actualizar el catálogo. Comprueba que el servidor esté en ejecución.'));
  const retry = el('button', 'Reintentar', 'button button-quiet');
  retry.type = 'button';
  retry.addEventListener('click', () => refresh());
  output.append(retry);
  output.hidden = false;
}

async function refresh() {
  const version = ++refreshVersion;
  $('refresh').disabled = true;
  try {
    const next = await api('/api/grafo');
    if (version !== refreshVersion) return false;
    graph = next;
    if (selected && !graph.nodos.some(node => node.id === selected)) selected = null;
    render();
    $('connection-message').hidden = true;
    return true;
  } catch {
    if (version === refreshVersion) connectionError();
    return false;
  } finally {
    if (version === refreshVersion) $('refresh').disabled = false;
  }
}

function render() {
  for (const type of types) $(`count-${type}`).textContent = graph.nodos.filter(node => node.tipo === type).length;
  $('count-edges').textContent = graph.aristas.length;
  $('total-elements').textContent = graph.nodos.length;
  $('total-dependencies').textContent = graph.aristas.length;
  renderOptions();
  renderTables();
  renderGraph();
  updatePreview();
}

function renderOptions() {
  for (const [id, placeholder] of [['dependency-source', 'Selecciona un requisito'], ['dependency-target', 'Selecciona un elemento']]) {
    const select = $(id);
    const previous = select.value;
    const option = el('option', placeholder);
    option.value = '';
    select.replaceChildren(option);
    for (const type of types) {
      const nodes = graph.nodos.filter(node => node.tipo === type);
      if (!nodes.length) continue;
      const group = el('optgroup');
      group.label = `${labels[type]}s`;
      if (type === 'proveedor') group.label = 'Proveedores';
      for (const node of nodes) {
        const choice = el('option', `${node.nombre} · ${node.id}`);
        choice.value = node.id;
        group.append(choice);
      }
      select.append(group);
    }
    if (graph.nodos.some(node => node.id === previous)) select.value = previous;
  }
}

function renderTables() {
  const nodes = new Map(graph.nodos.map(node => [node.id, node]));
  $('elements-body').replaceChildren(...graph.nodos.map(node => {
    const row = el('tr');
    const type = el('td');
    type.append(el('span', labels[node.tipo], `badge ${classes[node.tipo]}`));
    const id = el('td');
    id.append(el('code', node.id));
    row.append(el('td', node.nombre), type, id);
    return row;
  }));
  $('dependencies-body').replaceChildren(...graph.aristas.map(edge => {
    const row = el('tr');
    const source = el('td', nodes.get(edge.origen).nombre);
    source.append(el('span', edge.origen, 'cell-id'));
    const target = el('td', nodes.get(edge.destino).nombre);
    target.append(el('span', edge.destino, 'cell-id'));
    const arrow = el('td', '→', 'arrow-cell');
    arrow.setAttribute('aria-label', 'habilita a');
    row.append(source, arrow, target);
    return row;
  }));
  $('elements-empty').hidden = graph.nodos.length > 0;
  $('dependencies-empty').hidden = graph.aristas.length > 0;
}

function edgePath(source, target) {
  const width = 240;
  if (source.id === target.id) {
    return `M ${source.x + 175} ${source.y} C ${source.x + 220} ${source.y - 48}, ${source.x + 25} ${source.y - 48}, ${source.x + 65} ${source.y - 3}`;
  }
  if (source.x === target.x) {
    const x = source.x + width;
    return `M ${x} ${source.y + 21} C ${x + 48} ${source.y + 21}, ${x + 48} ${target.y + 43}, ${x + 4} ${target.y + 43}`;
  }
  if (source.x > target.x) {
    // Las relaciones inversas entran por arriba y permanecen visibles.
    const sx = source.x + width / 2;
    const tx = target.x + width / 2;
    const top = Math.max(40, Math.min(source.y, target.y) - 50);
    return `M ${sx} ${source.y} C ${sx} ${top}, ${tx} ${top}, ${tx} ${target.y - 4}`;
  }
  const sx = source.x + width;
  const tx = target.x - 4;
  const gap = (tx - sx) * .5;
  return `M ${sx} ${source.y + 32} C ${sx + gap} ${source.y + 32}, ${tx - gap} ${target.y + 32}, ${tx} ${target.y + 32}`;
}

function renderGraph(focusId) {
  const svg = $('graph');
  const counts = types.map(type => graph.nodos.filter(node => node.tipo === type).length);
  const height = Math.max(510, Math.max(...counts) * 108 + 100);
  svg.setAttribute('viewBox', `0 0 1000 ${height}`);
  svg.toggleAttribute('hidden', graph.nodos.length === 0);
  $('graph-empty').hidden = graph.nodos.length > 0;
  svg.replaceChildren(
    svgEl('title', { id: 'graph-title' }, 'Red de dependencias de AbastecePyme'),
    svgEl('desc', { id: 'graph-desc' }, `${graph.nodos.length} elementos y ${graph.aristas.length} dependencias. Cada flecha va del requisito al dependiente. Activa un elemento para resaltar sus conexiones directas. La agrupación por tipo no representa un orden de producción.`),
  );
  const defs = svgEl('defs');
  for (const [id, color] of [['arrow', '#91a6bf'], ['arrow-selected', '#d77c1e']]) {
    const marker = svgEl('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
    marker.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: color }));
    defs.append(marker);
  }
  svg.append(defs);
  const positions = new Map();
  types.forEach((type, column) => {
    const x = 45 + column * 335;
    svg.append(svgEl('text', { x: x + 2, y: 32, class: 'graph-column-label' }, ['PROVEEDORES', 'INSUMOS', 'PRODUCTOS'][column]));
    if (column < 2) svg.append(svgEl('line', { x1: x + 289, x2: x + 289, y1: 55, y2: height - 20, class: 'graph-divider' }));
    const nodes = graph.nodos.filter(node => node.tipo === type);
    nodes.forEach((node, index) => positions.set(node.id, { ...node, x, y: 70 + (index + .5) * (height - 100) / nodes.length - 32 }));
  });
  const connected = new Set(selected ? [selected] : []);
  for (const edge of graph.aristas) {
    if (edge.origen === selected || edge.destino === selected) { connected.add(edge.origen); connected.add(edge.destino); }
  }
  for (const edge of graph.aristas) {
    const active = edge.origen === selected || edge.destino === selected;
    const path = svgEl('path', {
      d: edgePath(positions.get(edge.origen), positions.get(edge.destino)),
      class: `graph-edge${active ? ' selected' : selected ? ' faded' : ''}`,
      'marker-end': `url(#${active ? 'arrow-selected' : 'arrow'})`,
    });
    path.append(svgEl('title', {}, `${edge.origen} habilita a ${edge.destino}`));
    svg.append(path);
  }
  for (const node of positions.values()) {
    const related = graph.aristas.some(edge => edge.origen === node.id || edge.destino === node.id);
    const group = svgEl('g', {
      class: `graph-node${node.id === selected ? ' selected' : selected && !connected.has(node.id) ? ' faded' : ''}`,
      'data-type': node.tipo, 'data-id': node.id, role: 'button', tabindex: 0,
      'aria-label': `${node.nombre}, ${labels[node.tipo]}, ${node.id}${related ? '' : ', sin conexiones'}`,
      'aria-pressed': String(node.id === selected), transform: `translate(${node.x},${node.y})`,
    });
    const name = node.nombre.length > 27 ? `${node.nombre.slice(0, 26)}…` : node.nombre;
    const id = node.id.length > 29 ? `${node.id.slice(0, 28)}…` : node.id;
    group.append(svgEl('title', {}, `${node.nombre} · ${node.id}`), svgEl('rect', { width: 240, height: 64, rx: 9 }), svgEl('circle', { cx: 15, cy: 22, r: 3, class: 'node-dot' }), svgEl('text', { x: 25, y: 27, class: 'node-name' }, name), svgEl('text', { x: 25, y: 47, class: 'node-id' }, id));
    if (!related) group.append(svgEl('text', { x: 9, y: 81, class: 'node-isolated' }, 'Sin conexiones'));
    const choose = () => { selected = selected === node.id ? null : node.id; renderGraph(node.id); };
    group.addEventListener('click', choose);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
    });
    svg.append(group);
  }
  $('clear-selection').hidden = !selected;
  if (selected) {
    const node = positions.get(selected);
    const incoming = graph.aristas.filter(edge => edge.destino === selected).map(edge => positions.get(edge.origen).nombre);
    const outgoing = graph.aristas.filter(edge => edge.origen === selected).map(edge => positions.get(edge.destino).nombre);
    $('selection-text').textContent = `${node.nombre}. Requiere: ${incoming.length ? incoming.join(', ') : 'sin requisitos registrados'}. Habilita a: ${outgoing.length ? outgoing.join(', ') : 'sin dependientes registrados'}.`;
  } else {
    $('selection-text').textContent = 'Selecciona un elemento de la red para resaltar sus conexiones.';
  }
  if (focusId) [...svg.querySelectorAll('.graph-node')].find(node => node.dataset.id === focusId)?.focus({ preventScroll: true });
}

function updatePreview() {
  const source = graph.nodos.find(node => node.id === $('dependency-source').value);
  const target = graph.nodos.find(node => node.id === $('dependency-target').value);
  const output = $('dependency-preview');
  output.className = 'dependency-preview';
  if (!source || !target) { output.textContent = 'Selecciona ambos elementos para leer la relación.'; return; }
  const verb = target.tipo === 'producto' ? 'producir' : 'disponer de';
  output.textContent = `Para ${verb} «${target.nombre}» necesito «${source.nombre}».`;
  if (source.id === target.id) {
    output.textContent += ' Este elemento dependerá de sí mismo. Se registra como una configuración pendiente de revisar.';
    output.classList.add('warning');
  }
}

$('element-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  message('element-message', 'Guardando elemento…', '');
  try {
    const result = await api('/api/elementos', Object.fromEntries(new FormData(form)));
    form.reset();
    const updated = await refresh();
    message('element-message', `Elemento ${result.elemento.id} guardado.${updated ? '' : ' Actualiza la vista para verlo.'}`, 'success');
    $('element-id').focus();
  } catch (error) {
    message('element-message', error.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor.' : error.message, 'error');
  } finally { button.disabled = false; }
});

$('dependency-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  message('dependency-message', 'Guardando dependencia…', '');
  try {
    const result = await api('/api/dependencias', Object.fromEntries(new FormData(form)));
    form.reset();
    const updated = await refresh();
    message('dependency-message', `Dependencia ${result.dependencia.origen} → ${result.dependencia.destino} guardada.${updated ? '' : ' Actualiza la vista para verla.'}`, 'success');
  } catch (error) {
    message('dependency-message', error.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor.' : error.message, 'error');
  } finally { button.disabled = false; }
});

$('dependency-source').addEventListener('change', updatePreview);
$('dependency-target').addEventListener('change', updatePreview);
$('refresh').addEventListener('click', () => refresh());
$('clear-selection').addEventListener('click', () => { selected = null; renderGraph(); });
refresh();
