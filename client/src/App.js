import React, { useState, useEffect } from 'react';
import './App.css';
import UploadForm from './components/UploadForm';
import ExtractsList from './components/ExtractsList';
import DatabaseViewer from './components/DatabaseViewer';

function App() {
  const [extracts, setExtracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDatabaseViewer, setShowDatabaseViewer] = useState(false);

  const fetchExtracts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/extracts');
      const data = await response.json();
      setExtracts(data);
    } catch (error) {
      console.error('Error fetching extracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtracts();
  }, []);

  const handleUploadSuccess = () => {
    fetchExtracts();
    if (showDatabaseViewer) {
      // Trigger refresh of database viewer if it's open
      window.dispatchEvent(new Event('refresh-database'));
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/extracts/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchExtracts();
        if (showDatabaseViewer) {
          window.dispatchEvent(new Event('refresh-database'));
        }
      }
    } catch (error) {
      console.error('Error deleting extract:', error);
      alert('Failed to delete extract');
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>📄 PDF to Excel Extractor</h1>
          <p>Upload blood report PDFs and convert them to Excel format</p>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowDatabaseViewer(!showDatabaseViewer)}
            style={{ marginTop: '15px' }}
          >
            {showDatabaseViewer ? 'Hide' : 'Show'} Database Viewer
          </button>
        </header>

        <UploadForm onUploadSuccess={handleUploadSuccess} />

        {showDatabaseViewer && <DatabaseViewer />}

        <ExtractsList 
          extracts={extracts} 
          loading={loading}
          onDelete={handleDelete}
          onRefresh={fetchExtracts}
        />
      </div>
    </div>
  );
}

export default App;

