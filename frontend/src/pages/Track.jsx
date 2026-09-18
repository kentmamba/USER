import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { trackComplaint, getMyComplaints, statusBadgeClass } from '../api.js';

function Timeline({ c }) {
  const stages = [
    { label: 'Submitted', desc: 'Request successfully logged by system.', done: c.stage >= 1 },
    { label: 'Under Review', desc: 'Legal and site verification is currently in progress by the desk officer.', done: c.stage >= 2 },
    { label: 'Resolved', desc: 'Case completion.', done: c.stage >= 3 }
  ];
  return (
    <div className="timeline" style={{ marginTop: 20 }}>
      {stages.map((s, i) => (
        <div className="t-item" key={s.label}>
          {i < stages.length - 1 && <div className="t-line" />}
          <div className={`t-dot ${s.done ? '' : 'pending'}`}>{i + 1}</div>
          <div className="t-content">
            <strong>{s.label}</strong>
            <span>{s.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Track() {
  const [params] = useSearchParams();
  const [refInput, setRefInput] = useState(params.get('ref') || '');
  const [result, setResult] = useState(null);
  const [others, setOthers] = useState([]);
  const [error, setError] = useState('');

  const doLookup = useCallback(async (ref) => {
    setError(''); setResult(null);
    if (!ref) return;
    try {
      const c = await trackComplaint(ref);
      setResult(c);
      try {
        const all = await getMyComplaints();
        setOthers(all.filter(x => x.id !== c.id));
      } catch { /* not fatal */ }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (refInput) {
      doLookup(refInput);
    } else {
      getMyComplaints().then(mine => {
        if (mine.length) {
          setRefInput(mine[0].trackingId);
          doLookup(mine[0].trackingId);
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = others.slice(0, 2);
  const history = others.slice(2, 5);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="hero-title" style={{ marginTop: 24 }}>Track Your Request</h1>
        <p className="hero-sub">Check the real-time status of your applications and reports by entering your unique reference ID.</p>

        <div className="track-search">
          <div className="track-search-row">
            🔍 <input
              value={refInput}
              onChange={e => setRefInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doLookup(refInput.trim()); }}
              placeholder="Reference ID (e.g., PS-2024-0891)"
            />
          </div>
          <button className="btn btn-navy btn-block" onClick={() => doLookup(refInput.trim())}>Verify</button>
        </div>

        {error && <div className="error-msg" style={{ marginTop: 16 }}>{error}</div>}

        {result && (
          <>
            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: '0 0 6px', color: 'var(--navy)' }}>{result.nature}</h2>
                  <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
                    ID: {result.trackingId} · CURRENT STATUS: {result.status}
                  </div>
                </div>
                <span className="status-chip">
                  {result.status === 'Under Review' ? 'IN PROGRESS' : result.status.toUpperCase()}
                </span>
              </div>
              <Timeline c={result} />
            </div>

            <div className="two-col">
              <div className="card">
                <div className="card-title">Mediation Schedule</div>
                {upcoming.length === 0 && <p style={{ color: 'var(--muted)', padding: '10px 0' }}>No scheduled mediations.</p>}
                {upcoming.map(c => (
                  <div className="history-row" key={c.id}>
                    <div><div style={{ fontWeight: 700 }}>{c.nature}</div><div className="ref">Ref No. {c.caseRef}</div></div>
                    <span style={{ color: 'var(--green-text)', fontWeight: 700 }}>{c.createdAt.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">Recent History</div>
                {history.length === 0 && <p style={{ color: 'var(--muted)', padding: '10px 0' }}>No history yet.</p>}
                {history.map(c => (
                  <div className="history-row" key={c.id}>
                    <div><div style={{ fontWeight: 700 }}>{c.nature}</div><div className="ref">Ref No. {c.caseRef}</div></div>
                    <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
              <button className="btn btn-navy" style={{ flex: 1 }}>🎧 Contact Support</button>
              <button className="btn btn-outline" style={{ flex: 1 }}>❓ Browse FAQ</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
