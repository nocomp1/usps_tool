// src/App.js
import React, { useState, useEffect } from 'react';
import CreateProjectForm from './CreateProjectForm';
import TransactionDetailForm from './TransactionDetailForm';

export default function App() {
  const [projects, setProjects] = useState([]);

  // loader function
  const loadProjects = () => {
    fetch('/mailings')
      .then(r => r.json())
      .then(setProjects)
      .catch(console.error);
  };

  useEffect(loadProjects, []);

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <CreateProjectForm onCreate={loadProjects} />
      <hr style={{ margin: '3rem 0' }} />
      <TransactionDetailForm projects={projects} />
    </div>
  );
}

