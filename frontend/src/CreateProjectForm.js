import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function CreateProjectForm({ onCreate }) {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // State for import preview
  const [parsedProject, setParsedProject] = useState(null);
  const [parsedDetails, setParsedDetails] = useState([]);


   // helper to strip non-numeric chars (commas, dollar signs, etc.)
 const sanitizeNumber = v =>
   v != null
     ? v.toString().replace(/[^0-9.-]/g, '')
     : '';

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

  // Load existing projects
  useEffect(() => {
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
        setRows([blankRow(), ...existing]);
      })
      .catch(err => console.error('Fetch failed:', err));
  }, [onCreate]);

  const updateRowField = (i, field, value) => {
    const newRows = [...rows];
    newRows[i][field] = value;
    setRows(newRows);
  };

  // --- IMPORT PREVIEW ---
  const handleFileUpload = async event => {
    const file = event.target.files[0];
    if (!file) return;
    setMessage('Parsing file...');
    setParsedProject(null);
    setParsedDetails([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (raw.length < 5) throw new Error('Unexpected file format');

      // Row 1: headers, Row 2: values
      const [pd, pi, ji, pt, pw, qty, tp, np] = raw[1];
      const project = {
        project_description: pd,
        project_id:           pi,
        job_id:               ji,
        product_type:         pt,
        piece_weight:         parseFloat(sanitizeNumber(pw)) || 0,
        quantity:             parseInt(sanitizeNumber(qty), 10) || 0,
        total_postage:        parseFloat(sanitizeNumber(tp)) || 0,
        net_postage:          parseFloat(sanitizeNumber(np)) || 0,
        discount:             0
      };

      // Transactions start at row index 4
      const detailRows = raw.slice(4);
      const details = detailRows
        .filter(r => r && r.length >= 9)
        .map(r => {
          const [
            category,
            product,
            entry,
            priceCategory,
            linePrice,
            pieces,
            subtotal,
            discountTotal,
            net
          ] = r;
          return {
            category:         category || null,
            product:          product || null,
            entry:            entry || null,
            price_category:   priceCategory?.toString().trim() ? priceCategory : 'None',
            line_price:       parseFloat(sanitizeNumber(linePrice)) || 0,
            number_of_pieces: parseInt(sanitizeNumber(pieces), 10) || 0,
            total_postage:    parseFloat(sanitizeNumber(subtotal)) || 0,
            discount:         parseFloat(sanitizeNumber(discountTotal)) || 0,
            net_postage:      parseFloat(sanitizeNumber(net)) || 0
          };
        });

      setParsedProject(project);
      setParsedDetails(details);
      setMessage(`Preview: 1 project + ${details.length} transactions`);
    } catch (e) {
      console.error(e);
      setMessage(`Parse error: ${e.message}`);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedProject) return;
    setMessage('Importing...');
    try {
      // Create project
      const projResp = await fetch('/mailings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(parsedProject)
      });
      if (!projResp.ok) {
        const err = await projResp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${projResp.status}`);
      }
      const projData = await projResp.json();
      const newId = projData.id;

      // Create transactions
      let count = 0;
      for (const tx of parsedDetails) {
        const txResp = await fetch('/transactions', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ ...tx, project_id: newId })
        });
        if (txResp.ok) count++;
      }

      setMessage(`Imported project ${newId} with ${count} transactions.`);
      window.alert(`Project ${newId} with ${count} transactions successfully added to the database.`);
      setParsedProject(null);
      setParsedDetails([]);
      onCreate();
    } catch (e) {
      console.error(e);
      setMessage(`Import error: ${e.message}`);
    }
  };

  const handleCancelImport = () => {
    setParsedProject(null);
    setParsedDetails([]);
    setMessage('Import canceled');
  };

  // --- CRUD FOR SINGLE ROWS ---
  const validateRow = row => {
    const req = [
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
    for (const [key,label] of req) {
      if (row[key] === '' || row[key] == null) return `${label} is required`;
    }
    return null;
  };

  const saveRow = async idx => {
    const row = rows[idx];
    const err = validateRow(row);
    if (err) { setMessage(err); return; }
    const payload = {
      project_description: row.projectDescription,
      project_id:          row.projectId,
      job_id:              row.jobId,
      product_type:        row.productType,
      piece_weight:        parseFloat(sanitizeNumber(row.pieceWeight)) || 0,
      quantity:            parseInt(sanitizeNumber(row.quantity), 10) || 0,
      total_postage:       parseFloat(sanitizeNumber(row.totalPostage)) || 0,
      net_postage:         parseFloat(sanitizeNumber(row.netPostage)) || 0,
      discount:            parseFloat(sanitizeNumber(row.discount)) || 0
    };
    try {
      const resp = await fetch(row.id ? `/mailings/${row.id}` : '/mailings', {
        method: row.id ? 'PUT' : 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setMessage(`Saved project ${data.id}`);
      const updated = [...rows];
      updated[idx] = { ...row, id: data.id };
      setRows(row.id ? updated : [blankRow(), ...updated]);
    } catch(e) {
      console.error(e);
      setMessage(`Save error: ${e.message}`);
    }
  };

  const deleteRow = async idx => {
    const row = rows[idx];
    if (!row.id) return setRows(rows.filter((_,i)=>i!==idx));
    if (!window.confirm('Delete this project?')) return;
    try {
      const resp = await fetch(`/mailings/${row.id}`, { method:'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setRows(rows.filter((_,i)=>i!==idx));
      setMessage(`Deleted project ${row.id}`);
    } catch(e) {
      console.error(e);
      setMessage(`Delete error: ${e.message}`);
    }
  };

  const addNewRow = () => setRows([blankRow(), ...rows.slice(1)]);
  const sortedRows = () => {
    const [first,...rest] = rows;
    const sorted = rest.sort((a,b)=> sortOrder==='asc'? a.id-b.id : b.id-a.id);
    return [first,...sorted];
  };
  const findIndex = r => rows.findIndex(x => x===r || (r.id && x.id===r.id));

  // --- RENDER ---
  return (
    <div style={{maxWidth:'100%',margin:'2rem auto'}}>
      {message && <div style={{color:'red',marginBottom:'1rem'}}>{message}</div>}

      {/* Import */}
      <div style={{marginBottom:'1rem'}}>
        <label>
          Import file: <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} />
        </label>
      </div>

      {/* Preview */}
      {parsedProject && (
        <div style={{border:'1px solid #ccc',padding:'1rem',marginBottom:'2rem'}}>
          <h3>Review Import</h3>
          <table><tbody>
            <tr><th align="left">Project Name</th><td>{parsedProject.project_description}</td></tr>
            <tr><th align="left">Project #</th><td>{parsedProject.project_id}</td></tr>
            <tr><th align="left">Job #</th><td>{parsedProject.job_id}</td></tr>
            <tr><th align="left">Product Type</th><td>{parsedProject.product_type}</td></tr>
            <tr><th align="left">Piece Weight</th><td>{parsedProject.piece_weight}</td></tr>
            <tr><th align="left">Quantity</th><td>{parsedProject.quantity}</td></tr>
            <tr><th align="left">Total Postage</th><td>{parsedProject.total_postage}</td></tr>
            <tr><th align="left">Net Postage</th><td>{parsedProject.net_postage}</td></tr>
            <tr><th align="left">Discount</th><td>{parsedProject.discount}</td></tr>
            <tr><th align="left">Transactions</th><td>{parsedDetails.length}</td></tr>
          </tbody></table>
          <table style={{width:'100%',borderCollapse:'collapse',marginTop:'1rem'}}>
            <thead style={{backgroundColor:'#f0f0f0'}}><tr>
              <th>Category</th><th>Product</th><th>Entry</th><th>Price Cat</th>
              <th>Line Price</th><th># Pieces</th><th>Total Postage</th>
              <th>Discount</th><th>Net</th>
            </tr></thead>
            <tbody>
              {parsedDetails.map((d,i)=>(<tr key={i}>
                <td>{d.category}</td><td>{d.product}</td><td>{d.entry}</td>
                <td>{d.price_category}</td><td>{d.line_price}</td>
                <td>{d.number_of_pieces}</td><td>{d.total_postage}</td>
                <td>{d.discount}</td><td>{d.net_postage}</td>
              </tr>))}
            </tbody>
          </table>
          <div style={{marginTop:'1rem'}}>
            <button onClick={handleConfirmImport} style={{marginRight:'1rem'}}>Confirm Import</button>
            <button onClick={handleCancelImport}>Cancel</button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem'}}>
        <button onClick={addNewRow} style={{padding:'0.5rem 1rem'}}>Create New Project</button>
        <label>
          Sort:
          <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)} style={{marginLeft:'0.5rem'}}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      {/* Table */}
      {rows.length>0 && (
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{backgroundColor:'#1f2937',color:'#fff'}}>
            <tr>
              {['PROJECT NAME','PROJECT #','JOB #','PRODUCT TYPE','PIECE WEIGHT','QUANTITY','TOTAL POSTAGE','NET POSTAGE','DISCOUNT','ACTIONS']
                .map(h=>(
                  <th key={h} style={{padding:'0.5rem',minWidth:['PROJECT NAME','PRODUCT TYPE'].includes(h)?'150px':'80px'}}>
                    {h}
                  </th>
                ))
              }
            </tr>
          </thead>
          <tbody>
            {sortedRows().map((r,idx)=>{
              const rawIdx = findIndex(r);
              const highlight = idx===0 ? {backgroundColor:'#e0f7fa'} : {};
              return (
                <tr key={idx} style={highlight}>
                  <td style={cellStyle}>
                    <input
                      value={r.projectDescription}
                      onChange={e=>updateRowField(rawIdx,'projectDescription',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      value={r.projectId}
                      onChange={e=>updateRowField(rawIdx,'projectId',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      value={r.jobId}
                      onChange={e=>updateRowField(rawIdx,'jobId',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <select
                      value={r.productType}
                      onChange={e=>updateRowField(rawIdx,'productType',e.target.value)}
                      style={inputStyle}
                    >
                      {['Flats','Letters','First Class Letters','Post Card','First Class Flats']
                        .map(opt=><option key={opt}>{opt}</option>)}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number" step="0.0001"
                      value={r.pieceWeight}
                      onChange={e=>updateRowField(rawIdx,'pieceWeight',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number"
                      value={r.quantity}
                      onChange={e=>updateRowField(rawIdx,'quantity',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number" step="0.01"
                      value={r.totalPostage}
                      onChange={e=>updateRowField(rawIdx,'totalPostage',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number" step="0.01"
                      value={r.netPostage}
                      onChange={e=>updateRowField(rawIdx,'netPostage',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number" step="0.01"
                      value={r.discount}
                      onChange={e=>updateRowField(rawIdx,'discount',e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <button onClick={()=>saveRow(rawIdx)} style={actionButtonStyle}>Save</button>
                    <button onClick={()=>deleteRow(rawIdx)} style={actionButtonStyle}>Delete</button>
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

// Styles
const cellStyle = { border:'1px solid #ddd', padding:'0.5rem', textAlign:'center' };
const inputStyle = { width:'100%', padding:'0.25rem', boxSizing:'border-box' };
const actionButtonStyle = { padding:'0.5rem 1rem', cursor:'pointer', minWidth:'80px', margin:'0.5rem 0.25rem' };
