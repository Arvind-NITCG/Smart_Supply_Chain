import networkx as nx
import math
import time
from typing import List, Dict, Any, Optional
from .multimodal_network import MODE_PROFILES, PRIORITY_MULTIPLIERS
from .live_routing import geocode_location, calculate_haversine_distance, BENCHMARK_CITY_COORDS
from .threat_intelligence import ThreatIntelligencePredictor, ContrastiveNLPEngine, CARFFilter
from .news_ingestion import DynamicNewsIngestor

from .node_resolver import NodeResolver

class RouteRecommender:
    """
    Supplychainer Dynamic Routing Engine.
    V6: Decision Superiority Edition with Strict Overrides and Audit Trace.
    """

    def __init__(self, network, predictor, simulator, scenario_mgr, demo_mode=False):
        self.network = network
        self.predictor = predictor
        self.simulator = simulator
        self.scenario_mgr = scenario_mgr
        self.demo_mode = demo_mode
        self.is_warmed_up = False
        self.warmup_failed = False
        
        self.nlp = ContrastiveNLPEngine(lazy_load=True)
        self.carf = CARFFilter()
        self.news_ingestor = DynamicNewsIngestor()
        self.resolver = NodeResolver()
        
        print(f"[STARTUP] Initializing Global Logistics Templates with Operational Priors...")
        self.mode_graphs = {"road": nx.DiGraph(), "rail": nx.DiGraph(), "air": nx.DiGraph(), "sea": nx.DiGraph()}
        
        mode_priors = {
            "road": {"delay": 2.5, "threat": 0.05, "news": "Standard operational baseline flow."},
            "sea": {"delay": 48.0, "threat": 0.2, "news": "Standard berth operations and maritime flow."},
            "air": {"delay": 12.0, "threat": 0.08, "news": "Normal air cargo slot handling."},
            "rail": {"delay": 18.0, "threat": 0.1, "news": "Standard intermodal yard operations."}
        }

        for u, v, data in self.network.edges(data=True):
            mode = data["transport_mode"]
            if mode not in self.mode_graphs: continue
            prior = mode_priors.get(mode, {"delay": 0.0, "threat": 0.0, "news": ""})
            self.mode_graphs[mode].add_edge(u, v, 
                base_weight=data["baseline_time"] + prior["delay"],
                baseline_time=data["baseline_time"],
                distance=data.get("distance", 0),
                base_delay=prior["delay"],
                base_threat=prior["threat"],
                base_news=prior["news"]
            )
            
        if self.demo_mode:
            self.is_warmed_up = True
            
        print(f"[STARTUP] Engine Ready.")

    def run_background_warmup(self):
        if self.is_warmed_up: return
        print("[WARMUP] Starting background intelligence calibration...")
        try:
            self.predictor.warmup()
            self.nlp.warmup()
            
            print("[WARMUP] Generating base risk floor from real models...")
            mode_base_risk = {}
            for m in self.mode_graphs.keys():
                news = self.news_ingestor.fallback_news.get(m, "Normal conditions.")
                score = self.nlp.get_semantic_score(news)
                threat = self.carf.apply_filter(score, news, m)
                risk = self.predictor.predict_worst_case_delay("BASE", "BASE", m, nlp_score=threat)
                mode_base_risk[m] = {"delay": risk["final_delay_presented"], "threat": threat, "news": news}

            print("[WARMUP] Enriching global network with live calibration...")
            for mode in self.mode_graphs.keys():
                base = mode_base_risk[mode]
                for u, v, data in self.mode_graphs[mode].edges(data=True):
                    self.mode_graphs[mode][u][v]["base_weight"] = data["baseline_time"] + base["delay"]
                    self.mode_graphs[mode][u][v]["base_delay"] = base["delay"]
                    self.mode_graphs[mode][u][v]["base_threat"] = base["threat"]
                    self.mode_graphs[mode][u][v]["base_news"] = base["news"]
                    
            self.is_warmed_up = True
            print("[WARMUP] Calibration complete. Engine FULLY OPERATIONAL.")
        except Exception as e:
            import traceback
            print(f"[WARMUP] CRITICAL FAILURE in background thread: {e}")
            traceback.print_exc()
            self.warmup_failed = True

    def recommend(self, source: str, destination: str, transport_preference: str = "any", 
                  routing_policy: str = "STRICT", cargo_type: str = "general", 
                  priority: str = "normal", scenario: str = None, 
                  overrides: dict = None) -> dict:
        
        t0 = time.perf_counter()
        overrides = overrides or {}
        avoid_chokepoints = overrides.get("avoid_chokepoints", [])
        max_delay = overrides.get("max_delay", 999)
        cost_ceiling = overrides.get("cost_ceiling", 999999)
        forced_mode = overrides.get("forced_mode", None)
        has_strategic_overrides = bool(avoid_chokepoints or overrides.get("max_delay") or overrides.get("cost_ceiling"))
        
        is_strict = routing_policy == "STRICT"
        target_modes = [forced_mode] if forced_mode else (["road", "rail", "air", "sea"] if transport_preference == "any" else [transport_preference])
        mode_hint = transport_preference if transport_preference != "any" else "sea"

        # 1. Scenario Activation
        active_scenario = self.scenario_mgr.activate_scenario(scenario)
        scenario_disruptions = self.scenario_mgr.get_active_disruptions()
        
        # 2. Intel Gathering
        strategic_nodes = set([source, destination])
        overlay_intel = {}
        
        if strategic_nodes:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            def fetch_intel(node):
                if node in scenario_disruptions:
                    d = scenario_disruptions[node]
                    return node, d["reason"], False, d["delay"], d["threat"], d["source"]
                if self.demo_mode:
                    return node, self.news_ingestor.fallback_news.get(mode_hint, "Normal conditions."), True, None, None, "FALLBACK"
                try:
                    news = self.news_ingestor.get_latest_news(node, mode_hint)
                    is_fallback = (news == self.news_ingestor.fallback_news.get(mode_hint))
                    return node, news, is_fallback, None, None, "LIVE" if not is_fallback else "FALLBACK"
                except:
                    return node, self.news_ingestor.fallback_news.get(mode_hint, "Normal conditions."), True, None, None, "FALLBACK"

            with ThreadPoolExecutor(max_workers=min(12, len(strategic_nodes))) as executor:
                futures = {executor.submit(fetch_intel, node): node for node in strategic_nodes}
                for future in as_completed(futures):
                    node, news, is_fallback, s_delay, s_threat, intel_source = future.result()
                    threat = s_threat if s_threat is not None else self.carf.apply_filter(self.nlp.get_semantic_score(news), news, mode_hint)
                    delay = s_delay if s_delay is not None else self.predictor.predict_worst_case_delay(node, "DEST", mode_hint, nlp_score=threat)["final_delay_presented"]
                    overlay_intel[node] = {"delay": delay, "threat": threat, "news": news, "source": intel_source}

        candidates = []
        mode_failures = {}
        
        for mode in target_modes:
            if cargo_type in MODE_PROFILES[mode]["cargo_restrictions"]: 
                mode_failures[mode] = f"Cargo restriction: '{cargo_type}' blocked from {mode.upper()} mode."
                continue
            res_s_data = self.resolver.resolve_node_with_transfer(source, mode, strict=is_strict)
            res_d_data = self.resolver.resolve_node_with_transfer(destination, mode, strict=is_strict)
            
            if "error" in res_s_data: 
                mode_failures[mode] = f"Origin resolution failed: {res_s_data['error']}"
                continue
            if "error" in res_d_data: 
                mode_failures[mode] = f"Destination resolution failed: {res_d_data['error']}"
                continue
                
            res_s, res_d = res_s_data["id"], res_d_data["id"]
            if res_s not in self.mode_graphs[mode] or res_d not in self.mode_graphs[mode]:
                mode_failures[mode] = f"Hub connectivity failure in {mode.upper()} graph."
                continue

            for persona in ["FASTEST", "SAFEST", "BALANCED"]:
                try:
                    def weight_fastest(u, v, d):
                        du = overlay_intel.get(u, {}).get("delay", 0) if u in overlay_intel else d["base_delay"]
                        dv = overlay_intel.get(v, {}).get("delay", 0) if v in overlay_intel else d["base_delay"]
                        return d["baseline_time"] + max(du, dv)

                    def weight_safest(u, v, d):
                        tu = overlay_intel.get(u, {}).get("threat", 0) if u in overlay_intel else d["base_threat"]
                        tv = overlay_intel.get(v, {}).get("threat", 0) if v in overlay_intel else d["base_threat"]
                        penalty = 1.0 + min(3.0, max(tu, tv) * 4.0)
                        return d["baseline_time"] * penalty

                    def weight_balanced(u, v, d):
                        du = overlay_intel.get(u, {}).get("delay", 0) if u in overlay_intel else d["base_delay"]
                        dv = overlay_intel.get(v, {}).get("delay", 0) if v in overlay_intel else d["base_delay"]
                        tu = overlay_intel.get(u, {}).get("threat", 0) if u in overlay_intel else d["base_threat"]
                        tv = overlay_intel.get(v, {}).get("threat", 0) if v in overlay_intel else d["base_threat"]
                        time_factor = d["baseline_time"] + max(du, dv)
                        cost_factor = (d["distance"] * MODE_PROFILES[mode]["cost_per_km"]) / 100.0
                        threat_penalty = 1.0 + min(2.0, max(tu, tv) * 3.0)
                        return (time_factor * 0.45) + (cost_factor * 0.35) + (threat_penalty * 0.20)

                    weights = {"FASTEST": weight_fastest, "SAFEST": weight_safest, "BALANCED": weight_balanced}
                    
                    graph = self.mode_graphs[mode].copy()
                    for node in avoid_chokepoints:
                        if node in graph:
                            if is_strict: graph.remove_node(node)
                            else:
                                for u, v in list(graph.edges(node)): graph[u][v][persona] = 999999
                    
                    path = nx.dijkstra_path(graph, res_s, res_d, weight=weights[persona])
                    
                    total_time, total_delay, total_cost, max_threat = 0, 0, 0, -1
                    choke_point, choke_reason, legs = None, "", []
                    
                    def get_transfer_cost(node_id):
                        if node_id.startswith("AIR-"): return 220, 1.8, 3.0
                        elif node_id.startswith("PORT-") or node_id.startswith("CHOKE-"): return 180, 1.4, 6.0
                        elif node_id.startswith("RAIL-"): return 130, 1.0, 4.0
                        else: return 80, 0.8, 2.0

                    trace = {
                        "eta": {"base": 0, "buffer": 0, "scenario": 0, "transfer": 0},
                        "cost": {"mode": 0, "transfer": 0, "scenario": 0},
                        "risk": {"historical": 0, "intel": 0, "scenario": 0}
                    }

                    if res_s_data.get("transfer"):
                        t = res_s_data["transfer"]
                        fee, rate, min_h = get_transfer_cost(res_s)
                        c = fee + (t["distance"] * rate)
                        legs.append(t)
                        trace["eta"]["transfer"] += max(min_h, t["baseline_time"])
                        trace["eta"]["buffer"] += t["p85_buffer"]
                        trace["cost"]["transfer"] += c
                        total_time += (max(min_h, t["baseline_time"]) + t["p85_buffer"]); total_delay += t["p85_buffer"]; total_cost += c

                    mode_cost_km = MODE_PROFILES[mode]["cost_per_km"]
                    for i in range(len(path)-1):
                        u, v = path[i], path[i+1]
                        d = self.mode_graphs[mode].get_edge_data(u, v)
                        intel = overlay_intel.get(u, {"delay": d["base_delay"], "threat": d["base_threat"], "news": d["base_news"], "source": "FALLBACK"})
                        f_delay = round(max(0.1, intel["delay"]), 1)
                        trace["eta"]["base"] += d["baseline_time"]
                        if intel["source"] == "LIVE" or scenario:
                            trace["eta"]["scenario"] += f_delay
                            trace["cost"]["scenario"] += (d["distance"] * mode_cost_km * 0.1)
                            trace["risk"]["scenario"] = max(trace["risk"]["scenario"], intel["threat"])
                        else:
                            trace["eta"]["buffer"] += f_delay
                            trace["risk"]["historical"] = max(trace["risk"]["historical"], d["base_threat"])
                        trace["cost"]["mode"] += (d["distance"] * mode_cost_km)
                        trace["risk"]["intel"] = max(trace["risk"]["intel"], intel["threat"])
                        total_time += (d["baseline_time"] + f_delay); total_delay += f_delay; total_cost += (d["distance"] * mode_cost_km)
                        if intel["threat"] > max_threat: max_threat, choke_point, choke_reason = intel["threat"], u, intel["news"]
                        legs.append({"to": v, "to_name": self.network.nodes[v].get("display_name", v), "mode": mode.upper(), "distance": d["distance"], "baseline_time": round(d["baseline_time"], 1), "delay_buffer": f_delay, "threat_level": round(intel["threat"], 2), "reason": intel["news"], "intel_source": intel["source"]})

                    if res_d_data.get("transfer"):
                        t = res_d_data["transfer"]
                        fee, rate, min_h = get_transfer_cost(res_d)
                        c = fee + (t["distance"] * rate)
                        legs.append(t)
                        trace["eta"]["transfer"] += max(min_h, t["baseline_time"])
                        trace["eta"]["buffer"] += t["p85_buffer"]
                        trace["cost"]["transfer"] += c
                        total_time += (max(min_h, t["baseline_time"]) + t["p85_buffer"]); total_delay += t["p85_buffer"]; total_cost += c

                    if total_delay > max_delay or total_cost > cost_ceiling: continue

                    candidates.append({"primary_mode": mode.upper(), "legs": legs, "adjusted_eta": round(total_time, 2), "worst_case_delay": round(total_delay, 2), "total_cost": round(total_cost, 2), "threat_level": round(max_threat, 2), "critical_choke_point": choke_point, "choke_reason": choke_reason, "persona": persona, "path_tuple": tuple(path), "audit_trace": trace, "override_applied": has_strategic_overrides})
                
                except nx.NetworkXNoPath:
                    mode_failures[mode] = f"Graph disconnected: No path between {res_s} and {res_d}."
                except Exception as e:
                    mode_failures[mode] = f"Internal routing failure: {str(e)}"

            if mode not in mode_failures and not any(c["primary_mode"] == mode.upper() for c in candidates):
                mode_failures[mode] = f"Constraint Violation: Found potential routes, but all exceeded Strategic { 'Cost' if total_cost > cost_ceiling else 'Delay' } Ceiling."

        if not candidates: return {"error": "No valid route established.", "details": mode_failures}

        final_results = []
        seen_paths = set()
        
        # 1. FASTEST
        fastest_cands = sorted([c for c in candidates if c["persona"] == "FASTEST"], key=lambda x: x["adjusted_eta"])
        if fastest_cands:
            f = fastest_cands[0].copy()
            seen_paths.add(f["path_tuple"])
            f.update({"rank": 1, "explanation": self._generate_persona_explanation("FASTEST", f["path_tuple"], f["threat_level"], f["adjusted_eta"], f["total_cost"], active_scenario["name"] if active_scenario else None, f["critical_choke_point"])})
            del f["path_tuple"]
            final_results.append(f)
            
        # 2. SAFEST
        safest_cands = sorted([c for c in candidates if c["persona"] == "SAFEST"], key=lambda x: (x["threat_level"], x["adjusted_eta"]))
        for s in safest_cands:
            if s["path_tuple"] not in seen_paths:
                sf = s.copy()
                seen_paths.add(sf["path_tuple"])
                sf.update({"rank": len(final_results) + 1, "explanation": self._generate_persona_explanation("SAFEST", sf["path_tuple"], sf["threat_level"], sf["adjusted_eta"], sf["total_cost"], active_scenario["name"] if active_scenario else None, sf["critical_choke_point"])})
                del sf["path_tuple"]
                final_results.append(sf)
                break
                
        # 3. BALANCED
        balanced_cands = sorted([c for c in candidates if c["persona"] == "BALANCED"], key=lambda x: (x["total_cost"], x["adjusted_eta"]))
        for b in balanced_cands:
            if b["path_tuple"] not in seen_paths:
                bf = b.copy()
                seen_paths.add(bf["path_tuple"])
                bf.update({"rank": len(final_results) + 1, "explanation": self._generate_persona_explanation("BALANCED", bf["path_tuple"], bf["threat_level"], bf["adjusted_eta"], bf["total_cost"], active_scenario["name"] if active_scenario else None, bf["critical_choke_point"])})
                del bf["path_tuple"]
                final_results.append(bf)
                break

        # Post-process for Delta Justifications
        for res in final_results:
            other_results = [r for r in final_results if r["persona"] != res["persona"]]
            deltas = []
            if other_results:
                comp = other_results[0]
                eta_delta = comp["adjusted_eta"] - res["adjusted_eta"]
                cost_delta = comp["total_cost"] - res["total_cost"]
                risk_delta = (comp["threat_level"] - res["threat_level"]) * 100
                if res["persona"] == "FASTEST": deltas.append(f"Saves {abs(eta_delta):.1f}h vs {comp['persona'].replace('SAFEST','RESILIENCE').replace('BALANCED','ECONOMIC')}")
                elif res["persona"] == "SAFEST": deltas.append(f"Reduces disruption exposure by {abs(risk_delta):.0f}%")
                elif res["persona"] == "BALANCED": deltas.append(f"Reduces cost by ${abs(cost_delta):.2f} vs VELOCITY")
            res["delta_justification"] = " | ".join(deltas)
            res["explanation"] = f"{res['delta_justification']}. {res['explanation']}" if deltas else res["explanation"]
        
        return {"origin": source, "destination": destination, "active_scenario": active_scenario["name"] if active_scenario else None, "recommendations": final_results[:3]}

    def _generate_persona_explanation(self, persona: str, path: tuple, max_threat: float, total_time: float, total_cost: float, scenario: str, choke_point: str) -> str:
        if persona == "FASTEST":
            if choke_point and max_threat > 0.6: return f"Prioritizes velocity via primary corridor. Accepts elevated risk at {choke_point} to minimize total ETA."
            return "Optimized purely for minimum ETA. Recommended for urgent freight with high risk tolerance."
        elif persona == "SAFEST":
            if scenario: return f"Actively avoids high-threat zones to mitigate {scenario} volatility. Prefers stable corridor."
            return "Optimizes for maximum resilience. Bypasses volatile nodes for highly reliable lead times."
        elif persona == "BALANCED":
            return f"Economic optimization. Blends operational stability with cost efficiency, avoiding excessive transfer overhead."
