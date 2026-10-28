"""Account updates and serialized administrator protection."""
from fastapi import HTTPException
from backend.Auth import PublicUser, Hasher, VerifyPassword

def UpdateUser(Database, UserId, Body):
    with Database.Transaction() as Connection:
        Connection.execute("SELECT RoleId FROM Roles WHERE RoleId='Administrator' FOR UPDATE").fetchone()
        Existing = Connection.execute("SELECT RoleId,IsActive,Version FROM Users WHERE UserId=? FOR UPDATE",UserId).fetchone()
        if not Existing:
            raise HTTPException(404,"Usuario no encontrado.")
        if Existing[2] != Body.Version:
            raise HTTPException(409,"La cuenta cambió. Recarga la lista.")
        if Existing[0] == "Administrator" and Existing[1] and (Body.RoleName != "Administrator" or not Body.IsActive):
            Count = Connection.execute("SELECT COUNT(*) FROM Users WHERE RoleId='Administrator' AND IsActive=1").fetchone()[0]
            if Count <= 1:
                raise HTTPException(409,"Debe permanecer al menos un administrador activo.")
        Connection.execute("UPDATE Users SET RoleId=?,IsActive=?,Version=Version+1 WHERE UserId=?",
                           Body.RoleName,int(Body.IsActive),UserId)
        Connection.execute("DELETE FROM Sessions WHERE UserId=?",UserId)
        return PublicUser(Connection,UserId)

def UpdateAccount(Database, UserId, Body):
    with Database.Transaction() as Connection:
        Connection.execute("UPDATE Users SET DisplayName=?,Email=?,Version=Version+1 WHERE UserId=?",
                           Body.DisplayName,Body.Email,UserId)
        return PublicUser(Connection,UserId)

def ChangePassword(Database, UserId, Body):
    with Database.Transaction() as Connection:
        Existing = Connection.execute("SELECT PasswordHash FROM Users WHERE UserId=? FOR UPDATE",UserId).fetchone()
        if not Existing or not VerifyPassword(Existing[0],Body.CurrentPassword):
            raise HTTPException(400,"La contraseña actual es incorrecta.")
        Connection.execute("UPDATE Users SET PasswordHash=?,Version=Version+1 WHERE UserId=?",Hasher.hash(Body.NewPassword),UserId)
        Connection.execute("DELETE FROM Sessions WHERE UserId=?",UserId)
    return {"Detail":"Contraseña actualizada. Inicia sesión nuevamente."}

