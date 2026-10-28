"""Startup must not rewrite an already prepared database."""
import hashlib
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from backend.Schema import Migrate

class InitializationRequired(Exception):
    pass

class ReadOnlyCursor:
    def __init__(self, Values):
        self.Values=Values
    def fetchall(self):
        return self.Values

class ReadOnlyConnection:
    def __init__(self, Digest, MissingTable=None, MissingMigration=None):
        self.Closed=False
        self.Tables=["revisionclock","elements","suppliers","materials","products","supplieroffers",
                     "productrequirements","generaldependencies","roles","users","sessions","migrations"]
        if MissingTable: self.Tables.remove(MissingTable)
        self.Markers=[("InitialCatalogue",Digest),("RevisionClockV2","0"*64)]
        if MissingMigration:
            self.Markers=[Row for Row in self.Markers if Row[0]!=MissingMigration]
    def execute(self, Query, *Arguments):
        if Query.startswith("SELECT TABLE_NAME FROM information_schema.TABLES"):
            return ReadOnlyCursor([(Name,) for Name in self.Tables])
        if Query.startswith("SELECT MigrationId,SourceHash FROM AbastecePyme.Migrations"):
            return ReadOnlyCursor(self.Markers)
        raise InitializationRequired("A database write was attempted.")
    def close(self):
        self.Closed=True

class ReadOnlyDatabase:
    def __init__(self, Connection):
        self.Connection=Connection
    def Connect(self, WithDatabase=True):
        return self.Connection

class InitializedStartupTests(unittest.TestCase):
    def setUp(self):
        self.Folder=TemporaryDirectory()
        self.addCleanup(self.Folder.cleanup)
        self.CatalogPath=Path(self.Folder.name)/"seed.json"
        self.CatalogPath.write_bytes(b'{"elementos":[],"dependencias":[]}')
        self.Digest=hashlib.sha256(self.CatalogPath.read_bytes()).hexdigest()

    def test_completed_installation_starts_without_writes(self):
        Connection=ReadOnlyConnection(self.Digest)
        Migrate(ReadOnlyDatabase(Connection),self.CatalogPath)
        self.assertTrue(Connection.Closed)

    def test_changed_seed_is_still_rejected_before_writes(self):
        Connection=ReadOnlyConnection("f"*64)
        with self.assertRaises(ValueError):
            Migrate(ReadOnlyDatabase(Connection),self.CatalogPath)
        self.assertTrue(Connection.Closed)

    def test_missing_table_still_requires_initialization(self):
        Connection=ReadOnlyConnection(self.Digest,MissingTable="sessions")
        with self.assertRaises(InitializationRequired):
            Migrate(ReadOnlyDatabase(Connection),self.CatalogPath)
        self.assertTrue(Connection.Closed)

    def test_pending_migration_still_requires_initialization(self):
        Connection=ReadOnlyConnection(self.Digest,MissingMigration="RevisionClockV2")
        with self.assertRaises(InitializationRequired):
            Migrate(ReadOnlyDatabase(Connection),self.CatalogPath)
        self.assertTrue(Connection.Closed)

