import React, { useState, useEffect } from 'react';
import CreateProjectForm from './CreateProjectForm';
import TransactionDetailForm from './TransactionDetailForm';
import ReportingPage from './ReportingPage';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('menu');

  const loadProjects = () => {
    fetch('/mailings')
      .then(res => res.json())
      .then(setProjects)
      .catch(console.error);
  };

  useEffect(loadProjects, []);

  const headerBar = {
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: '1rem',
    textAlign: 'center',
    borderRadius: '4px',
    marginBottom: '2rem'
  };

  const logoStyle = {
    height: 40
  };

  const menuItem = {
    padding: '0.75rem 0',
    cursor: 'pointer',
    fontWeight: 500,
    borderBottom: '1px solid #e5e7eb'
  };

  const backButton = {
    marginBottom: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#1f2937',
    color: '#fff',
    border: '1px solid #1f2937',
    borderRadius: 4,
    cursor: 'pointer'
  };

  const renderMenu = () => (
    <div style={{ padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <img src="/logo.png" alt="Lithographix" style={logoStyle} />
        <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>Lithographix</span>
      </div>

      <header style={headerBar}>
        <h2 style={{ margin: 0, color: '#fff' }}>POSTAL QUALIFICATION ANALYSIS</h2>
      </header>

      <nav>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#1f2937' }}>
          <li style={menuItem} onClick={() => setView('create')}>Create Project</li>
          <li style={menuItem} onClick={() => setView('transactions')}>Enter Statement Details</li>
          <li style={menuItem} onClick={() => setView('reporting')}>Reporting</li>
          <li style={menuItem} onClick={() => setView('projections')}>Projections</li>
        </ul>
      </nav>
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      {view === 'menu' && renderMenu()}

      {view === 'create' && (
        <>
          <button onClick={() => setView('menu')} style={backButton}>&larr; Back to Menu</button>
          <CreateProjectForm onCreate={() => { loadProjects(); setView('menu'); }} />
        </>
      )}

      {view === 'transactions' && (
        <>
          <button onClick={() => setView('menu')} style={backButton}>&larr; Back to Menu</button>
          <TransactionDetailForm projects={projects} />
        </>
      )}

      {view === 'reporting' && (
        <>
          <button onClick={() => setView('menu')} style={backButton}>&larr; Back to Menu</button>
          <ReportingPage />
        </>
      )}

      {view === 'projections' && (
        <>
          <button onClick={() => setView('menu')} style={backButton}>&larr; Back to Menu</button>
          <p>Projections view coming soon.</p>
        </>
      )}
    </div>
  );
}
