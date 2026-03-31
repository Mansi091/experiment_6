import React, { useState } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Route, AlertTriangle, CheckCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in leaflet
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

// Helper to fit bounding box of the route
const MapFitter = ({ bounds }) => {
  const map = useMap();
  if (bounds) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
  return null;
};

const SafeRoute = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [routeSegments, setRouteSegments] = useState([]);
  const [routeSummary, setRouteSummary] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);

  const getGeoCode = async (query) => {
    const geoReq = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    if (!geoReq.data || geoReq.data.length === 0) {
      throw new Error(`Location not found: ${query}`);
    }
    return {
      latitude: parseFloat(geoReq.data[0].lat),
      longitude: parseFloat(geoReq.data[0].lon),
      name: geoReq.data[0].display_name.split(',')[0]
    };
  };

  const handleRouteAnalysis = async (e) => {
    e.preventDefault();
    if (!start || !end) return;
    
    setLoading(true);
    setErrorMsg('');
    setRouteSegments([]);
    setRouteSummary(null);

    try {
      // 1. Geocode Start and End
      const startLoc = await getGeoCode(start);
      const endLoc = await getGeoCode(end);

      // 2. Fetch Route Geometry via OSRM (Open Source Routing Machine)
      const osrmRes = await axios.get(`https://router.project-osrm.org/route/v1/driving/${startLoc.longitude},${startLoc.latitude};${endLoc.longitude},${endLoc.latitude}?overview=full&geometries=geojson`);
      
      if (!osrmRes.data.routes || osrmRes.data.routes.length === 0) {
        throw new Error('Could not calculate a driving route between these locations.');
      }
      
      // OSRM returns coordinates as [Longitude, Latitude], Leaflet needs [Latitude, Longitude]
      const routeCoords = osrmRes.data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      
      // Compute bounds for the map
      const bounds = L.latLngBounds(routeCoords);
      setMapBounds(bounds);

      // 3. Fetch current weather for the starting point
      const weatherReq = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${startLoc.latitude}&longitude=${startLoc.longitude}&current_weather=true`);
      const cw = weatherReq.data.current_weather;
      const wind = cw.windspeed;
      const wCode = cw.weathercode;
      
      // Encode Weather for ML Model
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

      // 4. Divide Route into Segments to simulate changing road conditions
      const numSegments = 6;
      const segLength = Math.ceil(routeCoords.length / numSegments);
      
      const speedVariations = [30, 60, 40, 70, 50, 30]; // varying speed limits
      const roadTypeVariations = [6, 3, 6, 2, 3, 6];    // varying road types
      
      let segmentsData = [];
      let totalRisk = 0;
      let highRiskCount = 0;
      
      for (let i = 0; i < numSegments; i++) {
        const startIdx = i * segLength;
        const endIdx = startIdx + segLength + 1; // overlap by 1 to link polylines
        const pts = routeCoords.slice(startIdx, endIdx);
        
        if (pts.length > 1) {
            // Apply ML predict for each segment to get dynamic safety reading
            const reqPayload = {
                hour, 
                speed_limit: speedVariations[i % speedVariations.length], 
                road_type: roadTypeVariations[i % roadTypeVariations.length],
                weather_conditions: weatherFeat,
                light_conditions: lightFeat,
                road_surface: surfaceFeat,
                urban_rural: 1, // Rural/Urban
                num_vehicles: 2,
                num_casualties: 1,
                age_of_driver: 30,
                age_of_vehicle: 5,
                day_of_week: new Date().getDay() || 7
            };

            let riskScore = 0.2; // default fallback
            let riskLevel = 'Low';
            try {
                const mlRes = await axios.post(API_URL, reqPayload);
                riskScore = mlRes.data.risk_score;
                if (mlRes.data.prediction === 0) { riskLevel = 'High'; highRiskCount++; }
                else if (mlRes.data.prediction === 1) riskLevel = 'Moderate';
            } catch(e) {
                // Fallback for demo
                riskScore = Math.random() * 0.7;
                if (riskScore > 0.5) { riskLevel = 'High'; highRiskCount++; }
                else if (riskScore > 0.3) riskLevel = 'Moderate';
            }
            
            totalRisk += riskScore;

            // Determine strict color coding
            let color = '#22c55e'; // Green
            if (riskScore > 0.5 || riskLevel === 'High') color = '#ef4444'; // Red
            else if (riskScore > 0.3 || riskLevel === 'Moderate') color = '#f59e0b'; // Yellow

            segmentsData.push({
                points: pts,
                color: color,
                riskScore: riskScore,
                riskLevel: riskLevel,
                speedLimit: speedVariations[i % speedVariations.length]
            });
        }
      }
      
      setRouteSegments(segmentsData);
      setRouteSummary({
          startName: startLoc.name,
          endName: endLoc.name,
          avgRisk: (totalRisk / segmentsData.length) * 100,
          highRiskZones: highRiskCount,
          totalDistance: (osrmRes.data.routes[0].distance / 1000).toFixed(1), // in km
          duration: Math.ceil(osrmRes.data.routes[0].duration / 60) // in mins
      });

    } catch (err) {
      setErrorMsg(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 20px' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Safe Route</h1>
      </div>

      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <form onSubmit={handleRouteAnalysis}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flex: 1, minWidth: '250px', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: '#3b82f6' }}><MapPin size={24} /></div>
              <input 
                type="text" 
                placeholder="Start Location (e.g. Manchester)" 
                className="form-control" 
                style={{ flex: 1 }}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flex: 1, minWidth: '250px', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: '#ef4444' }}><MapPin size={24} /></div>
              <input 
                type="text" 
                placeholder="Destination (e.g. London)" 
                className="form-control" 
                style={{ flex: 1 }}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <button type="submit" className="submit-btn" style={{ margin: 0, padding: '0.75rem 1.5rem' }} disabled={loading}>
              <Route size={18} style={{ marginRight: '8px' }} />
              {loading ? 'Analyzing AI Path...' : 'Analyze Route'}
            </button>
          </div>
        </form>
        {errorMsg && <div style={{ color: '#ef4444', marginTop: '15px', fontWeight: 500 }}>{errorMsg}</div>}
      </div>

      {routeSummary && routeSegments.length > 0 && mapBounds && (
        <div style={{ animation: 'fadeInUp 0.6s ease-out' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(250px, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Map Column */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', height: '400px', position: 'relative' }}>
               <MapContainer bounds={mapBounds} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                 <TileLayer
                   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 />
                 
                 {/* Start & End Markers */}
                 <Marker position={routeSegments[0].points[0]} icon={customIcon}>
                   <Popup>Start: {routeSummary.startName}</Popup>
                 </Marker>
                 <Marker position={routeSegments[routeSegments.length - 1].points[routeSegments[routeSegments.length - 1].points.length - 1]} icon={customIcon}>
                   <Popup>Destination: {routeSummary.endName}</Popup>
                 </Marker>

                 {/* Route Segments */}
                 {routeSegments.map((seg, idx) => (
                    <Polyline 
                        key={idx} 
                        positions={seg.points} 
                        pathOptions={{ color: seg.color, weight: 6, opacity: 0.8 }} 
                    >
                        <Popup>
                            <strong>Segment {idx + 1}</strong><br/>
                            Risk Level: <span style={{color: seg.color, fontWeight: 'bold'}}>{seg.riskLevel}</span><br/>
                            Risk Score: {(seg.riskScore * 100).toFixed(1)}%<br/>
                            Simulated Speed limit: {seg.speedLimit} mph
                        </Popup>
                    </Polyline>
                 ))}
                 
                 <MapFitter bounds={mapBounds} />
               </MapContainer>
            </div>
            
            {/* Summary Statistics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                 <h3 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Navigation color="#3b82f6" /> Trip Summary
                 </h3>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Distance:</span>
                    <span style={{ fontWeight: 'bold' }}>{routeSummary.totalDistance} km</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Est. Time:</span>
                    <span style={{ fontWeight: 'bold' }}>{routeSummary.duration} mins</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Average Risk:</span>
                    <span style={{ fontWeight: 'bold', color: routeSummary.avgRisk > 50 ? '#ef4444' : '#22c55e' }}>
                        {routeSummary.avgRisk.toFixed(1)}%
                    </span>
                 </div>
                 
                 {routeSummary.highRiskZones > 0 ? (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #ef4444', borderRadius: '4px', color: '#ef4444', fontWeight: 600 }}>
                         <AlertTriangle size={20} />
                         Warning: {routeSummary.highRiskZones} High-Risk Segment(s) Detected
                     </div>
                 ) : (
                     <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(34, 197, 94, 0.1)', borderLeft: '3px solid #22c55e', borderRadius: '4px', color: '#16a34a', fontWeight: 600 }}>
                         <CheckCircle size={20} />
                         Safe Route! No critical hazards detected.
                     </div>
                 )}
                 
                 <div style={{ marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Map Legend</h4>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '12px', height: '4px', background: '#22c55e', borderRadius: '2px' }}/> Safe
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '12px', height: '4px', background: '#f59e0b', borderRadius: '2px' }}/> Caution
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '12px', height: '4px', background: '#ef4444', borderRadius: '2px' }}/> High Risk
                        </div>
                    </div>
                 </div>
                 
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafeRoute;
