import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function ReportingPage() {
  const [formatOptions, setFormatOptions] = useState([]);
  const [pageCountOptions, setPageCountOptions] = useState([]);
  const [qualificationOptions, setQualificationOptions] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedPageCount, setSelectedPageCount] = useState('');
  const [selectedQualification, setSelectedQualification] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [increases, setIncreases] = useState([]);

  // Populate format and page count options
  useEffect(() => {
    fetch('/mailings')
      .then(res => res.json())
      .then(projects => {
        setFormatOptions(Array.from(new Set(projects.map(p => p.format).filter(f => f))));
        setPageCountOptions(Array.from(new Set(projects.map(p => p.page_count?.toString()).filter(pc => pc))));
        
             setFormatOptions(
                    Array.from(new Set(projects.map(p => p.format).filter(f => f)))
                  );
                  setPageCountOptions(
                    Array.from(new Set(projects.map(p => p.page_count?.toString()).filter(pc => pc)))
                  );
                 setQualificationOptions(
                    Array.from(new Set(projects.map(p => p.qualifications).filter(q => q)))
                  );

      })
      .catch(console.error);
  }, []);

  // Reset increases when summaryRows change
  useEffect(() => {
    setIncreases(summaryRows.map(() => 0));
  }, [summaryRows]);

  // Fetch detail & summary
  const runReport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFormat)   params.set('format', selectedFormat);
      if (selectedPageCount) params.set('page_count', selectedPageCount);

      if (selectedQualification) params.set('qualifications', selectedQualification);
      if (startDate)        params.set('start_date', startDate);
      if (endDate)          params.set('end_date', endDate);

      const [detailRes, summaryRes] = await Promise.all([
        fetch(`/reports/project_summary?${params}`),
        fetch(`/reports/summary_by_entry?${params}`)
      ]);
      setData(await detailRes.json());
      setSummaryRows(await summaryRes.json());
    } catch (err) {
      console.error(err);
    }
  };

    const handleIncreaseChange = (idx, value) => {
       // Allow the user to type "-" or clear the field without immediately coercing to 0
        if (value === '' || value === '-') {
          const next = [...increases];
          next[idx] = value;
          setIncreases(next);
          return;
        }
        // Otherwise, parseFloat will convert "-5" to -5, or fall back to 0 if invalid
        const val = parseFloat(value) || 0;
        const next = [...increases];
        next[idx] = val;
        setIncreases(next);
      };

  // Raw unit prices (full precision)
  const unitPrices = summaryRows.map(s =>
    s.pieces ? s.total / s.pieces : 0
  );

  // Grand totals, but excluding any negative‐total rows
  const originalTotal = summaryRows.reduce(
    (sum, s) => (s.total > 0 ? sum + s.total : sum),
    0
  );
  const adjustedTotal = summaryRows.reduce(
    (sum, s, i) =>
      s.total > 0
        ? sum + unitPrices[i] * (1 + (increases[i] || 0) / 100) * s.pieces
        : sum,
    0
  );
  const differenceTotal = adjustedTotal - originalTotal;

  // Total pieces (only counting rows with s.total > 0)
  const totalPieces = summaryRows.reduce(
    (sum, s) => (s.total > 0 ? sum + s.pieces : sum),
    0
  );

  const tdStyle = { border: '1px solid #ddd', padding: '0.5rem' };
  const thStyle = { padding: '0.5rem' };
  const formatCurrency = val =>
    val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Export to Excel (includes unit‐price columns)
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Details
    const detailData = data.map(r => ({
      'Project Name': r.project_description,
      'Project #':    r.project_id,
      Format:         r.format,
      'Page Count':   r.page_count,
      'Qualification': r.qualifications,
      'Job #':        r.job_id,
      'Piece Weight': r.piece_weight,
      Quantity:       r.quantity
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Details');

    // Summary
    const summaryData = summaryRows.map((s, i) => ({
      Category:         s.category,
      Entry:            s.entry,
      'Price Category': s.price_category,
      Pieces:           s.pieces,
      Total:            s.total,
      'Unit Price':     unitPrices[i]
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Adjustments
    const adjustData = summaryRows.map((s, i) => {
      const up   = unitPrices[i];
      const inc  = increases[i] || 0;
      const newUP = up * (1 + inc / 100);
      return {
        Category:          s.category,
        Entry:             s.entry,
        'Price Category':  s.price_category,
        Pieces:            s.pieces,
        Total:             s.total,
        'Unit Price':      up,
        'Increase (%)':    inc,
        'New Total':       newUP * s.pieces,
        'New Unit Price':  newUP
      };
    });
    const wsAdjust = XLSX.utils.json_to_sheet(adjustData);
    XLSX.utils.book_append_sheet(wb, wsAdjust, 'Adjustments');

    // Grand Totals
    const gt = [{
      'Total Original':  originalTotal,
      'Orig Unit Price': totalPieces ? originalTotal / totalPieces : 0,
      'Total Adjusted':  adjustedTotal,
      'Adj Unit Price':  totalPieces ? adjustedTotal / totalPieces : 0,
      Difference:        differenceTotal,
      'Diff Unit Price': totalPieces ? differenceTotal / totalPieces : 0
    }];
    const wsGT = XLSX.utils.json_to_sheet(gt);
    XLSX.utils.book_append_sheet(wb, wsGT, 'Grand Totals');

    const fileName =
      `Report_${selectedFormat}_${selectedPageCount}` +
      (startDate && endDate ? `_${startDate}-${endDate}` : '') +
      `.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div>
      <h3>Qualification Reporting</h3>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {/* Controls */}
        <div>
          <label>Format:</label><br />
          <select
            value={selectedFormat}
            onChange={e => setSelectedFormat(e.target.value)}
          >
            <option value="">--Select--</option>
            {formatOptions.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Page Count:</label><br />
          <select
            value={selectedPageCount}
            onChange={e => setSelectedPageCount(e.target.value)}
          >
            <option value="">--Select--</option>
            {pageCountOptions.map(pc => (
              <option key={pc} value={pc}>{pc}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Qualification:</label><br />
          <select
            value={selectedQualification}
            onChange={e => setSelectedQualification(e.target.value)}
          >
            <option value="">--Select--</option>
            {qualificationOptions.map(q => (
              <option key={q} value={q}>{q}</option>
           ))}
          </select>
        </div>

        <div>
          <label>Start Date:</label><br />
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label>End Date:</label><br />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <button
          onClick={runReport}
          disabled={!selectedFormat || !selectedPageCount || !selectedQualification}
          style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}
        >
          Generate Report
        </button>
        {data.length > 0 && summaryRows.length > 0 && (
          <button
            onClick={exportToExcel}
            style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}
          >
            Export to Excel
          </button>
        )}
      </div>

      {data.length > 0 && summaryRows.length > 0 && (
        <>
          {/* Detail Table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                <tr>
                {['Project Name','Project #','Format','Page Count','Qualification','Job #','Piece Weight','Quantity']
                    .map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} style={i % 2 === 0 ? { backgroundColor: '#f9fafb' } : {}}>
                    <td style={tdStyle}>{r.project_description}</td>
                    <td style={tdStyle}>{r.project_id}</td>
                    <td style={tdStyle}>{r.format}</td>
                    <td style={tdStyle}>{r.page_count}</td>
                    <td style={tdStyle}>{r.qualifications}</td>
                    <td style={tdStyle}>{r.job_id}</td>
                    <td style={tdStyle}>{r.piece_weight}</td>
                    <td style={tdStyle}>{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Table */}
          <h4 style={{ marginTop: '1rem' }}>Summary by Entry & Price Category</h4>
          <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#374151', color: '#fff' }}>
                <tr>
                  {['Entry','Price Category','Pieces','Total','Unit Price']
                    .map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((s, i, arr) => {
                  const isNewGroup = i === 0 || s.entry !== arr[i-1].entry;
                  const rowStyle = isNewGroup
                    ? { backgroundColor: '#e0f2fe' }
                    : i % 2 === 0
                    ? { backgroundColor: '#f3f4f6' }
                    : {};
                  return (
                    <tr key={i} style={rowStyle}>
                      <td style={tdStyle}>{s.entry}</td>
                      <td style={tdStyle}>{s.price_category}</td>
                      <td style={tdStyle}>{s.pieces}</td>
                      <td style={tdStyle}>{formatCurrency(s.total)}</td>
                      <td style={tdStyle}>{formatCurrency(unitPrices[i])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Proposed Adjustments Table */}
          <h4 style={{ marginTop: '1rem' }}>Proposed Adjustments</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#4B5563', color: '#fff' }}>
                <tr>
                  {['Category', 'Entry', 'Price Category', 'Pieces', 'Total', 'Unit Price', 'Increase (%)', 'New Total', 'New Unit Price']
                    .map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((s, i) => {
                  const up       = unitPrices[i];
                  const inc      = increases[i] || 0;
                  const newUP    = up * (1 + inc / 100);
                  const newTotal = newUP * s.pieces;
                  return (
                    <tr key={i} style={i % 2 === 0 ? { backgroundColor: '#f9fafb' } : {}}>
                      <td style={tdStyle}>{s.category}</td>
                      <td style={tdStyle}>{s.entry}</td>
                      <td style={tdStyle}>{s.price_category}</td>
                      <td style={tdStyle}>{s.pieces}</td>
                      <td style={tdStyle}>{formatCurrency(s.total)}</td>
                      <td style={tdStyle}>{formatCurrency(up)}</td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          value={inc}
                          onChange={e => handleIncreaseChange(i, e.target.value)}
                          style={{ width: '4rem', padding: '0.25rem' }}
                        />
                      </td>
                      <td style={tdStyle}>{formatCurrency(newTotal)}</td>
                      <td style={tdStyle}>{formatCurrency(newUP)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Live Grand Totals */}
          <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1em', fontWeight: 'bold' }}>
              <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                <tr>
                  <th style={thStyle}>Total Original</th>
                  <th style={thStyle}>Orig Unit Price</th>
                  <th style={thStyle}>Total Adjusted</th>
                  <th style={thStyle}>Adj Unit Price</th>
                  <th style={thStyle}>Difference</th>
                  <th style={thStyle}>Diff Unit Price</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td style={tdStyle}>{formatCurrency(originalTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(originalTotal / totalPieces)}</td>
                  <td style={tdStyle}>{formatCurrency(adjustedTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(adjustedTotal / totalPieces)}</td>
                  <td style={tdStyle}>{formatCurrency(differenceTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(differenceTotal / totalPieces)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
