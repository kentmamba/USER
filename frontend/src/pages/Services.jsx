import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';

export default function Services() {
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
          <div className="card service-simple-card">
            <div className="icon-badge">📞</div>
            <h4>Emergency Contacts</h4>
            <p>Direct access to local police, the fire department, and emergency response units.</p>
            <a href="#!" className="view-dir">VIEW DIRECTORY ›</a>
          </div>
          <div className="card service-simple-card">
            <div className="icon-badge">🔔</div>
            <h4>Announcements &amp; Safety Notifications</h4>
            <p>Barangay announcements, event updates, and emergency alerts you should be aware of.</p>
            <Link to="/dashboard" className="view-dir">VIEW ANNOUNCEMENTS ›</Link>
          </div>
        </div>
      </div>
    </>
  );
}
