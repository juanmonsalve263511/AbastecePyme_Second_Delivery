"""Interactive local bootstrap; no default password and no remote endpoint."""
import getpass
import sys
import uuid
from pathlib import Path
import pyodbc
from backend.Database import Database
from backend.Schema import Migrate
from backend.Auth import Hasher
from backend.Models import Registration
from pydantic import ValidationError

def Main():
    try:
        DatabaseInstance = Database(getpass.getpass("Contraseña de MariaDB para usuario_python3: "))
        Migrate(DatabaseInstance,Path(__file__).resolve().parent/"data"/"catalogo.json")
        Username = input("Usuario para el primer administrador: ").strip()
        DisplayName = input("Nombre para mostrar: ").strip()
        Password = getpass.getpass("Nueva contraseña del sitio (mínimo 12 caracteres): ")
        Confirmation = getpass.getpass("Repite la nueva contraseña: ")
        if Password != Confirmation:
            print("Las contraseñas no coinciden.")
            return 1
        Body = Registration(Username=Username,DisplayName=DisplayName,Password=Password)
        PasswordHash = Hasher.hash(Body.Password)
        del Password, Confirmation, Body
        with DatabaseInstance.Transaction() as Connection:
            Connection.execute("SELECT RoleId FROM Roles WHERE RoleId='Administrator' FOR UPDATE").fetchone()
            if Connection.execute("SELECT COUNT(*) FROM Users WHERE RoleId='Administrator' AND IsActive=1").fetchone()[0]:
                print("Ya existe un administrador. Gestiona los perfiles desde Usuarios y perfiles.")
                return 1
            Connection.execute("INSERT INTO Users(UserId,Username,DisplayName,PasswordHash,RoleId) VALUES (?,?,?,?,'Administrator')",
                               str(uuid.uuid4()),Username,DisplayName,PasswordHash)
        print("Administrador creado. Inicia sesión con el usuario que elegiste.")
        return 0
    except ValidationError:
        print("Datos inválidos: usuario de 3 a 40 letras/números/guiones, nombre de 2 a 80 y contraseña de 12 a 128 caracteres.")
    except pyodbc.Error:
        print("No se pudo configurar la cuenta. Verifica MySQL, la contraseña y que el usuario del sitio no exista.")
    except (EOFError,KeyboardInterrupt):
        print("Configuración cancelada.")
    return 1

if __name__ == "__main__":
    sys.exit(Main())

