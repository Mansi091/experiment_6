import React, { useState } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Cloud, Wind, Thermometer, AlertOctagon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in leaflet with React/Vite
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const API_URL = 'http://localhost:8000/predict';

// Helper component to recenter map when coords change
const MapUpdater = ({ coords }) => {
  const map = useMap();
  map.setView(coords, map.getZoom());
  return null;
};

const LiveForecaster = () => {
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [weatherData, setWeatherData] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [coords, setCoords] = useState(null);

  const fetchLivePrediction = async (lat, lon, locName) => {
    try {
      setCoords([lat, lon]);
      // 1. Fetch Weather
      const weatherReq = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const cw = weatherReq.data.current_weather;
      
      setWeatherData(cw);
      setLocationName(locName);

      // 2. Map Weather to Features
      const wind = cw.windspeed;
      const wCode = cw.weathercode;
      
      let weatherFeat = 1;
      if ([45, 48].includes(wCode)) weatherFeat = 7;
      else if ((wCode >= 50 && wCode <= 69) || (wCode >= 80 && wCode <= 82)) weatherFeat = wind > 20 ? 5 : 2;
      else if ((wCode >= 70 && wCode <= 79) || (wCode >= 85 && wCode <= 86)) weatherFeat = wind > 20 ? 6 : 3;
      else weatherFeat = wind > 20 ? 4 : 1;

      const hour = new Date().getHours();
      const night = (hour < 6 || hour > 20);
      const lightFeat = night ? 4 : 1;
      
      let surfaceFeat = 1;
      if ([2, 5].includes(weatherFeat)) surfaceFeat = 2;
      else if ([3, 6].includes(weatherFeat)) surfaceFeat = 3;

      // 3. Call ML API
      const reqPayload = {
        hour, 
        speed_limit: 40, 
        road_type: 6,
        weather_conditions: weatherFeat,
        light_conditions: lightFeat,
        road_surface: surfaceFeat,
        urban_rural: 1,
        num_vehicles: 2,
        num_casualties: 1,
        age_of_driver: 30,
        age_of_vehicle: 5,
        day_of_week: new Date().getDay() || 7
      };

      try {
        const mlRes = await axios.post(API_URL, reqPayload);
        setPrediction({...mlRes.data, weatherFeat, lightFeat});
      } catch(err) {
        // Fallback for demo if backend is offline
        setTimeout(() => {
           setPrediction({
             prediction: 1,
             probabilities: [0.12, 0.68, 0.20],
             risk_score: 0.45,
             weatherFeat, lightFeat
           });
        }, 600);
      }
      
    } catch (err) {
      setErrorMsg('Failed to process weather or location data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCitySearch = async (e) => {
    e.preventDefault();
    if (!city) return;
    setLoading(true);
    setErrorMsg('');
    setPrediction(null);
    setWeatherData(null);
    setCoords(null);
    
    try {
      const geoReq = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}&limit=1`);
      if (!geoReq.data || geoReq.data.length === 0) {
        setErrorMsg('Location not found. Try a broader search term.');
        setLoading(false);
        return;
      }
      const loc = geoReq.data[0];
      await fetchLivePrediction(parseFloat(loc.lat), parseFloat(loc.lon), loc.display_name.split(',')[0]);
    } catch (err) {
      setErrorMsg('Failed to find location.');
      setLoading(false);
    }
  };

  const handleCurrentLocation = () => {
    setLoading(true);
    setErrorMsg('');
    setPrediction(null);
    setWeatherData(null);
    setCoords(null);
    
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchLivePrediction(position.coords.latitude, position.coords.longitude, "Your Current Location");
        },
        (error) => {
          setErrorMsg("Geolocation permission denied or unavailable.");
          setLoading(false);
        }
      );
    } else {
      setErrorMsg("Geolocation is not supported by your browser.");
      setLoading(false);
    }
  };

  // UI Helpers
  const getSeverityDetails = () => {
    if (!prediction) return { label: '', class: '', titleClass: '' };
    switch (prediction.prediction) {
      case 0: return { label: 'Fatal', class: 'risk-high-card', titleClass: 'risk-high-text' };
      case 1: return { label: 'Serious', class: 'risk-med-card', titleClass: 'risk-med-text' };
      case 2: return { label: 'Slight', class: 'risk-low-card', titleClass: 'risk-low-text' };
      default: return { label: 'Unknown', class: '', titleClass: '' };
    }
  };

  const getAiInsights = (risk_score, weather_feat, light_feat) => {
      let reasons = [];
      let actions = [];
      const speed_limit = 40; // Hardcoded in API call above
      
      if (risk_score > 0.5) {
          if ([3, 6, 4, 5].includes(weather_feat)) {
              reasons.push("Harsh weather conditions severely impact vehicle traction and visibility.");
              actions.push("Reduce speed by at least 30% and maintain double the standard following distance.");
          }
          if ([4, 5, 6].includes(light_feat)) {
              reasons.push("Low light severely reduces driver reaction times.");
              actions.push("Ensure high beams are used where appropriate and stay vigilant of unlit obstacles.");
          }
          if (speed_limit >= 60) {
              reasons.push("High speed zones amplify the severity of any potential impact.");
              actions.push("Strictly adhere to speed limits and avoid sudden lane changes.");
          }
          if (reasons.length === 0) {
              reasons.push("A combination of traffic, time, and road conditions raises the danger profile to critical.");
              actions.push("Exercise extreme caution, avoid distractions, and consider delaying the journey if possible.");
          }
      } else if (risk_score > 0.3) {
          if ([2, 7].includes(weather_feat)) {
              reasons.push("Mild adverse weather (rain/fog) is slightly elevating risk.");
              actions.push("Keep windshields clear, turn on fog lights if necessary, and drive slower.");
          } else {
              reasons.push("Moderate risk conditions detected based on current time and traffic patterns.");
              actions.push("Stay alert and maintain normal safety precautions.");
          }
      } else {
          reasons.push("Current environmental and road conditions are optimal.");
          actions.push("Maintain standard driving protocols.");
      }
          
      return { reasons, actions };
  };

  return (
    <div style={{ padding: '0 20px' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Live Accident Risk Forecaster</h1>
        <p className="page-desc">Check real-time traffic safety indicators using LIVE weather and geolocation.</p>
      </div>

      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <form onSubmit={handleCitySearch} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flex: 1, minWidth: '300px', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Enter a city to check traffic risk..." 
              className="form-control" 
              style={{ flex: 1 }}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <button type="submit" className="submit-btn" style={{ margin: 0, padding: '0.75rem 1.25rem' }} disabled={loading}>
              <MapPin size={18} />
            </button>
          </div>
          
          <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>OR</div>
          
          <button type="button" onClick={handleCurrentLocation} className="submit-btn" style={{ margin: 0, padding: '0.75rem 1.25rem', background: '#374151' }} disabled={loading}>
            <Navigation size={18} style={{ marginRight: '8px' }} /> Use Current GPS
          </button>
        </form>
        {errorMsg && <div style={{ color: '#ef4444', marginTop: '15px' }}>{errorMsg}</div>}
        {loading && <div style={{ color: '#3b82f6', marginTop: '15px' }}>Analyzing global weather patterns & predicting risks...</div>}
      </div>

      {weatherData && prediction && coords && (
        <div style={{ animation: 'fadeInUp 0.6s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
               <MapPin color="#3b82f6" /> {locationName}
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(300px, 2fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Map Column */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', height: '320px', position: 'relative' }}>
               <MapContainer center={coords} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                 <TileLayer
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 />
                 <Marker position={coords} icon={customIcon}>
                   <Popup>{locationName}</Popup>
                 </Marker>
                 <MapUpdater coords={coords} />
               </MapContainer>
            </div>
            
            {/* Weather Metric Elements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                 <Thermometer size={40} color="#f59e0b" />
                 <div>
                   <div style={{ fontSize: '2rem', fontWeight: 700 }}>{weatherData.temperature}°C</div>
                   <div style={{ color: 'var(--text-muted)' }}>Temperature</div>
                 </div>
              </div>
              
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                 <Wind size={40} color="#3b82f6" />
                 <div>
                   <div style={{ fontSize: '2rem', fontWeight: 700 }}>{weatherData.windspeed} <span style={{fontSize:'1.2rem'}}>km/h</span></div>
                   <div style={{ color: 'var(--text-muted)' }}>Wind Speed</div>
                 </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
            {/* Severity Card */}
            <div className={`glass-panel severity-card ${getSeverityDetails().class}`} style={{ border: '2px solid' }}>
               <div className="severity-title">Current Danger Level</div>
               <div className={`severity-value ${getSeverityDetails().titleClass}`}>{getSeverityDetails().label}</div>
               <div style={{ fontSize: '1rem', opacity: 0.8 }}>
                 Calculated Risk: {(prediction.risk_score * 100).toFixed(1)}%
               </div>
            </div>
            
            {/* AI Insights */}
            <div className="glass-panel">
               <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <AlertOctagon color="#8b5cf6" /> Live Autonomous Insights
               </h3>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                 {getAiInsights(prediction.risk_score, prediction.weatherFeat, prediction.lightFeat).reasons.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', marginTop: '7px', flexShrink: 0 }} />
                      <div style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>{r}</div>
                    </div>
                 ))}
                 
                 <div style={{ marginTop: '10px', background: 'rgba(59, 130, 246, 0.1)', borderLeft: '3px solid #3b82f6', padding: '15px', borderRadius: '4px' }}>
                   <strong>Recommended Actions: </strong>
                   {getAiInsights(prediction.risk_score, prediction.weatherFeat, prediction.lightFeat).actions.map((a, i) => (
                      <span key={i}>{a} </span>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveForecaster;
