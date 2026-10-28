"""Same-origin local application and strict authenticated API."""
from pathlib import Path
from typing import Literal
from fastapi import Path as PathParameter
import pyodbc
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from backend import Auth, Users, Catalog, Relations
from backend.Database import Rows
from backend.Estimates import CalculateEstimate
from backend.Impact import AnalyzeImpact
from backend.Models import ElementCreate, ElementEdit, RelationCreate, RelationEdit, LoginBody, Registration, AccountEdit, PasswordEdit, UserEdit

class RequestBoundary:
    def __init__(self, App, AllowedOrigins):
        self.App = App
        self.AllowedOrigins = AllowedOrigins

    async def __call__(self, Scope, Receive, Send):
        if Scope["type"] != "http":
            return await self.App(Scope,Receive,Send)
        Headers = {Key.decode().lower():Value.decode() for Key,Value in Scope["headers"]}
        if Scope["method"] in ("POST","PATCH","PUT","DELETE"):
            if Headers.get("origin") not in self.AllowedOrigins:
                return await JSONResponse({"Detail":"Origen no permitido."},403)(Scope,Receive,Send)
            if Scope["method"] != "DELETE" and Headers.get("content-type","").split(";")[0] != "application/json":
                # Bodyless logout is allowed but still CSRF-protected.
                if Scope["path"] != "/api/auth/logout":
                    return await JSONResponse({"Detail":"Envía JSON."},415)(Scope,Receive,Send)
        Messages = []
        Size = 0
        while True:
            Message = await Receive()
            if Message["type"] == "http.disconnect":
                return
            Size += len(Message.get("body",b""))
            if Size > 32768:
                return await JSONResponse({"Detail":"Solicitud demasiado grande."},413)(Scope,Receive,Send)
            Messages.append(Message)
            if not Message.get("more_body",False):
                break
        async def Read():
            return Messages.pop(0) if Messages else await Receive()
        async def Write(Message):
            if Message["type"] == "http.response.start":
                Message["headers"] += [
                    (b"x-content-type-options",b"nosniff"),(b"x-frame-options",b"DENY"),
                    (b"referrer-policy",b"same-origin"),
                    (b"content-security-policy",b"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"),
                    (b"cache-control",b"no-store")]
            await Send(Message)
        await self.App(Scope,Read,Write)

def CreateApp(Database, Port=3000):
    App = FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
    App.state.Database = Database
    App.state.Limiter = Auth.RateLimiter()
    App.add_middleware(RequestBoundary, AllowedOrigins=(f"http://127.0.0.1:{Port}",f"http://localhost:{Port}"))
    App.add_middleware(TrustedHostMiddleware,allowed_hosts=["127.0.0.1","localhost"])

    @App.exception_handler(HTTPException)
    async def HttpError(Request, Error):
        return JSONResponse({"Detail":Error.detail},Error.status_code)

    @App.exception_handler(RequestValidationError)
    async def ValidationError(Request, Error):
        Fields = sorted({str(Item["loc"][-1]) for Item in Error.errors()})
        return JSONResponse({"Detail":"Revisa los campos: "+", ".join(Fields)},422)

    @App.exception_handler(pyodbc.Error)
    async def DatabaseError(Request, Error):
        # Driver messages may include SQL data; never expose them to clients.
        if isinstance(Error,pyodbc.IntegrityError):
            return JSONResponse({"Detail":"El registro ya existe o tiene relaciones incompatibles."},409)
        return JSONResponse({"Detail":"No se pudo completar la operación en la base de datos."},503)

    @App.get("/api/auth/session")
    def Session(User=Depends(Auth.CurrentUser)):
        return User

    @App.post("/api/auth/register",status_code=201)
    def Register(Body: Registration, Request: Request):
        App.state.Limiter.Check(("register",Request.client.host))
        return Auth.CreateUser(Database,Body.Username,Body.DisplayName,Body.Password)

    @App.post("/api/auth/login")
    def Login(Body: LoginBody, Request: Request, Response: Response):
        App.state.Limiter.Check(("login",Request.client.host))
        return Auth.Login(Database,Body,Response)

    @App.post("/api/auth/logout")
    def Logout(Request: Request, Response: Response, User=Depends(Auth.CurrentUser)):
        with Database.Transaction() as Connection:
            Connection.execute("DELETE FROM Sessions WHERE TokenHash=?",Auth.HashToken(Request.cookies.get(Auth.CookieName,"")))
        Response.delete_cookie(Auth.CookieName,path="/")
        return {"Detail":"Sesión cerrada."}

    @App.get("/api/catalog")
    @App.get("/api/graph")
    def ReadCatalogue(User=Depends(Auth.CurrentUser)):
        return Catalog.ReadCatalogue(Database)

    @App.post("/api/elements",status_code=201)
    def CreateElement(Body: ElementCreate, User=Depends(Auth.RequireEditor)):
        return Catalog.CreateElement(Database,Body)

    @App.patch("/api/elements/{ElementId}")
    def EditElement(ElementId: str, Body: ElementEdit, User=Depends(Auth.RequireEditor)):
        return Catalog.EditElement(Database,ElementId,Body)

    @App.get("/api/elements/{ElementId}/deletion-preview")
    def Preview(ElementId: str, User=Depends(Auth.RequireEditor)):
        return Catalog.DeletePreview(Database,ElementId)

    @App.delete("/api/elements/{ElementId}")
    def DeleteElement(ElementId: str, Version: int = Query(ge=1), User=Depends(Auth.RequireEditor)):
        return Catalog.DeleteElement(Database,ElementId,Version)

    @App.post("/api/relations",status_code=201)
    def CreateRelation(Body: RelationCreate, User=Depends(Auth.RequireEditor)):
        return Relations.ChangeRelation(Database,Body,"create")

    @App.patch("/api/relations")
    def EditRelation(Body: RelationEdit, User=Depends(Auth.RequireEditor)):
        return Relations.ChangeRelation(Database,Body,"edit")

    @App.delete("/api/relations")
    def DeleteRelation(Body: RelationEdit, User=Depends(Auth.RequireEditor)):
        return Relations.ChangeRelation(Database,Body,"delete")

    @App.get("/api/impact/{ElementId}")
    def Impact(
        ElementId: str = PathParameter(pattern=r"^[A-Z][A-Z0-9_-]{1,39}$"),
        Direction: Literal["Consequences", "Requirements"] = "Consequences",
        User=Depends(Auth.CurrentUser),
    ):
        Data = Catalog.ReadCatalogue(Database)
        try:
            return AnalyzeImpact(ElementId, Data["Elements"], Data["Relations"], Direction)
        except KeyError:
            raise HTTPException(404, "Elemento no encontrado. Actualiza el catálogo y vuelve a consultar.") from None

    @App.get("/api/products/{ProductId}/estimate")
    def Estimate(ProductId: str, User=Depends(Auth.CurrentUser)):
        Data = Catalog.ReadCatalogue(Database)
        if not any(Item["ElementId"]==ProductId and Item["ElementType"]=="Product" for Item in Data["Elements"]):
            raise HTTPException(404,"Producto no encontrado.")
        return CalculateEstimate(ProductId,Data["Elements"],Data["Relations"])

    @App.get("/api/users")
    def ReadUsers(User=Depends(Auth.RequireAdmin)):
        with Database.Transaction() as Connection:
            return Rows(Connection.execute("SELECT "+Auth.UserColumns+" FROM Users u ORDER BY u.Username"))

    @App.patch("/api/users/{UserId}")
    def EditUser(UserId: str, Body: UserEdit, User=Depends(Auth.RequireAdmin)):
        return Users.UpdateUser(Database,UserId,Body)

    @App.patch("/api/account")
    def Account(Body: AccountEdit, User=Depends(Auth.CurrentUser)):
        return Users.UpdateAccount(Database,User["UserId"],Body)

    @App.post("/api/account/password")
    def Password(Body: PasswordEdit, User=Depends(Auth.CurrentUser)):
        return Users.ChangePassword(Database,User["UserId"],Body)

    BuildPath = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if BuildPath.exists():
        App.mount("/assets",StaticFiles(directory=BuildPath/"assets"),name="assets")
        @App.get("/")
        def Home():
            return FileResponse(BuildPath/"index.html")
    return App


