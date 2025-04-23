import React, { useState, useEffect } from 'react';

export default function TransactionDetailForm() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [category, setCategory] = useState('Piece');
  const [product, setProduct] = useState('');
  const [entry, setEntry] = useState('5-Digit');
  const [priceCategory, setPriceCategory] = useState('None');
  const [linePrice, setLinePrice] = useState('');
  const [numPieces, setNumPieces] = useState('');
  const [totalPostageInput, setTotalPostageInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [netPostageInput, setNetPostageInput] = useState('');
  const [message, setMessage] = useState('');

  // Fetch existing projects on mount
  useEffect(() => {
    fetch('/mailings')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(console.error);
  }, []);

  // When a project is selected, set product and numPieces from project
  const handleProjectChange = e => {
    const id = e.target.value;
    setSelectedProjectId(id);
    setMessage('');
    const proj = projects.find(p => String(p.id) === id);
    if (proj) {
      setProduct(proj.product_type);
      setNumPieces(proj.quantity);                // auto-fill number of pieces
      setTotalPostageInput('');
      setDiscountInput('');
      setNetPostageInput('');
    }
  };

  const handleUpdate = async e => {
    e.preventDefault();
    const payload = {
      project_id:        parseInt(selectedProjectId, 10),
      category,
      product,
      entry,
      price_category:    priceCategory,
      line_price:        parseFloat(linePrice),
      number_of_pieces:  parseInt(numPieces, 10),
      total_postage:     parseFloat(totalPostageInput),
      discount:          parseFloat(discountInput),
      net_postage:       parseFloat(netPostageInput)
    };

    try {
      const resp = await fetch('/transactions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const newTx = await resp.json();
      setMessage(`Transaction saved (ID ${newTx.id})`);
      // Clear input fields except numPieces remains read-only
      setCategory('Piece');
      setEntry('5-Digit');
      setPriceCategory('None');
      setLinePrice('');
      setTotalPostageInput('');
      setDiscountInput('');
      setNetPostageInput('');
    } catch (err) {
      console.error('Update failed:', err);
      setMessage(`Error: ${err.message}`);
    }
  };

  // Common style for label-on-top fields
  const colStyle = { display: 'flex', flexDirection: 'column', marginBottom: '0.5rem' };

  return (
    <form onSubmit={handleUpdate} style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h2>Transaction Detail</h2>

      <div style={colStyle}>
        <label>Project</label>
        <select value={selectedProjectId} onChange={handleProjectChange} required>
          <option value="">-- Select Project --</option>
          {projects.map(p => {
            const desc = p.project_description;
            const short = desc.length > 40 ? desc.slice(0, 20) + '...' : desc;
            return (
              <option key={p.id} value={p.id}>
                {`${p.project_id}-${short}`}
              </option>
            );
          })}
        </select>
      </div>

      {selectedProjectId && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}
          >
            <div style={colStyle}>
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option>Piece</option>
                <option>Pound</option>
              </select>
            </div>

            <div style={colStyle}>
              <label>Product</label>
              <input type="text" value={product} disabled />
            </div>

            <div style={colStyle}>
              <label>Entry</label>
              <select value={entry} onChange={e => setEntry(e.target.value)}>
                <option>5-Digit</option>
                <option>Mixed ADC</option>
                <option>3-Digit</option>
                <option>ADC</option>
                <option>Basic</option>
              </select>
            </div>

            <div style={colStyle}>
              <label>Price Category</label>
              <select value={priceCategory} onChange={e => setPriceCategory(e.target.value)}>
                <option>None</option>
                <option>DNDC</option>
                <option>DSCF</option>
              </select>
            </div>

            <div style={colStyle}>
              <label>Line Price</label>
              <input
                type="number"
                step="0.01"
                placeholder="Line Price"
                value={linePrice}
                onChange={e => setLinePrice(e.target.value)}
              />
            </div>

            <div style={colStyle}>
              <label>Number of Pieces</label>
              <input
                type="number"
                placeholder="Number of Pieces"
                value={numPieces}
                disabled
              />
            </div>

            <div style={colStyle}>
              <label>Total Postage</label>
              <input
                type="number"
                step="0.01"
                value={totalPostageInput}
                onChange={e => setTotalPostageInput(e.target.value)}
              />
            </div>

            <div style={colStyle}>
              <label>Discount</label>
              <input
                type="number"
                step="0.01"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
              />
            </div>

            <div style={colStyle}>
              <label>Net Postage</label>
              <input
                type="number"
                step="0.01"
                value={netPostageInput}
                onChange={e => setNetPostageInput(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" style={{ padding: '0.5rem 1rem' }}>
            Update Transaction Details
          </button>
          {message && <div style={{ marginTop: '1rem' }}>{message}</div>}
        </>
      )}
    </form>
  );
}
