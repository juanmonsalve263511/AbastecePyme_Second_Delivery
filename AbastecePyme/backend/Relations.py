"""Typed directed edges and editable decimal weights."""
from fastapi import HTTPException
from backend.Catalog import LockElement, ReadRelations
from backend.Estimates import ParseDecimal
from backend.Revisions import NextRevision

def EdgeDefinition(Connection, SourceId, TargetId):
    Types = {}
    for ElementId in sorted(set((SourceId,TargetId))):
        Types[ElementId] = LockElement(Connection,ElementId)
    Pair = (Types[SourceId],Types[TargetId])
    if Pair == ("Supplier","Material"):
        return "SupplierOffers","SupplierId","MaterialId","UnitPrice",2,False
    if Pair == ("Material","Product"):
        return "ProductRequirements","MaterialId","ProductId","Quantity",4,True
    return "GeneralDependencies","SourceId","TargetId",None,None,None

def ChangeRelation(Database, Body, Operation):
    with Database.Transaction() as Connection:
        Revision = NextRevision(Connection)
        Table,Left,Right,Weight,Scale,Positive = EdgeDefinition(Connection,Body.SourceId,Body.TargetId)
        Existing = Connection.execute(f"SELECT Version FROM {Table} WHERE {Left}=? AND {Right}=? FOR UPDATE",
                                      Body.SourceId,Body.TargetId).fetchone()
        if Operation == "create" and Existing:
            raise HTTPException(409,"La relación ya existe.")
        if Operation != "create":
            if not Existing:
                raise HTTPException(404,"Relación no encontrada.")
            if Body.Version != Existing[0]:
                raise HTTPException(409,"La relación cambió. Recarga la lista.")
        if Operation == "delete":
            Connection.execute(f"DELETE FROM {Table} WHERE {Left}=? AND {Right}=?",Body.SourceId,Body.TargetId)
        else:
            Value = None
            if Weight:
                try:
                    Value = str(ParseDecimal(Body.Value,Scale,Positive))
                except ValueError as Error:
                    raise HTTPException(422,str(Error)) from None
            elif Body.Value is not None:
                raise HTTPException(422,"Las dependencias generales no tienen peso.")
            if Operation == "create":
                if Weight:
                    Connection.execute(f"INSERT INTO {Table}({Left},{Right},{Weight},IsDemo,Version) VALUES (?,?,?,?,?)",
                                       Body.SourceId,Body.TargetId,Value,int(Body.IsDemo),Revision)
                else:
                    Connection.execute(f"INSERT INTO {Table}({Left},{Right},Version) VALUES (?,?,?)",Body.SourceId,Body.TargetId,Revision)
            elif Weight:
                Connection.execute(f"UPDATE {Table} SET {Weight}=?,IsDemo=?,Version=? WHERE {Left}=? AND {Right}=?",
                                   Value,int(Body.IsDemo),Revision,Body.SourceId,Body.TargetId)
            else:
                Connection.execute(f"UPDATE {Table} SET Version=? WHERE {Left}=? AND {Right}=?",Revision,Body.SourceId,Body.TargetId)
        for ElementId in sorted(set((Body.SourceId,Body.TargetId))):
            Connection.execute("UPDATE Elements SET Version=? WHERE ElementId=?",Revision,ElementId)
        if Operation == "delete":
            return {"Detail":"Relación eliminada."}
        return next(Edge for Edge in ReadRelations(Connection) if Edge["SourceId"]==Body.SourceId and Edge["TargetId"]==Body.TargetId)

