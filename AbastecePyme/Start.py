"""Local launcher; secrets enter through a hidden prompt or a private pipe."""
import argparse
import getpass
import socket
import sys
import webbrowser
from pathlib import Path

Root = Path(__file__).resolve().parent

def CheckPort(Port=3000):
    try:
        with socket.socket() as Probe:
            Probe.bind(("127.0.0.1",Port))
    except OSError:
        raise RuntimeError(f"El puerto {Port} está ocupado. Cierra el servidor anterior y vuelve a intentar.") from None

def CheckBuild(Folder):
    if not (Folder/"index.html").is_file():
        raise RuntimeError("Falta compilar la interfaz. Ejecuta Instalar.cmd.")

def Main():
    Parser = argparse.ArgumentParser()
    Parser.add_argument("--password-stdin",action="store_true")
    Parser.add_argument("--no-browser",action="store_true")
    Parser.add_argument("--port",type=int,default=3000)
    Arguments = Parser.parse_args()
    try:
        if not 1024 <= Arguments.port <= 65535:
            raise RuntimeError("El puerto debe estar entre 1024 y 65535.")
        CheckPort(Arguments.port)
        CheckBuild(Root/"frontend"/"dist")
        import pyodbc
        if "MySQL ODBC 26.7 Unicode Driver" not in pyodbc.drivers():
            raise RuntimeError("Falta el controlador MySQL ODBC 26.7 Unicode Driver.")
        from backend.Database import Database
        from backend.Schema import Migrate
        from backend.Main import CreateApp
        import uvicorn
        Password = sys.stdin.readline().rstrip("\r\n") if Arguments.password_stdin else getpass.getpass("Contraseña de MariaDB para usuario_python3: ")
        DatabaseInstance = Database(Password)
        del Password
        try:
            Migrate(DatabaseInstance,Root/"data"/"catalogo.json")
        except pyodbc.Error:
            raise RuntimeError("No se pudo conectar o preparar AbastecePyme. Revisa MySQL en XAMPP, la contraseña y los permisos de usuario_python3.") from None
        with DatabaseInstance.Transaction() as Connection:
            AdminCount = Connection.execute("SELECT COUNT(*) FROM Users WHERE RoleId='Administrator' AND IsActive=1").fetchone()[0]
        if not AdminCount:
            print("Falta el primer administrador. Ejecuta ConfigurarAdministrador.cmd en otra ventana.")
        print(f"AbastecePyme: http://127.0.0.1:{Arguments.port}/ | Ctrl+C para detener.")
        if not Arguments.no_browser:
            import threading
            Timer = threading.Timer(1.5,lambda:webbrowser.open(f"http://127.0.0.1:{Arguments.port}/"))
            Timer.daemon=True
            Timer.start()
        uvicorn.run(CreateApp(DatabaseInstance,Arguments.port),host="127.0.0.1",port=Arguments.port,access_log=False,proxy_headers=False,log_level="warning")
    except (RuntimeError,ValueError) as Error:
        print(str(Error),file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 0
    return 0

if __name__ == "__main__":
    sys.exit(Main())


