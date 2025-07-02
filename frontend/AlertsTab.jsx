import React, { useState, useEffect, useRef, useCallback } from 'react';

const getColumnWidth = (key) => {
  if (key === 'alert_id') return 150;
  if (key === 'region') return 70;
  if (key === 'reviewed') return 80;
  if (key === 'create_timestamp') return 100;
  if (key === 'status') return 60;
  if (key === 'tenant') return 60;
  if (key === 'score') return 60;
  if (key === 'description') return 250;
  return 150;
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case "CRITICAL": return "#ff4d4d";    // Bright Red
    case "HIGH": return "#ff944d";        // Orange
    case "ELEVATED": return "#f1c40f";    // Yellow
    case "MODERATE": return "#2ecc71";    // Green
    case "LOW": return "#95a5a6";         // Grey (probably never shown)
    default: return "#f5f5f5";
  }
};

const getScoreColor = (score) => {
  score = Number(score);
  if (score >= 86) return '#e74c3c'; // Red
  if (score >= 71) return '#e67e22'; // Orange
  if (score >= 61) return '#f1c40f'; // Yellow
  return '#2ecc71'; // Green
};

const Modal = ({ children, onClose }) => {
  useEffect(() => {
    const handleEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#1f1f1f', color: '#f5f5f5', borderRadius: '8px', width: '80%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const AlertsTab = () => {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState("new");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const parentRef = useRef();
  const [newStatus, setNewStatus] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/alerts?days=${days}&page=${currentPage}&status=${status}`);
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [days, currentPage, status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [days, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportToCsv = () => {
    if (!data.length) return;
    const header = Object.keys(data[0]);
    const rows = data.map(row => header.map(field => '"' + String(row[field] ?? '').replace(/"/g, '""') + '"').join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'alerts_export.csv');
    link.click();
  };

  const handleAlertClick = async (row) => {
    setSelectedAlert(row);
    setTransaction(null);
    await fetch(`/alert/${row.alert_id}/reviewed`, { method: 'PATCH' });
    setData(prev => prev.map(a => a.alert_id === row.alert_id ? { ...a, reviewed: true } : a));
  };

  const fetchTransaction = async () => {
    if (!selectedAlert?.alert_id) return;
    setTransactionLoading(true);
    try {
      const res = await fetch(`/alert/${selectedAlert.alert_id}/transaction`);
      const json = await res.json();
      setTransaction(json.transaction);
    } catch (err) {
      console.error('Error fetching transaction:', err);
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedAlert?.alert_id || !newStatus) return;
    try {
      const res = await fetch(`/alert/${selectedAlert.alert_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSelectedAlert(prevAlert => ({ ...prevAlert, status: newStatus }));
        alert("Status updated successfully");
      } else {
        alert("Failed to update status");
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert("Error updating status");
    }
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#121212', color: '#f5f5f5', minHeight: '100vh', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center' }}>
          Date range:
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ marginLeft: '0.5rem' }}>
            <option value={1}>Last 1 day</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center' }}>
          Status:
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            <option value="new">New</option>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <button onClick={fetchData} style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white' }} disabled={loading}>
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button onClick={exportToCsv} style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white' }} disabled={loading || data.length === 0}>
          📥 Download CSV
        </button>
      </div>

      <div ref={parentRef} style={{
        overflowX: 'scroll',
        overflowY: 'auto',
        maxHeight: '70vh',
        backgroundColor: '#1f1f1f',
        position: 'relative',
        opacity: loading ? 0.3 : 1,
        pointerEvents: loading ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
        border: '1px solid #333',
        borderRadius: '6px',
        fontFamily: 'monospace',
        minWidth: '100%'
      }}>
        {data.length > 0 && (
          <div style={{ display: 'flex', position: 'sticky', top: 0, backgroundColor: '#2c2c2c', zIndex: 10 }}>
            <div style={{ width: 70, textAlign: 'center', padding: '4px', fontWeight: 'bold' }}>#</div>
            {(() => {
              const keys = Object.keys(data[0]);
              let reorderedKeys = keys.filter(k => !['severity', 'alert_id', 'reviewed', 'create_timestamp'].includes(k));
              const amountIndex = reorderedKeys.indexOf('amount');
              if (amountIndex !== -1) {
                const extraCols = ['score', 'tenant', 'severity'];
                extraCols.reverse().forEach(col => {
                  if (!reorderedKeys.includes(col)) {
                    reorderedKeys.splice(amountIndex + 1, 0, col);
                  }
                });
              }
              reorderedKeys = reorderedKeys.filter(k => k !== 'region');
              reorderedKeys = ['alert_id', 'region', 'reviewed', ...reorderedKeys, 'create_timestamp'];
              return reorderedKeys.map((col, idx) => (
                <div key={idx} style={{
                  width: getColumnWidth(col),
                  minWidth: getColumnWidth(col),
                  maxWidth: getColumnWidth(col),
                  padding: '4px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>{col}</div>
              ));
            })()}
          </div>
        )}
        <div>
          {data.map((row, rowIndex) => {
            const keys = Object.keys(row);
            let reorderedKeys = keys.filter(k => !['severity', 'alert_id', 'reviewed', 'create_timestamp'].includes(k));
            const amountIndex = reorderedKeys.indexOf('amount');
            if (amountIndex !== -1) {
              const extraCols = ['score', 'tenant', 'severity'];
              extraCols.reverse().forEach(col => {
                if (!reorderedKeys.includes(col)) {
                  reorderedKeys.splice(amountIndex + 1, 0, col);
                }
              });
            }
            reorderedKeys = reorderedKeys.filter(k => k !== 'region');
            reorderedKeys = ['alert_id', 'region', 'reviewed', ...reorderedKeys, 'create_timestamp'];
            const reordered = reorderedKeys.map(k => [k, row[k]]);
            return (
              <div key={rowIndex} style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: rowIndex % 2 === 0 ? '#1a1a1a' : '#252525' }}>
                <div style={{ width: 70, textAlign: 'center', padding: '4px', opacity: 0.7 }}>{rowIndex + 1}</div>
                {reordered.map(([key, val], idx) => (
                  <div key={idx}
                    onClick={() => key === 'alert_id' && handleAlertClick(row)}
                    style={{
                      width: getColumnWidth(key),
                      minWidth: getColumnWidth(key),
                      maxWidth: getColumnWidth(key),
                      padding: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: key === 'alert_id' ? 'pointer' : undefined,
                      color: key === 'score' ? '#000' : key === 'alert_id' ? '#007bff' : undefined,
                      fontWeight: row.reviewed === false ? 'bold' : 'normal',
                      fontStyle: row.reviewed === true ? 'italic' : 'normal',
                      opacity: row.reviewed === true ? 0.6 : 1,
                      backgroundColor:
                        key === 'severity' ? getSeverityColor(val)
                        : key === 'score' ? getScoreColor(val)
                        : undefined,
                      flexShrink: 0
                    }}>
                    {key === 'amount' && val !== null ? parseFloat(val).toFixed(2)
                      : key === 'reviewed' ? (val ? '✔️' : '❌')
                        : val}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>⬅ Prev</button>
        <span>Page {currentPage}</span>
        <button onClick={() => setCurrentPage(p => p + 1)}>Next ➡</button>
      </div>

      {selectedAlert && (
        <Modal onClose={() => setSelectedAlert(null)}>
          <div style={{ padding: '1rem', fontWeight: 'bold' }}>Alert Preview</div>
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
            <h4>Alert</h4>
            <pre>{JSON.stringify(selectedAlert, null, 2)}</pre>
            {transactionLoading && <p>🔄 Loading transaction...</p>}
            {transaction && <>
              <h4>Transaction</h4>
              <pre>{JSON.stringify(transaction, null, 2)}</pre>
            </>}
          </div>
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', background: '#2c2c2c' }}>
            <button onClick={() => setSelectedAlert(null)} style={{ backgroundColor: '#6c757d', color: 'white' }}>Close</button>
            {!transactionLoading && (
              <button onClick={fetchTransaction} style={{ backgroundColor: '#007bff', color: 'white' }}>
                {transaction ? '🔄 Reload Transaction' : 'Load Transaction'}
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ marginRight: '1rem' }}>Change Status:</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ marginRight: '1rem' }}>
                <option value="new">New</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
              <button onClick={handleStatusChange} style={{ backgroundColor: '#007bff', color: 'white' }}>Update Status</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AlertsTab;

