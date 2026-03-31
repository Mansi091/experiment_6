import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { Clock, Map, Calendar, CloudLightning } from 'lucide-react';

const hourlyData = [
  { hour: '00', severity: 2.2 }, { hour: '01', severity: 1.9 },
  { hour: '02', severity: 1.8 }, { hour: '03', severity: 1.7 },
  { hour: '04', severity: 1.8 }, { hour: '05', severity: 2.0 },
  { hour: '06', severity: 2.4 }, { hour: '07', severity: 2.7 },
  { hour: '08', severity: 2.6 }, { hour: '09', severity: 2.2 },
  { hour: '10', severity: 2.1 }, { hour: '11', severity: 2.0 },
  { hour: '12', severity: 2.1 }, { hour: '13', severity: 2.1 },
  { hour: '14', severity: 2.0 }, { hour: '15', severity: 2.3 },
  { hour: '16', severity: 2.8 }, { hour: '17', severity: 2.9 },
  { hour: '18', severity: 2.7 }, { hour: '19', severity: 2.4 },
  { hour: '20', severity: 2.2 }, { hour: '21', severity: 2.1 },
  { hour: '22', severity: 2.2 }, { hour: '23', severity: 2.3 },
];

const roadData = [
  { name: 'Slip road', severity: 1.7 },
  { name: 'Roundabout', severity: 1.8 },
  { name: 'One way', severity: 1.9 },
  { name: 'Dual c-way', severity: 2.1 },
  { name: 'Single c-way', severity: 2.4 },
];

const dayData = [
  { name: 'Mon', severity: 2.0 }, { name: 'Tue', severity: 1.9 },
  { name: 'Wed', severity: 2.1 }, { name: 'Thu', severity: 2.0 },
  { name: 'Fri', severity: 2.3 }, { name: 'Sat', severity: 2.5 },
  { name: 'Sun', severity: 2.4 },
];

// Custom Tooltip properly styled for dark mode
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel" style={{ padding: '10px 15px', borderRadius: '8px' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{`${label}`}</p>
        <p style={{ margin: '5px 0 0', color: '#3b82f6' }}>
          {`Risk Index: ${payload[0].value.toFixed(2)}`}
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  return (
    <div style={{ padding: '0 20px' }}>
      <div className="page-header">
        <h1 className="page-title">Traffic Accident Patterns</h1>
        <p className="page-desc">Visualizing hidden correlations in India traffic accident data.</p>
      </div>

      <div className="dashboard-grid">
        {/* Hourly Trend Chart */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <h2 className="chart-title"><Clock size={20} /> Hourly Accident Risk</h2>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={hourlyData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSeverity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" stroke="#8b949e" tick={{fill: '#8b949e'}} />
                <YAxis dataKey="severity" domain={[1.5, 3.0]} stroke="#8b949e" tick={{fill: '#8b949e'}} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="severity" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSeverity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Road Type Danger */}
        <div className="glass-panel">
          <h2 className="chart-title"><Map size={20} /> Danger by Road Type</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={roadData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" domain={[1.0, 3.0]} stroke="#8b949e" tick={{fill: '#8b949e'}} />
                <YAxis dataKey="name" type="category" stroke="#8b949e" tick={{fill: '#e6edf3', fontWeight: 500}} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="severity" radius={[0, 4, 4, 0]}>
                  {roadData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.severity > 2.2 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day of Week */}
        <div className="glass-panel">
          <h2 className="chart-title"><Calendar size={20} /> Danger by Day</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={dayData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#8b949e" tick={{fill: '#8b949e'}} />
                <YAxis dataKey="severity" domain={[1.0, 3.0]} stroke="#8b949e" tick={{fill: '#8b949e'}} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="severity" radius={[4, 4, 0, 0]}>
                  {dayData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.severity > 2.3 ? '#8b5cf6' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
