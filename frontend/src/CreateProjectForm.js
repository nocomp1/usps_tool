import React, { useState, useEffect } from 'react';

export default function CreateProjectForm({ onCreate }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');

  // Template for a new blank project row
  const blankRow = () => ({
    id: null,
    projectDescription: '',
    projectId: '',
    jobId: '',
    productType: 'Flats',
    pieceWeight: '',
    quantity: '',
    totalPostage: '',
    netPostage: '',
    discount: ''
  });

  // Load existing projects on mount, and prepend a blank row
  useEffect(() => {
    fetch('/mailings')
      .then(res => res.json())
      .then(data => {
        const existingRows = data.map(p => ({
          id: p.id,
          projectDescription: p.project_description,
          projectId: p.project_id || '',
          jobId: p.job_id || '',
          productType: p.product_type,
          pieceWeight: p.piece_weight,
          quantity: p.quantity,
          totalPostage: p.total_postage,
          netPostage: p.net_postage,
          discount: p.discount || ''
        }));
        setRows([blankRow(), ...existingRows]);
      })
      .catch(err => console.error('Fetch projects failed:', err));
  }, [onCreate]);

  // Update a specific field in a row
  const updateRowField = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  // Save a single row: POST if new, PUT if existing
  const saveRow = async (index) => {
    const row = rows[index];
    const payload = {
      project_description: row.projectDescription,
      product_type: row.productType,
      piece_weight: parseFloat(row.pieceWeight),
      quantity: parseInt(row.quantity, 10),
      total_postage: parseFloat(row.totalPostage),
      net_postage: parseFloat(row.netPostage),
      discount: parseFloat(row.discount) || 0,
      job_id: row.jobId,
      project_id: row.projectId
    };
    try {
      let resp;
      if (row.id) {
        resp = await fetch(`/mailings/${row.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      } else {
        resp = await fetch('/mailings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      setMessage(`Saved project ID ${result.id}`);
      onCreate();
      // Refresh list: reload existing rows to get updated data
      const refreshed = await fetch('/mailings').then(r => r.json());
      const existingRows = refreshed.map(p => ({
        id: p.id,
        projectDescription: p.project_description,
        projectId: p.project_id || '',
        jobId: p.job_id || '',
        productType: p.product_type,
        pieceWeight: p.piece_weight,
        quantity: p.quantity,
        totalPostage: p.total_postage,
        netPostage: p.net_postage,
        discount: p.discount || ''
      }));
      setRows([blankRow(), ...existingRows]);
    } catch (err) {
      console.error('Save failed:', err);
      setMessage(`Error: ${err.message}`);
    }
  };

  // Delete a single row
  const deleteRow = async (index) => {
    const row = rows[index];
    if (row.id) {
      try {
        const resp = await fetch(`/mailings/${row.id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setMessage(`Deleted project ID ${row.id}`);
      } catch (err) {
        console.error('Delete failed:', err);
        setMessage(`Error: ${err.message}`);
        return;
      }
    }
    // Remove row from table
    setRows(rows.filter((_, i) => i !== index));
  };

  // Add a new blank row at top
  const addNewRow = () => setRows([blankRow(), ...rows]);

  return (
    <div style={{ maxWidth: '100%', margin: '2rem auto' }}>
      <button onClick={addNewRow} style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>
        Create New Project
      </button>
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
            <tr>
              {['PROJECT NAME','PROJECT #','JOB #','PRODUCT TYPE','PIECE WEIGHT','QUANTITY','TOTAL POSTAGE','NET POSTAGE','DISCOUNT','ACTIONS']
                .map(h => <th key={h} style={headerStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td style={cellStyle}>
                  <input
                    value={r.projectDescription}
                    onChange={e => updateRowField(idx, 'projectDescription', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    value={r.projectId}
                    onChange={e => updateRowField(idx, 'projectId', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    value={r.jobId}
                    onChange={e => updateRowField(idx, 'jobId', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <select
                    value={r.productType}
                    onChange={e => updateRowField(idx, 'productType', e.target.value)}
                    style={inputStyle}
                  >
                    {['Flats','Letters','First Class Letters','Post Card','First Class Flats']
                      .map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                </td>
                <td style={cellStyle}>
                  <input
                    type="number" step="0.0001"
                    value={r.pieceWeight}
                    onChange={e => updateRowField(idx, 'pieceWeight', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="number"
                    value={r.quantity}
                    onChange={e => updateRowField(idx, 'quantity', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="number" step="0.01"
                    value={r.totalPostage}
                    onChange={e => updateRowField(idx, 'totalPostage', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="number" step="0.01"
                    value={r.netPostage}
                    onChange={e => updateRowField(idx, 'netPostage', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="number" step="0.01"
                    value={r.discount}
                    onChange={e => updateRowField(idx, 'discount', e.target.value)}
                    style={inputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <button onClick={() => saveRow(idx)} style={actionButtonStyle}>
                    Save
                  </button>
                  <button onClick={() => deleteRow(idx)} style={{ ...actionButtonStyle, marginLeft: '0.5rem' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {message && <div style={{ marginTop: '1rem' }}>{message}</div>}
    </div>
  );
}

// Styles
const headerStyle = { padding: '0.5rem', textAlign: 'center' };
const cellStyle = { border: '1px solid #ddd', padding: '0.5rem', textAlign: 'center' };
const inputStyle = { width: '100%', padding: '0.25rem', boxSizing: 'border-box' };
const actionButtonStyle = { padding: '0.25rem 0.5rem', cursor: 'pointer' };
