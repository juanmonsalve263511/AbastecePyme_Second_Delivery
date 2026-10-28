# Instalación en otro equipo

## Requisitos
Entorno de referencia verificado en Windows:
- Python 3.14 de 64 bits, disponible como `py -3.14`.
- Node.js 24, con npm en PATH.
- MariaDB 10.4.32 (usada mediante XAMPP); otras versiones requieren su propia comprobación.
- MySQL ODBC 26.7 Unicode Driver de 64 bits.
- Internet para descargar las dependencias de requirements.txt y frontend/package-lock.json.

Las versiones declaradas son las del proyecto, no una afirmación de compatibilidad con cualquier versión posterior. No se incluyen los instaladores ni los binarios de Python, Node, MariaDB u ODBC.

## 1. Preparar MariaDB
Inicia MariaDB. La configuración actual espera:
- Servidor: 127.0.0.1
- Puerto: 3306
- Base: AbastecePyme
- Cuenta SQL: usuario_python3

En una instalación nueva, un administrador de MariaDB debe crear la cuenta SQL con una contraseña propia y conceder:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX
ON `AbastecePyme`.* TO 'usuario_python3'@'localhost';
```
Esta sentencia concede permisos a una cuenta existente; no crea su contraseña. Crea la cuenta desde el gestor de usuarios de MariaDB/phpMyAdmin antes de concederlos. No reemplaces ni cambies una cuenta que ya esté en uso. El servidor local puede mostrar el nombre de base en minúsculas.

La aplicación crea su esquema al iniciar o al configurar el primer administrador. No hace falta importar un dump SQL, copiar el directorio de datos de XAMPP ni dar permisos globales.

## 2. Ajustar la configuración no secreta, si hace falta
La conexión está en backend/Database.py. Si usas otro usuario, puerto o servidor, ajusta esos valores allí. Los textos de los prompts de Start.py y SetupAdmin.py mencionan el usuario predeterminado.

El nombre del controlador aparece en backend/Database.py y en la comprobación de Start.py; ambos deben coincidir con el controlador instalado. La arquitectura del controlador debe coincidir con Python. El proyecto está diseñado para la base AbastecePyme: cambiar su nombre también exige revisar backend/Schema.py.

No escribas la contraseña en el código. Se solicita por entrada oculta en cada inicio.

## 3. Instalar dependencias
Dentro de la carpeta raíz:
```powershell
.\Instalar.cmd
```
Crea .venv, instala requirements.txt, ejecuta npm ci en frontend y compila React en frontend/dist. Este directorio compilado no se incluye en Git, se genera al instalar.

## 4. Crear el administrador del sitio
```powershell
.\ConfigurarAdministrador.cmd
```
Introduce la contraseña SQL; después elige el usuario y nombre del administrador del sitio y una contraseña de 12 a 128 caracteres. No es la misma cuenta que el usuario SQL. El programa no crea otro primer administrador si ya existe uno activo.

## 5. Iniciar
```powershell
.\Iniciar.cmd
```
Puerto alternativo:
```powershell
.\Iniciar.cmd --port 3001
```
Abre la dirección mostrada por la consola. La aplicación escucha únicamente en 127.0.0.1. Ctrl+C detiene el servidor; cerrar una pestaña no detiene el servidor.

## Catálogo de demostración
data/catalogo.json es la fuente inicial. La importación se registra una vez y no reemplaza posteriores cambios de MariaDB. No edites ese archivo después de importar en una base existente: su huella se verifica al iniciar y un cambio necesita una migración explícita. .gitattributes conserva sus bytes al usar Git.

src/ y public/ contienen la versión anterior, que no debe usarse como servidor principal. Se conservan para referencia y pruebas.

## Actualizar código en una instalación existente
Conserva tus datos en MariaDB, reinstala/compila si cambiaron dependencias o frontend, reinicia el servidor Python y recarga el navegador. Antes de cambios de esquema, prepara un respaldo privado. Los respaldos no van a GitHub.

## Producción
El paquete está pensado para demostración local. Para Internet hacen falta HTTPS, cookies seguras, orígenes y alojamiento adecuados; no basta cambiar 127.0.0.1.

## Inicio de una instalación ya preparada
El arranque comprueba las tablas, el registro de las migraciones actuales y la huella del catálogo. Si todo está aplicado, no repite escrituras de inicialización. Las instalaciones nuevas o incompletas todavía requieren los permisos indicados anteriormente.

Si una pantalla actualizada devuelve 404 genérico para /api/impact, reinicia el servidor de la aplicación desde esta carpeta; recargar el navegador no recarga Python. Una respuesta específica de “Elemento no encontrado” indica que el código del catálogo solicitado no existe.
