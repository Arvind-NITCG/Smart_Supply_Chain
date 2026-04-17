# Supplychainer: Context-Aware Agentic Routing Engine

> **An NLP-driven Risk Assessment API for Dynamic Supply Chain Graph Routing.**

Traditional supply chain routing algorithms (like Dijkstra or A*) rely on static distances. But in the real world, supply chains are disrupted by dynamic **Black Swan events**—hurricanes, worker strikes, and geopolitical blockades. 

**Supplychainer** is an Agentic AI microservice that intercepts route requests, reads live global news along the path, applies logical context filters, and mathematically calculates the **85th-percentile worst-case delay**. This dynamic risk weight is then fed back to the routing graph to autonomously steer logistics away from danger.

---

## The Architecture Pipeline

Our system decouples sensory data from mathematical risk using a 4-stage pipeline:

1. **The Targeted Fetch:** The routing algorithm requests a path (e.g., Shanghai to Rotterdam). The API evaluates the Origin, Destination, and dynamic Choke Points.
2. **The Sensory Brain (Contrastive NLP):** We utilize a `SentenceTransformer` (`all-MiniLM-L6-v2`) with **Contrastive Semantic Anchoring**. It reads live news texts, splits them via semantic chunking, and calculates a pure "Threat Margin" against a multi-domain matrix of Disasters vs. Safe baseline scenarios.
3. **The Logic Gate - CARF System:** The **Context-Aware Relevance Filter (CARF)** prevents hallucinated delays. If the news reports a *sinking ship*, but the transport mode is an *EV Delivery Van*, CARF zeroes out the threat. It ensures spatial and modal relevance.
4. **The Decision Brain - Quantile ML:** The context-filtered NLP score, combined with tabular operational data (weather conditions, transport modes), is fed into a **Gradient Boosting Regressor**. We use a `Quantile Loss` function (alpha=0.85) to predict the worst-case scenario buffer, not just the mean delay.

---

## How to Run Locally

The ML model (`risk_model.pkl`) and categorical encoders (`label_encoders.pkl`) are pre-trained and included in this repository. You **do not** need the proprietary CSV dataset to run the API.

### 1. Install Dependencies
Make sure you have Python installed, then run:
```bash
pip install fastapi uvicorn pydantic scikit-learn pandas xgboost sentence-transformers torch joblib
```
### 2. Boot the API Server
Start the FastAPI backend:
```bash
uvicorn api:app --reload
```
The first boot may take 10-20 seconds to load the HuggingFace transformer weights into memory.
### 3. Test the Endpoints
Open your browser and navigate to the auto-generated Swagger UI:
http://127.0.0.1:8000/docs

### API Usage For the Heuristics Team
Endpoint: POST /predict_route_risk
The Dijkstra algorithm must ping this endpoint for every leg it considers in the graph.
**Example Payload:**
```json
{
  "Leg_Type": "Global_Freight",
  "Origin_Node": "Shanghai",
  "Destination_Node": "Rotterdam",
  "Transport_Mode": "Sea",
  "Condition_Flag": "Clear",
  "Live_News_Feed": {
    "Shanghai": "Port operations are completely normal. Clear skies and routine loading.",
    "Strait of Malacca": "A massive global worker strike has completely shut down the shipping logistics network.",
    "Rotterdam": "Perfect weather conditions. Routine deliveries are arriving right on time."
  }
}
```
**Example Response:**
Because the CARF system detects a maritime threat : worker strike shutting down shipping and the mode is "Sea", the API calculates a massive penalty weight to block the route:
```json
{
  "status": "success",
  "route_max_threat_score": 1.0,
  "predicted_worst_case_delay_hours": 3650.35,
  "threat_logs": { ... },
  "message": "Dynamic risk weight calculated successfully."
}
```
If the Transport_Mode was changed to Air in the exact same payload, the API would return a safe operational delay (e.g., 2.4 hours), as planes are unaffected by maritime shipping strikes.

### Built With
- FastAPI
- Scikit-Learn / Gradient Boosting 
- HuggingFace Sentence-Transformers
- Pandas & NumPy

In association with Unique Coders.
