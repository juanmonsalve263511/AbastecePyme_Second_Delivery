# Compartir el proyecto en GitHub

El paquete ya está preparado para copiar su contenido a un repositorio. No incluye la base real ni credenciales. No se ha publicado ni creado ningún repositorio desde este chat.

## Opción sencilla: navegador
1. Descomprime AbastecePyme-GitHub.zip.
2. Crea un repositorio en tu cuenta y elige público o privado.
3. Abre Add file → Upload files.
4. Arrastra el **contenido** de la carpeta AbastecePyme, conservando sus subcarpetas. README.md debe quedar en la raíz del repositorio, no dentro de una segunda carpeta AbastecePyme.
5. Incluye .gitignore y .gitattributes. Comprueba que no se hayan omitido por comenzar con punto.
6. Escribe un mensaje descriptivo, como “Versión con catálogo y análisis de impacto”, y confirma los cambios.

Si ya hay archivos con esos nombres, revisa los cambios antes de sustituirlos. Para ramas protegidas, utiliza una rama y una solicitud de cambios según las reglas del repositorio.

GitHub permite hasta 100 archivos por carga web y hasta 25 MiB por archivo. Si necesitas más, realiza varias cargas o utiliza Git. Subir únicamente el ZIP permite descargarlo, pero no presenta el código organizado como repositorio.

Fuente: [Documentación oficial de GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

## Opción con Git
Después de crear un repositorio vacío (sin README automático), abre PowerShell dentro de la carpeta AbastecePyme:
```powershell
git init
git add .
git commit -m "Compartir AbastecePyme con análisis de impacto"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```
Sustituye TU_USUARIO y TU_REPOSITORIO por tu destino. GitHub puede solicitar que inicies sesión. No pegues tokens en archivos del proyecto.

## Qué incluye
Código React/Python y referencia anterior; archivos de instalación; versiones de dependencias; datos de demostración; pruebas; guía Markdown/PDF y documentación de impacto.

## Qué excluye
.venv, node_modules, runtime, compilados, cachés, archivos .env, logs, respaldos, cuentas/sesiones reales, volcados SQL, configuraciones del chat y archivos temporales. .gitignore ayuda a mantener estas exclusiones en futuros cambios.

La publicación del código no hospeda la aplicación. Quien la descargue debe seguir docs/INSTALACION.md. No se ha añadido una licencia al paquete; puedes elegirla por separado antes de publicarlo.
