// Dashboards.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Sector
} from 'recharts';
import axios from 'axios';

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#8dd1e1", "#a29bfe", "#fab1a0", "#55efc4", "#ffeaa7"];

const dashboards = {
  fullOverview: { label: "📊 Full Overview" },
  alertsByType: {
    label: "Alerts by Type",
    fetch: async () => {
      const res = await axios.get("/dashboard/alerts_by_type");
      return res.data.data.map(item => ({ name: item.alert_type, value: item.count }));
    },
    refresh: async () => axios.post("/refresh_alerts_by_type"),
  },
  alertsByTenant: {
    label: "Alerts by Tenant",
    fetch: async () => {
      const res = await axios.get("/dashboard/alerts_by_tenant");
      return res.data.data.map(item => ({ name: item.tenant, value: item.count }));
    },
    refresh: async () => axios.post("/refresh_alerts_by_tenant"),
  },
  alertsByScoreRange: {
    label: "Alerts by Score Range",
    fetch: async () => {
      const res = await axios.get("/dashboard/alerts_by_score_range");
      return res.data.data
        .map(item => ({ name: item.score_range, value: item.count }))
        .sort((a, b) => {
          const getStart = (range) => parseInt(range.split(/[-–]/)[0], 10);
          return getStart(a.name) - getStart(b.name);
        });
    },
    refresh: async () => axios.post("/refresh_alerts_by_score_range"),
  },
  alertsByRegion: {
    label: "Alerts by Region",
    fetch: async () => {
      const res = await axios.get("/dashboard/alerts_by_region");
      const max = Math.max(...res.data.data.map(d => d.count || 0), 1);
      return res.data.data.map(({ region, count }) => {
        const intensity = Math.min(1, count / max);
        const red = Math.round(255 * intensity);
        const blue = Math.round(255 * (1 - intensity));
        return {
          region,
          value: count,
          shade: `rgb(${red}, 0, ${blue})`
        };
      });
    },
    refresh: async () => axios.post("/refresh_alerts_by_region"),
  }
};

const renderActiveShape = (props) => {
  const { cx, cy, outerRadius, innerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#fff" fontSize={14}>
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

export default function Dashboards() {
  const [selectedDashboard, setSelectedDashboard] = useState("alertsByType");
  const [chartData, setChartData] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSingleChart = useCallback(async (key) => {
    if (!dashboards[key]?.fetch) return [];
    return await dashboards[key].fetch();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedDashboard === 'fullOverview') {
        const [byType, byTenant, byScore, byRegion] = await Promise.all([
          loadSingleChart("alertsByType"),
          loadSingleChart("alertsByTenant"),
          loadSingleChart("alertsByScoreRange"),
          loadSingleChart("alertsByRegion")
        ]);
        setChartData({
          alertsByType: byType,
          alertsByTenant: byTenant,
          alertsByScoreRange: byScore,
          alertsByRegion: byRegion
        });
      } else {
        const data = await loadSingleChart(selectedDashboard);
        setChartData({ [selectedDashboard]: data });
      }
    } catch (e) {
      console.error("Error loading chart data", e);
      setChartData({});
    } finally {
      setLoading(false);
    }
  }, [selectedDashboard, loadSingleChart]);

  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      if (selectedDashboard === 'fullOverview') {
        await Promise.all([
          dashboards.alertsByType.refresh(),
          dashboards.alertsByTenant.refresh(),
          dashboards.alertsByScoreRange.refresh(),
          dashboards.alertsByRegion.refresh()
        ]);
      } else {
        await dashboards[selectedDashboard].refresh();
      }
      await loadData();
    } catch (e) {
      console.error("Failed to refresh", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getFill = (region) => {
    const regionData = (chartData.alertsByRegion || []).find(r => r.region === region);
    return regionData?.shade || "#e0e0e0";
  };
  const renderMap = () => (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <h3 style={{ marginBottom: 10 }}>📍 Alert Density by Region</h3>
      <div style={{
        width: '100%',
        height: '500px', // Fixed height for panel
        border: '1px solid #444',
        background: '#1e1e1e',
        overflow: 'hidden',
      }}>
        <svg
          viewBox="300 150 700 500"
          style={{
            width: '100%',
            height: '100%',
          }}
        preserveAspectRatio="xMidYMid meet"
        >
          <g>
            <path id="SE" d="M591.1 319.4l-1.5-0.3-0.3-3.8 2-4.6 1-0.3 2.7-6.5 0.5 2-1.5 3.2-0.3 2.2-0.6 0.5-2 7.6z m26.2-22.7l-1.3 1.4-1.4 0.5 0.1 3.3 1.5 1.2-1.3 0.5-0.7 1.8-1.8 0.6-1.5 1.6-0.3 1.6-2.1 0.9 1.2-2.4-0.9-0.7-1.4-2.1 0.4-0.9-0.6-3.2 2.7-2.9 1.3-1.1 3.3-1 1.3 0 1.5 0.9z m36.8-113l-2.7 0.3-2.2-0.6-1 0.3-3.8 0.3-1.1 0.7-2.1-0.7-2-1.2-2 1.1-1.6-1-1 1.9 0.1 1.8-1.8-0.2 0.3 1.1-2 1.5-3.2 0.2 0.7 1.5-0.9 0.7 1 1.7-1.3 1.5-2.1 1.9-0.5 1 1.7 1.1 1.6 2.5 1.6 1.1-0.4 1.2-2.1 1.1-2.2 1.7-2 4.3-3.1 1.3-2.4 1.6-3 0.7-2.4 2.2-1.8-0.8-1.5 0.5-1 1.8-1.9 1.5-2.4-0.2 0.2 0.8-2.3 0.3-1 4-2.2 0.6-0.7 0.8-0.9-0.6-2.1 0.1 1.6 2.8-1.7 1.8-1.2 0-1.5 0.7-1.9-0.8-0.2 1.2 0.8 1.3 1.3 1-0.1 1.3-0.9 4.3 0.7 1.8-2.1 1.2-0.8 1.1 0.6 1.7-0.1 1.1 0.7 1.9 0.8 4.2 1.1 2-0.1 1.6 1.3 0.9 2.1-0.1 1.4 1.6 3.1-0.8 0.8 1.1 2.9 2.2 1.7 0.3 1.9 1.2 0 1.5 2.9 1 1.9 2 0.8 1.6-0.1 1-2.6 1.5-1.3 1.3-3.8 2.1-0.6-0.1-2.1 1 2 0.6 1.4-0.7 2.6-0.6 1.4 1.2-2.2 0.5-0.3 1.6-0.8 1-2 0.7-2.8 1.5-4 1.4-1.1 1.2-2.6 1-1.3 0.8-3.8 0-3.7-0.1 1 0.9 0.9-0.2 3.6 0.4 1.7 1.3-3 0.9 1.7 3.2-0.7 0.8 0.4 3.5-1.1 0.1-0.3 1.4 0.6 2.5 1 2.1-0.1 1-1.5 2.4 0.9 2.9-1.5 5.3-1.9 3.1-1.3 4.1-1.8 1.4-2.4-0.9-3.4 0.5-3.2-0.3-3 0.2-0.8 0.4 0.7 1.4-2.3-0.2-1.7 1.1-2 2.1 0 1.5 1.9 3-1.7 2-1.1 0-3.2-0.5-5.5 1.2-5.1-1 0.5-1 0.2-3.1-0.6-1.7-1.3-1.1-3.1-3.8-1.2-2.3 2.4 0.9 1-0.5-1.8-2.6 2.2-0.1 0.7-1-0.6-1.5-1.9-0.6-1.9-2.4-1.8-1.2-3.5-4.7-1.3-3.2-1.1 0.3-1.2-3.7-1.7-0.6-0.6-3.7-1.8-0.4-1.3-1.7-0.4-3.2-1.2-0.6-0.8-1.4-0.8-3-0.3-2.7-0.9-1.8 0.5-1.2 1.1-0.2 1.1 0.8 1 1.8 1.9-0.2 0.7-1.4 0.6-3.9-1.6-4.4 1.5-1.5 0.9-2.4 2.6-0.7 1.3-0.8 1.9-2 0.1-2.8 0.6-2.1-0.5-1.4-3.1-4.9-0.3-1.6 1.8-0.6 2.4 0 1.3-2.5 0.4-1.9-3.4-2.7-1.2-0.4-3.8-2.1 0.9-6.4 0-1.6-2.5-4.4 0.1-1.8-0.6-2.8 1.1-1.1-2.7-4.1 2-2.8-0.5-1.5 1.2-1 3.5-3.8 3.3-1.5 3.3-0.4 7.1 0.9 1.7-2.2-0.1-1.2-1.1-2.9-4.7-1.6 4.4-5 3.3-5 0.1-4.7 0.6-2.7-1.4-3.9 3.8-0.4 2.4-0.5 3.3-1.5-1-2.5 1.3-0.9 3-2.9 3.3-2.9 1.5-1 0.2-1.4-1-1.3-2.7-2.3 0.5-1.1 2.7-0.6 1.1-1.1 1.5-3.5 3.7-1.9 1.5-0.9 6.3 1.8 2.1-3.1-0.8-3.6 0-0.8 2.1-0.5 4.1 0.9 2.9 0.1 8.6 1.7 1 0.1 2.5-1.6-2.9-0.9 1.6-0.9 1.4-1.9-0.1-2-2.6-1.6 5.1-0.2 2.9 0.8 0.4 0.9 2.9 1.1 4.8 2.3 4.2 1.8 8.3 1.7 3.5 1.8 1.2 1.6 1.4 0.1 1.9 1.5 1.8 0.9-1.1 1 0.4 2.4 0.7 1.4-0.3 1.9 2.8 0.4 0.6 1.3-1 0.8-0.1 1.1 0.8 1.6 3.3 2.6 0.6 0.9-0.7 1.4 0.1 1.8-1.5 1.3 0 1.3 1.3 2.6 1.8 0.6 1.9 2.2 1.6 2.5z" fill={getFill("Sweden")} stroke="#333" />
            <path id="EE" d="M655.5 285.3l3.9 0.2 4 1.8-1.8 0.7-3.7 2.5-0.3 0.5-2.6-0.1-1.4 0.2-1 0.9-0.9 2.8-1.6 0.5-0.3-0.9 1.6-1.8-1.5-1.4-1.9-0.7 0.9-1.8-1.6-1.6 1.5-0.2 1 0.5 2-0.5 0.5-1 3.2-0.6z m8.3 1l-0.9 0.2-2.4-1.1 1-1 1.9 0.5 0.4 1.4z m-5.4-4l-0.8 0.7-0.9-0.6-0.9 1.6-1.3 0.3-1.9-2.5-2.9-0.5-1.3-0.7 4.5-0.4 1.2-1.6 1.3 0.1 0.4 0.9 2.1 0.3 0.9 1-0.4 1.4z m53.2 18.9l-1.9-0.2-3.4-1-4 1.2-2.8-1.1-3.5-2.7-0.6-0.7-2.3-0.5-5.6-2.5-1.1 0.7-1.5-1-8.4 2.8 1-3.4 0.1-3.6-2.3-0.4-0.9 1.3-1.3 0.3-4.1-1.3-1.2-2.1-1.6-1.1-0.8-1.2 0-1.8-1.5-2 0.7-1.1-0.7-2.8 3-1.2 3.3-0.2 0.9-1.3 2-1.3 2.3 0.2 3.1-1 6.3 0.1 0.4-1.7 3.2 0 7.6 1.2 1.8 0 2.8 1.2 1.4 0.3 4 0 6.3 0.5 1.2-1 1.5 1.2-1 1.4-1.2 0.4-0.9 3.2-0.8 1-1.7-0.3-2.5 0.2-2 0.5-1.3 1.1 0.1 1.1 2.6 2.3 1.4 2.8 2.6 2.2 0.8 1.3 2.4 2.9 1.8 2.5-2.3 0.6-1.2 2-0.2 2z" fill={getFill("Estonia")} stroke="#333" />
            <path id="LV" d="M711.6 301.2l1.9 0.3 0.5 1.1 3.2 1.7 0.7 2.2-0.8 1.6-0.3 3.1 1.8-0.3 1 0.6 0.3 1.2 1.7 2.1 1.3 0.8 1.9 4.2-0.3 1.7-1.3 0.2-1.4 0.8-2.5 2.4-0.4 1.7-3.1-0.1-3-0.4-1.1 0.3-1.2 1.5-2.6 0.6-2.3-0.5-1.5-0.7-2.6-2.1-5.4-3.1-0.9-0.4-6.1-1-2.4-2.9-2.3 0.2-1.7 1.3-4.6 0.4-3.7-0.9-2.3-0.1-4.9-0.5-1.6 0.7-1-0.9-4.3 0.1-5.9-0.5-4.7 1.4-3.6 1.9-2.8 1.7-0.8-2.8-0.6-5.5 0.1-2.8 1.9-1.6 0.8-1.2 0.6-4.5 2.5-3.6 2.4-0.4 3.1-1 3.5-0.9 1.4 1.9 4.9 3 1.2 1 2.3 3.4 4.4 1.8 3.1-0.6 3.6-2.4 1-1.1 0-1.1-1.2-4.7-1.1-2 0.1-1.3 8.4-2.8 1.5 1 1.1-0.7 5.6 2.5 2.3 0.5 0.6 0.7 3.5 2.7 2.8 1.1 4-1.2 3.4 1 1.9 0.2z" fill={getFill("Latvia")} stroke="#333" />
            <path id="LT" d="M707.9 328.5l0 1.8-0.7 3.1 3.9 1-1.3 1-0.4 1.1-3.6-0.1-1 2-0.8 0.6-2.6 0.6-1.1 3 0.4 2.3-1 1.5-0.5 2 1.9 0.5 0.9 1.1 0 1-2 0.2-1.7-2.3-1 0.7-2.1 0.5-1.4 1.2-2-0.2-0.8 2.6-1.8-0.1-3.3 1.3-1.6-0.9-3.7 0.3-1.6 0.3-2.9-0.4-0.8-3-1.1-0.9-4.5-2.2-2.3-0.7-0.6 0.6-1.3-2 0-2.1 1-3.1-1.3-1.3-1.4-0.6-0.9-1.3-5.7-0.1-2.4-0.6-3.9-1.4-2-1.2-1.8 0.2-0.6-1.2 0.2-1.6-1.1-2.4-1.6-2.9-0.7-3.8 2.8-1.7 3.6-1.9 4.7-1.4 5.9 0.5 4.3-0.1 1 0.9 1.6-0.7 4.9 0.5 2.3 0.1 3.7 0.9 4.6-0.4 1.7-1.3 2.3-0.2 2.4 2.9 6.1 1 0.9 0.4 5.4 3.1 2.6 2.1 1.5 0.7 2.3 0.5z" fill={getFill("Lithuania")} stroke="#333" />
          </g>
        </svg>
      </div>
    <div style={{ marginTop: 10, color: '#ccc', display: 'flex', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 20, height: 20, backgroundColor: 'rgb(0,0,255)', border: '1px solid #555' }}></div>
        <span>Low Alerts</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 20, height: 20, backgroundColor: 'rgb(255,0,0)', border: '1px solid #555' }}></div>
        <span>High Alerts</span>
      </div>
    </div>
  </div>
);

  return (
    <div style={{ padding: 20 }}>
      <h2>Dashboards</h2>
      <select value={selectedDashboard} onChange={(e) => setSelectedDashboard(e.target.value)}>
        {Object.entries(dashboards).map(([key, config]) => (
          <option key={key} value={key}>{config.label}</option>
        ))}
      </select>
      <button onClick={refreshDashboard} style={{ marginLeft: 10, marginTop: 10 }}>
        {selectedDashboard === 'fullOverview' ? '🔄 Refresh All Dashboards' : `Refresh ${dashboards[selectedDashboard].label}`}
      </button>
      {refreshing && (
        <div style={{ marginTop: 10, padding: 10, backgroundColor: "#fffae6", border: "1px solid #ffe58f", borderRadius: 5 }}>
          🔄 Refreshing dashboard...
        </div>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : selectedDashboard === "fullOverview" ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly' }}>
            <div style={{ flex: '1 1 400px', margin: 10 }}>
              <h3>Alerts by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie dataKey="value" data={chartData.alertsByType || []} cx="50%" cy="50%" outerRadius={80} label activeShape={renderActiveShape}>
                    {(chartData.alertsByType || []).map((entry, index) => (
                      <Cell key={`cell-type-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ color: '#ccc' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: '1 1 400px', margin: 10 }}>
              <h3>Alerts by Tenant</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie dataKey="value" data={chartData.alertsByTenant || []} cx="50%" cy="50%" outerRadius={80} label activeShape={renderActiveShape}>
                    {(chartData.alertsByTenant || []).map((entry, index) => (
                      <Cell key={`cell-tenant-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ color: '#ccc' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-evenly', marginTop: 20 }}>
            <div style={{ flex: '1 1 48%', margin: 10 }}>
              <h3>Alerts by Score Range</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.alertsByScoreRange || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ color: '#ccc' }} />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: '1 1 48%', margin: 10, padding: 10, border: '1px solid #444', borderRadius: 5, backgroundColor: '#1e1e1e' }}>
              {renderMap()}
            </div>
          </div>
        </div>
      ) : selectedDashboard === "alertsByScoreRange" ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData[selectedDashboard]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ color: '#ccc' }} />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      ) : selectedDashboard === "alertsByRegion" ? (
        <div style={{ width: '100%', marginTop: 20 }}>{renderMap()}</div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              dataKey="value"
              data={chartData[selectedDashboard]}
              cx="50%"
              cy="50%"
              outerRadius={120}
              label
              activeShape={renderActiveShape}
            >
              {chartData[selectedDashboard]?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ color: '#ccc' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

