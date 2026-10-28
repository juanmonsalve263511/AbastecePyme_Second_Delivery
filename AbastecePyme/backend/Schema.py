"""Non-destructive schema initialization and one-time catalogue import."""
import hashlib
import json
from pathlib import Path

Definitions = [
"""CREATE TABLE IF NOT EXISTS RevisionClock (ClockId INT PRIMARY KEY, CurrentValue BIGINT NOT NULL)""",
"""CREATE TABLE IF NOT EXISTS Elements (
ElementId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
Name VARCHAR(80) NOT NULL, ElementType ENUM('Supplier','Material','Product') NOT NULL,
Description VARCHAR(1000) NOT NULL DEFAULT '', Version INT NOT NULL DEFAULT 1)""",
"""CREATE TABLE IF NOT EXISTS Suppliers (
ElementId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
Contact VARCHAR(160) NOT NULL DEFAULT '',
FOREIGN KEY(ElementId) REFERENCES Elements(ElementId))""",
"""CREATE TABLE IF NOT EXISTS Materials (
ElementId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
UnitCode VARCHAR(30) NOT NULL DEFAULT 'unidad',
FOREIGN KEY(ElementId) REFERENCES Elements(ElementId))""",
"""CREATE TABLE IF NOT EXISTS Products (
ElementId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
FOREIGN KEY(ElementId) REFERENCES Elements(ElementId))""",
"""CREATE TABLE IF NOT EXISTS SupplierOffers (
SupplierId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
MaterialId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
UnitPrice DECIMAL(18,2) NOT NULL CHECK(UnitPrice>=0),
CurrencyCode CHAR(3) NOT NULL DEFAULT 'COP' CHECK(CurrencyCode='COP'),
IsDemo BOOLEAN NOT NULL DEFAULT 1, Version INT NOT NULL DEFAULT 1,
PRIMARY KEY(SupplierId,MaterialId),
FOREIGN KEY(SupplierId) REFERENCES Suppliers(ElementId),
FOREIGN KEY(MaterialId) REFERENCES Materials(ElementId))""",
"""CREATE TABLE IF NOT EXISTS ProductRequirements (
MaterialId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
ProductId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
Quantity DECIMAL(18,4) NOT NULL CHECK(Quantity>0),
IsDemo BOOLEAN NOT NULL DEFAULT 1, Version INT NOT NULL DEFAULT 1,
PRIMARY KEY(MaterialId,ProductId),
FOREIGN KEY(MaterialId) REFERENCES Materials(ElementId),
FOREIGN KEY(ProductId) REFERENCES Products(ElementId))""",
"""CREATE TABLE IF NOT EXISTS GeneralDependencies (
SourceId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
TargetId VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
Version INT NOT NULL DEFAULT 1, PRIMARY KEY(SourceId,TargetId),
FOREIGN KEY(SourceId) REFERENCES Elements(ElementId),
FOREIGN KEY(TargetId) REFERENCES Elements(ElementId))""",
"""CREATE TABLE IF NOT EXISTS Roles (
RoleId VARCHAR(20) PRIMARY KEY)""",
"""CREATE TABLE IF NOT EXISTS Users (
UserId CHAR(36) PRIMARY KEY, Username VARCHAR(40) NOT NULL UNIQUE,
DisplayName VARCHAR(80) NOT NULL, Email VARCHAR(254) NOT NULL DEFAULT '',
PasswordHash VARCHAR(255) NOT NULL, RoleId VARCHAR(20) NOT NULL,
IsActive BOOLEAN NOT NULL DEFAULT 1, Version INT NOT NULL DEFAULT 1,
CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(RoleId) REFERENCES Roles(RoleId))""",
"""CREATE TABLE IF NOT EXISTS Sessions (
TokenHash CHAR(64) PRIMARY KEY, UserId CHAR(36) NOT NULL,
CsrfToken CHAR(64) NOT NULL, ExpiresAt DATETIME NOT NULL,
FOREIGN KEY(UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
INDEX(ExpiresAt))""",
"""CREATE TABLE IF NOT EXISTS Migrations (
MigrationId VARCHAR(80) PRIMARY KEY, SourceHash CHAR(64) NOT NULL,
AppliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"""
]

def ImportCatalogue(Connection, Source):
    Types = {"proveedor":"Supplier","insumo":"Material","producto":"Product"}
    Elements = Source["elementos"]
    Mapping = {Item["id"]: Types[Item["tipo"]] for Item in Elements}
    if len(Mapping) != len(Elements):
        raise ValueError("Duplicate IDs in source")
    for Item in Elements:
        Kind = Mapping[Item["id"]]
        Connection.execute("INSERT INTO Elements(ElementId,Name,ElementType) VALUES (?,?,?)",
                           Item["id"], Item["nombre"], Kind)
        Table = {"Supplier":"Suppliers","Material":"Materials","Product":"Products"}[Kind]
        Connection.execute(f"INSERT INTO {Table}(ElementId) VALUES (?)", Item["id"])
    Seen = set()
    for Index, Edge in enumerate(Source["dependencias"]):
        SourceId, TargetId = Edge["origen"], Edge["destino"]
        if SourceId not in Mapping or TargetId not in Mapping or (SourceId, TargetId) in Seen:
            raise ValueError("Invalid or duplicate source dependency")
        Seen.add((SourceId,TargetId))
        Pair = (Mapping[SourceId],Mapping[TargetId])
        if Pair == ("Supplier","Material"):
            Connection.execute("INSERT INTO SupplierOffers(SupplierId,MaterialId,UnitPrice) VALUES (?,?,?)",
                               SourceId,TargetId,str(1500 + (Index % 19) * 1250))
        elif Pair == ("Material","Product"):
            Connection.execute("INSERT INTO ProductRequirements(MaterialId,ProductId,Quantity) VALUES (?,?,?)",
                               SourceId,TargetId,str(1 + Index % 5))
        else:
            Connection.execute("INSERT INTO GeneralDependencies(SourceId,TargetId) VALUES (?,?)",SourceId,TargetId)

def Migrate(Database, CatalogPath):
    Content = Path(CatalogPath).read_bytes()
    Digest = hashlib.sha256(Content).hexdigest()
    Connection = Database.Connect(False)
    try:
        # Completed installations need only reads on ordinary startup. Keep the
        # seed checksum and pending-migration checks; never suppress SQL errors.
        ExistingTables = {Row[0].lower() for Row in Connection.execute(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?",
            "AbastecePyme").fetchall()}
        RequiredTables = {Definition.split()[5].lower() for Definition in Definitions}
        if RequiredTables.issubset(ExistingTables):
            AppliedMigrations = dict(Connection.execute(
                "SELECT MigrationId,SourceHash FROM AbastecePyme.Migrations").fetchall())
            if {"InitialCatalogue", "RevisionClockV2"}.issubset(AppliedMigrations):
                if AppliedMigrations["InitialCatalogue"] != Digest:
                    raise ValueError("El catálogo de origen cambió; se requiere una migración explícita.")
                return
        Connection.execute("CREATE DATABASE IF NOT EXISTS AbastecePyme CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        Connection.commit()
    finally:
        Connection.close()
    with Database.Transaction() as Connection:
        for Definition in Definitions:
            Connection.execute(Definition + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci")
        if not Connection.execute("SELECT MigrationId FROM Migrations WHERE MigrationId='RevisionClockV2'").fetchone():
            for Table in ("Elements","SupplierOffers","ProductRequirements","GeneralDependencies"):
                Connection.execute(f"ALTER TABLE {Table} MODIFY COLUMN Version BIGINT NOT NULL DEFAULT 1")
            Connection.execute("INSERT INTO Migrations(MigrationId,SourceHash) VALUES ('RevisionClockV2',?)","0"*64)
        Connection.execute("INSERT IGNORE INTO RevisionClock(ClockId,CurrentValue) VALUES (1,1)")
        Maximum = max(Connection.execute(f"SELECT COALESCE(MAX(Version),1) FROM {Table}").fetchone()[0]
                      for Table in ("Elements","SupplierOffers","ProductRequirements","GeneralDependencies"))
        Connection.execute("UPDATE RevisionClock SET CurrentValue=GREATEST(CurrentValue,?) WHERE ClockId=1",Maximum)
        for Role in ("Administrator","Editor","Viewer"):
            Connection.execute("INSERT IGNORE INTO Roles(RoleId) VALUES (?)",Role)
    with Database.Transaction() as Connection:
        # A stable row lock serializes import and bootstrap without global privileges.
        Connection.execute("SELECT RoleId FROM Roles WHERE RoleId='Administrator' FOR UPDATE").fetchone()
        Applied = Connection.execute("SELECT SourceHash FROM Migrations WHERE MigrationId='InitialCatalogue'").fetchone()
        if Applied:
            if Applied[0] != Digest:
                raise ValueError("El catálogo de origen cambió; se requiere una migración explícita.")
            return
        if Connection.execute("SELECT COUNT(*) FROM Elements").fetchone()[0]:
            raise ValueError("La base contiene elementos sin registro de importación.")
        ImportCatalogue(Connection, json.loads(Content.decode("utf-8-sig")))
        Connection.execute("INSERT INTO Migrations(MigrationId,SourceHash) VALUES ('InitialCatalogue',?)",Digest)

