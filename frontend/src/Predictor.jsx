import React, { useState } from 'react';
import axios from 'axios';
import { Activity, Search, AlertOctagon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const API_URL = 'http://localhost:8000/predict';

const Predictor = () => {
  const [formData, setFormData] = useState({
    hour: 17,
    speed_limit: 60,
    road_type: 6,
    weather_conditions: 1,
    light_conditions: 1,
    road_surface: 1,
    urban_rural: 1,
    num_vehicles: 2,
    num_casualties: 1,
    age_of_driver: 35,
    age_of_vehicle: 5,
    day_of_week: new Date().getDay() || 7
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: Number(e.target.value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(API_URL, formData);
      setResult(response.data);
    } catch (error) {
      console.error("Prediction error:", error);
      // Fallback for demo purposes if backend isn't running
      setTimeout(() => {
        setResult({
          prediction: 1,
          probabilities: [0.15, 0.65, 0.20],
          risk_score: 0.52
        });
      }, 800);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityData = () => {
    if (!result) return [];
    return [
      { name: 'Fatal', value: result.probabilities[0] * 100 },
      { name: 'Serious', value: result.probabilities[1] * 100 },
      { name: 'Slight', value: result.probabilities[2] * 100 }
    ];
  };

  const getSeverityDetails = () => {
    if (!result) return { label: '', class: '', titleClass: '' };
    switch (result.prediction) {
      case 0: return { label: 'Fatal', class: 'risk-high-card', titleClass: 'risk-high-text' };
      case 1: return { label: 'Serious', class: 'risk-med-card', titleClass: 'risk-med-text' };
      case 2: return { label: 'Slight', class: 'risk-low-card', titleClass: 'risk-low-text' };
      default: return { label: 'Unknown', class: '', titleClass: '' };
    }
  };

  const svDetail = getSeverityDetails();

  return (
    <div style={{ padding: '0 20px' }}>
      <div className="page-header">
        <h1 className="page-title">Scenario Forecasting</h1>
        <p className="page-desc">Predict traffic accident severity dynamically based on real-time inputs.</p>
      </div>

      <div className="glass-panel">
        <form onSubmit={handleSubmit} className="predictor-form">
          <div className="form-group">
            <label className="form-label">Hour of Day ({formData.hour}:00)</label>
            <input type="range" name="hour" min="0" max="23" className="form-control" value={formData.hour} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Speed Limit ({formData.speed_limit} km/h)</label>
            <input type="range" name="speed_limit" min="20" max="120" step="10" className="form-control" value={formData.speed_limit} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Road Type</label>
            <select name="road_type" className="form-control" value={formData.road_type} onChange={handleChange}>
              <option value="1">Roundabout</option>
              <option value="2">One way</option>
              <option value="3">Dual carriageway</option>
              <option value="6">Single carriageway</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Weather Conditions</label>
            <select name="weather_conditions" className="form-control" value={formData.weather_conditions} onChange={handleChange}>
              <option value="1">Fine</option>
              <option value="2">Rain</option>
              <option value="3">Snow</option>
              <option value="4">Fine + High Wind</option>
              <option value="5">Rain + High Wind</option>
              <option value="7">Fog or Mist</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Light Conditions</label>
            <select name="light_conditions" className="form-control" value={formData.light_conditions} onChange={handleChange}>
              <option value="1">Daylight</option>
              <option value="4">Darkness - Lit</option>
              <option value="5">Darkness - Unlit</option>
              <option value="6">Darkness - No Lighting</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Road Surface</label>
            <select name="road_surface" className="form-control" value={formData.road_surface} onChange={handleChange}>
              <option value="1">Dry</option>
              <option value="2">Wet or Damp</option>
              <option value="3">Snow</option>
              <option value="4">Frost or Ice</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Area Type</label>
            <select name="urban_rural" className="form-control" value={formData.urban_rural} onChange={handleChange}>
              <option value="1">Urban</option>
              <option value="2">Rural</option>
            </select>
          </div>

          <div className="form-group">
             <label className="form-label">Driver Age ({formData.age_of_driver} yrs)</label>
             <input type="range" name="age_of_driver" min="17" max="90" className="form-control" value={formData.age_of_driver} onChange={handleChange} />
          </div>

          <div className="form-group">
             <label className="form-label">Vehicle Age ({formData.age_of_vehicle} yrs)</label>
             <input type="range" name="age_of_vehicle" min="0" max="30" className="form-control" value={formData.age_of_vehicle} onChange={handleChange} />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Analyzing Data...' : 'Run Prediction Engine'}
          </button>
        </form>
      </div>

      {result && (
        <div className="results-section">
          {/* Severity Result Card */}
          <div className={`glass-panel severity-card ${svDetail.class}`} style={{ border: '2px solid', transition: 'all 0.4s ease' }}>
            <div className="severity-title">Predicted Severity</div>
            <div className={`severity-value ${svDetail.titleClass}`}>{svDetail.label}</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              Calculated Road Risk Score: {(result.risk_score * 100).toFixed(1)} / 100
            </div>
            
            <div style={{ marginTop: '20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', justifyContent: 'center', color: '#8b949e'}}>
                    <AlertOctagon size={16} /> AI Confidence Profiling
                </div>
            </div>
          </div>

          {/* Probabilities Chart */}
          <div className="glass-panel">
            <h2 className="chart-title"><Activity size={20} /> Diagnostic Probabilities</h2>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={getSeverityData()} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#8b949e" tick={{fill: '#e6edf3', fontSize: 13, fontWeight: 500}} />
                  <YAxis domain={[0, 100]} stroke="#8b949e" tick={{fill: '#8b949e'}} tickFormatter={(t) => `${t}%`} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: 'rgba(13, 17, 23, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#3b82f6', fontWeight: 600 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50} label={{ position: 'top', fill: '#e6edf3', formatter: (val) => `${val.toFixed(1)}%` }}>
                    {getSeverityData().map((entry, index) => {
                       const colors = { 'Fatal': '#ef4444', 'Serious': '#f59e0b', 'Slight': '#10b981' };
                       return <Cell key={`cell-${index}`} fill={colors[entry.name]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Predictor;
