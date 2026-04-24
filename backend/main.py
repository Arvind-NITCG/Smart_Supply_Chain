from fastapi import FastAPI, WebSocket
import asyncio
import json
import random
from contextlib import asynccontextmanager

from .engine.graph_model import create_logistics_network
from .engine.simulator import LogisticsSimulator
from .engine.ml_predictor import DelayPredictor
from .engine.optimizer import RouteOptimizer
from .engine.baseline import BaselineRouter

# Global Engine State
network = create_logistics_network()
simulator = LogisticsSimulator(network)
predictor = DelayPredictor()
baseline = BaselineRouter(network)
optimizer = RouteOptimizer(network, predictor, simulator)

class PreTrainingTask:
    is_running = False
    is_done = False

async def run_pre_training_async():
    PreTrainingTask.is_running = True
    print("Running background pre-training...")
    nodes = list(network.nodes())
    for _ in range(1500):
        if random.random() < 0.5:
            src = random.choice(nodes)
            dst = random.choice(nodes)
            if src != dst:
                route = baseline.get_route(src, dst)
                if route:
                    simulator.dispatch_truck(src, dst, route["route"])
        simulator.step()
        await asyncio.sleep(0.0) # Yield control
        
    df = simulator.get_trip_dataframe()
    if len(df['is_delayed'].unique()) == 1:
        # Force a tiny bit of variance for the demo
        if len(df) > 5:
            df.loc[0, 'is_delayed'] = 1 - df.loc[0, 'is_delayed']
            df.loc[1, 'is_delayed'] = 1 - df.loc[1, 'is_delayed']
            
    predictor.train(df)
    PreTrainingTask.is_running = False
    PreTrainingTask.is_done = True
    print("Pre-training complete.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    asyncio.create_task(run_pre_training_async())
    yield
    # Shutdown logic

app = FastAPI(title="Smart Supply Chain API", lifespan=lifespan)

@app.get("/api/network")
def get_network():
    nodes = []
    for n, data in network.nodes(data=True):
        nodes.append({"id": n, "region": data.get("region"), "capacity": data.get("warehouse_capacity")})
    
    edges = []
    for u, v, data in network.edges(data=True):
        edges.append({"source": u, "target": v, "baseline_time": data.get("baseline_time")})
        
    return {"nodes": nodes, "edges": edges}

@app.get("/api/status")
def get_status():
    return {
        "ml_trained": predictor.is_trained,
        "pre_training_running": PreTrainingTask.is_running,
        "active_trips": len(simulator.active_trips),
        "tick": simulator.time_tick
    }

@app.post("/api/dispatch")
def dispatch_optimized_truck():
    if not predictor.is_trained:
        return {"status": "error", "message": "ML Model not trained yet."}
        
    nodes = list(network.nodes())
    src = random.choice(nodes)
    dst = random.choice(nodes)
    while src == dst:
        dst = random.choice(nodes)
        
    decision = optimizer.get_optimized_route(src, dst)
    if decision:
        simulator.dispatch_truck(src, dst, decision["optimized_route"])
        return {"status": "dispatched", "decision": decision}
    return {"status": "error", "message": "No route found"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Advance simulation 1 tick per real-time second
            simulator.step()
            
            state = {
                "tick": simulator.time_tick,
                "active_trips": simulator.active_trips,
                "ml_trained": predictor.is_trained,
                "weather_states": [{"edge": [u,v], "severity": s} for (u,v), s in simulator.weather_states.items() if s > 0.1],
                "traffic_states": [{"edge": [u,v], "severity": s} for (u,v), s in simulator.traffic_states.items() if s > 0.2],
                "backlog_states": [{"node": n, "severity": s} for n, s in simulator.backlog_states.items() if s > 0.2],
            }
            await websocket.send_text(json.dumps(state))
            await asyncio.sleep(1.0)
    except Exception as e:
        print(f"WebSocket closed: {e}")
