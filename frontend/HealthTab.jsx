import React, { useState, useEffect, useRef } from 'react';

const shakeAnimation = `
@keyframes shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  50% { transform: translateX(5px); }
  75% { transform: translateX(-5px); }
  100% { transform: translateX(0); }
}
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = shakeAnimation;
  document.head.appendChild(style);
}

const HealthTab = () => {
  const [status, setStatus] = useState({ api: 'Unknown', cassandra: 'Unknown', cassandra_latency: null, websocket: 'Unknown' });
  const [lastChecked, setLastChecked] = useState(null);
  const [demoMessage, setDemoMessage] = useState('');
  const [demoError, setDemoError] = useState(false);
  const flashRef = useRef(null);
  const demoFlashRef = useRef(null);

  const checkHealth = async () => {
    try {
      const start = performance.now();
      const res = await fetch('/health');
      const data = await res.json();
      const end = performance.now();

      setStatus(prev => ({
        ...prev,
        api: res.ok ? `UP (${Math.round(end - start)}ms)` : 'DOWN',
        cassandra: data.cassandra_status,
        cassandra_latency: data.cassandra_latency_ms
      }));
      setLastChecked(new Date().toLocaleTimeString());

      if (flashRef.current) {
        flashRef.current.style.backgroundColor = '#333';
        setTimeout(() => {
          if (flashRef.current) {
            flashRef.current.style.backgroundColor = 'transparent';
          }
        }, 500);
      }
    } catch {
      setStatus(prev => ({ ...prev, api: 'DOWN', cassandra: 'UNKNOWN' }));
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  const checkWebSocket = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname + ':8000';
    const socket = new WebSocket(`${wsProtocol}://${wsHost}/ws/data`);

    socket.onopen = () => setStatus(prev => ({ ...prev, websocket: 'Connected' }));
    socket.onerror = () => setStatus(prev => ({ ...prev, websocket: 'Error' }));
    socket.onclose = () => setStatus(prev => ({ ...prev, websocket: 'Disconnected' }));

    return () => socket.close();
  };

  useEffect(() => {
    checkHealth();
    checkWebSocket();
  }, []);

  const runDemoQuery = async () => {
    try {
      const start = performance.now();
      const res = await fetch('/demo-query');
      const end = performance.now();

      if (!res.ok) {
        throw new Error('Server returned error');
      }

      const data = await res.json();
      setDemoMessage(`${data.message} @ ${new Date(data.timestamp).toLocaleTimeString()} (${Math.round(end - start)}ms)`);
      setDemoError(false);

      if (demoFlashRef.current) {
        demoFlashRef.current.style.backgroundColor = '#333';
        setTimeout(() => {
          if (demoFlashRef.current) {
            demoFlashRef.current.style.backgroundColor = 'transparent';
          }
        }, 500);
      }
    } catch (error) {
      setDemoMessage('❌ Demo query failed: Cassandra is DOWN');
      setDemoError(true);

      if (demoFlashRef.current) {
        demoFlashRef.current.style.backgroundColor = '#660000';
        setTimeout(() => {
          if (demoFlashRef.current) {
            demoFlashRef.current.style.backgroundColor = 'transparent';
          }
        }, 500);
      }
    }
  };

  const getStatusColor = (value) => {
    if (!value) return 'gray';
    if (value.includes('DOWN') || value.includes('Disconnected') || value.includes('Error')) return '#ff6b6b';
    return '#00e676'; // bright green
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#121212', color: '#f5f5f5', minHeight: '100vh' }} ref={flashRef}>
      <h2>System Health</h2>

      {/* Buttons */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={checkHealth}
          style={{
            marginRight: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh Health
        </button>

        <button
          onClick={runDemoQuery}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🚀 Run Demo Query
        </button>
      </div>

      {/* Health Status Table */}
      <table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', backgroundColor: '#1f1f1f', borderCollapse: 'collapse', borderColor: '#333' }}>
        <thead>
          <tr style={{ backgroundColor: '#2c2c2c' }}>
            <th style={{ color: '#f5f5f5' }}>Component</th>
            <th style={{ color: '#f5f5f5' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>API Server</td>
            <td style={{ color: getStatusColor(status.api) }}>{status.api}</td>
          </tr>
          <tr>
            <td>Cassandra Cluster</td>
            <td style={{ color: getStatusColor(status.cassandra) }}>
              {status.cassandra} {status.cassandra_latency ? `(${status.cassandra_latency}ms)` : ''}
            </td>
          </tr>
          <tr>
            <td>WebSocket</td>
            <td style={{ color: getStatusColor(status.websocket) }}>{status.websocket}</td>
          </tr>
        </tbody>
      </table>

      {/* Timestamps and Demo Query Result */}
      <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#aaa' }}>
        <p>Last checked: {lastChecked}</p>

        <div ref={demoFlashRef} style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#1f1f1f',
          borderRadius: '5px',
          border: demoError ? '2px solid #ff6b6b' : '2px solid transparent',
          animation: demoError ? 'shake 0.4s' : 'none'
        }}>
          {demoMessage && <p style={{ color: demoError ? '#ff6b6b' : '#f5f5f5' }}><strong>Demo:</strong> {demoMessage}</p>}
        </div>
      </div>
    </div>
  );
};

export default HealthTab;

