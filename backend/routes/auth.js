const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---- Admin photo upload setup ----
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'admins');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.admin.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { institutionalId, password } = req.body;

  if (!institutionalId || !password) {
    return res.status(400).json({ message: 'Institutional ID and password are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE institutional_id = $1',
      [institutionalId]
    );
    const admin = rows[0];

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ message: 'Invalid institutional ID or password.' });
    }

    if (admin.status !== 'approved') {
      return res.status(403).json({ message: 'This account is still pending Institutional Board approval.' });
    }

    const token = jwt.sign(
      { id: admin.id, institutionalId: admin.institutional_id, fullName: admin.full_name, role: admin.role, scope: 'admin' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        fullName: admin.full_name,
        institutionalId: admin.institutional_id,
        department: admin.department,
        role: admin.role,
        photoUrl: admin.photo_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error during login.' });
  }
});

// POST /api/auth/request-access
router.post('/request-access', async (req, res) => {
  const { fullName, email, department, employeeId, password } = req.body;

  if (!fullName || !email || !department || !employeeId || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const { rows: existingRequests } = await pool.query(
      'SELECT id FROM access_requests WHERE email = $1',
      [email]
    );
    const { rows: existingAdmins } = await pool.query(
      'SELECT id FROM admins WHERE email = $1',
      [email]
    );

    if (existingRequests.length > 0 || existingAdmins.length > 0) {
      return res.status(409).json({ message: 'An account or request already exists for this email.' });
    }

    await pool.query(
      `INSERT INTO access_requests (id, full_name, email, department, employee_id, password_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [uuidv4(), fullName, email, department, employeeId, hashPassword(password)]
    );

    res.status(201).json({
      message: 'Request received. The Institutional Board typically reviews requests within 24-48 business hours.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error submitting request.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Institutional email is required.' });
  }

  // Always respond generically to avoid leaking which emails exist.
  res.json({
    message: 'If an account matches that institutional email, a secure reset link has been sent.',
  });
});

// ---- Account (requires a logged-in admin) ----

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, institutional_id, full_name, email, department, role, photo_url FROM admins WHERE id = $1',
      [req.admin.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Admin not found.' });

    const a = rows[0];
    res.json({
      id: a.id,
      institutionalId: a.institutional_id,
      fullName: a.full_name,
      email: a.email,
      department: a.department,
      role: a.role,
      photoUrl: a.photo_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading account.' });
  }
});

// POST /api/auth/me/photo  (upload/replace the logged-in admin's profile picture)
router.post('/me/photo', requireAuth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file was provided.' });
    }

    try {
      const { rows: existingRows } = await pool.query('SELECT photo_url FROM admins WHERE id = $1', [req.admin.id]);
      if (existingRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Admin not found.' });
      }

      const oldPhotoUrl = existingRows[0].photo_url;
      if (oldPhotoUrl) {
        const oldPath = path.join(__dirname, '..', oldPhotoUrl.replace(/^\//, ''));
        fs.unlink(oldPath, () => {});
      }

      const photoUrl = `/uploads/admins/${req.file.filename}`;
      const { rows } = await pool.query(
        'UPDATE admins SET photo_url = $1 WHERE id = $2 RETURNING id, institutional_id, full_name, email, department, role, photo_url',
        [photoUrl, req.admin.id]
      );

      const a = rows[0];
      res.json({
        id: a.id,
        institutionalId: a.institutional_id,
        fullName: a.full_name,
        email: a.email,
        department: a.department,
        role: a.role,
        photoUrl: a.photo_url,
      });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error saving photo.' });
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.admin.id]);
    const admin = rows[0];
    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [
      hashPassword(newPassword),
      admin.id,
    ]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating password.' });
  }
});

// ---- Access request management (requires a logged-in admin) ----

// GET /api/auth/access-requests
router.get('/access-requests', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, department, employee_id, requested_at
       FROM access_requests WHERE status = 'pending' ORDER BY requested_at ASC`
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        department: r.department,
        employeeId: r.employee_id,
        requestedAt: r.requested_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading requests.' });
  }
});

// POST /api/auth/access-requests/:id/approve
router.post('/access-requests/:id/approve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query(
      'SELECT * FROM access_requests WHERE id = $1',
      [req.params.id]
    );
    const request = reqRows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request not found.' });
    }

    const { rows: idTakenRows } = await client.query(
      'SELECT id FROM admins WHERE institutional_id = $1',
      [request.employee_id]
    );
    if (idTakenRows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An admin with this Employee ID already exists.' });
    }

    const newAdminId = `adm-${uuidv4().slice(0, 8)}`;
    await client.query(
      `INSERT INTO admins (id, institutional_id, full_name, email, department, password_hash, status, role)
       VALUES ($1,$2,$3,$4,$5,$6,'approved','Administrator')`,
      [newAdminId, request.employee_id, request.full_name, request.email, request.department, request.password_hash]
    );

    await client.query('DELETE FROM access_requests WHERE id = $1', [request.id]);
    await client.query('COMMIT');

    res.json({
      message: `${request.full_name} has been approved and can now log in with ID ${request.employee_id}.`,
      admin: { id: newAdminId, institutionalId: request.employee_id, fullName: request.full_name },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Database error approving request.' });
  } finally {
    client.release();
  }
});

// POST /api/auth/access-requests/:id/reject
router.post('/access-requests/:id/reject', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM access_requests WHERE id = $1 RETURNING full_name',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Request not found.' });

    res.json({ message: `Request from ${rows[0].full_name} has been rejected and removed.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error rejecting request.' });
  }
});

module.exports = router;
