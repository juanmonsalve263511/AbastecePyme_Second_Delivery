import unittest
import json
from pathlib import Path
from tests import IntegrationContext
from backend.Schema import Migrate, ImportCatalogue
from backend.Database import Rows

class MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Migrate(IntegrationContext.Database, Path('data/catalogo.json'))

    def test_original_catalogue_and_repeat(self):
        Database = IntegrationContext.Database
        PathToCatalogue = Path("data/catalogo.json")
        Migrate(Database, PathToCatalogue)
        Migrate(Database, PathToCatalogue)
        Source = json.loads(PathToCatalogue.read_text(encoding="utf-8-sig"))
        with Database.Transaction() as Connection:
            Elements = Rows(Connection.execute("SELECT ElementId, Name, ElementType FROM Elements"))
            Pairs = set()
            for Query in ["SELECT SupplierId, MaterialId FROM SupplierOffers",
                          "SELECT MaterialId, ProductId FROM ProductRequirements",
                          "SELECT SourceId, TargetId FROM GeneralDependencies"]:
                Pairs.update(tuple(Row) for Row in Connection.execute(Query).fetchall())
        Types = {"proveedor":"Supplier","insumo":"Material","producto":"Product"}
        self.assertEqual({(E["ElementId"],E["Name"],E["ElementType"]) for E in Elements},
                         {(E["id"],E["nombre"],Types[E["tipo"]]) for E in Source["elementos"]})
        self.assertEqual(len(Elements),40)
        self.assertEqual(Pairs,{(E["origen"],E["destino"]) for E in Source["dependencias"]})
        self.assertEqual(len(Pairs),92)

    def test_transaction_rollback(self):
        Database = IntegrationContext.Database
        try:
            with Database.Transaction() as Connection:
                Connection.execute("INSERT INTO Elements(ElementId,Name,ElementType) VALUES (?,?,?)",
                                   "TEST-ROLLBACK","Temporary","Material")
                raise RuntimeError("Injected failure")
        except RuntimeError:
            pass
        with Database.Transaction() as Connection:
            self.assertEqual(Connection.execute("SELECT COUNT(*) FROM Elements WHERE ElementId=?","TEST-ROLLBACK").fetchone()[0],0)

    def test_failed_import_rolls_back(self):
        Invalid = {"elementos":[{"id":"TEST-IMPORT","nombre":"Temporary","tipo":"proveedor"}],
                   "dependencias":[{"origen":"TEST-IMPORT","destino":"MISSING"}]}
        with self.assertRaises(ValueError):
            with IntegrationContext.Database.Transaction() as Connection:
                ImportCatalogue(Connection, Invalid)
        with IntegrationContext.Database.Transaction() as Connection:
            self.assertEqual(Connection.execute("SELECT COUNT(*) FROM Elements WHERE ElementId=?","TEST-IMPORT").fetchone()[0],0)


