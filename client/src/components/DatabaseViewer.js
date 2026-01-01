import React, { useState, useEffect } from 'react';

const DatabaseViewer = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchDatabaseInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/database-info');
      if (!response.ok) {
        throw new Error('Failed to fetch database info');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseInfo();
    
    // Listen for refresh events
    const handleRefresh = () => {
      fetchDatabaseInfo();
    };
    
    window.addEventListener('refresh-database', handleRefresh);
    
    return () => {
      window.removeEventListener('refresh-database', handleRefresh);
    };
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">Loading database information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">Error: {error}</div>
        <button className="btn btn-primary" onClick={fetchDatabaseInfo} style={{ marginTop: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📊 Database Viewer</h2>
        <button className="btn btn-primary btn-small" onClick={fetchDatabaseInfo}>
          Refresh
        </button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f2ff', borderRadius: '6px' }}>
        <strong>Total Records: {data.totalRecords}</strong>
      </div>

      {data.totalRecords === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No records in database. Upload a PDF to create records!</p>
        </div>
      ) : (
        <div className="database-records">
          {data.records.map((record) => (
            <div key={record.id} className="database-record">
              <div className="record-header" onClick={() => toggleExpand(record.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <strong>ID: {record.id}</strong> - {record.original_filename}
                  </div>
                  <div style={{ fontSize: '1.2rem' }}>
                    {expandedId === record.id ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {expandedId === record.id && (
                <div className="record-details">
                  <div className="detail-row">
                    <strong>Stored Filename:</strong> {record.filename}
                  </div>
                  <div className="detail-row">
                    <strong>Created At:</strong> {formatDate(record.created_at)}
                  </div>
                  <div className="detail-row">
                    <strong>Text Length:</strong> {record.text_length} characters
                  </div>
                  <div className="detail-row">
                    <strong>Excel Data Length:</strong> {record.data_length} characters
                  </div>

                  {record.text_preview && (
                    <div className="detail-section">
                      <strong>Extracted Text Preview:</strong>
                      <div className="preview-box">
                        {record.text_preview}
                        {record.text_length > 500 && '...'}
                      </div>
                    </div>
                  )}

                  {record.excelDataPreview && (
                    <div className="detail-section">
                      <strong>Excel Data Info:</strong>
                      <div className="preview-box">
                        <div><strong>Rows:</strong> {record.excelDataPreview.rowCount}</div>
                        {record.excelDataPreview.columns && record.excelDataPreview.columns.length > 0 && (
                          <>
                            <div><strong>Columns:</strong> {record.excelDataPreview.columns.join(', ')}</div>
                            {record.excelDataPreview.firstRow && (
                              <div style={{ marginTop: '10px' }}>
                                <strong>First Row Sample:</strong>
                                <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                                  {JSON.stringify(record.excelDataPreview.firstRow, null, 2)}
                                </pre>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DatabaseViewer;

