import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getAnnouncements, getMyEscalations } from '../api.js';

export default function Navbar() {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [newNotification, setNewNotification] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const [announcements, escalations] = await Promise.all([
          getAnnouncements(),
          getMyEscalations(),
        ]);
        if (!active) return;

        const seenIds = JSON.parse(localStorage.getItem('bp_seen_announcements') || '[]');
        const currentIds = announcements.map((announcement) => announcement.id);
        const seenEscalationIds = JSON.parse(localStorage.getItem('bp_seen_escalations') || '[]');

        if (!initialized.current) {
          const knownIds = [...new Set([...seenIds, ...currentIds])];
          localStorage.setItem('bp_seen_announcements', JSON.stringify(knownIds));
          localStorage.setItem('bp_seen_escalations', JSON.stringify(
            escalations.map((escalation) => escalation.id)
          ));
          initialized.current = true;
          return;
        }

        const unseen = announcements.filter((announcement) => !seenIds.includes(announcement.id));
        const announcementNotifications = unseen.map((announcement) => ({
          id: `announcement-${announcement.id}`,
          title: 'New announcement',
          message: announcement.title,
          type: 'announcement',
        }));
        const newEscalations = escalations.filter((escalation) => !seenEscalationIds.includes(escalation.id));
        const escalationNotifications = newEscalations.map((escalation) => ({
          id: `escalation-${escalation.id}`,
          title: 'Your complaint was escalated',
          message: `${escalation.caseRef || escalation.complaintId} has been escalated for review.`,
          type: 'escalation',
        }));

        if (unseen.length > 0) {
          localStorage.setItem('bp_seen_announcements', JSON.stringify([...new Set([...seenIds, ...currentIds])]));
        }
        if (newEscalations.length > 0) {
          localStorage.setItem('bp_seen_escalations', JSON.stringify([
            ...new Set([...seenEscalationIds, ...escalations.map((escalation) => escalation.id)]),
          ]));
        }

        const newNotifications = [...announcementNotifications, ...escalationNotifications];
        if (newNotifications.length > 0) {
          setNotifications((current) => {
            const existingIds = new Set(current.map((notification) => notification.id));
            return [...current, ...newNotifications.filter((notification) => !existingIds.has(notification.id))];
          });
          setNewNotification(newNotifications[0]);
        }
      } catch {
        // Notifications are supplemental; the rest of the navbar remains usable.
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  function openNotifications() {
    setShowNotifications((isOpen) => !isOpen);
    setNewNotification(null);
    const seenIds = JSON.parse(localStorage.getItem('bp_seen_announcements') || '[]');
    const updatedIds = [...new Set([
      ...seenIds,
      ...notifications.map((notification) => notification.id.replace('announcement-', '')),
    ])];
    localStorage.setItem('bp_seen_announcements', JSON.stringify(updatedIds));
    const seenEscalationIds = JSON.parse(localStorage.getItem('bp_seen_escalations') || '[]');
    localStorage.setItem('bp_seen_escalations', JSON.stringify([
      ...new Set([
        ...seenEscalationIds,
        ...notifications
          .filter((notification) => notification.type === 'escalation')
          .map((notification) => notification.id.replace('escalation-', '')),
      ]),
    ]));
  }

  return (
    <nav className="navbar">
      <div className="brand">🏛️ Barangay Residents Portal</div>
      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>🏠 Home</NavLink>
        <NavLink to="/services" className={({ isActive }) => isActive ? 'active' : ''}>⚏ Services</NavLink>
        <NavLink to="/track" className={({ isActive }) => isActive ? 'active' : ''}>📈 Track</NavLink>
        <div className="notification-wrap">
          <button type="button" className="notification-button" onClick={openNotifications} aria-label="Open notifications">
            🔔
            {notifications.length > 0 && <span className="notification-count">{notifications.length}</span>}
          </button>
          {showNotifications && (
            <div className="notification-menu">
              <div className="notification-menu-title">Notifications</div>
              {notifications.length === 0 ? (
                <div className="notification-empty">No new notifications.</div>
              ) : (
                notifications.map((notification) => (
                  <NavLink
                    to="/services"
                    className="notification-item"
                    key={notification.id}
                    onClick={() => setShowNotifications(false)}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                  </NavLink>
                ))
              )}
            </div>
          )}
        </div>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>◎ Profile</NavLink>
      </div>
      {newNotification && (
        <div className="announcement-toast" role="status">
          <strong>{newNotification.title}</strong>
          <span>{newNotification.message}</span>
          <button type="button" onClick={() => setNewNotification(null)} aria-label="Dismiss notification">✕</button>
        </div>
      )}
    </nav>
  );
}
