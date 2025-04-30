import React, { useState, useEffect } from 'react';

export default function CreateProjectForm({ onCreate }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

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

   // 1) fetch helper: maps API data → table rows
   const fetchRows = () => {
    fetch('/mailings')
      .then(res => res.json())
      .then(data => {
        const existing = data.map(p => ({
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
        setRows([ blankRow(), ...existing ]);
      })
      .catch(err => console.error('Fetch failed:', err));
  };

  // 2) run once on mount
  useEffect(fetchRows, []);

  const updateRowField = (i, field, value) => {
    const newRows = [...rows];
    newRows[i][field] = value;
    setRows(newRows);
  };

  // Require all fields to be non-empty
  const validateRow = row => {
    const requiredKeys = [
      ['projectDescription','Project Description'],
      ['projectId','Project #'],
      ['jobId','Job #'],
      ['productType','Product Type'],
      ['pieceWeight','Piece Weight'],
      ['quantity','Quantity'],
      ['totalPostage','Total Postage'],
      ['netPostage','Net Postage'],
      ['discount','Discount']
    ];
    for (let [key,label] of requiredKeys) {
      if (row[key] === '' || row[key] === null || row[key] === undefined) {
        return `${label} is required`;
      }
    }
    return null;
  };


  const saveRow = async idx => {
    const row = rows[idx];
    const error = validateRow(row);
    if (error) {
      setMessage(error);
      return;
    }
    const payload = {
      project_description: row.projectDescription,
      product_type:        row.productType,
      piece_weight:        parseFloat(row.pieceWeight),
      quantity:            parseInt(row.quantity, 10),
      total_postage:       parseFloat(row.totalPostage),
      net_postage:         parseFloat(row.netPostage),
      discount:            parseFloat(row.discount),
      job_id:              row.jobId,
      project_id:          row.projectId
    };
    try {
      const url = row.id ? `/mailings/${row.id}` : '/mailings';
      const method = row.id ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      setMessage(`Project ID ${result.id} saved`);
      fetchRows();
      onCreate();
    } catch (e) {
      console.error(e);
      setMessage(`Error: ${e.message}`);
    }
  };

  const deleteRow = async idx => {
    const row = rows[idx];
    // Prevent deleting incomplete new rows
    const error = validateRow(row);
    if (!row.id && error) {
      setMessage('Cannot delete an incomplete row. ' + error);
      return;
    }
    if (row.id) {
      if (!window.confirm('Delete this project?')) return;
      try {
        const resp = await fetch(`/mailings/${row.id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setMessage(`Deleted project ${row.id}`);
               // remove it locally instead of re-calling onCreate()
            setRows(rows.filter((_, i) => i !== idx));
            return;
      } catch (e) {
        console.error(e);
        setMessage(`Error: ${e.message}`);
        return;
      }
    }
    setRows(rows.filter((_, i) => i !== idx));
  };

  const addNewRow = () => setRows([blankRow(), ...rows.slice(1)]);

  const sortedRows = () => {
    const [first, ...rest] = rows;
    const sorted = rest.sort((a,b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id);
    return [first, ...sorted];
  };

  // Find the original index in rows for a sorted row
  const findIndex = r => rows.findIndex(x => x === r || (r.id !== null && x.id === r.id));

  return (
    <div style={{ maxWidth: '100%', margin: '2rem auto' }}>
      {/* Message at top */}
      {message && <div style={{ marginBottom: '1rem', color: 'red' }}>{message}</div>}

      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={addNewRow} style={{ padding: '0.5rem 1rem' }}>
          Create New Project
        </button>
        <label>
          Sort:
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
            <tr>
              {['PROJECT NAME','PROJECT #','JOB #','PRODUCT TYPE','PIECE WEIGHT','QUANTITY','TOTAL POSTAGE','NET POSTAGE','DISCOUNT','ACTIONS']
                .map(h => <th key={h} style={{
                    padding: '0.5rem',
                    minWidth: ['PROJECT NAME','PRODUCT TYPE'].includes(h) ? '150px' : '80px'
                  }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedRows().map((r, idx) => {
              const rawIdx = findIndex(r);
              return (
              <tr key={idx}>
                <td style={cellStyle}>
                  <input value={r.projectDescription} onChange={e => updateRowField(rawIdx,'projectDescription',e.target.value)} style={inputStyle} />
                </td>
                <td style={cellStyle}>
                  <input value={r.projectId} onChange={e => updateRowField(rawIdx,'projectId',e.target.value)} style={inputStyle} />
                </td>
                <td style={cellStyle}>
                  <input value={r.jobId} onChange={e => updateRowField(rawIdx,'jobId',e.target.value)} style={inputStyle} />
                </td>
                <td style={cellStyle}>
                  <select value={r.productType} onChange={e => updateRowField(rawIdx,'productType',e.target.value)} style={inputStyle}>
                    {['Flats','Letters','First Class Letters','Post Card','First Class Flats'].map(opt=><option key={opt}>{opt}</option>)}
                  </select>
                </td>
                <td style={cellStyle}><input type="number" step="0.0001" value={r.pieceWeight} onChange={e=>updateRowField(rawIdx,'pieceWeight',e.target.value)} style={inputStyle} /></td>
                <td style={cellStyle}><input type="number" value={r.quantity} onChange={e=>updateRowField(rawIdx,'quantity',e.target.value)} style={inputStyle} /></td>
                <td style={cellStyle}><input type="number" step="0.01" value={r.totalPostage} onChange={e=>updateRowField(rawIdx,'totalPostage',e.target.value)} style={inputStyle} /></td>
                <td style={cellStyle}><input type="number" step="0.01" value={r.netPostage} onChange={e=>updateRowField(rawIdx,'netPostage',e.target.value)} style={inputStyle} /></td>
                <td style={cellStyle}><input type="number" step="0.01" value={r.discount} onChange={e=>updateRowField(rawIdx,'discount',e.target.value)} style={inputStyle} /></td>
                <td style={cellStyle}>
                  <button onClick={() => saveRow(rawIdx)} style={actionButtonStyle}>Save</button>
                  <button onClick={() => deleteRow(rawIdx)} style={actionButtonStyle}>Delete</button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Styles
const headerStyle = { padding: '0.5rem', textAlign: 'center' };
const cellStyle = { border: '1px solid #ddd', padding: '0.5rem', textAlign: 'center' };
const inputStyle = { width: '100%', padding: '0.25rem', boxSizing: 'border-box' };
const actionButtonStyle = { padding: '0.5rem 1rem', cursor: 'pointer', minWidth: '80px', margin: '0.5rem 0.25rem' };
