import networkx as nx
import json
import os
import math
from typing import List, Dict, Any

MODE_PROFILES = {
    "road": {"speed": 80, "cost_per_km": 1.2, "cargo_restrictions": ["oversize_heavy"]},
    "rail": {"speed": 60, "cost_per_km": 0.5, "cargo_restrictions": []},
    "air": {"speed": 800, "cost_per_km": 15.0, "cargo_restrictions": ["hazardous_waste"]},
    "sea": {"speed": 35, "cost_per_km": 0.15, "cargo_restrictions": ["perishable_urgent"]}
}

PRIORITY_MULTIPLIERS = {
    "low": 1.2,
    "normal": 1.0,
    "urgent": 0.7
}

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def _travel_time(dist, mode):
    # Speeds in km/h based on freight benchmarks
    speed = MODE_PROFILES.get(mode, {}).get("speed", 50)
    
    # Road friction factor: Real trucking time includes standard stops/traffic
    if mode == "road":
        # Effective speed is lower than max highway speed due to freight regulations
        effective_speed = speed * 0.85 # 68 km/h effective
        return dist / effective_speed
    
    return dist / speed

def load_canonical_hubs():
    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'canonical_hubs.json')
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return []

def create_multimodal_network():
    """
    Supplychainer Data-Driven Graph Construction.
    Canonical Hubs Registry is the SINGLE SOURCE OF TRUTH for both Nodes and Edges.
    """
    G = nx.MultiDiGraph()
    hubs = load_canonical_hubs()
    hub_lookup = {h["id"]: h for h in hubs}

    # 1. Add Nodes
    for hub in hubs:
        G.add_node(hub["id"],
            display_name=hub["display_name"], type=hub["type"],
            country=hub["country"], lat=hub["lat"], lon=hub["lon"],
            importance=hub.get("importance", 5),
            modes=hub["modes"])

    # 2. Add Edges from Registry (Strategic Corridors)
    for hub in hubs:
        u = hub["id"]
        for conn in hub.get("connections", []):
            v = conn["to"]
            mode = conn["mode"]
            
            if v in hub_lookup:
                h1, h2 = hub, hub_lookup[v]
                dist = _haversine(h1["lat"], h1["lon"], h2["lat"], h2["lon"])
                t = _travel_time(dist, mode)
                if t < 0.5: t = 0.5
                
                # Strategic edges are directional based on registry
                G.add_edge(u, v, baseline_time=t, distance=round(dist, 1), transport_mode=mode, region="Strategic")

    # 3. Auto-wire nearby hubs (<200km) for Local Road Connectivity
    for i, h1 in enumerate(hubs):
        if "road" not in h1["modes"]: continue
        for h2 in hubs[i+1:]:
            if "road" not in h2["modes"]: continue
            d = _haversine(h1["lat"], h1["lon"], h2["lat"], h2["lon"])
            if d < 200:
                if not G.has_edge(h1["id"], h2["id"]):
                    t = _travel_time(d, "road")
                    G.add_edge(h1["id"], h2["id"], baseline_time=t, distance=round(d, 1), transport_mode="road", region="Local")
                    G.add_edge(h2["id"], h1["id"], baseline_time=t, distance=round(d, 1), transport_mode="road", region="Local")

    print(f"Multimodal Network: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges (Data-Driven)")
    return G

def get_city_capabilities(G):
    cities = []
    for node, data in G.nodes(data=True):
        modes = data.get("modes", [])
        cities.append({
            "id": node, 
            "display_name": data.get("display_name"),
            "type": data.get("type"), 
            "country": data.get("country"),
            "has_port": "sea" in modes, 
            "has_airport": "air" in modes,
            "has_rail": "rail" in modes
        })
    return sorted(cities, key=lambda c: c["display_name"])
