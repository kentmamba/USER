const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { JWT_SECRET, requireResidentAuth } = require('../middleware/auth');

const router = express.Router();

// ---- Upload setup: resident profile photos + ID document uploads ----
const PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'residents');
const ID_DIR = path.join(__dirname, '..', 'uploads', 'resident-ids');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
fs.mkdirSync(ID_DIR, { recursive: true });

function makeUpload(dir, prefix) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${prefix}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const okType = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
      if (!okType) return cb(new Error('Only image or PDF files are allowed.'));
      cb(null, true);
    },
  });
}

const idUpload = makeUpload(ID_DIR, 'id');
const photoUpload = makeUpload(PHOTO_DIR, 'resident');

function toResidentAccount(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    birthDate: r.birth_date,
    age: r.age,
    gender: r.gender,
    civilStatus: r.civil_status,
    occupation: r.occupation,
    address: r.address,
    zone: r.zone,
    contact: r.contact,
    email: r.email,
    status: r.status,
    photoUrl: r.photo_url,
    idDocumentUrl: r.id_document_url,
    communityPoints: r.community_points,
    tier: r.tier,
    pushNotifications: r.push_notifications,
    emailAnnouncements: r.email_announcements,
    twoFactorEnabled: r.two_factor_enabled,
    language: r.language,
  };
}

// POST /api/resident-auth/register  (self-service "Register your Household")
router.post('/register', (req, res) => {
  idUpload.single('idDocument')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload ID document.' });
    }

    try {
      const {
        firstName, middleName, lastName, birthDate, gender, contact, zone, email, password,
      } = req.body;

      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: 'First name, last name, email, and password are required.' });
      }

      const { rows: existing } = await pool.query(
        'SELECT id FROM residents WHERE email = $1 AND password_hash IS NOT NULL',
        [email]
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: 'An account already exists for this email.' });
      }

      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      const age = birthDate ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear()) : null;
      const id = `res-${uuidv4().slice(0, 8)}`;
      const idDocumentUrl = req.file ? `/uploads/resident-ids/${req.file.filename}` : null;

      const { rows } = await pool.query(
        `INSERT INTO residents
          (id, full_name, birth_date, age, gender, address, zone, contact, email, status,
           category, password_hash, id_document_url, self_registered)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pending',$10,$11,$12,true)
         RETURNING *`,
        [
          id, fullName, birthDate || null, age, gender || 'Unspecified', zone || '', zone || '',
          contact || '', email, JSON.stringify(['Resident']), hashPassword(password), idDocumentUrl,
        ]
      );

      // No token here on purpose: a self-registered account starts out
      // 'Pending' and can't sign in until a barangay admin approves it
      // (see the status check in POST /login below). It's flagged
      // self_registered so it's kept OUT of the main Resident Records list
      // (see the filter in GET /api/residents) and shown instead under
      // Pending Requests, alongside staff access requests, until approved.
      res.status(201).json({
        pending: true,
        message: 'Registration submitted. A barangay admin will review your account before you can sign in.',
        resident: toResidentAccount(rows[0]),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Database error during registration.' });
    }
  });
});

// POST /api/resident-auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email/username and password are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM residents WHERE email = $1 AND password_hash IS NOT NULL',
      [email]
    );
    const resident = rows[0];

    if (!resident || !verifyPassword(password, resident.password_hash)) {
      return res.status(401).json({ message: 'Invalid email/username or password.' });
    }

    if (resident.status === 'Pending') {
      return res.status(403).json({
        message: 'Your account is still awaiting barangay approval. Please check back later.',
      });
    }
    if (resident.status === 'Rejected') {
      return res.status(403).json({
        message: 'Your registration was not approved. Please visit the barangay office for assistance.',
      });
    }

    const token = jwt.sign(
      { id: resident.id, email: resident.email, fullName: resident.full_name, scope: 'resident' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, resident: toResidentAccount(resident) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error during login.' });
  }
});

// GET /api/resident-auth/me
router.get('/me', requireResidentAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.resident.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident account not found.' });
    res.json(toResidentAccount(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading account.' });
  }
});

// PUT /api/resident-auth/me  (Edit Profile)
router.put('/me', requireResidentAuth, async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.resident.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Resident account not found.' });

    const existing = toResidentAccount(existingRows[0]);
    const merged = { ...existing, ...req.body };

    const { rows } = await pool.query(
      `UPDATE residents SET
        full_name=$1, birth_date=$2, gender=$3, civil_status=$4, contact=$5, zone=$6
       WHERE id=$7 RETURNING *`,
      [merged.fullName, merged.birthDate, merged.gender, merged.civilStatus, merged.contact, merged.zone, req.resident.id]
    );

    res.json(toResidentAccount(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating account.' });
  }
});

// PUT /api/resident-auth/preferences  (push notifications, email, 2FA, language)
router.put('/preferences', requireResidentAuth, async (req, res) => {
  try {
    const { pushNotifications, emailAnnouncements, twoFactorEnabled, language } = req.body;

    const { rows } = await pool.query(
      `UPDATE residents SET
        push_notifications = COALESCE($1, push_notifications),
        email_announcements = COALESCE($2, email_announcements),
        two_factor_enabled = COALESCE($3, two_factor_enabled),
        language = COALESCE($4, language)
       WHERE id = $5 RETURNING *`,
      [pushNotifications, emailAnnouncements, twoFactorEnabled, language, req.resident.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Resident account not found.' });
    res.json(toResidentAccount(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating preferences.' });
  }
});

// POST /api/resident-auth/change-password
router.post('/change-password', requireResidentAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.resident.id]);
    const resident = rows[0];
    if (!resident || !verifyPassword(currentPassword, resident.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    await pool.query('UPDATE residents SET password_hash = $1 WHERE id = $2', [
      hashPassword(newPassword),
      resident.id,
    ]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating password.' });
  }
});

// POST /api/resident-auth/me/photo  (upload/replace profile picture)
router.post('/me/photo', requireResidentAuth, (req, res) => {
  photoUpload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file was provided.' });
    }

    try {
      const { rows: existingRows } = await pool.query('SELECT photo_url FROM residents WHERE id = $1', [req.resident.id]);
      if (existingRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Resident account not found.' });
      }

      const oldPhotoUrl = existingRows[0].photo_url;
      if (oldPhotoUrl) {
        const oldPath = path.join(__dirname, '..', oldPhotoUrl.replace(/^\//, ''));
        fs.unlink(oldPath, () => {});
      }

      const photoUrl = `/uploads/residents/${req.file.filename}`;
      const { rows } = await pool.query(
        'UPDATE residents SET photo_url = $1 WHERE id = $2 RETURNING *',
        [photoUrl, req.resident.id]
      );

      res.json(toResidentAccount(rows[0]));
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error saving photo.' });
    }
  });
});

// POST /api/resident-auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  // Generic response so we don't leak which emails have accounts.
  res.json({ message: 'If an account matches that email, a secure reset link has been sent.' });
});

module.exports = router;
