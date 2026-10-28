import concurrent.futures
import secrets
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from tests import IntegrationContext
from backend.Main import CreateApp
from backend.Schema import Migrate
from backend.Auth import CreateUser

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.Database = IntegrationContext.Database
        Migrate(cls.Database, Path("data/catalogo.json"))

    def setUp(self):
        self.Prefix = "TEST-" + secrets.token_hex(4).upper()
        self.Password = secrets.token_urlsafe(24)
        self.UserIds = []
        self.App = CreateApp(self.Database)
        self.Client = TestClient(self.App, base_url="http://127.0.0.1:3000")
        self.Client.headers["Origin"] = "http://127.0.0.1:3000"
        for Role in ("Administrator","Viewer","Editor"):
            User = CreateUser(self.Database, self.Prefix + Role, "Test account", self.Password, Role)
            self.UserIds.append(User["UserId"])
        self.Login("Administrator")

    def tearDown(self):
        self.Client.close()
        with self.Database.Transaction() as Connection:
            for Table, Left, Right in [("SupplierOffers","SupplierId","MaterialId"),
                    ("ProductRequirements","MaterialId","ProductId"),("GeneralDependencies","SourceId","TargetId")]:
                Connection.execute(f"DELETE FROM {Table} WHERE {Left} LIKE ? OR {Right} LIKE ?",self.Prefix+"%",self.Prefix+"%")
            for Table in ("Suppliers","Materials","Products","Elements"):
                Connection.execute(f"DELETE FROM {Table} WHERE ElementId LIKE ?",self.Prefix+"%")
            Connection.execute("DELETE FROM Users WHERE Username LIKE ?",self.Prefix+"%")

    def Login(self, Role):
        Response = self.Client.post("/api/auth/login",json={"Username":self.Prefix+Role,"Password":self.Password})
        self.assertEqual(Response.status_code,200)
        self.Client.headers["X-CSRF-Token"] = Response.json()["CsrfToken"]
        return Response

    def Element(self, Suffix="M", Kind="Material"):
        Body = {"ElementId":self.Prefix+Suffix,"Name":"Test material","ElementType":Kind,"UnitCode":"unidad"}
        Response = self.Client.post("/api/elements",json=Body)
        self.assertEqual(Response.status_code,201,Response.text)
        return Response.json()

    def test_registration_rejects_role(self):
        Response = self.Client.post("/api/auth/register",json={"Username":self.Prefix+"Public","DisplayName":"Public","Password":self.Password,"RoleId":"Administrator"})
        self.assertEqual(Response.status_code,422)
        Response = self.Client.post("/api/auth/register",json={"Username":self.Prefix+"Public","DisplayName":"Public","Password":self.Password})
        self.assertEqual(Response.status_code,201)
        self.assertEqual(Response.json()["RoleName"],"Viewer")
        self.assertNotIn("Password",Response.text)

    def test_cookie_and_session_no_password(self):
        Response = self.Login("Viewer")
        Cookie = Response.headers["set-cookie"].lower()
        self.assertIn("httponly",Cookie)
        self.assertIn("samesite=lax",Cookie)
        Data = self.Client.get("/api/auth/session").json()
        self.assertNotIn("PasswordHash",Data)
        self.assertNotIn(self.Password,str(Data))

    def test_viewer_cannot_write_and_editor_cannot_manage_users(self):
        self.Login("Viewer")
        self.assertEqual(self.Client.post("/api/elements",json={"ElementId":self.Prefix,"Name":"Example","ElementType":"Product"}).status_code,403)
        self.Login("Editor")
        self.assertEqual(self.Client.get("/api/users").status_code,403)

    def test_csrf_and_origin(self):
        self.Client.headers.pop("X-CSRF-Token")
        self.assertEqual(self.Client.post("/api/auth/logout").status_code,403)
        self.Client.headers["Origin"]="https://evil.example"
        self.assertEqual(self.Client.post("/api/auth/login",json={"Username":"x","Password":self.Password}).status_code,403)

    def test_logout_and_expiry(self):
        self.assertEqual(self.Client.post("/api/auth/logout").status_code,200)
        self.assertEqual(self.Client.get("/api/catalog").status_code,401)
        self.Login("Viewer")
        with self.Database.Transaction() as Connection:
            Connection.execute("UPDATE Sessions SET ExpiresAt='2000-01-01' WHERE UserId=?",self.UserIds[1])
        self.assertEqual(self.Client.get("/api/catalog").status_code,401)

    def test_unknown_fields_and_duplicate_id(self):
        Item = self.Element()
        self.assertEqual(self.Client.post("/api/elements",json={"ElementId":Item["ElementId"],"Name":"Again","ElementType":"Material"}).status_code,409)
        self.assertEqual(self.Client.patch("/api/elements/"+Item["ElementId"],json={"Version":Item["Version"],"Name":"Changed","ElementType":"Supplier"}).status_code,422)

    def test_crud_persistence_and_version_conflict(self):
        Item = self.Element()
        PathName = "/api/elements/"+Item["ElementId"]
        Changed = self.Client.patch(PathName,json={"Version":Item["Version"],"Name":"Changed ' ; --","UnitCode":"kg"})
        self.assertEqual(Changed.status_code,200,Changed.text)
        self.assertGreater(Changed.json()["Version"],Item["Version"])
        self.assertEqual(self.Client.patch(PathName,json={"Version":Item["Version"],"Name":"Stale"}).status_code,409)
        with self.Database.Transaction() as Connection:
            self.assertEqual(Connection.execute("SELECT Name FROM Elements WHERE ElementId=?",Item["ElementId"]).fetchone()[0],"Changed ' ; --")
        self.assertEqual(self.Client.delete(PathName+"?Version="+str(Item["Version"])).status_code,409)
        self.assertEqual(self.Client.delete(PathName+"?Version="+str(Changed.json()["Version"])).status_code,200)
        self.assertFalse(any(E["ElementId"]==Item["ElementId"] for E in self.Client.get("/api/catalog").json()["Elements"]))

    def test_relations_and_atomic_delete(self):
        Supplier = self.Element("S","Supplier")
        Material = self.Element()
        Body = {"SourceId":Supplier["ElementId"],"TargetId":Material["ElementId"],"Value":"12.34","IsDemo":False}
        Response = self.Client.post("/api/relations",json=Body)
        self.assertEqual(Response.status_code,201,Response.text)
        self.assertEqual(Response.json()["Value"],"12.34")
        self.assertEqual(self.Client.post("/api/relations",json=Body).status_code,409)
        Preview = self.Client.get("/api/elements/"+Material["ElementId"]+"/deletion-preview").json()
        self.assertEqual(Preview["RelationshipCount"],1)
        self.assertEqual(self.Client.delete("/api/elements/"+Material["ElementId"]+"?Version="+str(Preview["Version"])).status_code,200)
        self.assertFalse(any(E["TargetId"]==Material["ElementId"] for E in self.Client.get("/api/catalog").json()["Relations"]))

    def test_invalid_weights_and_endpoints(self):
        Supplier = self.Element("S","Supplier")
        Material = self.Element()
        for Value in ["NaN","-1","1.001"]:
            Response = self.Client.post("/api/relations",json={"SourceId":Supplier["ElementId"],"TargetId":Material["ElementId"],"Value":Value})
            self.assertEqual(Response.status_code,422)
        self.assertEqual(self.Client.post("/api/relations",json={"SourceId":Supplier["ElementId"],"TargetId":"MISSING","Value":"1"}).status_code,404)

    def test_rate_limit_and_sanitized_validation(self):
        Body = {"Username":"unknown","Password":self.Password}
        Codes = [self.Client.post("/api/auth/login",json=Body).status_code for Index in range(12)]
        self.assertIn(429,Codes)
        Response = self.Client.post("/api/auth/register",json={"Username":"a","Password":"tiny","DisplayName":"A"})
        self.assertNotIn("tiny",Response.text)

    def test_unauthenticated_catalogue(self):
        with TestClient(self.App,base_url="http://127.0.0.1:3000") as Client:
            self.assertEqual(Client.get("/api/catalog").status_code,401)

    def test_account_password_change(self):
        Response = self.Client.post("/api/account/password",json={"CurrentPassword":"wrong","NewPassword":secrets.token_urlsafe(24)})
        self.assertEqual(Response.status_code,400)
        Response = self.Client.patch("/api/account",json={"DisplayName":"New name","Email":"me@example.com"})
        self.assertEqual(Response.json()["DisplayName"],"New name")

    def test_last_admin(self):
        # The test runs before any permanent administrator is configured.
        with self.Database.Transaction() as Connection:
            Count = Connection.execute("SELECT COUNT(*) FROM Users WHERE RoleId='Administrator' AND IsActive=1").fetchone()[0]
        if Count != 1:
            self.skipTest("Permanent administrator exists; last-admin fixture requires isolation.")
        Response = self.Client.patch("/api/users/"+self.UserIds[0],json={"RoleName":"Viewer","IsActive":True,"Version":1})
        self.assertEqual(Response.status_code,409)


