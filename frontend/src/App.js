import React from 'react';
import CreateProjectForm from './CreateProjectForm';
import TransactionDetailForm from './TransactionDetailForm';

export default function App() {
  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Section 1: create a new project */}
      <CreateProjectForm />

      {/* Add some visual separation */}
      <hr style={{ margin: '3rem 0' }} />

      {/* Section 2: transaction details */}
      <TransactionDetailForm />
    </div>
  );
}
