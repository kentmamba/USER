import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Services from './pages/Services.jsx';
import FileComplaint from './pages/FileComplaint.jsx';
import SubmissionSuccess from './pages/SubmissionSuccess.jsx';
import Track from './pages/Track.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
      <Route path="/file-complaint" element={<ProtectedRoute><FileComplaint /></ProtectedRoute>} />
      <Route path="/submission-success" element={<ProtectedRoute><SubmissionSuccess /></ProtectedRoute>} />
      <Route path="/track" element={<ProtectedRoute><Track /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    </Routes>
  );
}
