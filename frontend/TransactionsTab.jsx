import React, { useState, useEffect, useRef, useCallback } from 'react';

const getColumnWidth = (key) => {
  if (key === 'transaction_key') return 340;
  if (key === 'amount') return 100;
  if (key === 'insert_date') return 100;
  if (key === 'insert_time') return 160;
  if (key === 'session_id') return 200;
  return 150;
};

const TransactionsTab = () => {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const parentRef = useRef();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/transactions?days=${days}&page=${currentPage}`);
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [days, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCsv = () => {
    if (!data.length) return;
    const header = Object.keys(data[0]);
    const rows = data.map(row =>
      header.map(field => {
        const value = row[field] ?? '';
        return '"' + String(value).replace(/"/g, '""') + '"';
      }).join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transactions_export.csv');
    link.click();
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#121212', color: '#f5f5f5', minHeight: '100vh' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center' }}>
          Date range:
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value={1}>Last 1 day</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>

        <button
          onClick={fetchData}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          disabled={loading}
        >
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>

        <button
          onClick={exportToCsv}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          disabled={loading || data.length === 0}
        >
          📥 Download CSV
        </button>
      </div>

      {/* Table */}
      <div
        ref={parentRef}
        style={{
          overflow: 'hidden',
          backgroundColor: '#1f1f1f',
          position: 'relative',
          opacity: loading ? 0.3 : 1,
          pointerEvents: loading ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
        }}
      >
        {data.length > 0 && (
          <div style={{
            display: 'flex',
            position: 'sticky',
            top: 0,
            backgroundColor: '#2c2c2c',
            zIndex: 10,
            borderBottom: '2px solid #333',
          }}>
            <div style={{ width: '60px', textAlign: 'right', padding: '4px', fontWeight: 'bold' }}>#</div>
            {Object.keys(data[0]).map((col, idx) => (
              <div
                key={idx}
                style={{
                  width: `${getColumnWidth(col)}px`,
                  minWidth: `${getColumnWidth(col)}px`,
                  padding: '4px',
                  fontWeight: 'bold',
                }}
              >
                {col}
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          {data.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                display: 'flex',
                width: '100%',
                borderBottom: '1px solid #333',
                backgroundColor: rowIndex % 2 === 0 ? '#1a1a1a' : '#252525',
              }}
            >
              <div style={{ width: '60px', textAlign: 'right', padding: '4px', opacity: 0.7 }}>
                {rowIndex + 1}
              </div>
              {Object.entries(row).map(([key, val], idx) => (
                <div
                  key={idx}
                  style={{
                    width: `${getColumnWidth(key)}px`,
                    minWidth: `${getColumnWidth(key)}px`,
                    padding: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: key === 'transaction_key' ? 'normal' : 'nowrap',
                    wordBreak: key === 'transaction_key' ? 'break-all' : 'normal'
                  }}
                >
                  {key === 'amount' && typeof val === 'string'
                    ? parseFloat(val).toFixed(2)
                    : val}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          style={{ padding: '0.5rem 1rem' }}
        >
          ⬅ Prev
        </button>
        <span style={{ alignSelf: 'center' }}>Page {currentPage}</span>
        <button
          onClick={() => setCurrentPage(p => p + 1)}
          style={{ padding: '0.5rem 1rem' }}
        >
          Next ➡
        </button>
      </div>
    </div>
  );
};

export default TransactionsTab;

