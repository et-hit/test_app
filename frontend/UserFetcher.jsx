import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const UserFetcher = () => {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState(null);
  const [timingHistory, setTimingHistory] = useState([]);
  const [httpStatus, setHttpStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailedTiming, setDetailedTiming] = useState(null);
  const [error, setError] = useState(null);

  const fetchUser = async () => {
    if (!userId) return;
    setLoading(true);
    setResult(null);
    setDetailedTiming(null);
    setError(null);

    const startTime = performance.now();
    try {
      const res = await fetch(`/events/${userId}`);
      const endTime = performance.now();
      const totalTime = Math.round(endTime - startTime);
      const json = await res.json();

      const data = json.data || json;
      const timing = json.timing || null;

      setResult(data);
      setHttpStatus(res.status);
      setDetailedTiming(timing);

      setTimingHistory(prev => [
        ...prev,
        { time: totalTime, status: res.status }
      ]);
    } catch (err) {
      const totalTime = Math.round(performance.now() - startTime);
      setResult(null);
      setHttpStatus(null);
      setTimingHistory(prev => [
        ...prev,
        { time: totalTime, status: 'ERR' }
      ]);
      setError('Fetch failed.');
    }
    setLoading(false);
  };

  const fetchRandomUsers = async () => {
    setLoading(true);
    setResult(null);
    setDetailedTiming(null);
    setError(null);

    try {
      const res = await fetch(`/random_user_ids`);
      const json = await res.json();

      if (json.user_ids && json.user_ids.length > 0) {
        const csvString = json.user_ids.join(',\n');
        setResult(csvString);
      }
    } catch (err) {
      console.error('Failed to fetch random users', err);
      setError('Failed to fetch random users.');
    }

    setLoading(false);
  };

  const fetchAllEvents = async () => {
    if (!userId) return;
    setLoading(true);
    setResult(null);
    setDetailedTiming(null);
    setError(null);

    const startTime = performance.now();
    try {
      const res = await fetch(`/events/full/${userId}`);
      const rawText = await res.text();
      const endTime = performance.now();
      const totalTime = Math.round(endTime - startTime);

      let json;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        setError('Failed to parse server response.');
        throw new Error('Failed to parse JSON response in fetchAllEvents');
      }

      const data = json.data || json;
      const timing = json.timing || null;

      setResult(data);
      setHttpStatus(res.status);
      setDetailedTiming(timing);

      setTimingHistory(prev => [
        ...prev,
        { time: totalTime, status: res.status }
      ]);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Fetch failed.');
      const totalTime = Math.round(performance.now() - startTime);
      setResult(null);
      setHttpStatus(null);
      setTimingHistory(prev => [
        ...prev,
        { time: totalTime, status: 'ERR' }
      ]);
    }
    setLoading(false);
  };

  const clearResult = () => {
    setResult(null);
    setHttpStatus(null);
    setDetailedTiming(null);
    setError(null);
  };

  const renderDetailedTiming = () => {
    if (!detailedTiming) return null;

    const totalTime = timingHistory.length > 0 ? timingHistory.at(-1).time : 0;
    const sumOfTimings = (detailedTiming.webToApi || 0) +
      (detailedTiming.apiToDb || 0) +
      (detailedTiming.dbFetch || 0) +
      (detailedTiming.dbToWeb || 0);

    const renderTime = Math.max(0, totalTime - sumOfTimings);

    return (
      <div>
        <h4 style={{ marginTop: '1rem' }}>Timing Breakdown</h4>
        <table style={{ width: '100%', fontSize: '0.85rem', color: '#f5f5f5' }}>
          <tbody>
            <tr><td>Web → API</td><td style={{ textAlign: 'right' }}>{detailedTiming.webToApi.toFixed(2)} ms</td></tr>
            <tr><td>API → DB</td><td style={{ textAlign: 'right' }}>{detailedTiming.apiToDb.toFixed(2)} ms</td></tr>
            <tr><td>DB → Web</td><td style={{ textAlign: 'right' }}>{detailedTiming.dbToWeb.toFixed(2)} ms</td></tr>
            <tr><td>Rendering (UI & JS)</td><td style={{ textAlign: 'right' }}>{renderTime.toFixed(2)} ms</td></tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif', flexDirection: 'column', backgroundColor: '#121212', color: '#f5f5f5' }}>
      {/* App Title */}
      <div style={{ textAlign: 'center', padding: '1rem', fontSize: '1.5rem', backgroundColor: '#1f1f1f', color: '#f5f5f5' }}>
        <h1>Eduards Event Browser app v1.7</h1>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Column */}
        <div style={{ width: '75%', padding: '1rem', overflowY: 'auto', backgroundColor: '#121212' }}>
          {/* Search Controls */}
          <div style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#1f1f1f',
            padding: '1rem',
            zIndex: 10,
            borderBottom: '2px solid #333',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            {/* Search Inputs */}
            <input
              type="text"
              placeholder="Enter user_id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{
                width: '30%', padding: '0.5rem', fontSize: '1rem',
                borderRadius: '4px', marginRight: '1rem',
                backgroundColor: '#2c2c2c', color: '#f5f5f5', border: '1px solid #555'
              }}
            />
            <button
              onClick={fetchUser}
              style={{
                padding: '0.5rem 1rem', fontSize: '1rem',
                backgroundColor: '#28a745', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer'
              }}
            >
              Search
            </button>
            <button
              onClick={clearResult}
              style={{
                marginLeft: '0.5rem', padding: '0.5rem 1rem', fontSize: '1rem',
                backgroundColor: '#dc3545', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer'
              }}
            >
              Clear
            </button>
            <button
              onClick={fetchAllEvents}
              style={{
                marginLeft: '1rem', padding: '0.5rem 1rem', fontSize: '1rem',
                backgroundColor: '#007bff', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer'
              }}
            >
              Fetch (All 106 Columns)
            </button>

            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={fetchRandomUsers}
                style={{
                  padding: '0.5rem 1rem', fontSize: '1rem',
                  backgroundColor: '#ffc107', color: '#212529', borderRadius: '4px', border: 'none', cursor: 'pointer'
                }}
              >
                Fetch Random User IDs
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                color: 'red', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1rem'
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          <div style={{ marginTop: '2rem' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#bbb' }}>Loading...</p>
            ) : result ? (
              typeof result === 'string' ? (
                <pre style={{
                  backgroundColor: '#1f1f1f',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  whiteSpace: 'pre-wrap',
                  color: '#f5f5f5'
                }}>
                  {result}
                </pre>
              ) : result.length > 0 ? (
                result.map((item, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#1f1f1f',
                    padding: '1rem',
                    marginBottom: '1rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 5px rgba(255, 255, 255, 0.05)',
                    fontFamily: 'monospace'
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      {/* Fixed Fields */}
                      {['user_id', 'event_date', 'event_time', 'event_type', 'session_id'].map((key) => (
                        item[key] && (
                          <div key={key}>
                            <strong>{key}:</strong> {item[key]}
                          </div>
                        )
                      ))}

                      {/* Dynamic Extra Fields */}
                      {Object.entries(item)
                        .filter(([key]) => !['user_id', 'event_date', 'event_time', 'event_type', 'session_id', 'xml_blob'].includes(key))
                        .map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {value}
                          </div>
                      ))}
                    </div>

                    {item.xml_blob && (
                      <pre style={{
                        backgroundColor: '#2c2c2c',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                        marginTop: '0.5rem',
                        color: '#f5f5f5'
                      }}>
                        {typeof item.xml_blob === 'string'
                          ? item.xml_blob
                          : JSON.stringify(item.xml_blob, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', marginTop: '2rem', color: '#bbb' }}>
                  No results to display.
                </p>
              )
            ) : (
              <p style={{ textAlign: 'center', marginTop: '2rem', color: '#bbb' }}>
                No results to display.
              </p>
            )}
          </div>
        </div>

        {/* Stats Panel */}
        <div style={{
          width: '25%',
          backgroundColor: '#1f1f1f',
          padding: '1rem',
          borderLeft: '2px solid #333',
          overflowY: 'auto',
          boxShadow: '2px 0 5px rgba(255, 255, 255, 0.05)',
          borderRadius: '8px'
        }}>
          <h3>Stats</h3>
          {httpStatus && <p><strong>Last Status:</strong> {httpStatus}</p>}
          {detailedTiming && renderDetailedTiming()}

          {timingHistory.length > 0 && (
            <>
              <p><strong>Last Time:</strong> {timingHistory.at(-1).time} ms</p>
              <p><strong>Avg Time:</strong> {
                Math.round(timingHistory.reduce((a, b) => a + b.time, 0) / timingHistory.length)
              } ms</p>

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={timingHistory}>
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                  <XAxis dataKey={(v, i) => i + 1} tick={false} stroke="#aaa" />
                  <YAxis unit="ms" width={40} stroke="#aaa" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f1f1f', borderColor: '#333', color: '#f5f5f5' }} />
                  <Line type="monotone" dataKey="time" stroke="#90caf9" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserFetcher;

