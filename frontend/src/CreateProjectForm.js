import React, { useState } from 'react';

export default function CreateProjectForm({ onCreate }) {
  const [projectDescription, setProjectDescription] = useState('');
  const [productType, setProductType]               = useState('Flats');
  const [pieceWeight, setPieceWeight]               = useState('');
  const [quantity, setQuantity]                     = useState('');
  const [totalPostage, setTotalPostage]             = useState('');
  const [netPostage, setNetPostage]                 = useState('');
  const [discount, setDiscount]                     = useState('');
  const [jobId, setJobId]                           = useState('');
  const [projectId, setProjectId]                   = useState('');
  const [message, setMessage]                       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      project_description: projectDescription,
      product_type:        productType,
      piece_weight:        parseFloat(pieceWeight),
      quantity:            parseInt(quantity, 10),
      total_postage:       parseFloat(totalPostage),
      net_postage:         parseFloat(netPostage),
      discount:            parseFloat(discount) || 0,
      job_id:              jobId,
      project_id:          projectId,
    };

    try {
      const resp = await fetch('/mailings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const newProj = await resp.json();
      setMessage(`Created project with ID ${newProj.id}`);
      onCreate();
      // Clear form
      setProjectDescription(''); setProductType('Flats'); setPieceWeight('');
      setQuantity(''); setTotalPostage(''); setNetPostage(''); setDiscount('');
      setJobId(''); setProjectId('');
    } catch (err) {
      console.error('Create failed:', err);
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 800, margin: '2rem auto' }}>
      <h2>Create A Project:</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
        <div>
          <label>Project Description</label>
          <input value={projectDescription} onChange={e=>setProjectDescription(e.target.value)} required />
        </div>
        <div>
          <label>Type of Product</label>
          <select value={productType} onChange={e=>setProductType(e.target.value)}>
            <option>Flats</option><option>Letters</option><option>First Class Letters</option>
            <option>Post Card</option><option>First Class Flats</option>
          </select>
        </div>
        <div>
          <label>Piece Weight</label>
          <input type="number" step="0.0001" value={pieceWeight} onChange={e=>setPieceWeight(e.target.value)} required />
        </div>
        <div>
          <label>Quantity</label>
          <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} required />
        </div>
        <div>
          <label>Total Postage</label>
          <input type="number" step="0.01" value={totalPostage} onChange={e=>setTotalPostage(e.target.value)} required />
        </div>
        <div>
          <label>Net Postage</label>
          <input type="number" step="0.01" value={netPostage} onChange={e=>setNetPostage(e.target.value)} required />
        </div>
        <div>
          <label>Discount (%)</label>
          <input type="number" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)} />
        </div>
        <div>
          <label>Job ID</label>
          <input value={jobId} onChange={e=>setJobId(e.target.value)} />
        </div>
        <div>
          <label>Project ID</label>
          <input value={projectId} onChange={e=>setProjectId(e.target.value)} />
        </div>
      </div>
      <button type="submit" style={{ padding: '0.5rem 1rem' , marginTop: '1rem' }}>Create Project</button>
      {message && <div style={{ marginTop: '1rem' }}>{message}</div>}
    </form>
  );
}
