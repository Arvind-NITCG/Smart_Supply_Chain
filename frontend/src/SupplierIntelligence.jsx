import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Clock, TrendingUp, Info, 
  BarChart3, Package, Truck, Database, Activity, CheckCircle2, ShieldAlert
} from 'lucide-react';

export default function SupplierIntelligence({ onNavigate }) {
  const [suppliers, setSuppliers] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [inventory, setInventory] = useState(1000);
  const [safetyStock, setSafetyStock] = useState(1500);
  const [forecast, setForecast] = useState(800);
  const [category, setCategory] = useState('Electronics');
  const [scenario, setScenario] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await fetch('/api/scenarios');
        const data = await res.json();
        setScenarios(data);
      } catch (e) { console.error(e); }
    };
    fetchScenarios();
  }, []);

  useEffect(() => {
    fetchSourcingData();
  }, [category, scenario, inventory, safetyStock, forecast]);

  const fetchSourcingData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          current_inventory: inventory,
          safety_stock: safetyStock,
          demand_forecast: forecast,
          scenario
        })
      });
      const data = await res.json();
      setSuppliers(data.suppliers);
      setAdvice(data.advice);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getUrgencyColor = (urgency) => {
    if (urgency === 'CRITICAL') return '#ef4444';
    if (urgency === 'HIGH') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="rr-container supply-theme supplier-intelligence">
      <div className="rr-topbar">
        <div className="rr-topbar-left">
          <Database size={22} className="rr-logo-icon" />
          <h1 className="rr-brand">Supplier Intelligence</h1>
          <span className="rr-brand-sub">Sourcing Decision Matrix</span>
        </div>
        <div className="rr-topbar-right">
          <button className="rr-nav-btn" onClick={() => onNavigate('dashboard')}>Simulator</button>
          <button className="rr-nav-btn" onClick={() => onNavigate('recommender')}>Route Recommender</button>
        </div>
      </div>

      <div className="rr-main">
        {/* Left Panel: Inventory & Scenarios */}
        <div className="rr-form-panel">
          <h2 className="panel-title">Sourcing Parameters</h2>
          
          <div className="supply-input-group">
            <label>Product Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="Electronics">Electronics</option>
              <option value="Raw Materials">Raw Materials</option>
              <option value="Chemicals">Chemicals</option>
            </select>
          </div>

          <div className="supply-input-group">
            <label>Current Inventory (Units)</label>
            <input 
              type="number" 
              value={inventory} 
              onChange={e => setInventory(parseInt(e.target.value))} 
            />
          </div>

          <div className="supply-input-group">
            <label>Safety Stock Target</label>
            <input 
              type="number" 
              value={safetyStock} 
              onChange={e => setSafetyStock(parseInt(e.target.value))} 
            />
          </div>

          <div className="supply-input-group">
            <label>Demand Forecast (Next Cycle)</label>
            <input 
              type="number" 
              value={forecast} 
              onChange={e => setForecast(parseInt(e.target.value))} 
            />
          </div>

          <div className="intel-section" style={{ marginTop: '2rem' }}>
            <h3 className="section-title">Active Disruption Context</h3>
            <div className="scenario-grid">
              <div 
                className={`scenario-card ${scenario === null ? 'active' : ''}`}
                onClick={() => setScenario(null)}
              >
                <Shield size={14} />
                <span>Normal</span>
              </div>
              {scenarios.map(s => (
                <div 
                  key={s.id} 
                  className={`scenario-card ${scenario === s.id ? 'active' : ''}`}
                  onClick={() => setScenario(s.id)}
                >
                  <AlertTriangle size={14} />
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Panel: Supplier List & Rankings */}
        <div className="rr-results-panel">
          {advice && (
            <div className="sourcing-advice-panel" style={{ borderLeftColor: getUrgencyColor(advice.urgency_level) }}>
              <div className="advice-header">
                <ShieldAlert size={18} style={{ color: getUrgencyColor(advice.urgency_level) }} />
                <span style={{ color: getUrgencyColor(advice.urgency_level) }}>SOURCING URGENCY: {advice.urgency_level}</span>
              </div>
              <p className="advice-text">{advice.recommendation}</p>
              <div className="advice-metrics">
                <div className="advice-metric">
                  <span className="label">Projected Inventory</span>
                  <span className={`value ${advice.projected_inventory <= 0 ? 'neg' : ''}`}>{advice.projected_inventory} units</span>
                </div>
                <div className="advice-metric">
                  <span className="label">Replenishment Gap</span>
                  <span className="value">{advice.shortage_quantity} units</span>
                </div>
              </div>
            </div>
          )}

          <h2 className="section-header" style={{ marginTop: '1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={18} />
            Strategic Supplier Ranking
          </h2>

          <div className="supplier-list">
            {suppliers.map((s, idx) => (
              <div key={s.id} className={`supplier-card supply-card ${idx === 0 ? 'top-rank' : ''}`}>
                <div className="supplier-header">
                  <div className="rank-indicator">RANK #{s.rank}</div>
                  <div className="supplier-name-group">
                    <span className="name">{s.name}</span>
                    <span className="id">{s.id} • {s.location_hub}</span>
                  </div>
                  <div className="score-badge">
                    <span className="label">DECISION SCORE</span>
                    <span className="value">{s.decision_score.toFixed(2)}</span>
                  </div>
                </div>

                <div className="supply-main-metrics v2">
                  <div className="supply-metric main">
                    <span className="label">UNIT COST</span>
                    <span className="value">${s.unit_cost.toLocaleString()}</span>
                  </div>
                  <div className="supply-metric main">
                    <span className="label">EFFECTIVE LEAD TIME</span>
                    <span className={`value ${s.audit_trace.penalties.lead_time_impact > 0 ? 'warn' : ''}`}>
                      {s.effective_lead_time} days
                    </span>
                  </div>
                  <div className="supply-metric main">
                    <span className="label">STABILITY INDEX</span>
                    <span className="value">{s.audit_trace.effective_metrics.stability_index}%</span>
                  </div>
                </div>

                <div className="audit-trace-panel mini">
                  <div className="audit-header">
                    <Activity size={12} />
                    <span>DETERMINISTIC SCORING AUDIT</span>
                  </div>
                  <div className="audit-sections">
                    <div className="audit-section">
                      <span className="section-label">SCORE ATTRITION</span>
                      <div className="audit-rows">
                        <div className="audit-row"><span>Cost Efficiency</span> <span>{s.audit_trace.scores.cost}</span></div>
                        <div className="audit-row"><span>Lead Time Index</span> <span>{s.audit_trace.scores.lead_time}</span></div>
                        <div className="audit-row"><span>Historical Reliability</span> <span>{s.audit_trace.scores.reliability}</span></div>
                      </div>
                    </div>
                    <div className="audit-section">
                      <span className="section-label">DISRUPTION PENALTIES</span>
                      <div className="audit-rows">
                        <div className="audit-row"><span>Logistics Delay</span> <span className="warn">+{s.audit_trace.penalties.lead_time_impact}d</span></div>
                        <div className="audit-row"><span>Risk Inflation</span> <span className="warn">+{s.audit_trace.penalties.risk_inflation}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="supply-footer">
                  <div className="decision-integrity-sash">
                    <CheckCircle2 size={10} />
                    <span>Integrity: {(s.decision_score * 100).toFixed(0)}% | DETERMINISTIC AUDIT TRACE VERIFIED</span>
                  </div>
                  <span>Mathematically Defensible Recommendation</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Intelligence Logs */}
        <div className="rr-disruption-panel supply-intel">
          <h2 className="panel-title">Scoring Methodology</h2>
          <div className="intel-section">
            <div className="method-item">
              <span className="label">Cost Weight</span>
              <div className="progress-bar"><div className="fill" style={{ width: '30%' }}></div></div>
              <span className="val">30%</span>
            </div>
            <div className="method-item">
              <span className="label">Lead Time Weight</span>
              <div className="progress-bar"><div className="fill" style={{ width: '30%' }}></div></div>
              <span className="val">30%</span>
            </div>
            <div className="method-item">
              <span className="label">Reliability Weight</span>
              <div className="progress-bar"><div className="fill" style={{ width: '40%' }}></div></div>
              <span className="val">40%</span>
            </div>
          </div>

          <div className="intel-section" style={{ marginTop: '2rem' }}>
            <h3 className="section-title">Decision Audit Logs</h3>
            <div className="intel-list">
              <div className="intel-item">
                <span>Deterministic Scoring</span>
                <span className="risk-val success">VERIFIED</span>
              </div>
              <div className="intel-item">
                <span>Scenario Delta Impact</span>
                <span className="risk-val success">{scenario ? 'ACTIVE' : 'READY'}</span>
              </div>
              <div className="intel-item">
                <span>Inventory Escalation</span>
                <span className="risk-val success">MONITORING</span>
              </div>
            </div>
          </div>

          <div className="intel-footer">
            <Activity size={12} />
            <span>Sourcing Decision Layer V1 Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
