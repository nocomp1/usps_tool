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

  // ── Promo Savings state ────────────────────────────────────────────────
  const [jobsList, setJobsList] = useState([]);             // all projects
  const [selectedJobId, setSelectedJobId] = useState('');   // chosen job number
  const [promoSummary, setPromoSummary] = useState(null);   // one-row summary
  const [showAudit, setShowAudit] = useState(false);
  // Populate format and page count options
  useEffect(() => {
    fetch('/mailings')
      .then(res => res.json())
      .then(projects => {
        // keep the full list for Promo Savings
        setJobsList(projects)
        // setFormatOptions(Array.from(new Set(projects.map(p => p.format).filter(f => f))));
        // setPageCountOptions(Array.from(new Set(projects.map(p => p.page_count?.toString()).filter(pc => pc))));

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

    // which document to show in the inline PDF viewer (null → main view)
    const [doc, setDoc] = useState(null);
  
    // S3 URLs for our documentation PDFs
    const PDF_URLS = {
      qualification:
        'https://elasticbeanstalk-us-west-2-497439480790.s3.us-west-2.amazonaws.com/Reporting+Adjustments+and+Totals+Documentation.pdf',
      promo:
        'https://elasticbeanstalk-us-west-2-497439480790.s3.us-west-2.amazonaws.com/Promo+Savings+Reporting+Docs.pdf',
    };

  // ── handle project/job selection for Promo Savings ───────────────────────
  const handleJobChange = async e => {
    const jobId = e.target.value;
    setSelectedJobId(jobId);

    // Clear summary if nothing selected--
    if (!jobId) {
      setPromoSummary(null);
      return;
    }

    // 1) All projects sharing that job number
    const projects = jobsList.filter(p => String(p.job_id) === jobId);

    // 2) Pull every project's transaction details
    const txArrays = await Promise.all(
      projects.map(p =>
        fetch(`/transactions?project_id=${p.id}`)
          .then(res => res.json())
      )
    );
    const allTx = txArrays.flat();

    // 3) CONS List = total number_of_pieces
    const consList = allTx.reduce(
      (sum, tx) => sum + (tx.number_of_pieces || 0),
      0
    );

    // 4) Savings buckets = sum of abs(net_postage) per entry
  // new — trim whitespace before comparing
const sumAbsNet = entryName =>
  allTx
    .filter(tx => tx.entry && tx.entry.trim() === entryName)
    .reduce((sum, tx) => sum + Math.abs(tx.net_postage), 0);

    const promoSavings = sumAbsNet('Sustainability');
    const addOn1Savings = sumAbsNet('Informed Delivery');
    const addOn2Savings = sumAbsNet('TSI');

    // 5) Total Postage base = sum of every project.total_postage
    const totalPostageSum = projects.reduce(
      (sum, p) => sum + (p.total_postage || 0),
      0
    );

    // 6) Percentage taken = (netSavings / totalPostageSum) * 100
    const totalNetSavings = promoSavings + addOn1Savings + addOn2Savings;
    const percentageTaken =
      totalPostageSum > 0
        ? (totalNetSavings / totalPostageSum) * 100
        : 0;

    // 7) Descriptive fields off the first project
    const first = projects[0] || {};

    setPromoSummary({
      projectNumber: jobId,
      projectDescription: first.project_description || '',
      qualification: first.qualifications || '',
      pageCount: first.page_count || '',
      consList,
      promoSavings,
      addOn1Savings,
      addOn2Savings,
      percentageTaken
    });
  };






  // Reset increases when summaryRows change
  useEffect(() => {
    setIncreases(summaryRows.map(() => ""));
  }, [summaryRows]);

  // Fetch detail & summary
  const runReport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFormat) params.set('format', selectedFormat);
      if (selectedPageCount) params.set('page_count', selectedPageCount);

      if (selectedQualification) params.set('qualifications', selectedQualification);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const [detailRes, summaryRes] = await Promise.all([
        fetch(`/reports/project_summary?${params}`),
        fetch(`/reports/summary_by_entry?${params}`)
            ]);
        
            // 1) Pull in both datasets
            const detailData  = await detailRes.json();
            const rawSummary = await summaryRes.json();
        
            setData(detailData);
        
            // 2) Build a map of piece‐counts per entry+price_category
            const pieceCounts = {};
            rawSummary.forEach(r => {
              if (r.category.toUpperCase() === 'PIECE') {
                const key = `${r.entry}||${r.price_category}`;
                pieceCounts[key] = r.pieces;
              }
            });
        
            // 3) Derive per‐entry weight = Qty × piece_weight
            const pieceWeight = detailData[0]?.piece_weight || 0;
            const decorated = rawSummary.map(r => {
              const key  = `${r.entry}||${r.price_category}`;
              const qty  = pieceCounts[key] || 0;
              const wgt  = r.category.toUpperCase() === 'POUND'
                ? qty * pieceWeight
                : 0;
              const unit = r.category.toUpperCase() === 'PIECE'
                ? (qty ? r.total / qty : 0)
                : (wgt ? r.total / wgt : 0);
              return {
                ...r,
                pieces:     qty,
                weight:     wgt,
                unit_price: unit
              };
            });
        
            // 4) Feed the decorated rows into state
            setSummaryRows(decorated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleIncreaseChange = (idx, value) => {
    // Allow the user to type empty, "-", ".", or "-." without coercing
    if (value === '' || value === '-' || value === '.' || value === '-.') {
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

    // Raw unit prices ($/piece or $/lb)
     const unitPrices = summaryRows.map(s => {
          // prefer backend‐decorated unit_price if present
          if (s.unit_price !== undefined) {
            return s.unit_price;
          }
          if (s.category.toUpperCase() === 'PIECE') {
            return s.pieces ? s.total / s.pieces : 0;
      }
         // Pound rows (case-insensitive): divide by line-level weight
         return s.weight ? s.total / s.weight : 0;
    });

  // Grand totals, but excluding any negative‐total rows
    // Grand totals, but excluding any negative‐total rows
  const originalTotal = summaryRows.reduce(
    (sum, s) => (s.total > 0 ? sum + s.total : sum),
    0
  );
    const adjustedTotal = summaryRows.reduce(
        (sum, s, i) => {
          if (s.total <= 0) return sum;
          const pct = increases[i] || 0;
          // Apply pct to the row’s total postage
          const rowAdjusted = s.total * (1 + pct / 100);
          return sum + rowAdjusted;
        },
        0
      );
  // Only compute a non-zero difference if the user has entered at least one percent
  const anyIncrease = increases.some(val => parseFloat(val));
  const rawDifference = adjustedTotal - originalTotal;
  const differenceTotal = anyIncrease
    ? Math.max(0, +rawDifference.toFixed(2))
    : 0;

  // Total pieces (only counting rows with s.total > 0)
  const totalPieces = summaryRows.reduce(
    (sum, s) => (s.total > 0 ? sum + s.pieces : sum),
    0
  );


    // ── Audit rows: combine raw & adjusted values per summary group ─────────
    const auditRows = summaryRows.map((s, i) => {
      const pcs  = s.pieces || 0;
      const wgt  = s.weight || 0;
      const orig = s.total;
      const pct  = increases[i] || 0;
      const adj  = orig * (1 + pct / 100);
      const unit = unitPrices[i] || 0;
      const newUnit = s.category.toUpperCase() === 'PIECE'
        ? (pcs  ? adj / pcs : 0)
        : (wgt  ? adj / wgt : 0);
      const delta = adj - orig;
  
      return {
        ...s,
        original_postage:   orig,
        unit_price:         unit,
        adjustment_pct:     pct,
        adjusted_postage:   adj,
        new_unit_price:     newUnit,
        delta_dollars:      delta
      };
    });
  


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
      'Project #': r.project_id,
      Format: r.format,
      'Page Count': r.page_count,
      'Qualification': r.qualifications,
      'Job #': r.job_id,
      'Piece Weight': r.piece_weight,
      Quantity: r.quantity
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Details');

    // Summary
        // Summary sheet: include weight & unit price
        const summaryData = summaryRows.map((s, i) => ({
          Category:         s.category,
          Entry:            s.entry,
          'Price Category': s.price_category,
          Pieces:           s.pieces,
          'Weight (lbs)':   s.weight,
          Total:            s.total,
          'Unit Price':     unitPrices[i]
        }));


    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Adjustments
        // Adjustments sheet: include weight, and recalc New Total / New Unit Price per row
    const adjustData = summaryRows.map((s, i) => {
      const up        = unitPrices[i];
      const inc       = increases[i] || 0;
      const newTotal  = s.total * (1 + inc / 100);
      const newUnit   = s.category.toUpperCase() === 'PIECE'
                      ? (s.pieces ? newTotal / s.pieces : 0)
                       : (s.weight ? newTotal / s.weight : 0);

      return {
        Category:         s.category,
        Entry:            s.entry,
        'Price Category': s.price_category,
        Pieces:           s.pieces,
        'Weight (lbs)':   s.weight,
        Total:            s.total,
        'Unit Price':     up,
        'Increase (%)':   inc,
        'New Total':      newTotal,
        'New Unit Price': newUnit
      };
    });

    const wsAdjust = XLSX.utils.json_to_sheet(adjustData);
    XLSX.utils.book_append_sheet(wb, wsAdjust, 'Adjustments');

    // Grand Totals
    const gt = [{
      'Total Original': originalTotal,
      'Orig Unit Price': totalPieces ? originalTotal / totalPieces : 0,
      'Total Adjusted': adjustedTotal,
      'Adj Unit Price': totalPieces ? adjustedTotal / totalPieces : 0,
      Difference: differenceTotal,
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

  // ── Export Promo Savings to Excel ────────────────────────────────────────
  const exportPromoSavings = () => {
    if (!promoSummary) return;

    const wb = XLSX.utils.book_new();
    const sheetData = [
      {
        'Project #': promoSummary.projectNumber,
        'Project Description': promoSummary.projectDescription,
        'Qualification': promoSummary.qualification,
        'Page Count': promoSummary.pageCount,
        'CONS List': promoSummary.consList,
        'Promo Savings': promoSummary.promoSavings,
        'Add on 1 Savings': promoSummary.addOn1Savings,
        'Add on 2 Savings': promoSummary.addOn2Savings,
        'Percentage': `${promoSummary.percentageTaken.toFixed(1)}%`,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Promo Savings');
    const fileName = `Promo_Savings_${selectedJobId}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };







    return doc ? (
        // INLINE PDF VIEWER
        <div style={{ padding: '1rem' }}>
         <button
            onClick={() => setDoc(null)}
            style={{
              marginBottom: '1rem',
              background: 'none',
              border: 'none',
              color: '#0366d6',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ← Back
         </button>
    
         <div
  style={{
    width: '100%',
    height: '900px',      // pick whatever max height you need
    overflow: 'auto',     // scroll if PDF is taller
    border: '1px solid #ccc',
    borderRadius: '4px'
  }}
>
  <object
    data={`${PDF_URLS[doc]}#navpanes=0&toolbar=0`}
    type="application/pdf"
    style={{
      width: '100%',
      height: '100%'
    }}
  >
    <p>
      Your browser doesn’t support inline PDFs.{' '}
      <a
        href={PDF_URLS[doc]}
        target="_blank"
        rel="noopener noreferrer"
      >
        Download the PDF.
      </a>
    </p>
  </object>
</div>

        </div>
      ) : (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3>Qualification Reporting</h3>
        <a
          href="#"
          onClick={e => { e.preventDefault(); setDoc('qualification'); }}
          style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer' }}
        >
          What is this
        </a>
      </div>
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

            <button
              onClick={() => setShowAudit(v => !v)}
              style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem', marginLeft: '0.5rem' }}
            >
              {showAudit ? 'Hide Audit View' : 'Show Audit View'}
            </button>
        
      </div>

      {data.length > 0 && summaryRows.length > 0 && (
        <>
          {/* Detail Table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                <tr>
                  {['Project Name', 'Project #', 'Format', 'Page Count', 'Qualification', 'Job #', 'Piece Weight', 'Quantity']
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
                                {['Category','Entry','Price Category','Pieces','Weight (lbs)','Total','Unit Price']
                  .map(h => (
                    <th
                      key={h}
                     style={{
                        ...thStyle,
                        position: 'sticky',
                        top: 0,
                        backgroundColor: '#374151',
                        zIndex: 1
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((s, i, arr) => {
                  const isNewGroup = i === 0 || s.entry !== arr[i - 1].entry;
                  const rowStyle = isNewGroup
                    ? { backgroundColor: '#e0f2fe' }
                    : i % 2 === 0
                      ? { backgroundColor: '#f3f4f6' }
                      : {};
                          const pcs = s.pieces || 0;
    const wgt = s.weight || 0;
    const up  = unitPrices[i] || 0;
                  return (
                    <tr key={i} style={rowStyle}>
     <td style={tdStyle}>{s.category}</td>
     <td style={tdStyle}>{s.entry}</td>
     <td style={tdStyle}>{s.price_category}</td>
            <td style={tdStyle}>{pcs}</td>
        <td style={tdStyle}>{wgt.toFixed(2)}</td>
        <td style={tdStyle}>{formatCurrency(s.total)}</td>
        <td style={tdStyle}>{formatCurrency(up)}</td>
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
                                {[
                  'Category','Entry','Price Category','Pieces','Weight (lbs)',
                  'Total','Unit Price','Increase (%)','New Total','New Unit Price'
                ].map(h => (
                  <th
                    key={h}
                    style={{
                     ...thStyle,
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#4B5563',
                      zIndex: 1
                    }}
                  >
                    {h}
                  </th>
                ))}
                </tr>
              </thead>
              <tbody>
               {summaryRows.map((s, i) => {
    const pcs = s.pieces || 0;
    const wgt = s.weight || 0;
    const up  = unitPrices[i] || 0;
    const pct = increases[i] || 0;

    // New total is original total × (1 + pct/100)
    const newTotal = s.total * (1 + pct/100);

    // New unit price per piece or per lb
    const newUnit = s.category.toUpperCase() === 'PIECE'
      ? (pcs ? newTotal/pcs : 0)
      : (wgt ? newTotal/wgt : 0);
                  return (
                    <tr key={i} style={i % 2 === 0 ? { backgroundColor: '#f9fafb' } : {}}>
                      <td style={tdStyle}>{s.category}</td>
                      <td style={tdStyle}>{s.entry}</td>
                      <td style={tdStyle}>{s.price_category}</td>
                      <td style={tdStyle}>{s.pieces}</td>
                      <td style={tdStyle}>{s.weight.toFixed(2)}</td>
                      <td style={tdStyle}>{formatCurrency(s.total)}</td>
                      <td style={tdStyle}>{formatCurrency(up)}</td>
                      <td style={tdStyle}>
                        <input
                          type="number"           // now shows spinner arrows
                          step="any"              // allow any decimal precision
                          value={increases[i]}
                          onChange={e => handleIncreaseChange(i, e.target.value)}
                          style={{ width: '4rem', padding: '0.25rem' }}
                        />
                      </td>
                           <td style={tdStyle}>{formatCurrency(newTotal)}</td>
                           <td style={tdStyle}>{formatCurrency(newUnit)}</td>
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


               {/* Audit View */}   
          {showAudit && (
  <>
    <h4 style={{ marginTop: '1rem' }}>Audit View</h4>
    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {[
              'Category','Entry','Price Category',
              'Pieces','Weight (lbs)',
              'Original Postage','Unit Price',
              'Increase (%)','Adjusted Postage',
              'New Unit Price','Delta'
            ].map(h => (
              <th
                key={h}
                style={{
                  ...thStyle,
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#ddd',
                  zIndex: 1
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {auditRows.map((r, i) => (
            <tr key={i}>
              <td style={tdStyle}>{r.category}</td>
              <td style={tdStyle}>{r.entry}</td>
              <td style={tdStyle}>{r.price_category}</td>
              <td style={tdStyle}>{r.pieces}</td>
              <td style={tdStyle}>{r.weight.toFixed(2)}</td>
              <td style={tdStyle}>{formatCurrency(r.original_postage)}</td>
              <td style={tdStyle}>{formatCurrency(r.unit_price)}</td>
              <td style={tdStyle}>{r.adjustment_pct}%</td>
              <td style={tdStyle}>{formatCurrency(r.adjusted_postage)}</td>
              <td style={tdStyle}>{formatCurrency(r.new_unit_price)}</td>
              <td style={tdStyle}>{formatCurrency(r.delta_dollars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
)}



        </>
      )}


      {/* Promo Savings */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3>Promo Savings</h3>
      <a href="#" onClick={e => { e.preventDefault(); setDoc('promo'); }}>
        What is this
      </a>
    </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <label style={{ margin: 0 }}>
          Project:&nbsp;
          <select
            value={selectedJobId}
            onChange={handleJobChange}
            style={{ padding: '0.25rem' }}
          >
            <option value="">-- Select Project --</option>
            {jobsList.map(p => (
              <option key={`${p.job_id}-${p.id}`} value={p.job_id}>
                {p.project_description} || {p.job_id}
              </option>
            ))}
          </select>
        </label>

        {promoSummary && (
          <button
            onClick={exportPromoSavings}
            style={{ padding: '0.5rem 1rem' }}
          >
            Export Promo Savings
          </button>
        )}
      </div>




      {promoSummary && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1rem',
            textAlign: 'center'
          }}
        >
          <thead style={{ backgroundColor: '#1f2937', color: '#fff' }}>
            <tr>
              <th style={thStyle}>Project #</th>
              <th style={thStyle}>Project Description</th>
              <th style={thStyle}>Qualification</th>
              <th style={thStyle}>Page Count</th>
              <th style={thStyle}>CONS List</th>
              <th style={thStyle}>Promo Savings</th>
              <th style={thStyle}>Add on 1 Savings</th>
              <th style={thStyle}>Add on 2 Savings</th>
              <th style={thStyle}>Percentage</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>
                {promoSummary.projectNumber}
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>
                {promoSummary.projectDescription}
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>
                {promoSummary.qualification}
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>
                {promoSummary.pageCount}
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #ddd' }}>
                {promoSummary.consList}
              </td>
              <td style={tdStyle}>{formatCurrency(promoSummary.promoSavings)}</td>
              <td style={tdStyle}>{formatCurrency(promoSummary.addOn1Savings)}</td>
              <td style={tdStyle}>{formatCurrency(promoSummary.addOn2Savings)}</td>
              <td style={tdStyle}>
                {promoSummary.percentageTaken.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      )}




    </div>
  );
}
