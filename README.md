# Supplychainer: Context-Aware Agentic Routing Engine

> **An NLP-driven Risk Assessment API & Executive Command Dashboard for Dynamic Supply Chain Graph Routing.**

Traditional supply chain routing algorithms (like Dijkstra or A*) rely on static distances. But in the real world, supply chains are disrupted by dynamic **Black Swan events**—hurricanes, worker strikes, and geopolitical blockades. 

**Supplychainer** is a dual-component platform:
1. **Agentic AI Backend**: Intercepts route requests, reads live global news along the path, applies logical context filters, and mathematically calculates the **85th-percentile worst-case delay**.
2. **Executive Command Dashboard**: A high-performance, multimodal React frontend to visualize risks, trigger live simulations (like a Suez blockage), and perform comparative intelligence auditing.

---

## 🚀 Key Features

* **Real-time Threat Intelligence**: Monitors global RSS feeds to detect local disruptions before they trap inventory.
* **Context-Aware Relevance Filter (CARF)**: Eliminates false positives (e.g., ignoring a seaport strike if the transport mode is Rail).
* **Quantile ML Risk Assessment**: Uses a Gradient Boosting Regressor trained on 50,000+ real-world historical incidents to predict the **worst-case p85 scenario buffer**, not just the mean delay.
* **Executive Dashboard**: A visually stunning 3-column command interface featuring real-time tradeoff strips, operational configuration drop-downs, and forensic audit trails.

---

## 🧠 The Architecture Pipeline

Our system decouples sensory data from mathematical risk using a 4-stage pipeline:

1. **The Targeted Fetch:** The routing algorithm requests a path (e.g., Shanghai to Rotterdam). The API evaluates the Origin, Destination, and dynamic Choke Points.
2. **The Sensory Brain (Contrastive NLP):** We utilize a `SentenceTransformer` (`all-MiniLM-L6-v2`) with **Contrastive Semantic Anchoring**. It reads live news texts, splits them via semantic chunking, and calculates a pure "Threat Margin" against a multi-domain matrix of Disasters vs. Safe baseline scenarios.
3. **The Logic Gate - CARF System:** The **CARF** prevents hallucinated delays. If the news reports a *sinking ship*, but the transport mode is an *EV Delivery Van*, CARF zeroes out the threat. It ensures spatial and modal relevance.
4. **The Decision Brain - Quantile ML:** The context-filtered NLP score, combined with tabular operational data, is fed into a **Gradient Boosting Regressor**. We use a `Quantile Loss` function (alpha=0.85) to predict the worst-case scenario buffer.

---

## 📊 Decision Superiority Benchmarks

Supplychainer shifts logistics from geometric shortest paths to optimal business decisions:
* **Suez Canal Failure**: Reroutes automatically via Cape of Good Hope, avoiding infinite delay backlogs.
* **Air vs. Sea Economics**: Shifts high-value cargo to Air when the p85 risk of Sea transit (and inventory carry cost) outweighs the freight premium.
* **Zero Latency Scaling**: With our static + dynamic risk overlay, multimodal routing latency dropped by **86%** (from 15s to ~2s per request).

---

## 🛠️ How to Run Locally

### 1. Backend Service (FastAPI)

The ML model (`risk_model.pkl`) and categorical encoders (`label_encoders.pkl`) are pre-trained and included. You **do not** need the proprietary CSV dataset to run the API.

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload
```
*The first boot may take 10-20 seconds to load the HuggingFace transformer weights into memory. API Docs available at `http://127.0.0.1:8000/docs`.*

### 2. Executive Frontend (React/Vite)

```bash
cd frontend
npm install
npm run dev
```
*Access the dashboard at `http://localhost:5173` (or the port specified by Vite).*

---

## 📡 API Usage Example (For Heuristics / Integration)

**Endpoint:** `POST /predict_route_risk`
*(Dijkstra algorithm pings this for every considered leg)*

**Payload:**
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

**Response:**
```json
{
  "status": "success",
  "route_max_threat_score": 1.0,
  "predicted_worst_case_delay_hours": 3650.35,
  "threat_logs": { ... },
  "message": "Dynamic risk weight calculated successfully."
}
```

---

## 💻 Tech Stack

* **Frontend**: React, Vite, Vanilla CSS (Executive Dark-Mode Aesthetic)
* **Backend**: FastAPI, Python, Uvicorn
* **Machine Learning**: Scikit-Learn (Gradient Boosting with Quantile Loss)
* **NLP**: HuggingFace Sentence-Transformers
* **Data Ops**: Pandas, NumPy, NetworkX

*In association with Unique Coders.*
