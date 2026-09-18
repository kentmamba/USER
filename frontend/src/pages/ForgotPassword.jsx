import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await forgotPassword(email.trim());
      setMessage(data.message || 'If an account matches that email, a secure reset link has been sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <div className="auth-logo">🏛️</div>
        <h1 className="auth-title">Reset Your Password</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.9rem', margin: '0 0 20px' }}>
          Enter the email on your account and we'll send you a link to reset your password.
        </p>

        {error && <div className="error-msg">{error}</div>}
        {message ? (
          <div className="card" style={{ background: '#eaf6ec', borderColor: '#cdead2', textAlign: 'center' }}>
            <p style={{ margin: 0, color: 'var(--navy)' }}>{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field input-icon">
              <label className="field-label">Email</label>
              <span className="icon">👤</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="footer-note" style={{ marginTop: 16 }}>
          <Link to="/" className="link-blue">← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
