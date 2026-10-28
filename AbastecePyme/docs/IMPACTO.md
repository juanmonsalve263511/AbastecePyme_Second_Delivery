# Feature 2 — Análisis de impacto

Entra con cualquier perfil y abre **Análisis de impacto**. Selecciona un elemento, elige Consecuencias o Requisitos y pulsa **Analizar conexiones**. También está disponible en **Explorador de API → Análisis de impacto**.

### Qué significa “alcanzar” en este negocio

En AbastecePyme, **“alcanzar” un elemento significa llegar a él siguiendo una cadena de dependencias del grafo**. Las flechas se guardan desde el requisito hacia el elemento que lo necesita.

Por ejemplo:

**Maderas del Norte → Tablero de madera → Mesa de trabajo**

Si iniciamos el análisis en **Maderas del Norte**, alcanzamos directamente **Tablero de madera** y, de forma indirecta, **Mesa de trabajo**. En el negocio, esto significa que un problema de abastecimiento del proveedor **podría repercutir** en ese insumo y en el producto que lo utiliza.

El alcance representa **impacto potencial**, no una interrupción de producción confirmada: puede existir otro proveedor, inventario o una alternativa cuya disponibilidad no registra la aplicación. Los precios y cantidades no determinan qué elementos se alcanzan.

En modo **Requisitos**, se consulta en sentido inverso: desde **Mesa de trabajo** se buscan los insumos y proveedores de los que depende. Las flechas almacenadas mantienen su dirección original.

El elemento inicial se visita, pero no se cuenta como otro elemento afectado. **Directo** significa una relación desde el origen; **indirecto**, dos o más. El recorrido no representa un orden de fabricación.

### Recorrido propio
`backend/Impact.py` implementa BFS iterativo con diccionario de adyacencia, cola y conjunto implícito de visitados en el mapa de padres. Marca cada elemento al encolarlo: los diamantes no duplican resultados y los ciclos/autorrelaciones no causan bucles infinitos. Ordena vecinos por ID para obtener resultados reproducibles. Acepta dependencias generales y cadenas de cualquier longitud, sin presuponer tres niveles. No utiliza bibliotecas de grafos.

Construir el índice cuesta O(V+E); recorrerlo, O(V+E) más ordenar vecinos. La respuesta incluye caminos explícitos, cuyo espacio y tiempo suman sus longitudes (hasta O(V²) en una cadena). Está pensado para el catálogo universitario, no para redes masivas. BFS **no es un orden de producción**; el orden topológico pertenece a Feature 3.

### API de lectura
```text
GET /api/impact/S1?Direction=Consequences
GET /api/impact/P1?Direction=Requirements
```
S1 y P1 son ejemplos: sustituye por identificadores existentes. La dirección por defecto es Consequences. Requiere la sesión habitual; Administrador, Editor y Consulta pueden leer.

- **200 / Reached:** hay otros elementos alcanzables.
- **200 / NoReachable:** el elemento existe, pero no alcanza otros en esa dirección; incluso una autorrelación sola cae en este estado.
- **404:** identificador válido inexistente.
- **422:** identificador mal formado o dirección inválida.
- **401:** falta una sesión válida.

La respuesta contiene Origin, Direction, Meaning, Status, Traversal, Visited, Reached, Summary y Graph. Visited incluye el origen; Reached lo excluye. Cada visita tiene ElementId, Name, ElementType, Depth, ParentId y Path (IDs en orden de recorrido). En Requirements, Path avanza contra las flechas almacenadas. Graph conserva todas las relaciones originales entre los nodos visitados; no solo las del árbol de visita. Summary incluye Total, Direct, Indirect y Products.

Cada petición usa el catálogo vigente de MariaDB mediante ReadCatalogue. No escribe registros, no cambia disponibilidad y no requiere migración del esquema. Si otra persona cambia el catálogo, vuelve a pulsar Analizar conexiones para obtener un nuevo resultado.

### Pantalla
La tabla diferencia origen, directos e indirectos. Ver camino explica un resultado y lo destaca en ámbar en el grafo; el origen tiene contorno discontinuo. El grafo muestra la cadena completa, con zoom, desplazamiento y detalles. El sentido inverso se identifica expresamente. Cambiar origen o dirección descarta respuestas pendientes de la selección anterior.

### Validación y límites de la evidencia
Pruebas automatizadas: `tests/python/test_impact.py`, `test_impact_api.py`, `tests/graph-layout.test.mjs` y las regresiones existentes. Las pruebas API ejecutan FastAPI y el recorrido reales, sustituyendo solamente la lectura del catálogo por datos de prueba y la identidad por perfiles de prueba; no acreditan autenticación real ni permisos SQL. La prueba sin sesión usa la dependencia real.

Casos: ramas/diamantes, camino de cuatro nodos, cadena de 1.100 nodos, componente aislado, nodo final, inexistente, ID/dirección inválidos, ciclos/autorrelación, proveedores alternativos, consulta inversa, estabilidad del orden, entradas sin modificación, lectura por todos los perfiles, actualización entre consultas, cadena completa visible y resaltado inverso. El control de respuestas tardías también tiene pruebas propias.

No se ha ejecutado la suite que crea datos de prueba en MariaDB en esta actualización. No se modificaron bases reales ni tablas del sistema para verificar esta actualización.


## Cómo usar Análisis de impacto

1. Abre http://127.0.0.1:3001/ y recarga la página. Inicia sesión con tu usuario del sitio si se solicita.
2. Entra en **Análisis de impacto**.
3. En **¿Qué quieres conocer?**, elige **Consecuencias: ¿qué podría afectar?**.
4. En **Elemento inicial**, selecciona **Maderas del Norte · Proveedor · PROV-MADERA**. Puedes escribir su nombre en Buscar en el catálogo para localizarlo.
5. Pulsa **Analizar conexiones**.
6. Revisa el resumen y la tabla. Pulsa **Ver camino** junto a un resultado para comprender cómo se conecta con el origen; el grafo resalta ese camino.

Con el catálogo consultado el 27 de octubre de 2026, ese ejemplo devuelve **8 elementos: 1 directo y 7 indirectos; 7 son productos**. El directo es Tablero de madera. Entre los productos aparecen Mesa de trabajo, Estante modular y otros muebles.

Para consultar al revés:
1. Cambia la opción a **Requisitos: ¿de qué depende?**.
2. Selecciona **Mesa de trabajo · Producto · PROD-MESA**.
3. Pulsa **Analizar conexiones**.

Este segundo ejemplo devuelve **6 requisitos: 3 directos** (Barniz, Tablero de madera y Tornillos) **y 3 indirectos** (Acabados Andinos, Maderas del Norte y Ferretería Central). Los totales pueden cambiar si editas el catálogo.

Un resultado válido sin dependencias muestra un mensaje y cero alcanzados; no debería devolver un 404 genérico. El origen no se cuenta en los totales. No hay que crear relaciones nuevas para probar estos ejemplos.