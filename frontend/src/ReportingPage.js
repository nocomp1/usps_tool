import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function ReportingPage() {
  const [formatOptions, setFormatOptions] = useState([]);
  const [pageCountOptions, setPageCountOptions] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedPageCount, setSelectedPageCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [increases, setIncreases] = useState([]);

  // Populate format and page count options from existing projects
  useEffect(() => {
    fetch('/mailings')
      .then(res => res.json())
      .then(projects => {
        const formats = Array.from(
          new Set(projects.map(p => p.format).filter(f => f))
        );
        setFormatOptions(formats);
        const counts = Array.from(
          new Set(projects.map(p => p.page_count?.toString()).filter(pc => pc))
        );
        setPageCountOptions(counts);
      })
      .catch(console.error);
  }, []);

  // Initialize increase percentages when summaryRows change
  useEffect(() => {
    setIncreases(summaryRows.map(() => 0));
  }, [summaryRows]);

  // Fetch detail and summary data with optional date range
  const runReport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFormat) params.set('format', selectedFormat);
      if (selectedPageCount) params.set('page_count', selectedPageCount);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const [detailRes, summaryRes] = await Promise.all([
        fetch(`/reports/project_summary?${params.toString()}`),
        fetch(`/reports/summary_by_entry?${params.toString()}`)
      ]);
      const detailJson = await detailRes.json();
      const summaryJson = await summaryRes.json();
      setData(detailJson);
      setSummaryRows(summaryJson);
    } catch (err) {
      console.error(err);
    }
  };

  const handleIncreaseChange = (idx, value) => {
    const val = parseFloat(value) || 0;
    const arr = [...increases];
    arr[idx] = val;
    setIncreases(arr);
  };

  // Compute grand totals
  const originalTotal = summaryRows.reduce((sum, s) => sum + s.total, 0);
  const adjustedTotal = summaryRows.reduce(
    (sum, s, i) => sum + s.total * (1 + (increases[i] || 0) / 100),
    0
  );
  const differenceTotal = adjustedTotal - originalTotal;

  const tdStyle = { border: '1px solid #ddd', padding: '0.5rem' };
  const thStyle = { padding: '0.5rem' };

  const formatCurrency = val =>
    val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Detail sheet
    const detailData = data.map(r => ({
      'Project Name': r.project_description,
      'Project #': r.project_id,
      Format: r.format,
      'Page Count': r.page_count,
      'Job #': r.job_id,
      'Piece Weight': r.piece_weight,
      Quantity: r.quantity
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Details');

    // Summary sheet
    const summaryData = summaryRows.map(s => ({
      Entry: s.entry,
      'Price Category': s.price_category,
      Pieces: s.pieces,
      Total: s.total
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Adjustments sheet
    const adjustData = summaryRows.map((s, i) => ({
      Entry: s.entry,
      'Price Category': s.price_category,
      Pieces: s.pieces,
      Total: s.total,
      'Increase (%)': increases[i] || 0,
      'New Total': s.total * (1 + ((increases[i] || 0) / 100))
    }));
    const wsAdjust = XLSX.utils.json_to_sheet(adjustData);
    XLSX.utils.book_append_sheet(wb, wsAdjust, 'Adjustments');

    // Grand Totals sheet
    const gtData = [
      {
        'Total Original': originalTotal,
        'Total Adjusted': adjustedTotal,
        Difference: differenceTotal
      }
    ];
    const wsGT = XLSX.utils.json_to_sheet(gtData);
    XLSX.utils.book_append_sheet(wb, wsGT, 'Grand Totals');

    // Filename includes date filters if present
    const fileName = `Report_${selectedFormat}_${selectedPageCount}` +
      (startDate && endDate ? `_${startDate}-${endDate}` : '') + `.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div>
      <h3>Qualification Reporting</h3>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {/* Controls */}
        <div>
          <label>Format:</label><br />
          <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)}>
            <option value="">--Select--</option>
            {formatOptions.map(fmt => (
              <option key={fmt} value={fmt}>{fmt}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Page Count:</label><br />
          <select value={selectedPageCount} onChange={e => setSelectedPageCount(e.target.value)}>
            <option value="">--Select--</option>
            {pageCountOptions.map(pc => (
              <option key={pc} value={pc}>{pc}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Start Date:</label><br />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>End Date:</label><br />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button onClick={runReport} disabled={!selectedFormat || !selectedPageCount} style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}>
          Generate Report
        </button>
        {data.length > 0 && summaryRows.length > 0 && (
          <button onClick={exportToExcel} style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}>
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
                  {['Project Name','Project #','Format','Page Count','Job #','Piece Weight','Quantity'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={i} style={i % 2 ? {} : { backgroundColor: '#f9fafb' }}>
                    <td style={tdStyle}>{r.project_description}</td>
                    <td style={tdStyle}>{r.project_id}</td>
                    <td style={tdStyle}>{r.format}</td>
                    <td style={tdStyle}>{r.page_count}</td>
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
                  {['Entry','Price Category','Pieces','Total'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((s, i, arr) => {
                  const isNewGroup = i === 0 || s.entry !== arr[i-1].entry;
                  const rowStyle = isNewGroup
                    ? { backgroundColor: '#e0f2fe' }
                    : i % 2
                    ? {}
                    : { backgroundColor: '#f3f4f6' };
                  return (
                    <tr key={i} style={rowStyle}>
                      <td style={tdStyle}>{s.entry}</td>
                      <td style={tdStyle}>{s.price_category}</td>
                      <td style={tdStyle}>{s.pieces}</td>
                      <td style={tdStyle}>{formatCurrency(s.total)}</td>
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
                  {['Entry','Price Category','Pieces','Total','Increase (%)','New Total'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((s, i) => {
                  const inc = increases[i] || 0;
                  const newTotal = s.total * (1 + inc/100);
                  return (
                    <tr key={i} style={i % 2 ? {} : { backgroundColor: '#f9fafb' }}>
                      <td style={tdStyle}>{s.entry}</td>
                      <td style={tdStyle}>{s.price_category}</td>
                      <td style={tdStyle}>{s.pieces}</td>
                      <td style={tdStyle}>{formatCurrency(s.total)}</td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          value={inc}
                          onChange={e => handleIncreaseChange(i, e.target.value)}
                          style={{ width: '4rem', padding: '0.25rem' }}
                        />
                      </td>
                      <td style={tdStyle}>{formatCurrency(newTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Live Grand Totals with difference */}
          <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fafafa' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1.1em', fontWeight: 'bold' }}>
              <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                <tr>
                  <th style={thStyle}>Total Original</th>
                  <th style={thStyle}>Total Adjusted</th>
                  <th style={thStyle}>Difference</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td style={tdStyle}>{formatCurrency(originalTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(adjustedTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(differenceTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
