import React, { useState } from 'react';
import { Shield, BarChart2, MapPin } from 'lucide-react';
import Dashboard from './Dashboard';
import Predictor from './Predictor';
import LiveForecaster from './LiveForecaster';
import './index.css';

function App() {
  const [currentTab, setCurrentTab] = useState('forecaster');

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">RoadSense AI</div>
          <div className="sidebar-subtitle">Predictive Traffic Safety</div>
        </div>
        
        <div className="nav-links">
          <button 
            className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <BarChart2 size={20} />
            Accident Patterns
          </button>
          
          <button 
            className={`nav-btn ${currentTab === 'predictor' ? 'active' : ''}`}
            onClick={() => setCurrentTab('predictor')}
          >
            <Shield size={20} />
            Scenario Predictor
          </button>
          
          <button 
            className={`nav-btn ${currentTab === 'forecaster' ? 'active' : ''}`}
            onClick={() => setCurrentTab('forecaster')}
          >
            <MapPin size={20} />
            Live Forecaster
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {currentTab === 'dashboard' && <Dashboard />}
        {currentTab === 'predictor' && <Predictor />}
        {currentTab === 'forecaster' && <LiveForecaster />}
      </div>
    </div>
  );
}

export default App;
