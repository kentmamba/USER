import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { getAnnouncements, toAssetUrl } from '../api.js';

const emergencyContacts = [
  { label: 'CORDOVA POLICE STATION', value: '0998-598-6392' },
  { label: 'BUREAU OF FIRE PROTECTION', value: '436-4245\n0933-394-9073' },
  { label: 'CORDOVA PRIMARY HEALTH CARE FACILITY (ABTC, BIRTHING CENTER, MEDICAL SECTION)', value: '0967-491-5579' },
  { label: 'CORDOVA PRIMARY HEALTH CARE FACILITY AMBULANCE SERVICES (8:00 AM - 5:00 PM)', value: '0967-491-5579' },
  { label: 'MDRRMO AMBULANCE', value: '247\n0917-149-8457\n0917-116-9819' },
  { label: 'PHILIPPINE RED CROSS (LAPU-LAPU & CORDOVA CHAPTER)', value: '0969-450-8482' },
  { label: 'PHILIPPINE COAST GUARD (CORDOVA)', value: '0927-941-2486' },
];

export default function Services() {
  const [showEmergencyDirectory, setShowEmergencyDirectory] = useState(false);
  const [showAnnouncementsFeed, setShowAnnouncementsFeed] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState('');

  useEffect(() => {
    getAnnouncements()
      .then(setAnnouncements)
      .catch(() => setAnnouncementsError('Unable to load announcements right now.'));
  }, []);

  function openAnnouncements() {
    setShowAnnouncementsFeed(true);
    if (announcements.length === 0 && !announcementsLoading) {
      setAnnouncementsLoading(true);
      setAnnouncementsError('');
      getAnnouncements()
        .then(setAnnouncements)
        .catch(() => setAnnouncementsError('Unable to load announcements right now.'))
        .finally(() => setAnnouncementsLoading(false));
    }
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="search-box">🔍 <input placeholder="Search Services" /></div>

        <div className="justice-panel">
          <h2>Barangay Justice</h2>
          <p>Our Lupong Tagapamayapa ensures swift and fair mediation for neighborhood disputes. Resolve issues peacefully within the community.</p>
          <div className="justice-grid">
            <div className="justice-card">
              <div className="icon-badge">📣</div>
              <h4>File a Formal Complaint</h4>
              <p>Initiate the official mediation process for civil or minor criminal disputes and other residential concerns.</p>
              <Link to="/file-complaint?category=complaint"><button className="btn btn-sky">Start Form</button></Link>
            </div>
            <div className="justice-card">
              <div className="icon-badge">🛠️</div>
              <h4>Infrastructure / Public Works</h4>
              <p>Issues related to public facilities, roads, drainage, and utilities that require maintenance in your area.</p>
              <Link to="/file-complaint?category=infrastructure"><button className="btn btn-sky">Start Form</button></Link>
            </div>
          </div>
        </div>

        <div className="section-title"><h3>Public Safety</h3></div>
        <div className="services-grid-2">
          <div className="card service-simple-card emergency-card" onClick={() => setShowEmergencyDirectory(true)} role="button" tabIndex={0} onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowEmergencyDirectory(true);
            }
          }}>
            <div className="icon-badge">📞</div>
            <h4>Emergency Contacts</h4>
            <p>Direct access to local police, the fire department, and emergency response units.</p>
          </div>
          <div className="card service-simple-card announcement-card" onClick={openAnnouncements} role="button" tabIndex={0} onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openAnnouncements();
            }
          }}>
            <div className="icon-badge">🔔</div>
            <h4>Announcements &amp; Safety Notifications</h4>
            <p>Barangay announcements, event updates, and emergency alerts you should be aware of.</p>
          </div>
        </div>

        {showAnnouncementsFeed && (
          <div className="announcement-feed-overlay" onClick={() => setShowAnnouncementsFeed(false)}>
            <div className="announcement-feed-modal" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close emergency-close" onClick={() => setShowAnnouncementsFeed(false)} aria-label="Close">✕</button>

              <div className="announcement-feed-header">
                <h3>Announcements &amp; Safety Notifications</h3>
              </div>

              <div className="announcement-feed-list">
                {announcementsLoading && <p className="announcement-feed-status">Loading announcements...</p>}
                {!announcementsLoading && announcementsError && <p className="announcement-feed-status error-msg">{announcementsError}</p>}
                {!announcementsLoading && !announcementsError && announcements.length === 0 && (
                  <p className="announcement-feed-status">No announcements have been posted yet.</p>
                )}
                {!announcementsLoading && announcements.map((post) => (
                  <article className="announcement-post" key={post.id}>
                    <div className="announcement-post-header">
                      <div className="announcement-avatar">🏛️</div>
                      <div>
                        <div className="announcement-author">Barangay Poblacion</div>
                        <div className="announcement-time">
                          {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'New announcement'}
                        </div>
                      </div>
                    </div>

                    <div className="announcement-post-body">
                      <div className="announcement-post-tag">{post.tag || 'General'}</div>
                      <h4>{post.title}</h4>
                      {post.body && <p>{post.body}</p>}
                      {post.eventDate && <div className="announcement-post-date">Event date: {post.eventDate}</div>}
                    </div>

                    {post.imageUrl && (
                      <img src={toAssetUrl(post.imageUrl)} alt={post.title} className="announcement-post-image" />
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {showEmergencyDirectory && (
          <div className="emergency-directory-overlay" onClick={() => setShowEmergencyDirectory(false)}>
            <div className="emergency-directory-modal" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close emergency-close" onClick={() => setShowEmergencyDirectory(false)} aria-label="Close">✕</button>

              <div className="emergency-header">
                <div className="emergency-badge">🏛️</div>
                <div className="emergency-header-text">
                  <div className="municipality-line">MUNICIPALITY OF CORDOVA</div>
                  <div className="tagline">BAGONG PILIPINAS</div>
                </div>
              </div>

              <h1 className="emergency-title">EMERGENCY<br />HOTLINES</h1>

              <div className="emergency-list">
                {emergencyContacts.map((item) => (
                  <div className="emergency-row" key={item.label}>
                    <div className="emergency-label">{item.label}</div>
                    <div className="emergency-value">{item.value.split('\n').map((line, index) => (
                      <span key={`${item.label}-${index}`}>
                        {line}
                        {index < item.value.split('\n').length - 1 && <br />}
                      </span>
                    ))}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
