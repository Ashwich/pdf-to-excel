import React from 'react';

const ExtractsList = ({ extracts, loading, onDelete, onRefresh }) => {
  const handleDownload = async (id, filename) => {
    try {
      const response = await fetch(`/api/download/${id}`);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace('.pdf', '.xlsx');
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download Excel file');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">Loading extracts...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Extracted Reports</h2>
        <button className="btn btn-primary btn-small" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {extracts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No extracts found. Upload a PDF to get started!</p>
        </div>
      ) : (
        <table className="extracts-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Uploaded</th>
              <th>Text Length</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {extracts.map((extract) => (
              <tr key={extract.id}>
                <td>
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <span>{extract.original_filename}</span>
                  </div>
                </td>
                <td>{formatDate(extract.created_at)}</td>
                <td>{extract.text_length} characters</td>
                <td>
                  <div className="actions">
                    <button
                      className="btn btn-success btn-small"
                      onClick={() => handleDownload(extract.id, extract.original_filename)}
                    >
                      Download Excel
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this extract?')) {
                          onDelete(extract.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ExtractsList;

