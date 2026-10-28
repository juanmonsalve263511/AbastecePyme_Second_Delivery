# AbastecePyme

Aplicación universitaria local para organizar proveedores, insumos, productos y sus dependencias. Interfaz React, API FastAPI en Python y base MariaDB.

## Funcionalidades
- Inicio de sesión, registro y perfiles Consulta, Editor y Administrador.
- Catálogo con altas, consultas, edición y eliminación según perfil.
- Relaciones con precios en COP y cantidades de insumo por producto.
- Estimación del costo de materiales usando la oferta más económica de cada insumo.
- Grafo SVG propio con zoom, desplazamiento y consulta de conexiones.
- Análisis de impacto potencial y consulta inversa de requisitos con BFS propio, sin bibliotecas de grafos.
- Explorador de API de lectura con consultas guiadas.

## Empezar en Windows
1. Revisa los requisitos y prepara MariaDB siguiendo [Instalación](docs/INSTALACION.md).
2. Ejecuta `Instalar.cmd`.
3. Ejecuta `ConfigurarAdministrador.cmd` una sola vez.
4. Ejecuta `Iniciar.cmd` y abre la dirección mostrada. Puerto alternativo: `Iniciar.cmd --port 3001`.

La contraseña de MariaDB se solicita de forma oculta. No existe una contraseña de administrador predeterminada. No subas contraseñas, usuarios exportados ni copias de la base al repositorio.

## Qué significa “alcanzar” en este negocio

En AbastecePyme, **“alcanzar” un elemento significa llegar a él siguiendo una cadena de dependencias del grafo**. Las flechas se guardan desde el requisito hacia el elemento que lo necesita.

Por ejemplo:

**Maderas del Norte → Tablero de madera → Mesa de trabajo**

Si iniciamos el análisis en **Maderas del Norte**, alcanzamos directamente **Tablero de madera** y, de forma indirecta, **Mesa de trabajo**. En el negocio, esto significa que un problema de abastecimiento del proveedor **podría repercutir** en ese insumo y en el producto que lo utiliza.

El alcance representa **impacto potencial**, no una interrupción de producción confirmada: puede existir otro proveedor, inventario o una alternativa cuya disponibilidad no registra la aplicación. Los precios y cantidades no determinan qué elementos se alcanzan.

En modo **Requisitos**, se consulta en sentido inverso: desde **Mesa de trabajo** se buscan los insumos y proveedores de los que depende. Las flechas almacenadas mantienen su dirección original.

El elemento inicial se visita, pero no se cuenta como otro elemento afectado. **Directo** significa una relación desde el origen; **indirecto**, dos o más. El recorrido no representa un orden de fabricación.

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

## Estructura
```text
backend/       API, reglas, autenticación, cálculos y esquema
frontend/      React, estilos y manifiestos de dependencias
data/          Catálogo inicial sintético
docs/          Guías y documentación
tests/         Pruebas automatizadas
src/, public/  Versión anterior conservada como referencia y para sus pruebas
Start.py       Servidor actual
SetupAdmin.py  Creación inicial del administrador
```

La versión operativa es **backend + frontend**; src/public no son la nueva aplicación. El esquema se prepara desde backend/Schema.py. Una instalación nueva importa 40 elementos y 92 relaciones de demostración; no lleva los usuarios ni los cambios de una base real.

## Alcance
Este proyecto está preparado para HTTP local en 127.0.0.1. Compartirlo en GitHub comparte el código; no despliega automáticamente Python ni MariaDB. No es una aplicación estática para GitHub Pages. Un despliegue público requiere una configuración de producción propia.

Los precios y cantidades iniciales son sintéticos. No se implementan inventario real, compras, facturación ni orden topológico de producción.
