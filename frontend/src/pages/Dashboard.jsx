import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { getAnnouncements, getMyComplaints, Session, statusBadgeClass, toAssetUrl } from '../api.js';

export default function Dashboard() {
  const user = Session.getUser();
  const [announcements, setAnnouncements] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [lightboxAnnouncement, setLightboxAnnouncement] = useState(null);

  useEffect(() => {
    getAnnouncements().then(setAnnouncements).catch(console.error);
    getMyComplaints().then(setComplaints).catch(console.error);
  }, []);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="hero-title">Hello, {user ? user.firstName : 'Resident'}</h1>
        <p className="hero-sub">
          Welcome to your Smart Profiling and Complaint Management System. Access essential services,
          file reports, and stay connected with your community.
        </p>

        <div className="section-title">
          <h3>Quick Actions</h3>
          <span className="pill-muted">3 Available</span>
        </div>

        <div className="card quick-action-card">
          <div className="icon-badge">⚠️</div>
          <h4>File Complaint</h4>
          <p>Report neighborhood issues, safety concerns, or infrastructure damages.</p>
          <Link to="/file-complaint"><button className="btn btn-sky">File Report</button></Link>
        </div>

        <div className="section-title">
          <h3>Announcements</h3>
        </div>
        {announcements.length === 0 && <p style={{ color: 'var(--muted)' }}>No announcements yet.</p>}
        {announcements.map(a => (
          <div className="announcement-banner" style={{ marginBottom: 16 }} key={a.id}>
            <div
              className="cover"
              onClick={a.imageUrl ? () => setLightboxAnnouncement(a) : undefined}
              style={a.imageUrl ? {
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,.55) 100%), url(${toAssetUrl(a.imageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                cursor: 'zoom-in'
              } : undefined}
            >{a.tag || ''}</div>
            <div className="body">
              <h4>{a.title}</h4>
              <p>{a.body}</p>
              <div className="date-tag">📅 {a.eventDate || ''}</div>
            </div>
          </div>
        ))}

        <div className="section-title">
          <h3>Portal Activity</h3>
          <span style={{ color: 'var(--muted)' }}>↻</span>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {complaints.length === 0 && (
            <div style={{ padding: 20, color: 'var(--muted)' }}>
              No requests filed yet. Use "File Report" to get started.
            </div>
          )}
          {complaints.map(c => (
            <div className="history-row" style={{ padding: '16px 20px' }} key={c.id}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.nature}</div>
                <div className="ref">Ref ID: #{c.trackingId}</div>
              </div>
              <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {lightboxAnnouncement && (
        <div className="lightbox-overlay" onClick={() => setLightboxAnnouncement(null)}>
          <button className="lightbox-close" onClick={() => setLightboxAnnouncement(null)} aria-label="Close">✕</button>
          <div className="lightbox-card" onClick={e => e.stopPropagation()}>
            <img src={toAssetUrl(lightboxAnnouncement.imageUrl)} alt="" className="lightbox-img" />
            <div className="lightbox-info">
              {lightboxAnnouncement.tag && <span className="pill-muted" style={{ marginBottom: 8, display: 'inline-block' }}>{lightboxAnnouncement.tag}</span>}
              <h4>{lightboxAnnouncement.title}</h4>
              {lightboxAnnouncement.body && <p>{lightboxAnnouncement.body}</p>}
              {lightboxAnnouncement.eventDate && <div className="date-tag">📅 {lightboxAnnouncement.eventDate}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
