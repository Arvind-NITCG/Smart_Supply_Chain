import json
import os
from typing import Dict, Optional

class NodeResolver:
    """
    Supplychainer Mode-Aware Node Resolver.
    Translates high-level city/location names into mode-specific operational Hub IDs.
    Ensures Dijkstra integrity across multimodal handoffs.
    """
    def __init__(self, locations_path: str = None, hubs_path: str = None):
        if not locations_path:
            locations_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'canonical_locations.json')
        if not hubs_path:
            hubs_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'canonical_hubs.json')
            
        self.location_map = {}
        if os.path.exists(locations_path):
            with open(locations_path, 'r') as f:
                self.location_map = json.load(f)
                
        self.hubs = []
        if os.path.exists(hubs_path):
            with open(hubs_path, 'r') as f:
                self.hubs = json.load(f)
        
        # Build reverse index for direct ID resolution
        self.hub_id_to_modes = {h["id"]: h["modes"] for h in self.hubs}

    def resolve_node_with_transfer(self, location_or_id: str, mode: str, strict: bool = False) -> Dict[str, Any]:
        """
        Resolves a location to a node and calculates transfer metadata if a local move is required.
        V2: Operational Type Purity Enforcement.
        """
        from .multimodal_network import _haversine, _travel_time
        
        mode_to_type_map = {
            "road": ["dc", "hub", "logistics_park"],
            "air": ["airport"],
            "sea": ["port", "choke_point"],
            "rail": ["rail_terminal", "icd"]
        }
        
        # 1. Identity Resolution
        resolved_id = None
        current_hub = next((h for h in self.hubs if h["id"] == location_or_id), None)
        
        # City level
        if location_or_id in self.location_map:
            resolved_id = self.location_map[location_or_id].get(mode)
        
        # ID level
        elif current_hub:
            # Purity check: If strict, we prefer a hub of the correct primary type
            expected_types = mode_to_type_map.get(mode, [])
            is_correct_type = current_hub["type"].lower() in expected_types
            
            if strict and not is_correct_type:
                # Force resolution to a better type in the same city
                city = self._find_city_for_hub(location_or_id)
                if city:
                    resolved_id = self.location_map[city].get(mode)
                
                # If city resolution failed or stayed the same, but mode is supported, we accept it but it's risky
                if not resolved_id and mode in current_hub["modes"]:
                    resolved_id = location_or_id
            else:
                # Normal resolution or already correct type
                if mode in current_hub["modes"]:
                    resolved_id = location_or_id
                else:
                    # Not supported, must find in city
                    city = self._find_city_for_hub(location_or_id)
                    if city:
                        resolved_id = self.location_map[city].get(mode)

        resolved_result = resolved_id or location_or_id
        
        # 2. Final Guard
        if not resolved_id and strict and not current_hub:
            return {"id": None, "transfer": None, "error": f"STRICT {mode.upper()} mode unavailable for {location_or_id}"}
        
        if not resolved_id and strict and current_hub:
            # Check if current hub is acceptable
            expected_types = mode_to_type_map.get(mode, [])
            if mode not in current_hub["modes"]:
                 return {"id": None, "transfer": None, "error": f"STRICT {mode.upper()} mode NOT SUPPORTED by {location_or_id}"}

        # 3. Transfer Generation
        transfer = None
        if resolved_id and resolved_id != location_or_id:
            h1 = current_hub or next((h for h in self.hubs if h["id"] == location_or_id), None)
            h2 = next((h for h in self.hubs if h["id"] == resolved_id), None)
            
            if h1 and h2:
                dist = _haversine(h1["lat"], h1["lon"], h2["lat"], h2["lon"])
                t = _travel_time(dist, "road")
                # Operational Realism: Apply mandatory handoff delay (no cargo teleportation)
                handoff_delay = 4.0 if (h2["type"] == "port" or h2["type"] == "rail_terminal") else 2.0
                transfer = {
                    "type": "transfer", "from": location_or_id, "from_name": h1["display_name"],
                    "to": resolved_id, "to_name": h2["display_name"], "mode": "ROAD",
                    "distance": round(dist, 1), "baseline_time": round(t + handoff_delay, 1),
                    "p85_buffer": round(t * 0.4 + 1.0, 1), "reason": f"Operational {mode.upper()} handoff transfer"
                }

        return {"id": resolved_id or location_or_id, "transfer": transfer}

    def resolve_node(self, location_or_id: str, mode: str) -> str:
        """Legacy support for simple resolution"""
        res = self.resolve_node_with_transfer(location_or_id, mode)
        return res["id"]

    def _find_city_for_hub(self, hub_id: str) -> Optional[str]:
        for city, entities in self.location_map.items():
            if hub_id in entities.values():
                return city
        return None
