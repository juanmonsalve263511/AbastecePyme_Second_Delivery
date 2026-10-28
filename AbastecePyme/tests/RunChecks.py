import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.Database import Database
from tests import IntegrationContext
IntegrationContext.Database = Database(sys.stdin.readline().rstrip("\r\n"))
Suite = unittest.defaultTestLoader.discover("tests/integration")
Result = unittest.TextTestRunner(verbosity=2).run(Suite)
sys.exit(not Result.wasSuccessful())

