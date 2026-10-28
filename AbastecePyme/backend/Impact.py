"""Directed reachability with an own iterative breadth-first traversal.

Stored edges always mean prerequisite -> dependent. Reverse traversal changes
the adjacency index, never the original edges. No costs or availability inferred.
"""
from collections import deque


def AnalyzeImpact(ElementId, Elements, Relations, Direction="Consequences"):
    if Direction not in ("Consequences", "Requirements"):
        raise ValueError("Unknown traversal direction.")
    Lookup = {Element["ElementId"]: Element for Element in Elements}
    if ElementId not in Lookup:
        raise KeyError(ElementId)
    Adjacent = {Key: set() for Key in Lookup}
    for Edge in Relations:
        Source, Target = Edge["SourceId"], Edge["TargetId"]
        if Source not in Lookup or Target not in Lookup:
            continue
        if Direction == "Requirements":
            Source, Target = Target, Source
        Adjacent[Source].add(Target)

    Parents = {ElementId: None}
    Depths = {ElementId: 0}
    Queue = deque([ElementId])
    Visited = []
    while Queue:
        Current = Queue.popleft()
        Path = []
        Step = Current
        while Step is not None:
            Path.append(Step)
            Step = Parents[Step]
        Path.reverse()
        Element = Lookup[Current]
        Visited.append({
            "ElementId": Current, "Name": Element["Name"],
            "ElementType": Element["ElementType"], "Depth": Depths[Current],
            "ParentId": Parents[Current], "Path": Path,
        })
        for Neighbor in sorted(Adjacent[Current]):
            if Neighbor not in Parents:
                # Mark on enqueue: diamonds and cycles cannot enqueue duplicates.
                Parents[Neighbor] = Current
                Depths[Neighbor] = Depths[Current] + 1
                Queue.append(Neighbor)

    Reached = Visited[1:]
    Direct = sum(Row["Depth"] == 1 for Row in Reached)
    return {
        "Origin": Visited[0],
        "Direction": Direction,
        "Meaning": "PotentialImpact" if Direction == "Consequences" else "Prerequisites",
        "Status": "Reached" if Reached else "NoReachable",
        "Traversal": "BreadthFirst",
        "Visited": Visited,
        "Reached": Reached,
        "Summary": {
            "Total": len(Reached), "Direct": Direct, "Indirect": len(Reached) - Direct,
            "Products": sum(Row["ElementType"] == "Product" for Row in Reached),
        },
        "Graph": {
            "Elements": [Lookup[Row["ElementId"]].copy() for Row in Visited],
            "Relations": [Edge.copy() for Edge in sorted(Relations, key=lambda Edge: (Edge["SourceId"], Edge["TargetId"]))
                          if Edge["SourceId"] in Parents and Edge["TargetId"] in Parents],
        },
    }

