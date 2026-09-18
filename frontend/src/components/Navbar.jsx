import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="brand">🏛️ Barangay Residents Portal</div>
      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>🏠 Home</NavLink>
        <NavLink to="/services" className={({ isActive }) => isActive ? 'active' : ''}>⚏ Services</NavLink>
        <NavLink to="/track" className={({ isActive }) => isActive ? 'active' : ''}>📈 Track</NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>◎ Profile</NavLink>
      </div>
    </nav>
  );
}
