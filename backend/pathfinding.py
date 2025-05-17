import networkit as nk
from typing import List

def compute_path(graph: nk.Graph, start: int, end: int) -> List[int]:
    """Compute shortest path between two nodes using NetworkIt's Dijkstra."""
    if not (0 <= start < graph.numberOfNodes()):
        print("Invalid start node")
        return []

    if not (0 <= end < graph.numberOfNodes()):
        print("Invalid end node")
        return []
    dijkstra = nk.distance.Dijkstra(graph, start, end)
    dijkstra.run()
    path = dijkstra.getPath(end)
    return list(path) if path else []