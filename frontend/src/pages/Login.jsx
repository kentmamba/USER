import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, Session } from '../api.js';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('resident');
  const [identifier, setIdentifier] = useState('elena.santos@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Session.isLoggedIn()) navigate('/dashboard');
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(identifier, password);
      Session.setToken(data.token);
      Session.setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function chooseOfficial() {
    setTab('official');
    setError('Official login is not available in this demo. Please use the Resident tab.');
  }
  function chooseResident() {
    setTab('resident');
    setError('');
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <div className="auth-logo">🏛️</div>
        <h1 className="auth-title">Barangay Poblacion</h1>

        <div className="tabs">
          <button type="button" className={tab === 'resident' ? 'active' : ''} onClick={chooseResident}>Resident</button>
          <button type="button" className={tab === 'official' ? 'active' : ''} onClick={chooseOfficial}>Official</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field input-icon">
            <label className="field-label">Email</label>
            <span className="icon">👤</span>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="field input-icon">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" className="link-blue">Forgot Password?</Link>
            </div>
            <span className="icon">🔒</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="staySignedIn" style={{ width: 'auto' }} />
            <label htmlFor="staySignedIn">Stay signed in for 30 days</label>
          </div>
          <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Secure Login →'}
          </button>
        </form>

        <p className="footer-note">Don't have an account? <Link to="/register" className="link-blue">Register your Household</Link></p>

        <div className="footer-pills">
          <span>DILG</span>
          <span className="dark">BRGY</span>
        </div>
        <p className="footer-note">© 2024 Barangay Poblacion Digital Bureau</p>
      </div>
    </div>
  );
}
