# Guía sencilla de AbastecePyme

## Tu guía de AbastecePyme
Qué hace, cómo usarlo y cómo está construido · Octubre de 2026

AbastecePyme ayuda a organizar la relación entre proveedores, insumos y productos. Permite registrar precios y cantidades, explorar conexiones y entender qué podría verse afectado si falta un elemento.

### 1. Entrar a la aplicación

1. Si ya está instalada: inicia MySQL en XAMPP y ejecuta Iniciar.cmd dentro de la carpeta del proyecto. Introduce la contraseña de MariaDB cuando la consola la solicite de forma oculta.

2. Abre la dirección que muestra la consola. Por defecto es http://127.0.0.1:3000/. Para usar el puerto 3001, ejecuta Iniciar.cmd --port 3001.

3. Pulsa Iniciar sesión y usa tu cuenta del sitio. Esta cuenta es distinta del usuario con el que la aplicación se conecta a MariaDB.

Si ya creaste el administrador, no necesitas crearlo otra vez. Para detener la aplicación, pulsa Ctrl+C en la consola del servidor.

### 2. Qué encontrarás

| Sección | Para qué sirve |
| --- | --- |
| Inicio | Presenta la marca y permite acceder o registrarse. |
| Resumen | Muestra cantidades del catálogo y accesos a las tareas. |
| Catálogo | Organiza proveedores, insumos y productos. |
| Relaciones | Conecta elementos y registra sus precios o cantidades. |
| Grafo | Permite explorar visualmente las conexiones. |
| Análisis de impacto | Explica consecuencias potenciales y requisitos. |
| Explorador de API | Consulta datos y resultados sin escribir código. |
| Mi cuenta / Usuarios | Edita tus datos; el administrador gestiona accesos. |

### 3. Cada perfil tiene un alcance

Consulta: puede leer y analizar. Editor: también puede agregar, editar y eliminar elementos y relaciones. Administrador: además puede cambiar perfiles y activar o desactivar cuentas.

> El registro público crea cuentas de Consulta. Para poder editar, un administrador debe cambiar tu perfil.

## Organizar tu catálogo
Proveedores, insumos, productos y costos

### 4. Agregar, editar o eliminar elementos

1. Abre Catálogo y selecciona Proveedores, Insumos o Productos.

2. Con perfil Editor o Administrador, pulsa Agregar. Completa un código único y un nombre. Puedes añadir una descripción; los proveedores admiten contacto y los insumos necesitan una unidad.

3. Guarda los cambios. Busca por nombre o código para localizar el registro. Usa Editar para actualizarlo.

4. Para eliminar, revisa la confirmación: al borrar un elemento también se eliminan sus relaciones. El código y el tipo del elemento no se cambian mediante Editar.

### 5. Conectar elementos

En Relaciones, crea una conexión desde el requisito hacia el elemento que lo necesita. Por ejemplo: Proveedor → Madera → Mesa.

| Conexión | Qué significa el peso |
| --- | --- |
| Proveedor → Insumo | Precio en pesos colombianos (COP) por una unidad del insumo. |
| Insumo → Producto | Cantidad de ese insumo para producir una unidad del producto. |
| Dependencia general | Otra conexión dirigida; no tiene peso económico ni cantidad. |

Puedes editar el peso de una relación existente o eliminar la conexión. Eliminar una relación conserva ambos elementos. Los valores iniciales marcados como Demostración son ejemplos y se pueden corregir.

> Usa la misma unidad para comprar y consumir cada insumo. Si el precio es por metro, la cantidad necesaria debe expresarse en metros.

### 6. Consultar una estimación

1. Abre Catálogo → Productos y pulsa el nombre del producto. En sus detalles aparece la estimación de materiales.

Python toma el menor precio registrado entre los proveedores de cada insumo, lo multiplica por la cantidad requerida y suma los resultados.

Ejemplo ilustrativo: 2 unidades de madera a $30.000 más 8 tornillos a $200 dan $61.600 en materiales. Son cifras de ejemplo, no precios del catálogo.

La estimación puede aparecer incompleta si faltan ofertas o hay dependencias generales entrantes. No incluye mano de obra, impuestos, transporte ni margen de venta.

## Explorar y analizar la red
Entender una conexión y seguir toda su cadena

### 7. Usar el grafo

En Grafo de abastecimiento, selecciona un elemento para ver sus detalles. Puedes acercarte o alejarte con + y −, usar la rueda del ratón y arrastrar el fondo. Ajustar vista restablece el encuadre.

Mostrar todos los pesos permite ver precios y cantidades. El filtro Explorar alrededor de muestra conexiones cercanas; para seguir una cadena completa usa Análisis de impacto.

### 8. Analizar el impacto o los requisitos

1. Abre Análisis de impacto. En ¿Qué quieres conocer?, elige Consecuencias para saber qué podría afectar un elemento, o Requisitos para saber de qué depende.

2. Busca un nombre o código, selecciona el elemento inicial y pulsa Analizar conexiones.

3. Revisa los totales: elementos alcanzados, directos, indirectos y productos. El origen se visita, pero no se cuenta como otro elemento afectado.

4. En Recorrido explicado, pulsa Ver camino. Se muestran los pasos que explican ese resultado y el grafo destaca el camino en ámbar. El origen tiene contorno discontinuo.

Ejemplo: al consultar un proveedor, pueden aparecer la madera y una mesa que la utiliza. Al consultar los requisitos de la mesa, el recorrido avanza hacia la madera y sus proveedores. Las flechas siempre conservan el sentido requisito → dependiente.

> Impacto potencial no significa producción necesariamente bloqueada. El sistema no conoce existencias ni disponibilidad de proveedores alternativos.

Directo significa una relación desde el origen; indirecto significa dos o más. El recorrido no es un orden de fabricación ni una ruta de menor costo.

### 9. Interpretar un resultado y consultar la API

Sin otros elementos alcanzables: el elemento existe, pero no conduce a otros en esa dirección. Elemento no encontrado: ya no existe o el código es incorrecto. Una cadena alcanzada muestra sus elementos y caminos.

En Explorador de API, elige catálogo, grafo, estimación o análisis de impacto; completa las opciones y pulsa Consultar información. El resultado se muestra como JSON, un formato de datos con nombres y valores. Las consultas de esta pantalla son de lectura.

El perfil de Consulta puede utilizar todas estas funciones. Si otro usuario cambia la red, vuelve a consultar para obtener el resultado actualizado.

## Cómo está construida
Tres partes que trabajan juntas

### 10. De la pantalla a los datos

**React · Interfaz → FastAPI · Python → MariaDB · Datos**

React construye la pantalla, los formularios y la navegación. Cuando consultas o guardas algo, envía una solicitud a la API de Python. La API valida los datos y permisos, realiza los cálculos y consulta MariaDB mediante ODBC.

| Parte del proyecto | Responsabilidad |
| --- | --- |
| frontend/src/ | Componentes React, estilos y dibujo SVG del grafo. |
| backend/ | API, acceso a datos, sesiones, validaciones y cálculos. |
| backend/Impact.py | Recorrido de impacto y requisitos. |
| backend/Schema.py | Crea el esquema e importa el catálogo inicial una vez. |
| data/catalogo.json | Datos de demostración para una instalación nueva. |
| tests/ | Pruebas de lógica, API, grafo y regresiones. |
| Start.py / SetupAdmin.py | Inicio de la aplicación y creación del primer administrador. |

### 11. Cómo se representan las conexiones

Cada elemento tiene un identificador único. Las relaciones guardan un origen y un destino. La base utiliza claves primarias para identificar registros y claves foráneas para enlazarlos.

El impacto usa un recorrido propio llamado BFS: avanza por niveles y marca los elementos ya visitados. Así evita repetirlos o quedarse atrapado en ciclos. No utiliza bibliotecas que resuelvan grafos automáticamente.

### 12. Acceso y alcance del proyecto

Las contraseñas del sitio se guardan como hashes Argon2id, no como texto legible. Las sesiones y perfiles se comprueban en el servidor. La contraseña de MariaDB se solicita al iniciar y permanece en memoria.

La base guarda el catálogo, las relaciones, los perfiles, las cuentas y las sesiones. La API controla las operaciones de cada perfil y detecta conflictos cuando dos personas editan la misma versión de un registro.

> La versión actual está preparada para una demostración local. Compartir su código en GitHub no publica una web ejecutable ni convierte GitHub Pages en un servidor Python/MariaDB.

Incluye catálogo, relaciones, grafo y análisis de impacto. No incorpora inventario real, compras, facturación ni un planificador de producción con orden topológico.

## Instalar y compartir
Qué recibe otra persona y cómo comenzar

### 13. Instalar una copia en otro equipo

1. Descomprime AbastecePyme-GitHub.zip. Instala los requisitos descritos en docs/INSTALACION.md: Python, Node.js, MariaDB y el controlador ODBC de la versión configurada.

2. Prepara una cuenta local de MariaDB con los permisos indicados en ese documento. La configuración de conexión está en backend/Database.py; no se incluye ninguna contraseña.

3. Ejecuta Instalar.cmd. Descarga las dependencias, prepara Python y compila la interfaz.

4. Con MySQL/MariaDB activo, ejecuta ConfigurarAdministrador.cmd una sola vez para crear la cuenta del sitio. La inicialización prepara la base AbastecePyme y el catálogo de ejemplo.

5. Ejecuta Iniciar.cmd y abre la dirección mostrada. Si el puerto está ocupado, usa Iniciar.cmd --port 3001.

### 14. Subir el proyecto a GitHub

1. Crea un repositorio en tu cuenta de GitHub y elige su visibilidad.

2. Descomprime el ZIP. Sube el contenido de la carpeta AbastecePyme al nivel principal del repositorio: README.md, backend, frontend, data, docs y demás archivos. Incluye .gitignore.

3. Puedes usar Add file → Upload files o Git. Conserva las carpetas; subir únicamente el ZIP no deja el código organizado para navegarlo en GitHub.

El paquete incluye código, datos sintéticos, pruebas, dependencias declaradas y documentación. No incluye tu base real, usuarios, contraseñas, sesiones, respaldos ni las dependencias ya instaladas.

### 15. Si algo no funciona

| Situación | Qué revisar |
| --- | --- |
| No conecta a los datos | MariaDB iniciado, puerto, usuario, contraseña y permisos. |
| Falta el controlador ODBC | Instalación y nombre exacto del controlador configurado. |
| No aparecen opciones de edición | Tu cuenta puede tener el perfil Consulta. |
| El puerto está ocupado | Detén la otra aplicación o utiliza otro puerto. |
| No aparece una actualización | Reinicia la aplicación y recarga el navegador. No basta recargar si cambió Python. |

Guía de carga de archivos: docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository. Más detalle y comandos en docs/SUBIR_A_GITHUB.md del paquete.

Esta guía describe el código revisado el 26 de octubre de 2026. Las capturas o los datos que se agreguen después pueden cambiar.
