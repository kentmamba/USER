require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const pool = require('./db/pool');
const authRoutes = require('./routes/auth');
const residentsRoutes = require('./routes/residents');
const complaintsRoutes = require('./routes/complaints');
const meetingsRoutes = require('./routes/meetings');
const escalationsRoutes = require('./routes/escalations');
const dashboardRoutes = require('./routes/dashboard');
const residentAuthRoutes = require('./routes/residentAuth');
const residentComplaintsRoutes = require('./routes/residentComplaints');
const announcementsRoutes = require('./routes/announcements');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serves uploaded resident photos, e.g. GET /uploads/residents/res-abc123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'ok', database: 'disconnected', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/residents', residentsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/escalations', escalationsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Resident (citizen-facing) portal
app.use('/api/resident-auth', residentAuthRoutes);
app.use('/api/resident/complaints', residentComplaintsRoutes);
app.use('/api/announcements', announcementsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Barangay Poblacion API running on http://localhost:${PORT}`);
});
