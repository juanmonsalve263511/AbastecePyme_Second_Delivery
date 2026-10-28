# Pruebas del proyecto

## Sin base de datos
Después de instalar dependencias:
```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests/python -v
npm test
npm run check
npm run build --prefix frontend
```

La suite Python contiene 20 pruebas, incluidas 14 de impacto/API y 6 previas. Node contiene 28 pruebas de la versión anterior y regresiones de la interfaz/grafo. Las pruebas API de impacto sustituyen la lectura de MariaDB y la identidad por fixtures; prueban FastAPI y BFS reales, no la autenticación SQL real. La prueba de acceso sin sesión usa la dependencia real.

En entornos restringidos de Windows puede ser necesario utilizar un directorio temporal del proyecto para las pruebas, en lugar del temporal protegido del sistema. Este ajuste no cambia el código de la aplicación.

## Integración con MariaDB
tests/integration/ y tests/RunChecks.py contienen pruebas que **crean y eliminan datos temporales**. Úsalas únicamente sobre una instalación de demostración preparada para ello. La contraseña se proporciona por una entrada privada; nunca la incluyas en argumentos o archivos. Estas pruebas no se ejecutaron para preparar este paquete.

## Evidencia de Feature 2
20 pruebas Python y 28 Node aprobadas en el entorno de desarrollo; compilación React aprobada. Revisión visual con datos ficticios: consecuencias, requisitos inversos, vacío, caminos, zoom, escritorio, móvil y coherencia con el explorador de API. Sin errores de consola en esa revisión. No acredita una comprobación de la sesión real de quien descargue el repositorio.

## Comprobación de la copia para compartir (26 de octubre de 2026)
Se verificó una copia independiente de los archivos del paquete: 28 pruebas Node, 20 Python, npm run check y compilación de React aprobados. Las dependencias frontend se instalaron con npm ci --ignore-scripts --no-audit --no-fund a partir del lockfile. Python utilizó el entorno ya instalado del proyecto, con los imports del código de la copia. No se simuló una instalación de MariaDB nueva ni se conectó a la base real.

El PDF de cinco páginas se renderizó y revisó visualmente. El catálogo de demostración conserva 40 elementos, 92 relaciones y su huella original. Se comprobaron las exclusiones de archivos privados y las referencias internas de la documentación.

## Actualización del 27 de octubre de 2026
24 pruebas Python y 28 Node aprobadas: 52 en total. Se añadieron cuatro pruebas de arranque para instalaciones ya preparadas. La comprobación sigue rechazando un catálogo original cambiado y no omite las migraciones pendientes ni las tablas faltantes. El README contiene la definición de “alcanzar” con un ejemplo del catálogo y pasos concretos de uso.
