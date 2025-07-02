import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';

// Helper to format JSON (key: value per line)
const formatJSONToKeyValueLines = (jsonString) => {
  if (!jsonString) return '';
  try {
    const obj = JSON.parse(jsonString);
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  } catch (err) {
    console.error('Invalid JSON:', err);
    return jsonString; // fallback
  }
};

const Modal = ({ children, onClose }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        background: '#1f1f1f',
                color: '#f5f5f5',
        borderRadius: '8px',
        width: '80%',
        maxWidth: '1000px',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
};

const ExpandableField = ({ value }) => {
  const [showModal, setShowModal] = useState(false);
  const formattedValue = formatJSONToKeyValueLines(value);

  if (!value) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value.slice(0, 100)}...
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            marginLeft: '0.5rem',
            background: 'none',
            border: 'none',
            color: '#007bff',
            cursor: 'pointer',
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          [Expand]
        </button>
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
            XML Content
          </div>
          <div style={{
            flexGrow: 1,
            overflowY: 'auto',
            background: '#2c2c2c',
            padding: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
          }}>
            <pre style={{ margin: 0 }}>{formattedValue}</pre>
          </div>
          <div style={{
            padding: '1rem',
            borderTop: '1px solid #ccc',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#2c2c2c',
          }}>
            <button
              onClick={() => setShowModal(false)}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

const RecordPreviewModal = ({ record, onClose }) => {
  if (!record) return null;

  const mainFields = ['user_id', 'event_date', 'event_time', 'event_type', 'session_id'];
  const xmlFormatted = formatJSONToKeyValueLines(record.xml_blob);
  const otherFields = Object.keys(record).filter(key => !mainFields.includes(key) && key !== 'xml_blob');

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 'bold' }}>
        Record Preview
      </div>
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          {mainFields.map((field) => record[field] && (
            <div key={field}><strong>{field}:</strong> {record[field]}</div>
          ))}
        </div>
        {record.xml_blob && (
          <div style={{
            background: '#2c2c2c',
            padding: '1rem',
            marginBottom: '1rem',
            whiteSpace: 'pre-wrap',
          }}>
            <pre style={{ margin: 0 }}>{xmlFormatted}</pre>
          </div>
        )}
        <div>
          {otherFields.map((field) => (
            <div key={field}><strong>{field}:</strong> {record[field]}</div>
          ))}
        </div>
      </div>
      <div style={{
        padding: '1rem',
        borderTop: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'flex-end',
        background: '#2c2c2c',
      }}>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

const getColumnWidth = (key) => {
  if (key === 'user_id') return 270;
  if (key === 'event_date') return 90;
  if (key === 'event_time') return 140;
  if (key === 'event_type') return 90;
  if (key === 'metadata') return 140;
  if (key === 'session_id') return 180;
  return 150;
};

const DataBrowserTab = () => {
  const [hoveredRowIndex, setHoveredRowIndex] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [timing, setTiming] = useState({ callStart: null, frontend: null, total: null });
  const [serverTiming, setServerTiming] = useState({});
  const [previewRecord, setPreviewRecord] = useState(null);

  const parentRef = useRef();

  // CSV export helper function
  const exportToCsv = () => {
    if (data.length === 0) return;

  const header = Object.keys(data[0]);
  const csvRows = [
    header.join(','), // header row
    ...data.map(row =>
      header.map(fieldName => {
        const escaped = ('' + (row[fieldName] ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'data_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


  const fetchData = useCallback(async () => {
    const totalStart = performance.now();
    setLoading(true);

    try {
      const callStartTime = performance.now();
      const res = await fetch(`/browse?limit=${limit}`);
      const json = await res.json();
      const { data: rows, timing: serverTimingData } = json;
      const apiEnd = performance.now();

      setData(rows);
      setServerTiming(serverTimingData || {});

      setTimeout(() => {
        requestAnimationFrame(() => {
          const totalEnd = performance.now();
          setTiming({
            callStart: (callStartTime - totalStart).toFixed(1),
            frontend: (totalEnd - apiEnd).toFixed(1),
            total: (totalEnd - totalStart).toFixed(1),
          });
        });
      }, 0);

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  return (
    <div style={{ padding: '0.5rem', fontFamily: 'monospace', backgroundColor: '#121212', color: '#f5f5f5', minHeight: '100vh' }}>
      {/* Top controls */}
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center' }}>
          Rows to load:
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ marginLeft: '0.5rem' }}
          >
            {[10, 50, 100, 500, 1000, 5000].map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
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
            cursor: 'pointer',
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
            cursor: 'pointer',
          }}
          disabled={loading || data.length === 0}
        >
          📥 Download CSV
        </button>
      </div>

      {/* Timing panel */}
      <div style={{ fontSize: '0.85rem', color: '#f5f5f5', marginBottom: '0.5rem', width: '400px' }}>
        {[
          { label: '🚀 Frontend ➔ API Call Timing:', value: timing.callStart ? `${timing.callStart} ms` : null },
          { label: '🗄️ Server DB Query Time:', value: serverTiming.db_time != null ? `${serverTiming.db_time.toFixed(1)} ms` : null },
          { label: '⚙️ Server Processing Time (post-DB):', value: serverTiming.processing_time != null ? `${serverTiming.processing_time.toFixed(1)} ms` : null },
          { label: '🛠️ Server Total API Time:', value: serverTiming.api_time != null ? `${serverTiming.api_time.toFixed(1)} ms` : null },
          { label: '🖥️ Frontend Render Time:', value: timing.frontend ? `${timing.frontend} ms` : null },
          { label: '⏱️ Total Time (Click ➔ Visible):', value: timing.total ? `${timing.total} ms` : null, bold: true },
        ].map((item, idx) => item.value && (
          <div key={idx} style={{ display: 'flex', marginBottom: '2px' }}>
            <div style={{ flex: '0 0 70%' }}>
              {item.bold ? <strong>{item.label}</strong> : item.label}
            </div>
            <div style={{ flex: '0 0 30%', textAlign: 'right' }}>
              {item.bold ? <strong>{item.value}</strong> : item.value}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ marginBottom: '0.5rem', color: '#007bff', fontSize: '0.9rem' }}>
          🔄 Loading data...
        </div>
      )}

          {/* Table */}
      <div
        ref={parentRef}
        style={{
          height: '600px',
          overflow: 'auto',
          border: '1px solid #333',
          backgroundColor: '#1f1f1f',
          position: 'relative',
          opacity: loading ? 0.3 : 1,
          pointerEvents: loading ? 'none' : 'auto',
          transition: 'opacity 0.3s ease',
        }}
      >
        {data.length > 0 && (
          <div
            style={{
              display: 'flex',
              position: 'sticky',
              top: 0,
              backgroundColor: '#2c2c2c',
              zIndex: 10,
              borderBottom: '2px solid #333',
            }}
          >
		    <div
              style={{
                width: '60px',
                minWidth: '60px',
                maxWidth: '60px',
                padding: '4px',
                fontWeight: 'bold',
                textAlign: 'right',
                opacity: 0.7,
              }}
            >
              #
            </div>
            {Object.keys(data[0]).map((col, idx) => (
              <div
                key={idx}
                style={{
                  width: `${getColumnWidth(col)}px`,
                  minWidth: `${getColumnWidth(col)}px`,
                  maxWidth: `${getColumnWidth(col)}px`,
                  padding: '4px',
                  fontWeight: 'bold',
                  textAlign: 'left',
                }}
              >
                {col}
              </div>
            ))}
          </div>
        )}
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const row = data[virtualRow.index];
			const rowIndex = virtualRow.index + 1; // Start counting at 1
            return (
              <div
                key={virtualRow.key}
			    onMouseEnter={() => setHoveredRowIndex(virtualRow.index)}
				onMouseLeave={() => setHoveredRowIndex(null)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                  display: 'flex',
                  width: '100%',
                  borderBottom: '1px solid #333',
                  backgroundColor: hoveredRowIndex === virtualRow.index
                    ? '#333' // when hovered
                    : (virtualRow.index % 2 === 0 ? '#1a1a1a' : '#252525'), // normal alternating
					transition: 'background-color 0.2s ease', // smooth effect
                }}
              >
			    {/* 📌 Row number cell */}
                <div
                  style={{
                    width: '60px',
                    minWidth: '60px',
                    maxWidth: '60px',
                    padding: '4px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    opacity: 0.7,
                  }}
              >
                  {rowIndex}
                </div>
                {Object.entries(row).map(([key, val], idx) => (
                  <div
                    key={idx}
                    style={{
                      width: `${getColumnWidth(key)}px`,
                      minWidth: `${getColumnWidth(key)}px`,
                      maxWidth: `${getColumnWidth(key)}px`,
                      padding: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: key === 'user_id' ? 'pointer' : undefined,
                      color: key === 'user_id' ? '#007bff' : undefined,
                    }}
                    onClick={() => key === 'user_id' && setPreviewRecord(row)}
                  >
                    {key === 'xml_blob' && typeof val === 'string'
                      ? <ExpandableField value={val} />
                      : (typeof val === 'string' && val.length > 100
                        ? val.slice(0, 100) + '...'
                        : val)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {previewRecord && (
        <RecordPreviewModal record={previewRecord} onClose={() => setPreviewRecord(null)} />
      )}
    </div>
  );
};

export default DataBrowserTab;

