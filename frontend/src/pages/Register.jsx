import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../api.js';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', dateOfBirth: '', sex: '',
    contactNumber: '', purok: '', email: '', password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null); // holds the pending-approval message once submitted
  const [idFile, setIdFile] = useState(null);
  const [idFileError, setIdFileError] = useState('');

  function handleIdFile(file) {
    setIdFileError('');
    if (!file) { setIdFile(null); return; }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) { setIdFileError('Only image or PDF files are allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setIdFileError('File is too large — max size is 5MB.'); return; }
    setIdFile(file);
  }

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.purok) { setError('Please select your Purok / Zone.'); return; }
    if (!form.email.trim()) { setError('Email is required — it doubles as your login and login recovery address.'); return; }

    setLoading(true);
    try {
      const body = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        sex: form.sex,
        contactNumber: '+63 ' + form.contactNumber.trim(),
        purok: form.purok,
        email: form.email.trim(),
        password: form.password,
        idDocument: idFile
      };
      const data = await register(body);
      // No auto-login: a barangay admin has to approve the account first
      // (see the Pending status check on login), so show a confirmation
      // instead of jumping to the dashboard.
      setSubmitted(data.message || 'Registration submitted. A barangay admin will review your account before you can sign in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="page" style={{ paddingTop: 30 }}>
        <div className="form-wrap">
          <div className="card" style={{ padding: 36, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>✅</div>
            <h2 style={{ color: 'var(--navy)', margin: '0 0 10px' }}>Registration Submitted</h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>{submitted}</p>
            <Link to="/"><button className="btn btn-navy btn-block">Back to Sign In</button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 30 }}>
      <div className="form-wrap">
        <div className="card" style={{ padding: 36 }}>
          <h2 style={{ color: 'var(--navy)', margin: '0 0 4px' }}>Personal Information</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', margin: '0 0 24px' }}>
            Please provide your official details as they appear on your government-issued identification cards.
          </p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label className="field-label">First Name</label>
                <input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="e.g. Alexander" required />
              </div>
              <div className="field">
                <label className="field-label">Middle Name</label>
                <input value={form.middleName} onChange={e => update('middleName', e.target.value)} placeholder="e.g. Sterling" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Last Name</label>
                <input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="e.g. Montgomery" required />
              </div>
              <div className="field">
                <label className="field-label">Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Sex</label>
                <select value={form.sex} onChange={e => update('sex', e.target.value)}>
                  <option value="">Select option</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Contact Number</label>
                <div className="phone-row">
                  <input value="+63" disabled />
                  <input value={form.contactNumber} onChange={e => update('contactNumber', e.target.value)} placeholder="917 123 4567" required />
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Purok / Zone</label>
              <select value={form.purok} onChange={e => update('purok', e.target.value)} required>
                <option value="">Select location</option>
                <option>Camulinas Purok Centro</option>
                <option>Purok Rizal</option>
                <option>Purok Mabini</option>
                <option>Purok Bonifacio</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Email (used to sign in)</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Create a password" required minLength={6} />
            </div>

            <div style={{ fontWeight: 800, color: 'var(--navy)', margin: '20px 0 10px' }}>Identity Documentation (ID)</div>
            <label className="upload-box" htmlFor="idDocument" style={{ cursor: 'pointer', display: 'block' }}>
              <div className="icon">⬆️</div>
              <strong>{idFile ? idFile.name : 'Tap to upload ID photo'}</strong>
              <small>Max size 5MB. PNG, JPG, or PDF.</small>
            </label>
            <input
              id="idDocument"
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={e => handleIdFile(e.target.files?.[0] || null)}
            />
            {idFileError && <p style={{ fontSize: '.8rem', color: '#c0392b', marginTop: 6 }}>{idFileError}</p>}

            <div className="card" style={{ background: '#eaf3fd', borderColor: '#cfe4f9', margin: '22px 0 24px' }}>
              <strong style={{ color: 'var(--navy)' }}>🛡️ Secured Transmission</strong>
              <p style={{ margin: '6px 0 0', fontSize: '.85rem', color: 'var(--muted)' }}>
                Your data is encrypted using AES-256 standards. Only authorized civil personnel can access this information for verification purposes.
              </p>
            </div>

            <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
              {loading ? 'Submitting…' : 'SUBMIT →'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: '.9rem' }}>
              Already registered? <Link to="/" className="link-blue">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
