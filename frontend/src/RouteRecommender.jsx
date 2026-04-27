import React, { useState, useEffect, useRef } from 'react';
import {
  Truck, Train, Plane, Ship, Package, AlertTriangle, Shield, Clock,
  Zap, BarChart3, Navigation, Loader2, Info, Lock, Globe, ShieldAlert,
  Database, Activity, Search, MapPin, ShieldCheck, CheckCircle2, TrendingUp
} from 'lucide-react';

const MODE_ICONS = {
  road: Truck,
  rail: Train,
  air: Plane,
  sea: Ship
};

const MODE_COLORS = {
  road: '#6b7280',
  rail: '#8b5cf6',
  air: '#3b82f6',
  sea: '#06b6d4'
};

const BADGE_COLORS = {
  'BEST': '#10b981',
  'SAFE': '#3b82f6',
  'LOW COST': '#f59e0b',
  'ALTERNATIVE': '#6b7280'
};

function HubSelector({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hubs/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data);
        setIsOpen(true);
      } catch (e) { console.error(e); }
      setLoading(false);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Find current hub display name if value exists
  const selectedHub = value;

  return (
    <div className="supply-input-group hub-selector" ref={containerRef}>
      <label>{label}</label>
      <div className="hub-input-wrapper">
        <Search size={14} className="search-icon" />
        <input 
          type="text" 
          value={value ? (suggestions.find(h => h.id === value)?.display_name || value) : query}
          placeholder={placeholder}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(''); // Clear selection on type
          }} 
        />
        {loading && <Loader2 size={14} className="spinner" />}
      </div>
      
      {isOpen && suggestions.length > 0 && (
        <div className="hub-dropdown">
          {suggestions.map(hub => (
            <div 
              key={hub.id} 
              className="hub-option"
              onClick={() => {
                onChange(hub.id);
                setQuery('');
                setIsOpen(false);
              }}
            >
              <div className="hub-option-main">
                <MapPin size={12} />
                <span className="hub-name">{hub.display_name}</span>
                <span className="hub-id">[{hub.id}]</span>
              </div>
              <div className="hub-option-sub">
                {hub.type.toUpperCase()} • {hub.country}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTracePanel({ trace }) {
  return (
    <div className="audit-trace-panel">
      <div className="audit-header">
        <Activity size={14} />
        <span>STRATEGIC AUDIT TRACE</span>
      </div>
      <div className="audit-sections">
        <div className="audit-section">
          <span className="section-label">ETA COMPOSITION</span>
          <div className="audit-rows">
            <div className="audit-row"><span>Base Transit</span> <span>{trace.eta.base.toFixed(1)}h</span></div>
            <div className="audit-row"><span>Delay Buffers</span> <span>{trace.eta.buffer.toFixed(1)}h</span></div>
            <div className="audit-row"><span>Scenario Delay</span> <span className="warn">{trace.eta.scenario.toFixed(1)}h</span></div>
            <div className="audit-row"><span>Transfer Handling</span> <span>{trace.eta.transfer.toFixed(1)}h</span></div>
          </div>
        </div>
        <div className="audit-section">
          <span className="section-label">COST COMPOSITION</span>
          <div className="audit-rows">
            <div className="audit-row"><span>Mode Cost</span> <span>${trace.cost.mode.toLocaleString()}</span></div>
            <div className="audit-row"><span>Transfer Cost</span> <span>${trace.cost.transfer.toLocaleString()}</span></div>
            <div className="audit-row"><span>Scenario Premium</span> <span className="warn">${trace.cost.scenario.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="audit-section">
          <span className="section-label">RISK ATTRITION</span>
          <div className="audit-rows">
            <div className="audit-row"><span>Historical Baseline</span> <span>{(trace.risk.historical * 100).toFixed(0)}%</span></div>
            <div className="audit-row"><span>Threat Intelligence</span> <span>{(trace.risk.intel * 100).toFixed(0)}%</span></div>
            <div className="audit-row"><span>Scenario Injection</span> <span className="warn">{(trace.risk.scenario * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeoffStrip({ fromRoute, toRoute }) {
  const fromName = fromRoute.persona === 'FASTEST' ? 'VELOCITY' : (fromRoute.persona === 'SAFEST' ? 'RESILIENCE' : 'ECONOMIC');
  const toName = toRoute.persona === 'FASTEST' ? 'VELOCITY' : (toRoute.persona === 'SAFEST' ? 'RESILIENCE' : 'ECONOMIC');
  
  const etaDiff = toRoute.adjusted_eta - fromRoute.adjusted_eta;
  const costDiff = toRoute.total_cost - fromRoute.total_cost;
  const riskDiff = (toRoute.threat_level - fromRoute.threat_level) * 100;

  return (
    <div className="tradeoff-strip">
      <div className="tradeoff-label">{fromName} vs {toName}</div>
      <div className="tradeoff-metrics">
        <div className={`tradeoff-item ${etaDiff > 0 ? 'pos' : 'neg'}`}>
          {etaDiff > 0 ? '+' : ''}{etaDiff.toFixed(1)}h ETA
        </div>
        <div className={`tradeoff-item ${costDiff > 0 ? 'pos' : 'neg'}`}>
          {costDiff > 0 ? '+' : ''}${Math.abs(costDiff).toLocaleString()} Cost
        </div>
        <div className={`tradeoff-item ${riskDiff > 0 ? 'pos' : 'neg'}`}>
          {riskDiff > 0 ? '+' : ''}{riskDiff.toFixed(0)}% Volatility
        </div>
      </div>
    </div>
  );
}

function DisruptionImpactPanel({ current, baseline }) {
  const delayInjected = current.adjusted_eta - baseline.eta;
  const costDelta = current.total_cost - baseline.cost;
  const riskDelta = (current.threat_level - baseline.threat) * 100;

  return (
    <div className="disruption-impact-panel">
      <div className="impact-header">
        <AlertTriangle size={14} />
        <span>SCENARIO IMPACT ANALYSIS</span>
      </div>
      <div className="impact-grid">
        <div className="impact-box">
          <span className="label">NORMAL ETA</span>
          <span className="value">{baseline.eta}h</span>
        </div>
        <div className="impact-box highlight">
          <span className="label">DELAY INJECTED</span>
          <span className="value">+{delayInjected.toFixed(1)}h</span>
        </div>
        <div className="impact-box">
          <span className="label">COST DELTA</span>
          <span className="value">+${costDelta.toLocaleString()}</span>
        </div>
        <div className="impact-box">
          <span className="label">RISK DELTA</span>
          <span className="value">+{riskDelta.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function LegItem({ leg, isChoke, isLast }) {
  const ModeIcon = leg.type === 'transfer' ? Navigation : (MODE_ICONS[leg.mode?.toLowerCase()] || Truck);
  const modeColor = leg.type === 'transfer' ? '#f59e0b' : (MODE_COLORS[leg.mode?.toLowerCase()] || '#6b7280');
  const isTransfer = leg.type === 'transfer';
  const isLive = leg.intel_source === 'LIVE';

  return (
    <div className={`leg-item ${isTransfer ? 'transfer' : ''}`}>
      <div className="leg-indicator">
        <div className={`node-dot ${isChoke ? 'choke' : ''} ${isTransfer ? 'transfer' : ''}`} />
        {!isLast && <div className={`leg-line ${isTransfer ? 'dashed' : ''}`} />}
      </div>
      <div className="leg-content">
        <div className="leg-header">
          <div className="node-info">
            <span className="node-name">{leg.to_name}</span>
            <span className="node-id">{leg.to}</span>
          </div>
          <div className="leg-mode-badges">
            <div className="leg-mode-badge" style={{ color: modeColor, borderColor: modeColor + '33' }}>
              <ModeIcon size={10} />
              <span>{isTransfer ? 'TRANSFER' : leg.mode.toUpperCase()}</span>
            </div>
            {leg.intel_source && (
              <div className={`intel-badge ${isLive ? 'live' : 'prior'}`}>
                {isLive ? <Zap size={8} /> : <Database size={8} />}
                {isLive ? 'LIVE' : 'PRIOR'}
              </div>
            )}
          </div>
        </div>
        
        <div className="leg-metrics">
          <div className="leg-metric">
            <span className="label">Distance</span>
            <span className="value">{leg.distance} km</span>
          </div>
          <div className="leg-metric">
            <span className="label">Baseline</span>
            <span className="value">{leg.baseline_time}h</span>
          </div>
          <div className="leg-metric risk">
            <span className="label">p85 Buffer</span>
            <span className="value">+{leg.p85_buffer || leg.delay_buffer}h</span>
          </div>
        </div>

        <div className={`leg-reason ${(leg.threat_level > 0.4 || isTransfer) ? 'warn' : ''}`}>
          {leg.reason.length > 120 ? leg.reason.substring(0, 117) + '...' : leg.reason}
        </div>
      </div>
    </div>
  );
}

function RouteCard({ route }) {
  const [expanded, setExpanded] = useState(false);
  const ModeIcon = MODE_ICONS[route.primary_mode.toLowerCase()] || Truck;
  const modeColor = MODE_COLORS[route.primary_mode.toLowerCase()] || '#6b7280';
  
  const PERSONA_COLORS = {
    'FASTEST': '#3b82f6',
    'SAFEST': '#10b981',
    'BALANCED': '#f59e0b',
    'ALTERNATIVE': '#6b7280'
  };

  return (
    <div className={`rr-route-card supply-card ${route.rank === 1 ? 'rr-route-top' : ''}`} style={{ borderLeftColor: modeColor }}>
      <div className="rr-route-header">
        <div className="rr-route-rank" style={{ background: modeColor }}>
          #{route.rank}
        </div>
        <div className="rr-route-mode">
          <ModeIcon size={18} style={{ color: modeColor }} />
          <span style={{ color: modeColor, fontWeight: 700 }}>{route.primary_mode}</span>
        </div>
        <div className="persona-badge" style={{ background: PERSONA_COLORS[route.persona] + '22', color: PERSONA_COLORS[route.persona], borderColor: PERSONA_COLORS[route.persona] + '44' }}>
          {route.persona === 'FASTEST' && <Zap size={10} />}
          {route.persona === 'SAFEST' && <Shield size={10} />}
          {route.persona === 'BALANCED' && <BarChart3 size={10} />}
          <span>{route.persona === 'FASTEST' ? 'VELOCITY' : (route.persona === 'SAFEST' ? 'RESILIENCE' : 'ECONOMIC')} PRIORITY</span>
        </div>
        {route.choke_reason && (
          <div className="scenario-impacted-sash">
            SCENARIO IMPACTED
          </div>
        )}
        {route.override_applied && (
          <div className="override-applied-badge">
            <Lock size={10} />
            <span>COMMAND OVERRIDE ENFORCED</span>
          </div>
        )}
      </div>

      <div className="executive-summary">
        <p>{route.explanation}</p>
      </div>

      <div className="supply-main-metrics v2">
        <div className="supply-metric main">
          <span className="label">ADJUSTED ETA</span>
          <span className="value">{route.adjusted_eta}h</span>
        </div>
        <div className="supply-metric main">
          <span className="label">TOTAL COST</span>
          <span className="value">${route.total_cost.toLocaleString()}</span>
        </div>
        <div className="supply-metric main risk">
          <span className="label">OPERATIONAL VOLATILITY</span>
          <span className="value">{Math.max(3, (route.threat_level * 100)).toFixed(0)}%</span>
        </div>
      </div>

      {route.baseline_metrics && (
        <DisruptionImpactPanel current={route} baseline={route.baseline_metrics} />
      )}

      <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? (
          <>Hide Intelligence Chain <Info size={14} /></>
        ) : (
          <>Audit Transfer Integrity <Activity size={14} /></>
        )}
      </button>

      {expanded && (
        <div className="rr-intelligence-panel">
          {route.audit_trace && (
            <AuditTracePanel trace={route.audit_trace} />
          )}

          <div className="intelligence-title">
            <Navigation size={12} />
            <span>Intelligence Deep Dive</span>
          </div>

          <div className="leg-chain">
            {route.legs.map((leg, idx) => (
              <LegItem 
                key={idx} 
                leg={leg} 
                isChoke={leg.to === route.critical_choke_point}
                isLast={idx === route.legs.length - 1} 
              />
            ))}
          </div>

          {route.critical_choke_point && (
            <div className="choke-callout">
              <div className="choke-callout-header">
                <ShieldAlert size={14} />
                <span>Operational Choke Point: {route.critical_choke_point}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#fca5a5', lineHeight: 1.4 }}>
                Engine prioritized <strong>{route.critical_choke_point}</strong> for maximum risk attribution. 
                Reasoning: {route.choke_reason}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="supply-footer">
        <div className="decision-integrity-sash">
          <ShieldCheck size={10} />
          <span>Integrity: {Math.min(98, (100 - route.threat_level * 100)).toFixed(0)}% | DETERMINISTIC AUDIT TRACE VERIFIED</span>
        </div>
        <span>v6 Decision Superiority Layer</span>
      </div>
    </div>
  );
}

export default function RouteRecommender({ onNavigate }) {
  const [source, setSource] = useState(''); 
  const [destination, setDestination] = useState(''); 
  const [transportMode, setTransportMode] = useState('any');
  const [routingPolicy, setRoutingPolicy] = useState('STRICT');
  const [cargoType, setCargoType] = useState('general');
  const [priority, setPriority] = useState('normal');
  const [riskProfile, setRiskProfile] = useState('BALANCED');
  const [scenario, setScenario] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [overrides, setOverrides] = useState({
    avoid_chokepoints: [],
    max_delay: 24,
    cost_ceiling: 50000,
    forced_mode: ''
  });

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const res = await fetch('/api/scenarios');
        const data = await res.json();
        setScenarios(data);
      } catch (e) { console.error(e); }
    };
    fetchScenarios();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (e) => setStatus(JSON.parse(e.data));
    return () => ws.close();
  }, []);

  const handleSubmit = async () => {
    if (!source || !destination) {
      alert("Please select both source and destination hubs.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          source, 
          destination, 
          transport_preference: transportMode, 
          routing_policy: routingPolicy,
          cargo_type: cargoType, 
          priority,
          scenario,
          overrides
        })
      });
      const data = await res.json();
      if (data.error && !data.details) alert(data.error);
      else setResult(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="rr-container supply-theme">
      <div className="rr-topbar">
        <div className="rr-topbar-left">
          <Globe size={22} className="rr-logo-icon" />
          <h1 className="rr-brand">Supplychainer Dashboard</h1>
          <span className="rr-brand-sub">Decision Superiority Engine</span>
        </div>
        <div className="rr-topbar-right">
          {result?.active_scenario ? (
            <div className="rr-scenario-active-alert">
              <ShieldAlert size={16} />
              <div className="alert-content">
                <span className="alert-title">ACTIVE GLOBAL DISRUPTION</span>
                <span className="alert-subtitle">{result.active_scenario.toUpperCase()}</span>
              </div>
            </div>
          ) : (
            <button className="rr-nav-btn" onClick={() => onNavigate('dashboard')}>Simulator</button>
          )}
        </div>
      </div>

      {status && status.engine_status === 'WARMING RISK ENGINE' && (
        <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '0.85rem', fontWeight: 500 }}>
          <Activity size={16} />
          <span>Using calibrated operational priors — live intelligence engine warming</span>
        </div>
      )}

      <div className="rr-main">
        {/* Left Panel: Params */}
        <div className="rr-form-panel">
          <h2 className="panel-title">Strategic Decision Inputs</h2>
          
          <HubSelector 
            label="Origin Hub"
            value={source}
            onChange={setSource}
            placeholder="Search port, airport, or rail hub..."
          />

          <HubSelector 
            label="Destination Hub"
            value={destination}
            onChange={setDestination}
            placeholder="Search port, airport, or rail hub..."
          />

          <div className="supply-input-group">
            <label>Transport Mode</label>
            <select value={transportMode} onChange={e => setTransportMode(e.target.value)}>
              <option value="any">Any / Multimodal</option>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
              <option value="air">Air</option>
              <option value="sea">Sea</option>
            </select>
          </div>

          <div className="supply-input-group">
            <label>Routing Policy</label>
            <div className="supply-chips">
              <button 
                className={routingPolicy === 'STRICT' ? 'active' : ''} 
                onClick={() => setRoutingPolicy('STRICT')}
              >
                STRICT
              </button>
              <button 
                className={routingPolicy === 'PREFERRED' ? 'active' : ''} 
                onClick={() => setRoutingPolicy('PREFERRED')}
              >
                PREFERRED
              </button>
            </div>
          </div>

          <div className="supply-input-group">
            <label>Risk Tolerance Profile</label>
            <div className="risk-profile-selector">
              {['BALANCED', 'RESILIENT', 'AGILE'].map(p => (
                <button 
                  key={p}
                  className={`risk-btn ${riskProfile === p ? 'active' : ''}`}
                  onClick={() => setRiskProfile(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="input-hint">RESILIENT applies p95 historical worst-case buffers.</p>
          </div>

          <div className="supply-input-group">
            <label>Strategic Command Overrides</label>
            <div className="override-grid">
              <div className="override-item">
                <span>Avoid Node</span>
                <input 
                  type="text" 
                  placeholder="e.g. CHOKE-SUEZ"
                  onBlur={(e) => {
                    if (e.target.value) setOverrides({...overrides, avoid_chokepoints: [e.target.value]});
                  }}
                />
              </div>
              <div className="override-item">
                <span>Delay Cap (h)</span>
                <input 
                  type="number" 
                  value={overrides.max_delay}
                  onChange={(e) => setOverrides({...overrides, max_delay: parseInt(e.target.value)})}
                />
              </div>
              <div className="override-item">
                <span>Cost Ceiling ($)</span>
                <input 
                  type="number" 
                  value={overrides.cost_ceiling}
                  onChange={(e) => setOverrides({...overrides, cost_ceiling: parseInt(e.target.value)})}
                />
              </div>
            </div>
          </div>

          <button className="supply-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Analyzing Scenarios...' : 'Generate Strategic Route Options'}
          </button>
        </div>

        {/* Center Panel: Results */}
        <div className="rr-results-panel">
          {result && result.error && (
            <div className="supply-empty" style={{ borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' }}>
              <ShieldAlert size={48} style={{ color: '#ef4444' }} />
              <h3 style={{ color: '#ef4444' }}>Routing Constraint Violation</h3>
              {result.details ? (
                <div style={{ marginTop: '1rem', textAlign: 'left', width: '100%' }}>
                  {Object.entries(result.details).map(([mode, reason]) => (
                    <div key={mode} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <strong style={{ color: '#ef4444' }}>{mode.toUpperCase()} UNAVAILABLE:</strong>
                      <div style={{ color: '#fca5a5', marginLeft: '0.5rem' }}>- {reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{result.error}</p>
              )}
            </div>
          )}
          
          {!result && !loading && (
            <div className="supply-empty">
              <Shield size={48} strokeWidth={1} />
              <h3>Ready for Decision Analysis</h3>
              <p>Initialize route parameters and select disruption scenarios to run multi-persona optimization.</p>
            </div>
          )}

          {loading && (
            <div className="supply-empty">
              <Loader2 size={48} className="rr-spinner" />
              <h3>Navigating Disruptions...</h3>
              <p>Optimizing multi-persona decision matrix against active threats.</p>
            </div>
          )}

          {result && result.recommendations && result.recommendations.map((r, i) => (
            <React.Fragment key={i}>
              <RouteCard route={r} />
              {i < result.recommendations.length - 1 && (
                <TradeoffStrip fromRoute={r} toRoute={result.recommendations[i+1]} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Right Panel: Scenarios */}
        <div className="rr-disruption-panel supply-intel">
          <h2 className="panel-title">Live Disruption Scenarios</h2>
          <p className="panel-sub">Select a scenario to test engine determinism.</p>
          
          <div className="scenario-grid">
            <div 
              className={`scenario-card ${scenario === null ? 'active' : ''}`}
              onClick={() => setScenario(null)}
            >
              <Shield size={16} />
              <span>Normal Conditions</span>
            </div>
            {scenarios.map(s => (
              <div 
                key={s.id} 
                className={`scenario-card ${scenario === s.id ? 'active' : ''}`}
                onClick={() => setScenario(s.id)}
              >
                <AlertTriangle size={16} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>

          <div className="intel-section">
            <h3 className="section-title">Engine Audit Logs</h3>
            <div className="intel-list">
              <div className="intel-item">
                <span>Persona Matrix</span>
                <span className="risk-val success">GENERATED</span>
              </div>
              <div className="intel-item">
                <span>Transfer Economics</span>
                <span className="risk-val success">ACTIVE</span>
              </div>
              <div className="intel-item">
                <span>Scenario Injection</span>
                <span className="risk-val success">READY</span>
              </div>
            </div>
          </div>

          <div className="intel-footer">
            <Activity size={12} />
            <span>Decision Matrix V6 Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
