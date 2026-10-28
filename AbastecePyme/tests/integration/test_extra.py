import concurrent.futures
import secrets
from test_api import ApiTests
from backend.Auth import CreateUser
from fastapi.testclient import TestClient

class ExtraTests(ApiTests):
    def test_real_password_change(self):
        NewPassword=secrets.token_urlsafe(24)
        Response=self.Client.post("/api/account/password",json={"CurrentPassword":self.Password,"NewPassword":NewPassword})
        self.assertEqual(Response.status_code,200)
        self.assertEqual(self.Client.get("/api/auth/session").status_code,401)
        Response=self.Client.post("/api/auth/login",json={"Username":self.Prefix+"Administrator","Password":NewPassword})
        self.assertEqual(Response.status_code,200)

    def test_relation_edit_conflict_and_quantity(self):
        Material=self.Element()
        Product=self.Element("P","Product")
        Body={"SourceId":Material["ElementId"],"TargetId":Product["ElementId"],"Value":"0"}
        self.assertEqual(self.Client.post("/api/relations",json=Body).status_code,422)
        Body["Value"]="0.1250"
        Response=self.Client.post("/api/relations",json=Body)
        self.assertEqual(Response.status_code,201)
        self.assertEqual(Response.json()["Value"],"0.1250")
        Body.update(Version=Response.json()["Version"],Value="2.5")
        Updated=self.Client.patch("/api/relations",json=Body)
        self.assertEqual(Updated.status_code,200)
        self.assertEqual(self.Client.patch("/api/relations",json=Body).status_code,409)
        Body["Version"]=Updated.json()["Version"]
        self.assertEqual(self.Client.request("DELETE","/api/relations",json=Body).status_code,200)

    def test_concurrent_last_administrators(self):
        Other=CreateUser(self.Database,self.Prefix+"Other","Other administrator",self.Password,"Administrator")
        with self.Database.Transaction() as Connection:
            Count=Connection.execute("SELECT COUNT(*) FROM Users WHERE RoleId='Administrator' AND IsActive=1").fetchone()[0]
        if Count!=2:
            self.skipTest("Permanent administrator exists.")
        def Demote(UserId,Username):
            with TestClient(self.App,base_url="http://127.0.0.1:3000") as Client:
                Client.headers["Origin"]="http://127.0.0.1:3000"
                Session=Client.post("/api/auth/login",json={"Username":Username,"Password":self.Password}).json()
                Client.headers["X-CSRF-Token"]=Session["CsrfToken"]
                return Client.patch("/api/users/"+UserId,json={"RoleName":"Viewer","IsActive":True,"Version":1}).status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as Pool:
            First=Pool.submit(Demote,self.UserIds[0],self.Prefix+"Administrator")
            Second=Pool.submit(Demote,Other["UserId"],self.Prefix+"Other")
            self.assertEqual(sorted([First.result(),Second.result()]),[200,409])

    def test_large_body_rejected(self):
        Response=self.Client.post("/api/auth/login",content='x'*33000,headers={"Content-Type":"application/json"})
        self.assertEqual(Response.status_code,413)



    def test_recreated_element_rejects_stale_edits(self):
        Original=self.Element()
        PathName="/api/elements/"+Original["ElementId"]
        self.assertEqual(self.Client.delete(PathName+"?Version="+str(Original["Version"])).status_code,200)
        Replacement=self.Element()
        self.assertEqual(self.Client.patch(PathName,json={"Version":Original["Version"],"Name":"Stale replacement edit"}).status_code,409)
        self.assertEqual(self.Client.delete(PathName+"?Version="+str(Original["Version"])).status_code,409)

    def test_recreated_relation_rejects_stale_edits(self):
        Supplier=self.Element("S","Supplier")
        Material=self.Element()
        Body={"SourceId":Supplier["ElementId"],"TargetId":Material["ElementId"],"Value":"1"}
        Original=self.Client.post("/api/relations",json=Body).json()
        self.assertEqual(self.Client.request("DELETE","/api/relations",json={**Body,"Version":Original["Version"]}).status_code,200)
        self.assertEqual(self.Client.post("/api/relations",json=Body).status_code,201)
        self.assertEqual(self.Client.patch("/api/relations",json={**Body,"Version":Original["Version"],"Value":"99"}).status_code,409)

    def test_deleting_neighbor_invalidates_preview(self):
        Supplier=self.Element("S","Supplier")
        Material=self.Element()
        self.Client.post("/api/relations",json={"SourceId":Supplier["ElementId"],"TargetId":Material["ElementId"],"Value":"1"})
        Preview=self.Client.get("/api/elements/"+Material["ElementId"]+"/deletion-preview").json()
        SupplierPreview=self.Client.get("/api/elements/"+Supplier["ElementId"]+"/deletion-preview").json()
        self.Client.delete("/api/elements/"+Supplier["ElementId"]+"?Version="+str(SupplierPreview["Version"]))
        self.assertEqual(self.Client.delete("/api/elements/"+Material["ElementId"]+"?Version="+str(Preview["Version"])).status_code,409)

def load_tests(Loader, Tests, Pattern):
    import unittest
    return unittest.TestSuite(ExtraTests(Name) for Name in ExtraTests.__dict__ if Name.startswith("test_"))


