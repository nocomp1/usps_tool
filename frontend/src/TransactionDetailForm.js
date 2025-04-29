import React, { useState, useEffect } from 'react';

export default function TransactionDetailForm() {
  const [projectsList, setProjectsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [projectFilter, setProjectFilter] = useState('');

  // Fetch latest projects on mount
  useEffect(() => {
    fetch('/mailings')
      .then(res => res.json())
      .then(data => setProjectsList(data))
      .catch(err => console.error('Failed to fetch projects:', err));
  }, []);

  const blankRow = productType => ({
    id: null,
    category: 'Piece',
    product: productType || '',
    entry: '5-Digit',
    price_category: 'None',
    line_price: '',
    number_of_pieces: '',
    total_postage: '',
    discount: '',
    net_postage: ''
  });

  // Load transactions when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setRows([]);
      return;
    }
    const project = projectsList.find(p => String(p.id) === selectedProjectId);
    const productType = project?.product_type || '';
    fetch('/transactions')
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(tx => String(tx.project_id) === selectedProjectId);
        setRows([blankRow(productType), ...filtered.map(tx => ({ ...tx, product: productType }))]);
      })
      .catch(err => console.error(err));
  }, [selectedProjectId, projectsList]);

  const updateField = (idx, field, value) => {
    const copy = [...rows];
    copy[idx][field] = value;
    setRows(copy);
  };

  const validateRow = row => {
    const required = [
      ['category','Category'],
      ['entry','Entry'],
      ['price_category','Price Category'],
      ['line_price','Line Price'],
      ['number_of_pieces','Pieces'],
      ['total_postage','Total Postage'],
      ['net_postage','Net Postage']
    ];
    for (let [key,label] of required) {
      if ((row[key] === '' || row[key] == null) && row[key] !== 0) {
        return `${label} is required`;
      }
    }
    return null;
  };

  const saveRow = async idx => {
    const row = { ...rows[idx], project_id: parseInt(selectedProjectId, 10) };
    const err = validateRow(row);
    if (err) {
      setMessage(err);
      return;
    }
    const payload = {
      project_id: row.project_id,
      category: row.category,
      product: row.product,
      entry: row.entry,
      price_category: row.price_category,
      line_price: parseFloat(row.line_price),
      number_of_pieces: parseInt(row.number_of_pieces, 10),
      total_postage: parseFloat(row.total_postage),
      discount: parseFloat(row.discount) || 0,
      net_postage: parseFloat(row.net_postage)
    };
    try {
      const url = row.id ? `/transactions/${row.id}` : '/transactions';
      const method = row.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage('Transaction saved');
      // refresh rows
      const all = await fetch('/transactions').then(r => r.json());
      const filtered = all.filter(tx => String(tx.project_id) === selectedProjectId);
      setRows([blankRow(row.product), ...filtered.map(tx => ({ ...tx, product: row.product }))]);
    } catch (e) {
      console.error(e);
      setMessage(`Error: ${e.message}`);
    }
  };

  const deleteRow = async idx => {
    const row = rows[idx];
    if (!row.id) {
      setMessage('Cannot delete unsaved/incomplete row');
      return;
    }
    if (!window.confirm('Delete this transaction?')) return;
    try {
      const res = await fetch(`/transactions/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage(`Deleted transaction ${row.id}`);
      const all = await fetch('/transactions').then(r => r.json());
      const filtered = all.filter(tx => String(tx.project_id) === selectedProjectId);
      setRows([blankRow(row.product), ...filtered.map(tx => ({ ...tx, product: row.product }))]);
    } catch (e) {
      console.error(e);
      setMessage(`Error: ${e.message}`);
    }
  };

  const findRawIndex = r => rows.findIndex(x => x === r || (r.id && x.id === r.id));

  const sortedRows = () => {
    if (!rows.length) return [];
    const [first, ...rest] = rows;
    rest.sort((a, b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id);
    return [first, ...rest];
  };

  return (
    <div style={{ maxWidth: '100%', margin: '2rem auto' }}>
      {message && <div style={{ color: 'red', marginBottom: '1rem' }}>{message}</div>}

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <label>
          Search Project:
          <input
            type="text"
            placeholder="Name / # / Job"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Project: </label>
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
        >
          <option value="">-- Select Project --</option>
          {projectsList
            .filter(p =>
              p.project_description.toLowerCase().includes(projectFilter.toLowerCase()) ||
              String(p.project_id).includes(projectFilter) ||
              String(p.job_id || '').includes(projectFilter)
            )
            .map(p => (
              <option key={p.id} value={String(p.id)}>
                {`${p.project_description} | #${p.project_id}${p.job_id ? ` | Job ${p.job_id}` : ''}`}
              </option>
            ))}
        </select>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
            <label>
              Sort:
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                style={{ marginLeft: '0.5rem' }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
              <tr>
                {['#','Category','Product','Entry','Price Cat','Line','Pieces','Total','Discount','Net','Actions'].map(h => (
                  <th
                    key={h}
                    style={{ padding: '0.5rem', minWidth: ['Category','Product','Entry','Price Cat'].includes(h) ? '100px' : '80px' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows().map((r, idx) => {
                const rawIdx = findRawIndex(r);
                return (
                  <tr key={idx}>
                    <td style={tdStyle}>{r.id || ''}</td>
                    <td style={tdStyle}>
                      <select
                        value={r.category}
                        onChange={e => updateField(rawIdx, 'category', e.target.value)}
                        style={inputStyle}
                      >
                        <option>Piece</option>
                        <option>Pound</option>
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input type="text" value={r.product} disabled style={inputStyle} />
                    </td>
                    <td style={tdStyle}>
                      <input type="text" value={r.entry} disabled style={inputStyle} />
                    </td>
                    <td style={tdStyle}>
                      <input type="text" value={r.price_category} disabled style={inputStyle} />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={r.line_price}
                        onChange={e => updateField(rawIdx, 'line_price', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={r.number_of_pieces}
                        onChange={e => updateField(rawIdx, 'number_of_pieces', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={r.total_postage}
                        onChange={e => updateField(rawIdx, 'total_postage', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={r.discount}
                        onChange={e => updateField(rawIdx, 'discount', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={r.net_postage}
                        onChange={e => updateField(rawIdx, 'net_postage', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => saveRow(rawIdx)} style={actionBtn}>Save</button>
                      <button onClick={() => deleteRow(rawIdx)} style={actionBtn}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const tdStyle = { border: '1px solid #ddd', padding: '0.5rem', textAlign: 'center' };
const inputStyle = { width: '100%', boxSizing: 'border-box' };
const actionBtn = { padding: '0.25rem 0.5rem', margin: '0.25rem', minWidth: '60px', cursor: 'pointer' };
