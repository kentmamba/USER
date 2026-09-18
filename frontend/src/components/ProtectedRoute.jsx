import React from 'react';
import { Navigate } from 'react-router-dom';
import { Session } from '../api.js';

export default function ProtectedRoute({ children }) {
  if (!Session.isLoggedIn()) return <Navigate to="/" replace />;
  return children;
}
