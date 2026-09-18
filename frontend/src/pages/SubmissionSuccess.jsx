import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function SubmissionSuccess() {
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('bp_last_complaint');
    if (raw) setComplaint(JSON.parse(raw));
  }, []);

  function copyRef() {
    if (complaint) navigator.clipboard.writeText('#' + complaint.caseRef);
  }

  return (
    <div className="page">
      <div className="success-wrap">
        <h1>Submission Successful</h1>
        <p>Your formal complaint has been officially logged into the Barangay Justice System. A digital receipt has been sent to your registered email.</p>

        <div className="ref-box">
          <label>Case Reference ID</label>
          <div className="ref-row">
            <strong>{complaint ? `#${complaint.caseRef}` : '—'}</strong>
            <button className="btn btn-outline" onClick={copyRef}>📋 Copy</button>
          </div>
          <p style={{ fontSize: '.8rem', color: 'var(--muted)', margin: '8px 0 0' }}>
            Please keep this ID for all future correspondence regarding this specific claim.
          </p>
        </div>

        <div className="next-box">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span>ⓘ</span>
            <div>
              <strong>What happens next?</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.9rem' }}>
                An officer will review your complaint within 48 hours. You can track the real-time status of your request anytime.
              </p>
            </div>
          </div>
          <div className="next-steps">
            <div className="step-item"><div className="step-dot done">✓</div>Submitted</div>
            <div className="step-item"><div className="step-dot">🕐</div>Review</div>
            <div className="step-item"><div className="step-dot">👤</div>Action</div>
          </div>
        </div>

        <button className="btn btn-navy btn-block" style={{ marginBottom: 12 }} onClick={() => navigate('/dashboard')}>
          Go to Dashboard →
        </button>
        <Link to={complaint ? `/track?ref=${complaint.trackingId}` : '/track'}>
          <button className="btn btn-sky btn-block">Track Status</button>
        </Link>

        <div className="info-line"><span>🛡️</span><div><strong>Secure Logging</strong>Encrypted records stored in the distributed municipal ledger.</div></div>
        <div className="info-line"><span>🔔</span><div><strong>Auto-Notifications</strong>Email alerts will be triggered once an officer is assigned to your file.</div></div>
        <div className="info-line"><span>🎧</span><div><strong>Need Support?</strong>Our support desk is available 24/7 for filing-related inquiries.</div></div>
      </div>
    </div>
  );
}
