"""Persistent monotonic revisions serialize local catalogue writes."""
from fastapi import HTTPException

def NextRevision(Connection):
    Current = Connection.execute("SELECT CurrentValue FROM RevisionClock WHERE ClockId=1 FOR UPDATE").fetchone()[0]
    if Current >= 9007199254740990:
        raise HTTPException(503,"Se agotó el contador de revisiones; contacta al administrador.")
    Revision = Current + 1
    Connection.execute("UPDATE RevisionClock SET CurrentValue=? WHERE ClockId=1",Revision)
    return Revision
