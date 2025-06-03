import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

export default function CreateProjectForm({ onCreate }) {
    // Rows & UI state
    const [rows, setRows] = useState([]);
    const [message, setMessage] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');

    // Import preview
    const [parsedProject, setParsedProject] = useState(null);
    const [parsedDetails, setParsedDetails] = useState([]);

    // Import controls
    const [importFormat, setImportFormat] = useState('Super Slim');
    const [importPageCount, setImportPageCount] = useState('32');

    // Format & Page Count persistence
    const defaultFormatOptions = ['Super Slim', 'Mini Flat', 'Letter Packet'];
    const defaultPageCountOptions = ['32', '52', '100'];
    const [formatOptions, setFormatOptions] = useState(defaultFormatOptions);
    const [newFormatOption, setNewFormatOption] = useState('');

    // Default qualification options (mirror format behavior)
    const defaultQualificationOptions = ['Diploma', 'Certificate', 'Degree'];
    const [qualificationOptions, setQualificationOptions] = useState(defaultQualificationOptions);
    const [newQualificationOption, setNewQualificationOption] = useState('');

    const [pageCountOptions, setPageCountOptions] = useState(defaultPageCountOptions);
    const [newPageCountOption, setNewPageCountOption] = useState('');




    const [isImporting, setIsImporting] = useState(false);
    const dialogRef = useRef(null);
    // Strip non-numeric
    const sanitizeNumber = v => v != null ? v.toString().replace(/[^0-9.-]/g, '') : '';


    // Parse date from various Excel formats (m/d/yy, m/d/yyyy, Excel serial, JS Date)
    const parseExcelDate = val => {
        if (!val) return '';
        // JS Date object
        if (val instanceof Date && !isNaN(val)) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        // Excel serial number
        if (typeof val === 'number') {
            const date = new Date((val - (25567 + 2)) * 86400 * 1000);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        // String formats
        const str = String(val).trim();
        const parts = str.split(/[\/\-]/);
        if (parts.length === 3) {
            let [mm, dd, yy] = parts.map(p => parseInt(p, 10));
            if (yy < 100) yy += 2000;
            const m = String(mm).padStart(2, '0');
            const d = String(dd).padStart(2, '0');
            return `${yy}-${m}-${d}`;
        }
        return '';
    };

    // Blank row template
    const blankRow = () => ({
        id: null,
        date: '',
        projectDescription: '',
        projectId: '',
        jobId: '',
        productType: 'Flats',
        pieceWeight: '',
        quantity: '',
        totalPostage: '',
        netPostage: '',
        discount: 0,
        format: formatOptions[0],
        pageCount: pageCountOptions[0],
        qualifications: qualificationOptions[0]
    });

    // Fetch projects & build options
    useEffect(() => {
        fetch('/mailings')
            .then(r => r.json())
            .then(data => {
                const customFormats = Array.from(
                    new Set(data.map(p => p.format).filter(f => f && !defaultFormatOptions.includes(f)))
                );
                setFormatOptions([...defaultFormatOptions, ...customFormats]);

                const customQualifications = Array.from(
                    new Set(
                        data
                            .map(p => p.qualifications)
                            .filter(q => q && !defaultQualificationOptions.includes(q))
                    )
                );
                setQualificationOptions([
                    ...defaultQualificationOptions,
                    ...customQualifications,
                ]);



                const customPageCounts = Array.from(
                    new Set(data.map(p => p.page_count?.toString()).filter(pc => pc && !defaultPageCountOptions.includes(pc)))
                );
                setPageCountOptions([...defaultPageCountOptions, ...customPageCounts]);

                const existing = data.map(p => ({
                    id: p.id,
                    date: p.date || '',
                    projectDescription: p.project_description,
                    projectId: p.project_id || '',
                    jobId: p.job_id || '',
                    productType: p.product_type,
                    pieceWeight: p.piece_weight,
                    quantity: p.quantity,
                    totalPostage: p.total_postage,
                    netPostage: p.net_postage,
                    discount: p.discount || 0.0,
                    format: p.format || defaultFormatOptions[0],
                    pageCount: p.page_count?.toString() || defaultPageCountOptions[0],
                    qualifications: p.qualifications || defaultQualificationOptions[0],
                }));
                setRows([blankRow(), ...existing]);
            })
            .catch(console.error);
    }, [onCreate]);


    // Update field
    const updateRowField = (i, field, value) => {
        const copy = [...rows];
        copy[i][field] = value;
        setRows(copy);
    };

    // Helper to find row index
    const findIndex = r => rows.findIndex(x => x === r || (r.id && x.id === r.id));

    // Add custom options
    const addFormatOption = () => {
        const opt = newFormatOption.trim();
        if (opt && !formatOptions.includes(opt)) {
            setFormatOptions([...formatOptions, opt]);
            setNewFormatOption('');
        }
    };
    const addPageCountOption = () => {
        const opt = newPageCountOption.trim();
        if (opt && !pageCountOptions.includes(opt)) {
            setPageCountOptions([...pageCountOptions, opt]);
            setNewPageCountOption('');
        }
    };

    const addQualificationOption = () => {
        const opt = newQualificationOption.trim();
        if (opt && !qualificationOptions.includes(opt)) {
            setQualificationOptions([...qualificationOptions, opt]);
            setNewQualificationOption('');
        }
    };


    // Import preview handlers
    const handleFileUpload = async event => {
        const file = event.target.files[0];
        if (!file) return;
        setMessage('Parsing file...');
        setParsedProject(null);
        setParsedDetails([]);
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (raw.length < 5) throw new Error('Unexpected format');
            const [pd, pi, ji, pt, pw, qty, tp, np, dt] = raw[1];
            const parsedDate = parseExcelDate(dt);
            const proj = {
                project_description: pd,
                project_id: pi,
                job_id: ji,
                product_type: pt,
                piece_weight: parseFloat(sanitizeNumber(pw)) || 0,
                quantity: parseInt(sanitizeNumber(qty), 10) || 0,
                total_postage: parseFloat(sanitizeNumber(tp)) || 0,
                net_postage: parseFloat(sanitizeNumber(np)) || 0,
                discount: 0,
                format: importFormat,
                page_count: parseInt(importPageCount, 10),
                date: parsedDate
            };
            const details = raw.slice(4)
                .filter(r => r && r.length >= 9)
                .map(r => {
                    const [cat, prod, entry, pc, lp, pcs, sub, disc, net] = r;
                    return {
                        category: cat || null,
                        product: prod || null,
                        entry: entry || null,
                        price_category: pc?.toString().trim() ? pc : 'None',
                        line_price: parseFloat(sanitizeNumber(lp)) || 0,
                        number_of_pieces: parseInt(sanitizeNumber(pcs), 10) || 0,
                        total_postage: parseFloat(sanitizeNumber(sub)) || 0,
                        discount: parseFloat(sanitizeNumber(disc)) || 0,
                        net_postage: parseFloat(sanitizeNumber(net)) || 0
                    };
                });
            setParsedProject(proj);
            setParsedDetails(details);
            setMessage(`Preview: 1 project + ${details.length} transactions`);
        } catch (e) {
            console.error(e);
            setMessage(`Parse error: ${e.message}`);
        }
    };

    const handleConfirmImport = async () => {
        if (!parsedProject) return;
        setIsImporting(true);
        setMessage('Importing...');
        try {
            const resp = await fetch('/mailings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsedProject) });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            let count = 0;
            for (let tx of parsedDetails) {
                const r = await fetch('/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tx, project_id: data.id }) });
                if (r.ok) count++;
            }
            setMessage(`Imported project ${data.id} with ${count} transactions.`);
            onCreate(); setParsedProject(null); setParsedDetails([]);
        } catch (e) {
            console.error(e);
            setMessage(`Import error: ${e.message}`);
        } finally {
            // ← always turn it off when you’re done (success or fail)
            setIsImporting(false);
        }
    };
    const handleCancelImport = () => { setParsedProject(null); setParsedDetails([]); setMessage('Import canceled'); };

    // CRUD single row
    const validateRow = row => {
        const req = [
            ['date', 'Date'],
            ['projectDescription', 'Project Description'],
            ['projectId', 'Project #'],
            ['jobId', 'Job #'],
            ['productType', 'Product Type'],
            ['pieceWeight', 'Piece Weight'],
            ['quantity', 'Quantity'],
            ['totalPostage', 'Total Postage'],
            ['netPostage', 'Net Postage'],
            ['discount', 'Discount'],
            ['format', 'Format'],
            ['pageCount', 'Page Count'],
            ['qualifications', 'Qualifications'],
        ];

        for (let [k, l] of req) {
            if (row[k] === '' || row[k] == null) return `${l} is required`;
        }
        return null;
    };
    const saveRow = async idx => {
        const row = rows[idx]; const err = validateRow(row);
        if (err) { setMessage(err); return; }
        const payload = {
            project_description: row.projectDescription,
            project_id: row.projectId,
            job_id: row.jobId,
            product_type: row.productType,
            piece_weight: parseFloat(sanitizeNumber(row.pieceWeight)) || 0,
            quantity: parseInt(sanitizeNumber(row.quantity), 10) || 0,
            total_postage: parseFloat(sanitizeNumber(row.totalPostage)) || 0,
            net_postage: parseFloat(sanitizeNumber(row.netPostage)) || 0,
            discount: parseFloat(sanitizeNumber(row.discount)) || 0,
            format: row.format,
            qualifications: row.qualifications,
            page_count: parseInt(row.pageCount, 10) || 0,
            date: row.date
        };
        try {
            const url = row.id ? `/mailings/${row.id}` : '/mailings';
            const method = row.id ? 'PUT' : 'POST';
            const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setMessage(`Saved project ${data.id}`);
            const copy = [...rows]; copy[idx] = { ...row, id: data.id };
            setRows(row.id ? copy : [blankRow(), ...copy]);
        } catch (e) { console.error(e); setMessage(`Save error: ${e.message}`); }
    };
    const deleteRow = async idx => {
        const row = rows[idx]; if (!row.id) { setRows(rows.filter((_, i) => i !== idx)); return; }
        if (!window.confirm('Delete this project?')) return;
        try {
            const r = await fetch(`/mailings/${row.id}`, { method: 'DELETE' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            setRows(rows.filter((_, i) => i !== idx)); setMessage(`Deleted project ${row.id}`);
        } catch (e) { console.error(e); setMessage(`Delete error: ${e.message}`); }
    };

    const sortedRows = () => {
        const [first, ...rest] = rows;
        const sorted = rest.sort((a, b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id);
        return [first, ...sorted];
    };

    const cellStyle = { border: '1px solid #ddd', padding: '0.5rem', textAlign: 'center' };
    const inputStyle = { width: '100%', padding: '0.25rem', boxSizing: 'border-box' };
    const actionButtonStyle = { padding: '0.5rem 1rem', cursor: 'pointer', minWidth: '80px', margin: '0.5rem 0.25rem' };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
            <div style={{ textAlign: 'left' }}>
                {message && <div style={{ color: 'red', marginBottom: '1rem' }}>{message}</div>}

                {/* Import controls */}
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label>Format:
                        <select value={importFormat} onChange={e => setImportFormat(e.target.value)}>
                            {formatOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </label>
                    <label>Page Count:
                        <select value={importPageCount} onChange={e => setImportPageCount(e.target.value)}>
                            {pageCountOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </label>
                    <label>Import file: <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} /></label>
                </div>

                {/* Preview */}
                {parsedProject && (
                    <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '2rem' }}>
                        <h3>Review Import</h3>
                        <table><tbody>
                            <tr><th align="left">Date</th><td>{parsedProject.date}</td></tr>
                            <tr><th align="left">Project Name</th><td>{parsedProject.project_description}</td></tr>
                            <tr><th align="left">Project #</th><td>{parsedProject.project_id}</td></tr>
                            <tr><th align="left">Job #</th><td>{parsedProject.job_id}</td></tr>
                            <tr><th align="left">Product Type</th><td>{parsedProject.product_type}</td></tr>
                            <tr><th align="left">Piece Weight</th><td>{parsedProject.piece_weight}</td></tr>
                            <tr><th align="left">Quantity</th><td>{parsedProject.quantity}</td></tr>
                            <tr><th align="left">Total Postage</th><td>{parsedProject.total_postage}</td></tr>
                            <tr><th align="left">Net Postage</th><td>{parsedProject.net_postage}</td></tr>
                            <tr><th align="left">Discount</th><td>{parsedProject.discount}</td></tr>
                            <tr><th align="left">Format</th><td>{parsedProject.format}</td></tr>
                            <tr><th align="left">Page Count</th><td>{parsedProject.page_count}</td></tr>
                            <tr><th align="left">Transactions</th><td>{parsedDetails.length}</td></tr>
                        </tbody></table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                            <thead style={{ backgroundColor: '#f0f0f0' }}>
                                <tr>
                                    <th>Category</th>
                                    <th>Product</th>
                                    <th>Entry</th>
                                    <th>Price Cat</th>
                                    <th>Line Price</th>
                                    <th># Pieces</th>
                                    <th>Total Postage</th>
                                    <th>Discount</th>
                                    <th>Net</th>
                                </tr>

                            </thead>
                            <tbody>
                                {parsedDetails.map((d, i) => (
                                    <tr key={i}>
                                        <td>{d.category}</td>
                                        <td>{d.product}</td>
                                        <td>{d.entry}</td>
                                        <td>{d.price_category}</td>
                                        <td>{d.line_price}</td>
                                        <td>{d.number_of_pieces}</td>
                                        <td>{d.total_postage}</td>
                                        <td>{d.discount}</td>
                                        <td>{d.net_postage}</td>
                                    </tr>
                                ))}
                            </tbody>

                            <tfoot>
                                <tr style={{ borderTop: '1px solid #ccc' }}>
                                    <td colSpan={8} style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold' }}>
                                        Total Net:
                                    </td>
                                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>
                                        {parsedDetails
                                            .reduce((sum, d) => sum + Number(d.net_postage), 0)
                                            .toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                </tr>
                            </tfoot>

                        </table>

                        <div style={{ marginTop: '1rem' }}><button onClick={handleConfirmImport} style={{ marginRight: '1rem' }}>Confirm Import</button><button onClick={handleCancelImport}>Cancel</button></div>
                    </div>
                )}

                {/* New Format/PageCount + Sort */}
                {rows.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <label>New Format:<input type="text" value={newFormatOption} onChange={e => setNewFormatOption(e.target.value)} placeholder="Type format" style={{ marginLeft: 4 }} /></label><button onClick={addFormatOption}>Add Format</button>
                        <label>New Page Count:<input type="text" value={newPageCountOption} onChange={e => setNewPageCountOption(e.target.value)} placeholder="Type pages" style={{ marginLeft: 4 }} /></label><button onClick={addPageCountOption}>Add Page Count</button>
                        <label>New Qualification:
                            <input
                                type="text"
                                value={newQualificationOption}
                                onChange={e => setNewQualificationOption(e.target.value)}
                                placeholder="Type qualification"
                                style={{ marginLeft: 4 }}
                            />
                        </label>
                        <button onClick={addQualificationOption}>Add Qualification</button>
                        <label style={{ marginLeft: 'auto' }}>Sort:<select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ marginLeft: 4 }}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
                    </div>
                )}

                {/* Table */}
                {rows.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                            <tr>{['Date', 'Project Name', 'Project #', 'Format', 'Page Count', 'Qualifications', 'Job #', 'Product Type', 'Piece Weight', 'Quantity', 'Total Postage', 'Net Postage', 'Discount', 'Actions'].map(h => <th key={h} style={{ padding: '0.5rem', minWidth: h === 'Date' ? '100px' : '80px' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {sortedRows().map((r, idx) => {
                                const i = findIndex(r); return (<tr key={idx}><td style={cellStyle}><input type="date" value={r.date} onChange={e => updateRowField(i, 'date', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><input value={r.projectDescription} onChange={e => updateRowField(i, 'projectDescription', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><input value={r.projectId} onChange={e => updateRowField(i, 'projectId', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><select value={r.format} onChange={e => updateRowField(i, 'format', e.target.value)} style={inputStyle}>{formatOptions.map(o => <option key={o}>{o}</option>)}</select></td><td style={cellStyle}><select value={r.pageCount} onChange={e => updateRowField(i, 'pageCount', e.target.value)} style={inputStyle}>{pageCountOptions.map(o => <option key={o}>{o}</option>)}</select></td>
                                    <td style={cellStyle}>
                                        <select
                                            value={r.qualifications}
                                            onChange={e => updateRowField(i, 'qualifications', e.target.value)}
                                            style={inputStyle}
                                        >
                                            {qualificationOptions.map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </td>


                                    <td style={cellStyle}><input value={r.jobId} onChange={e => updateRowField(i, 'jobId', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><select value={r.productType} onChange={e => updateRowField(i, 'productType', e.target.value)} style={inputStyle}>{['Flats', 'Letters', 'First Class Letters', 'Post Card', 'First Class Flats'].map(o => <option key={o}>{o}</option>)}</select></td><td style={cellStyle}><input type="number" step="0.0001" value={r.pieceWeight} onChange={e => updateRowField(i, 'pieceWeight', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><input type="number" value={r.quantity} onChange={e => updateRowField(i, 'quantity', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><input type="number" step="0.01" value={r.totalPostage} onChange={e => updateRowField(i, 'totalPostage', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><input type="number" step="0.01" value={r.netPostage} onChange={e => updateRowField(i, 'netPostage', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><input type="number" step="0.01" value={r.discount} onChange={e => updateRowField(i, 'discount', e.target.value)} style={inputStyle} /></td><td style={cellStyle}><button onClick={() => saveRow(i)} style={actionButtonStyle}>Save</button><button onClick={() => deleteRow(i)} style={actionButtonStyle}>Delete</button></td></tr>);
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            <dialog
                ref={dialogRef}
                open={isImporting}
                style={{
                    padding: 0,
                    border: 'none',
                    background: 'rgba(0,0,0,0.4)',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    display: isImporting ? 'flex' : 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                }}
            >
                <progress />
            </dialog>



        </div>

    );

}

// Styles
const cellStyle = { border: '1px solid #ddd', padding: '0.5rem', textAlign: 'center' };
const inputStyle = { width: '100%', padding: '0.25rem', boxSizing: 'border-box' };
const actionButtonStyle = { padding: '0.5rem 1rem', cursor: 'pointer', minWidth: '80px', margin: '0.5rem 0.25rem' };
