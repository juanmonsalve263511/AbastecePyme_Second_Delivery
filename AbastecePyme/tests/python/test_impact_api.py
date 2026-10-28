import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.Main import CreateApp
from backend import Auth
from test_impact import Fixture

class ImpactApiTests(unittest.TestCase):
    def setUp(self):
        self.Data = Fixture()
        self.App = CreateApp(None)
        self.Client = TestClient(self.App, base_url="http://127.0.0.1")
        self.Catalog = patch("backend.Catalog.ReadCatalogue", return_value=self.Data)
        self.Catalog.start()
        self.addCleanup(self.Catalog.stop)
        self.addCleanup(self.Client.close)

    def LoginAs(self, Role="Viewer"):
        self.App.dependency_overrides[Auth.CurrentUser] = lambda: {"UserId":"test-user","RoleName":Role}

    def test_requires_login(self):
        self.assertEqual(self.Client.get("/api/impact/S1").status_code,401)

    def test_all_roles_can_read_and_directions_are_distinct(self):
        for Role in ["Viewer","Editor","Administrator"]:
            self.LoginAs(Role)
            Response = self.Client.get("/api/impact/S1")
            self.assertEqual(Response.status_code,200)
            self.assertEqual(Response.json()["Summary"]["Total"],4)
        Response = self.Client.get("/api/impact/P2?Direction=Requirements")
        self.assertEqual(Response.json()["Reached"][-1]["ElementId"],"S2")

    def test_invalid_unknown_and_empty_are_distinct(self):
        self.LoginAs()
        self.assertEqual(self.Client.get("/api/impact/MISSING").status_code,404)
        self.assertEqual(self.Client.get("/api/impact/bad!").status_code,422)
        self.assertEqual(self.Client.get("/api/impact/S1?Direction=Sideways").status_code,422)
        Response = self.Client.get("/api/impact/ZZ")
        self.assertEqual(Response.status_code,200)
        self.assertEqual(Response.json()["Status"],"NoReachable")

    def test_each_request_uses_current_catalogue(self):
        self.LoginAs()
        self.assertEqual(self.Client.get("/api/impact/S1").json()["Summary"]["Total"],4)
        self.Data["Relations"].clear()
        self.assertEqual(self.Client.get("/api/impact/S1").json()["Summary"]["Total"],0)

