"""Transactional catalogue operations with optimistic versions."""
from fastapi import HTTPException
from backend.Database import Rows
from backend.Revisions import NextRevision

ElementQuery = """SELECT e.ElementId,e.Name,e.ElementType,e.Description,e.Version,
COALESCE(s.Contact,'') AS Contact,COALESCE(m.UnitCode,'') AS UnitCode
FROM Elements e LEFT JOIN Suppliers s ON s.ElementId=e.ElementId
LEFT JOIN Materials m ON m.ElementId=e.ElementId"""

def GetElement(Connection, ElementId):
    Items = Rows(Connection.execute(ElementQuery+" WHERE e.ElementId=?",ElementId))
    if not Items:
        raise HTTPException(404,"Elemento no encontrado.")
    return Items[0]

def LockElement(Connection, ElementId, Version=None):
    Item = Connection.execute("SELECT ElementType,Version FROM Elements WHERE ElementId=? FOR UPDATE",ElementId).fetchone()
    if not Item:
        raise HTTPException(404,"Elemento no encontrado.")
    if Version is not None and Version != Item[1]:
        raise HTTPException(409,"El elemento o sus relaciones cambiaron. Recarga antes de continuar.")
    return Item[0]

def ReadRelations(Connection):
    Queries = [
        "SELECT SupplierId AS SourceId,MaterialId AS TargetId,'Offer' AS RelationType,UnitPrice AS Value,IsDemo,Version FROM SupplierOffers",
        "SELECT MaterialId AS SourceId,ProductId AS TargetId,'Requirement' AS RelationType,Quantity AS Value,IsDemo,Version FROM ProductRequirements",
        "SELECT SourceId,TargetId,'General' AS RelationType,NULL AS Value,0 AS IsDemo,Version FROM GeneralDependencies"]
    Result = []
    for Query in Queries:
        for Item in Rows(Connection.execute(Query)):
            Item["Value"] = str(Item["Value"]) if Item["Value"] is not None else None
            Item["IsDemo"] = bool(Item["IsDemo"])
            Result.append(Item)
    return sorted(Result,key=lambda Item:(Item["SourceId"],Item["TargetId"]))

def ReadCatalogue(Database):
    with Database.Transaction() as Connection:
        return {"Elements":Rows(Connection.execute(ElementQuery+" ORDER BY e.ElementType,e.Name,e.ElementId")),
                "Relations":ReadRelations(Connection)}

def CreateElement(Database, Body):
    with Database.Transaction() as Connection:
        Revision = NextRevision(Connection)
        Connection.execute("INSERT INTO Elements(ElementId,Name,ElementType,Description,Version) VALUES (?,?,?,?,?)",
                           Body.ElementId,Body.Name,Body.ElementType,Body.Description,Revision)
        if Body.ElementType == "Supplier":
            Connection.execute("INSERT INTO Suppliers(ElementId,Contact) VALUES (?,?)",Body.ElementId,Body.Contact)
        elif Body.ElementType == "Material":
            Connection.execute("INSERT INTO Materials(ElementId,UnitCode) VALUES (?,?)",Body.ElementId,Body.UnitCode)
        else:
            Connection.execute("INSERT INTO Products(ElementId) VALUES (?)",Body.ElementId)
        return GetElement(Connection,Body.ElementId)

def EditElement(Database, ElementId, Body):
    with Database.Transaction() as Connection:
        Revision = NextRevision(Connection)
        Kind = LockElement(Connection,ElementId,Body.Version)
        Existing = GetElement(Connection,ElementId)
        Data = Body.model_dump(exclude_none=True)
        Connection.execute("UPDATE Elements SET Name=?,Description=?,Version=? WHERE ElementId=?",
                           Data.get("Name",Existing["Name"]),Data.get("Description",Existing["Description"]),Revision,ElementId)
        if Kind == "Supplier" and "Contact" in Data:
            Connection.execute("UPDATE Suppliers SET Contact=? WHERE ElementId=?",Data["Contact"],ElementId)
        if Kind == "Material" and "UnitCode" in Data:
            Connection.execute("UPDATE Materials SET UnitCode=? WHERE ElementId=?",Data["UnitCode"],ElementId)
        return GetElement(Connection,ElementId)

def DeletePreview(Database, ElementId):
    with Database.Transaction() as Connection:
        Item = GetElement(Connection,ElementId)
        Count = sum(1 for Edge in ReadRelations(Connection) if ElementId in (Edge["SourceId"],Edge["TargetId"]))
        return {"ElementId":ElementId,"Name":Item["Name"],"Version":Item["Version"],"RelationshipCount":Count}

def DeleteElement(Database, ElementId, Version):
    with Database.Transaction() as Connection:
        Revision = NextRevision(Connection)
        Kind = LockElement(Connection,ElementId,Version)
        Neighbors = {Edge["TargetId"] if Edge["SourceId"] == ElementId else Edge["SourceId"]
                     for Edge in ReadRelations(Connection) if ElementId in (Edge["SourceId"],Edge["TargetId"])}
        for Neighbor in sorted(Neighbors - {ElementId}):
            Connection.execute("UPDATE Elements SET Version=? WHERE ElementId=?",Revision,Neighbor)
        for Table, Left, Right in (("SupplierOffers","SupplierId","MaterialId"),
                ("ProductRequirements","MaterialId","ProductId"),("GeneralDependencies","SourceId","TargetId")):
            Connection.execute(f"DELETE FROM {Table} WHERE {Left}=? OR {Right}=?",ElementId,ElementId)
        Table = {"Supplier":"Suppliers","Material":"Materials","Product":"Products"}[Kind]
        Connection.execute(f"DELETE FROM {Table} WHERE ElementId=?",ElementId)
        Connection.execute("DELETE FROM Elements WHERE ElementId=?",ElementId)
    return {"Detail":"Elemento eliminado."}

