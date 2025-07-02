import React, { useState } from 'react';

const QueryRunnerTab = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [totalTime, setTotalTime] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    if (!query.toLowerCase().includes("where")) {
      setError("⚠️ Query must include a WHERE clause (e.g., WHERE user_id = ...)");
      return;
    }

    setLoading(true);
    setResult(null);
    setTotalTime(null);
    setError(null);

    const start = performance.now(); // Start timing

    try {
      const res = await fetch('/run-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const end = performance.now(); // End timing
      const duration = end - start;

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Query failed');
      }

      const json = await res.json();
      setResult(json.data);
      setTotalTime(duration);
    } catch (err) {
      setResult(null);
      setTotalTime(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#f5f5f5', minHeight: '100vh', padding: '1rem', fontFamily: 'Arial, sans-serif' }}>
      <h2>Query Runner</h2>

      <p style={{ color: '#ffcc80' }}>
        ⚠️ Only queries with <code>WHERE</code> clauses are allowed to protect the server from full table scans.
      </p>

      <p style={{ fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>
        Example: <code>SELECT * FROM eventlog.user_events_with_100_fields WHERE user_id = a652cdd9-d410-4ab1-af5e-12143d955a99;</code>
      </p>

      <textarea
        style={{
          width: '100%',
          padding: '1rem',
          minHeight: '100px',
          maxHeight: '400px',
          resize: 'none',
          overflowY: 'auto',
          backgroundColor: '#1f1f1f',
          color: '#f5f5f5',
          border: '1px solid #333',
          borderRadius: '6px',
          transition: 'height 0.9s ease'
        }}
        placeholder="Enter CQL query (must include WHERE clause)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);

          const el = e.target;
          el.style.height = 'auto';
          requestAnimationFrame(() => {
            el.style.height = Math.min(el.scrollHeight, 400) + 'px';
          });
        }}
      />

      <button
        onClick={runQuery}
        disabled={loading}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: loading ? '#555' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Running...' : 'Run Query'}
      </button>

      {loading && (
        <p style={{ color: '#ffcc80', marginTop: '1rem', fontWeight: 'bold' }}>
          ⏳ Loading...
        </p>
      )}

      {error && !loading && (
        <p style={{ color: '#ff6b6b', marginTop: '1rem', fontWeight: 'bold' }}>
          {error}
        </p>
      )}

      {totalTime && !loading && (
        <div style={{ marginTop: '1.5rem', backgroundColor: '#1f1f1f', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(255,255,255,0.05)' }}>
          <strong>Total Time:</strong> {totalTime.toFixed(2)} ms
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: '1.5rem', backgroundColor: '#1f1f1f', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(255,255,255,0.05)', overflowX: 'auto' }}>
          <strong>Result:</strong>
          <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', color: '#f5f5f5' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default QueryRunnerTab;

