import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { fileComplaint, Session } from '../api.js';

export default function FileComplaint() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const category = params.get('category') || 'complaint';
  const user = Session.getUser();

  const [form, setForm] = useState({
    barangayCaseNo: '', nature: '', complainantName: '', complainantAddress: '',
    respondentName: '', narrative: '', reliefSought: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceError, setEvidenceError] = useState('');

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleEvidenceFile(file) {
    setEvidenceError('');
    if (!file) { setEvidenceFile(null); return; }
    if (file.size > 10 * 1024 * 1024) { setEvidenceError('File is too large — max size is 10MB.'); return; }
    setEvidenceFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const body = {
      category,
      nature: form.nature.trim(),
      barangayCaseNo: form.barangayCaseNo.trim(),
      complainantName: form.complainantName.trim() || (user ? user.fullName : ''),
      complainantAddress: form.complainantAddress.trim(),
      respondentName: form.respondentName.trim(),
      narrative: form.narrative.trim(),
      reliefSought: form.reliefSought.trim(),
      evidence: evidenceFile
    };
    try {
      const complaint = await fileComplaint(body);
      sessionStorage.setItem('bp_last_complaint', JSON.stringify(complaint));
      navigate('/submission-success');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="form-wrap">
          <div className="form-header">
            <Link to="/services" className="back-arrow">←</Link>
            <h2>File Complaint</h2>
          </div>

          <div className="legal-card">
            <div className="legal-header">
              <div className="line">REPUBLIC OF THE PHILIPPINES</div>
              <div className="line">PROVINCE OF CEBU</div>
              <div className="line">MUNICIPALITY OF CORDOVA</div>
              <div className="line">BARANGAY POBLACION</div>
              <div className="office">OFFICE OF THE LUPONG TAGAPAMAYAPA</div>
            </div>
            <hr className="dash" />

            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Barangay Case No.</label>
                  <input value={form.barangayCaseNo} onChange={e => update('barangayCaseNo', e.target.value)} placeholder="Enter case number (if known)" />
                </div>
                <div className="field">
                  <label className="field-label">For</label>
                  <input value={form.nature} onChange={e => update('nature', e.target.value)} placeholder="Nature of complaint (e.g., Unpaid Debt)" required />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Complainant/s</label>
                <input value={form.complainantName} onChange={e => update('complainantName', e.target.value)} placeholder="Full Name(s) of Complainant" required style={{ marginBottom: 10 }} />
                <input value={form.complainantAddress} onChange={e => update('complainantAddress', e.target.value)} placeholder="Address" />
              </div>
              <p style={{ textAlign: 'right', fontStyle: 'italic', color: 'var(--muted)', margin: '4px 0' }}>-against-</p>

              <div className="field">
                <input value={form.respondentName} onChange={e => update('respondentName', e.target.value)} placeholder="Full Name of Respondent" />
              </div>

              <p className="legal-quote">"I hereby complain against above named respondent for violating my rights and interest in the following manner:"</p>
              <div className="field">
                <textarea value={form.narrative} onChange={e => update('narrative', e.target.value)} placeholder="Provide a detailed narrative of the incident, including dates, times, and specific actions…" required />
              </div>

              <p className="legal-quote">"THEREFORE, I pray, that the following relief be granted to me in accordance with law or equity:"</p>
              <div className="field">
                <textarea value={form.reliefSought} onChange={e => update('reliefSought', e.target.value)} placeholder="What specific action do you want the Barangay to take? (e.g., payment of debt, apology, cease and desist)" />
              </div>

              <div style={{ fontWeight: 800, color: 'var(--navy)', letterSpacing: '.03em', fontSize: '.85rem', margin: '20px 0 10px' }}>EVIDENCE / ATTACHMENTS</div>
              <label className="upload-box" htmlFor="evidence" style={{ cursor: 'pointer', display: 'block' }}>
                <div className="icon">📷</div>
                <strong>{evidenceFile ? evidenceFile.name : 'Upload photo or document'}</strong>
                <small>PNG, JPG or PDF (Up to 10MB)</small>
              </label>
              <input
                id="evidence"
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={e => handleEvidenceFile(e.target.files?.[0] || null)}
              />
              {evidenceError && <p style={{ fontSize: '.8rem', color: '#c0392b', marginTop: 6 }}>{evidenceError}</p>}

              <hr className="dash" />
              <div className="sign-block">
                Made this ___ day of _______, 20__.
                <div>Complainant Signature</div>
                <strong>RITCHEL S. BASILLOTE</strong>
                Punong Barangay, Lupon Chairperson

                <div style={{ marginTop: 14 }}>Attested by:</div>
                <strong>AMELYN M. ZARAGOZA</strong>
                Barangay Secretary
              </div>

              <p className="legal-fine">© By submitting, you agree to provide truthful information. Filing a false report is subject to legal penalties under Article 363 of the Revised Penal Code.</p>

              <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Complaint →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
