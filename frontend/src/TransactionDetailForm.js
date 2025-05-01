import React, { useState, useEffect } from 'react';

export default function TransactionDetailForm() {
  // ── Project list & selection ───────────────────────────────────────────────
  const [projectsList, setProjectsList]           = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // ── Transaction rows & UI state ────────────────────────────────────────────
  const [rows, setRows]           = useState([]);
  const [message, setMessage]     = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [projectFilter, setProjectFilter] = useState('');

  // ── Entry options: defaults + any custom ones loaded from the DB ────────────
  const defaultEntryOptions = [
    '5-Digit',
    '3-Digit',
    'ADC',
    'Basic',
    'Local',
    'Mixed ADC',
    'DISPLAY ONLY 5-Digit Automation Flats - Number of Pieces that Comply',
    'DISPLAY ONLY 3-Digit Automation Flats - Number of Pieces that Comply',
    'DISPLAY ONLY Automation Flats - Number of Pieces that Comply',
    'DISPLAY ONLY Flats - Number of Pieces that Comply',
    'DISPLAY ONLY 3-Digit Nonautomation Flats - Number of Pieces that Comply',
    'DISPLAY ONLY Nonautomation Flats - Number of Eligible Pieces',
  ];
  const [entryOptions, setEntryOptions] = useState(defaultEntryOptions);
  const [newEntryOption, setNewEntryOption] = useState('');

  // ── Price Category options ─────────────────────────────────────────────────
  const priceCategoryOptions = ['None', 'DNDC', 'DSCF'];

  // ── Fetch projects once ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/mailings')
      .then(r => r.json())
      .then(setProjectsList)
      .catch(err => console.error('Failed to fetch projects:', err));
  }, []);

  // ── Helper: blank row for the table ────────────────────────────────────────
  const blankRow = productType => ({
    id:               null,
    category:         'Piece',
    product:          productType || '',
    entry:            entryOptions[0],
    price_category:   priceCategoryOptions[0],
    line_price:       '',
    number_of_pieces: '',
    total_postage:    '',
    discount:         '',
    net_postage:      ''
  });

  // ── Load transactions + extract custom entries whenever project changes ─────
  useEffect(() => {
    if (!selectedProjectId) {
      setRows([]);
      return;
    }
    const project     = projectsList.find(p => String(p.id) === selectedProjectId);
    const productType = project?.product_type || '';

    fetch('/transactions')
      .then(r => r.json())
      .then(data => {
        // filter to this project
        const filtered = data.filter(tx => String(tx.project_id) === selectedProjectId);

        // extract any custom entries they’ve used
        const usedEntries = filtered
          .map(tx => tx.entry)
          .filter(e => !defaultEntryOptions.includes(e));
        const uniqueCustom = Array.from(new Set(usedEntries));

        // update dropdown-options state
        setEntryOptions([ ...defaultEntryOptions, ...uniqueCustom ]);

        // prime the table (blank row first)
        setRows([
          blankRow(productType),
          ...filtered.map(tx => ({ ...tx, product: productType }))
        ]);
      })
      .catch(console.error);
  }, [selectedProjectId, projectsList]);

  // ── Field updates, validation ───────────────────────────────────────────────
  const updateField = (idx, field, val) => {
    const copy = [...rows];
    copy[idx][field] = val;
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

  // ── Save (POST or PUT) ──────────────────────────────────────────────────────
  const saveRow = async idx => {
    const base = { ...rows[idx], project_id: parseInt(selectedProjectId, 10) };
    const err  = validateRow(base);
    if (err) {
      setMessage(err);
      return;
    }
    const payload = {
      project_id:       base.project_id,
      category:         base.category,
      product:          base.product,
      entry:            base.entry,
      price_category:   base.price_category,
      line_price:       parseFloat(base.line_price),
      number_of_pieces: parseInt(base.number_of_pieces, 10),
      total_postage:    parseFloat(base.total_postage),
      discount:         parseFloat(base.discount) || 0,
      net_postage:      parseFloat(base.net_postage),
    };
    try {
      const url    = base.id ? `/transactions/${base.id}` : '/transactions';
      const method = base.id ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage('Transaction saved');

      // reload table & entry-options
      const all = await fetch('/transactions').then(r => r.json());
      const filtered = all.filter(tx => String(tx.project_id) === selectedProjectId);
      const usedEntries = filtered
        .map(tx => tx.entry)
        .filter(e => !defaultEntryOptions.includes(e));
      const uniqueCustom = Array.from(new Set(usedEntries));
      setEntryOptions([ ...defaultEntryOptions, ...uniqueCustom ]);
      setRows([
        blankRow(base.product),
        ...filtered.map(tx => ({ ...tx, product: base.product }))
      ]);
    } catch (e) {
      console.error(e);
      setMessage(`Error: ${e.message}`);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteRow = async idx => {
    const row = rows[idx];
    if (!row.id) {
      setMessage('Cannot delete unsaved row');
      return;
    }
    if (!window.confirm('Delete this transaction?')) return;
    try {
      const res = await fetch(`/transactions/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage(`Deleted transaction ${row.id}`);

      const all = await fetch('/transactions').then(r => r.json());
      const filtered = all.filter(tx => String(tx.project_id) === selectedProjectId);
      const usedEntries = filtered
        .map(tx => tx.entry)
        .filter(e => !defaultEntryOptions.includes(e));
      const uniqueCustom = Array.from(new Set(usedEntries));
      setEntryOptions([ ...defaultEntryOptions, ...uniqueCustom ]);
      setRows([
        blankRow(row.product),
        ...filtered.map(tx => ({ ...tx, product: row.product }))
      ]);
    } catch (e) {
      console.error(e);
      setMessage(`Error: ${e.message}`);
    }
  };

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const addEntryOption = () => {
    const opt = newEntryOption.trim();
    if (opt && !entryOptions.includes(opt)) {
      setEntryOptions([ ...entryOptions, opt ]);
      setNewEntryOption('');
    }
  };
  const findRawIndex = r => rows.findIndex(x => x === r || (r.id && x.id === r.id));
  const sortedRows  = () => {
    if (!rows.length) return [];
    const [first, ...rest] = rows;
    return [
      first,
      ...[...rest].sort((a,b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id)
    ];
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '100%', margin: '2rem auto' }}>
      {message && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          {message}
        </div>
      )}

      {/* Search + Project selector on same line */}
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Search:
          <input
            type="text"
            placeholder="Name / # / Job"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            style={{ padding: '0.25rem', minWidth: '200px' }}
          />
        </label>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flex: 1
        }}>
          Project:
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            style={{ flex: 1, padding: '0.25rem' }}
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
                  {`${p.project_description} | #${p.project_id}${
                    p.job_id ? ` | Job ${p.job_id}` : ''
                  }`}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* Combine New Entry Option + Sort on one line */}
      {rows.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          marginBottom: '1rem'
        }}>
          {/* New Entry Option */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            New Entry Option:
            <input
              type="text"
              placeholder="Type entry label"
              value={newEntryOption}
              onChange={e => setNewEntryOption(e.target.value)}
              style={{ padding: '0.25rem', minWidth: '200px' }}
            />
          </label>
          <button onClick={addEntryOption} style={actionBtn}>
            Add
          </button>

          {/* Sort control */}
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Sort:
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      )}

      {/* Transactions table */}
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
            <tr>
              {[
                '#','Category','Product','Entry','Price Cat',
                'Line','Pieces','Total','Discount','Net','Actions'
              ].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '0.5rem',
                    minWidth: ['Category','Product','Entry','Price Cat'].includes(h)
                      ? '100px'
                      : '80px'
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows().map((r, idx) => {
              const rawIdx   = findRawIndex(r);
              const highlight = idx === 0
                ? { backgroundColor: '#e0f7fa' }
                : {};

              return (
                <tr key={idx} style={highlight}>
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
                    <input type="text" value={r.product} disabled style={inputStyle}/>
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={r.entry}
                      onChange={e => updateField(rawIdx, 'entry', e.target.value)}
                      style={inputStyle}
                    >
                      {entryOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={r.price_category}
                      onChange={e => updateField(rawIdx, 'price_category', e.target.value)}
                      style={inputStyle}
                    >
                      {priceCategoryOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
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
                    <button onClick={() => saveRow(rawIdx)}   style={actionBtn}>Save</button>
                    <button onClick={() => deleteRow(rawIdx)} style={actionBtn}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const tdStyle    = { border: '1px solid #ddd', padding: '0.5rem' };
const inputStyle = { width: '100%', boxSizing: 'border-box' };
const actionBtn  = { padding: '0.25rem 0.5rem', margin: '0.25rem', minWidth: '60px', cursor: 'pointer' };
