"""ODBC credentials remain in memory; one connection per transaction."""
from contextlib import contextmanager
import pyodbc

class Database:
    def __init__(self, Password):
        self.Password = Password

    def Connect(self, WithDatabase=True):
        Password = self.Password.replace("}", "}}")
        Connection = pyodbc.connect(
            "DRIVER={MySQL ODBC 26.7 Unicode Driver};SERVER=127.0.0.1;PORT=3306;"
            "UID=usuario_python3;PWD={" + Password + "};CHARSET=utf8mb4;"
            + ("DATABASE=AbastecePyme;" if WithDatabase else ""),
            timeout=5, autocommit=False)
        Connection.timeout = 15
        Connection.execute("SET SESSION sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
        return Connection

    @contextmanager
    def Transaction(self):
        Connection = self.Connect()
        try:
            yield Connection
            Connection.commit()
        except BaseException:
            Connection.rollback()
            raise
        finally:
            Connection.close()

def Rows(Cursor):
    Names = [Column[0] for Column in Cursor.description]
    return [dict(zip(Names, Row)) for Row in Cursor.fetchall()]

