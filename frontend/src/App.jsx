import React, { useState, useEffect } from 'react';

export default function App() {
  const [network, setNetwork] = useState({ nodes: [], edges: [] });
  const [status, setStatus] = useState(null);
  const [decisions, setDecisions] = useState([]);
  
  useEffect(() => {
    fetch('/api/network')
      .then(r => r.json())
      .then(data => setNetwork(data))
      .catch(e => console.error(e));
      
    // Connect to websocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const state = JSON.parse(event.data);
      setStatus(state);
    };
    
    return () => ws.close();
  }, []);

  const handleDispatch = async () => {
    try {
      const res = await fetch('/api/dispatch', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'dispatched') {
        setDecisions(prev => [data.decision, ...prev].slice(0, 10));
      } else {
        alert(data.message || 'Error dispatching');
      }
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div className="dashboard-container">
      {/* LEFT PANEL - METRICS & CONTROL */}
      <div className="panel">
        <h2 className="panel-title">Engine Status</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <div style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>Tick (Hours)</div>
            <div className="metric-value">{status?.tick || 0}</div>
          </div>
          <div className="metric-card">
            <div style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>Active Trucks</div>
            <div className="metric-value">{status?.active_trips?.length || 0}</div>
          </div>
          <div className="metric-card">
            <div style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>ML Layer</div>
            <div className="metric-value" style={{fontSize: '1rem', color: status?.ml_trained ? 'var(--accent-green)' : 'var(--accent-red)'}}>
              {status?.ml_trained ? 'Trained (RF)' : 'Training...'}
            </div>
          </div>
          <div className="metric-card">
            <div style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>Reroutes</div>
            <div className="metric-value">{decisions.filter(d => d.is_rerouted).length} / {decisions.length}</div>
          </div>
        </div>
        
        <div style={{marginTop: 'auto'}}>
          <button 
            className="dispatch-btn" 
            onClick={handleDispatch}
            disabled={!status?.ml_trained}
          >
            {status?.ml_trained ? 'Dispatch Optimized Truck' : 'Waiting for Pre-training...'}
          </button>
        </div>
      </div>

      {/* CENTER PANEL - NETWORK MAP */}
      <div className="panel" style={{padding: 0, overflow: 'hidden'}}>
        <div className="map-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
           {/* Placeholder for actual node graph drawing */}
           <div style={{textAlign: 'center', color: 'var(--text-muted)'}}>
             <h3 style={{color: 'white', marginBottom: '1rem'}}>Logistics Network Core</h3>
             <p>Tracking {network.nodes.length} Regional Nodes</p>
             <p>{network.edges.length} Active Transit Routes</p>
             <div style={{marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center'}}>
                {status?.weather_states?.length > 0 && <span style={{color: 'var(--accent-red)'}}>Severe Weather: {status.weather_states.length} zones</span>}
                {status?.traffic_states?.length > 0 && <span style={{color: 'var(--accent-orange)'}}>Traffic Delay: {status.traffic_states.length} zones</span>}
             </div>
           </div>
        </div>
      </div>

      {/* RIGHT PANEL - DECISION LOGS */}
      <div className="panel">
        <h2 className="panel-title">Algorithmic Decisions</h2>
        <div className="log-feed">
          {decisions.length === 0 && <div style={{color: 'var(--text-muted)', fontSize: '0.875rem'}}>No recent dispatches.</div>}
          {decisions.map((dec, i) => (
            <div key={i} className={`decision-card ${dec.is_rerouted ? 'rerouted' : ''}`}>
              <div className="decision-header">
                <span>{dec.optimized_route[0]} → {dec.optimized_route[dec.optimized_route.length-1]}</span>
                <span style={{color: dec.is_rerouted ? 'var(--accent-orange)' : 'var(--accent-green)'}}>
                  {dec.is_rerouted ? 'REROUTED' : 'OPTIMAL'}
                </span>
              </div>
              <div className="decision-body">
                <div>{dec.justification}</div>
                <div style={{marginTop: '0.5rem', opacity: 0.8}}>Risk Prob: {(dec.avg_risk_probability * 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
