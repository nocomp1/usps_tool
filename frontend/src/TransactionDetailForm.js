import React, { useState, useEffect } from 'react';

export default function TransactionDetailForm({ projects }) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [editingTxId, setEditingTxId] = useState(null);
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

  const [transactions, setTransactions] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc');

  // Load transactions when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    const proj = projects.find(p => String(p.id) === selectedProjectId);
    if (proj) {
      setProduct(proj.product_type);
      setNumPieces('');
      setTotalPostageInput('');
      setDiscountInput('');
      setNetPostageInput('');
      fetch(`/transactions?project_id=${proj.id}`)
        .then(res => res.json())
        .then(data => setTransactions(data))
        .catch(console.error);
    }
  }, [selectedProjectId, projects]);

  const handleProjectChange = e => {
    setSelectedProjectId(e.target.value);
    setEditingTxId(null);
    setMessage('');
  };

  const resetForm = () => {
    setEditingTxId(null);
    setCategory('Piece');
    setEntry('5-Digit');
    setPriceCategory('None');
    setLinePrice('');
    setNumPieces('');
    setTotalPostageInput('');
    setDiscountInput('');
    setNetPostageInput('');
  };

  const handleEditClick = tx => {
    setEditingTxId(tx.id);
    setCategory(tx.category);
    setEntry(tx.entry);
    setPriceCategory(tx.price_category);
    setLinePrice(tx.line_price);
    setNumPieces(tx.number_of_pieces);
    setTotalPostageInput(tx.total_postage);
    setDiscountInput(tx.discount);
    setNetPostageInput(tx.net_postage);
    setMessage(`Editing transaction ${tx.id}`);
  };

  const handleDeleteClick = async tx => {
    if (!window.confirm('Delete transaction entry?')) return;
    try {
      const resp = await fetch(`/transactions/${tx.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setTransactions(txs => txs.filter(t => t.id !== tx.id));
      setMessage(`Transaction ${tx.id} deleted`);
      if (editingTxId === tx.id) resetForm();
    } catch (err) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const payload = {
      project_id: parseInt(selectedProjectId, 10),
      category,
      product,
      entry,
      price_category: priceCategory,
      line_price: parseFloat(linePrice),
      number_of_pieces: parseInt(numPieces, 10),
      total_postage: parseFloat(totalPostageInput),
      discount: parseFloat(discountInput),
      net_postage: parseFloat(netPostageInput)
    };

    const url = editingTxId ? `/transactions/${editingTxId}` : '/transactions';
    const method = editingTxId ? 'PUT' : 'POST';

    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const tx = await resp.json();
      setMessage(editingTxId ? `Transaction ${tx.id} updated` : `Transaction saved (ID ${tx.id})`);
      setTransactions(txs => editingTxId
        ? txs.map(t => (t.id === tx.id ? tx : t))
        : [...txs, tx]
      );
      resetForm();
    } catch (err) {
      console.error(err);
      setMessage(`Error: ${err.message}`);
    }
  };

  const sorted = [...transactions].sort((a, b) =>
    sortOrder === 'asc' ? a.id - b.id : b.id - a.id
  );
  const totalPieces = sorted.reduce((sum, tx) => sum + tx.number_of_pieces, 0);
  // summary uses calculated line_price * pieces
  // header total is sum of stored total_postage values
  const totalAmount = sorted.reduce((sum, tx) => sum + tx.total_postage, 0);


  const colStyle = { display: 'flex', flexDirection: 'column', marginBottom: '0.5rem' };

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto' }}>
      <form onSubmit={handleSubmit}>
        <h2>{editingTxId ? 'Edit' : 'New'} Transaction</h2>
        <div style={colStyle}>
          <label>Project</label>
          <select value={selectedProjectId} onChange={handleProjectChange} required>
            <option value="">-- Select Project --</option>
            {projects.map(p => {
              const short = p.project_description.length > 20
                ? p.project_description.slice(0, 20) + '...'
                : p.project_description;
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
                  value={linePrice}
                  onChange={e => setLinePrice(e.target.value)}
                />
              </div>

              <div style={colStyle}>
                <label>Number of Pieces</label>
                <input
                  type="number"
                  value={numPieces}
                  onChange={e => setNumPieces(e.target.value)}
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

            <button
              type="submit"
              style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}
            >
              {editingTxId ? 'Save Changes' : 'Add Transaction'}
            </button>
            {message && <div style={{ marginBottom: '1rem' }}>{message}</div>}
          </>
        )}
      </form>

      {transactions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
        <label>Sort by ID: </label>
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>

        <div style={{ margin: '0.5rem 0' }}>
          <strong>Total Pieces:</strong> {totalPieces} | <strong>Total Amount:</strong> ${totalAmount.toFixed(2)}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Category</th>
              <th>Entry</th>
              <th>Pieces</th>
              <th>Line</th>
              <th>Total</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(tx => (
              <tr key={tx.id}>
                <td>{tx.id}</td>
                <td>{tx.category}</td>
                <td>{tx.entry}</td>
                <td>{tx.number_of_pieces}</td>
                <td>{tx.line_price.toFixed(2)}</td>
                <td>{tx.total_postage.toFixed(2)}</td>
                <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <button type="button" onClick={() => handleEditClick(tx)}>Edit</button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(tx)}
                    style={{ color: 'white', backgroundColor: '#d9534f', border: 'none', padding: '0.25rem 0.5rem', borderRadius: 4 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
