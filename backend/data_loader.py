import osmnx as ox
import geopandas as gpd
import networkit as nk
import networkx as nx
from typing import Tuple, Dict

def load_geographic_data(place: str) -> Tuple[nk.Graph, gpd.GeoDataFrame, Dict[str, list]]:
    """Load street network and POIs, mapping POIs to nearest NetworKit node IDs."""
    # Step 1: Load OSM graph as NetworkX
    graph_nx = ox.graph_from_place(place, network_type='drive')
    graph_nx = nx.Graph(graph_nx)
    nodes_gdf = ox.graph_to_gdfs(graph_nx, nodes=True, edges=False)
    # Step 2: Add weight attribute if missing
    for u, v, data in graph_nx.edges(data=True):
        data['weight'] = data.get('length', 1)

    # Step 3: Create NetworkX -> NetworKit node ID mapping
    nx_nodes = list(graph_nx.nodes)
    nx_id_to_nk_id = {nx_id: idx for idx, nx_id in enumerate(nx_nodes)}

    # Step 4: Remap NetworkX graph to have sequential integer node IDs
    relabeled_graph_nx = nx.relabel_nodes(graph_nx, mapping=nx_id_to_nk_id)

    # Step 5: Convert to NetworKit graph
    graph_nk = nk.nxadapter.nx2nk(relabeled_graph_nx, weightAttr='weight')

    nodes_gdf = nodes_gdf.loc[nx_id_to_nk_id.keys()]  # Keep only nodes in mapping
    nodes_gdf.index = nodes_gdf.index.map(nx_id_to_nk_id)  # Reindex to NetworKit IDs
    nodes_gdf.sort_index(inplace=True)
    # Step 6: Extract POIs and convert them to NetworKit node IDs
    pois_nk = {}
    for tag, key in [
        ({'amenity': 'school'}, 'schools'),
        ({'office': 'yes'}, 'offices'),
        ({'shop': 'yes'}, 'shops'),
        ({'leisure': 'park'}, 'parks'),
        ({'amenity': 'restaurant'}, 'restaurants'),
        ({'amenity': 'cafe'}, 'cafes'),
        ({'tourism': 'hotel'}, 'hotels')
    ]:
        gdf = ox.features_from_place(place, tag)
        if not gdf.empty:
            coords = [(row.geometry.centroid.x, row.geometry.centroid.y) if row.geometry.type != 'Point' 
                      else (row.geometry.x, row.geometry.y) for _, row in gdf.iterrows()]
            poi_nodes_nx = [ox.distance.nearest_nodes(graph_nx, x, y) for x, y in coords]
            poi_nodes_nk = [nx_id_to_nk_id[nx_id] for nx_id in poi_nodes_nx if nx_id in nx_id_to_nk_id]
            pois_nk[key] = list(set(poi_nodes_nk))
        else:
            pois_nk[key] = []
    return graph_nk, nodes_gdf, pois_nk
