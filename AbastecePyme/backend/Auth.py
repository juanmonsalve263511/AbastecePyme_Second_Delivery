"""Argon2 passwords and server-side opaque sessions."""
import hashlib
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import HTTPException, Request
from backend.Database import Rows
from backend.Models import Registration

Hasher = PasswordHasher()
DummyHash = Hasher.hash(secrets.token_urlsafe(32))
CookieName = "AbasteceSession"
UserColumns = "u.UserId,u.Username,u.DisplayName,u.Email,u.RoleId AS RoleName,u.IsActive,u.Version"

def HashToken(Token):
    return hashlib.sha256(Token.encode()).hexdigest()

def VerifyPassword(PasswordHash, Password):
    try:
        return Hasher.verify(PasswordHash,Password)
    except (VerificationError,InvalidHashError):
        return False

def PublicUser(Connection, UserId):
    Data = Rows(Connection.execute("SELECT "+UserColumns+" FROM Users u WHERE u.UserId=?",UserId))
    if not Data:
        raise HTTPException(404,"Usuario no encontrado.")
    Data[0]["IsActive"] = bool(Data[0]["IsActive"])
    return Data[0]

def CreateUser(Database, Username, DisplayName, Password, RoleName="Viewer"):
    Body = Registration(Username=Username,DisplayName=DisplayName,Password=Password)
    if RoleName not in ("Administrator","Editor","Viewer"):
        raise ValueError("Invalid role")
    UserId = str(uuid.uuid4())
    PasswordHash = Hasher.hash(Body.Password)
    with Database.Transaction() as Connection:
        Connection.execute("INSERT INTO Users(UserId,Username,DisplayName,PasswordHash,RoleId) VALUES (?,?,?,?,?)",
                           UserId,Body.Username,Body.DisplayName.strip(),PasswordHash,RoleName)
        return PublicUser(Connection,UserId)

class RateLimiter:
    def __init__(self):
        self.Attempts = {}
        self.Lock = threading.Lock()

    def Check(self, Key):
        Now = time.monotonic()
        with self.Lock:
            self.Attempts = {K:V for K,V in self.Attempts.items() if V[0] > Now-60}
            Start, Count = self.Attempts.get(Key,(Now,0))
            if Count >= 10:
                raise HTTPException(429,"Demasiados intentos. Espera un minuto.")
            self.Attempts[Key] = (Start,Count+1)

def CurrentUser(Request: Request):
    Token = Request.cookies.get(CookieName,"")
    if len(Token) != 64:
        raise HTTPException(401,"Inicia sesión para continuar.")
    with Request.app.state.Database.Transaction() as Connection:
        Data = Rows(Connection.execute(
            "SELECT "+UserColumns+",s.CsrfToken FROM Sessions s JOIN Users u ON u.UserId=s.UserId "
            "WHERE s.TokenHash=? AND s.ExpiresAt>UTC_TIMESTAMP() AND u.IsActive=1",HashToken(Token)))
    if not Data:
        raise HTTPException(401,"La sesión venció. Inicia sesión nuevamente.")
    User = Data[0]
    User["IsActive"] = bool(User["IsActive"])
    if Request.method not in ("GET","HEAD","OPTIONS"):
        Supplied = Request.headers.get("X-CSRF-Token","")
        if not secrets.compare_digest(Supplied,User["CsrfToken"]):
            raise HTTPException(403,"La sesión no pudo validar esta acción. Recarga la página.")
    return User

def RequireEditor(Request: Request):
    User = CurrentUser(Request)
    if User["RoleName"] not in ("Administrator","Editor"):
        raise HTTPException(403,"Tu perfil solo permite consultar.")
    return User

def RequireAdmin(Request: Request):
    User = CurrentUser(Request)
    if User["RoleName"] != "Administrator":
        raise HTTPException(403,"Esta acción requiere un administrador.")
    return User

def Login(Database, Body, Response):
    with Database.Transaction() as Connection:
        Found = Connection.execute("SELECT UserId,PasswordHash,IsActive FROM Users WHERE Username=?",Body.Username).fetchone()
        Valid = VerifyPassword(Found[1] if Found else DummyHash, Body.Password)
        if not Found or not Valid or not Found[2]:
            raise HTTPException(401,"Usuario o contraseña incorrectos.")
        # Lock the account before creating a session so deactivation serializes.
        Locked = Connection.execute("SELECT IsActive,PasswordHash FROM Users WHERE UserId=? FOR UPDATE",Found[0]).fetchone()
        if not Locked[0] or Locked[1] != Found[1]:
            raise HTTPException(401,"Usuario o contraseña incorrectos.")
        if Hasher.check_needs_rehash(Found[1]):
            Connection.execute("UPDATE Users SET PasswordHash=? WHERE UserId=?",Hasher.hash(Body.Password),Found[0])
        Token, Csrf = secrets.token_hex(32), secrets.token_hex(32)
        Connection.execute("DELETE FROM Sessions WHERE ExpiresAt<=UTC_TIMESTAMP()")
        Connection.execute("INSERT INTO Sessions(TokenHash,UserId,CsrfToken,ExpiresAt) VALUES (?,?,?,?)",
                           HashToken(Token),Found[0],Csrf,datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(hours=8))
        User = PublicUser(Connection,Found[0])
    Response.set_cookie(CookieName,Token,max_age=28800,httponly=True,samesite="lax",secure=False,path="/")
    return {**User,"CsrfToken":Csrf}

