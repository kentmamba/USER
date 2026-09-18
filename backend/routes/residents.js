const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---- Photo upload setup ----
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'residents');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
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

function toResident(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    birthDate: r.birth_date,
    age: r.age,
    gender: r.gender,
    occupation: r.occupation,
    address: r.address,
    zone: r.zone,
    residencyYears: r.residency_years,
    contact: r.contact,
    email: r.email,
    status: r.status,
    category: r.category || [],
    education: r.education,
    bloodType: r.blood_type,
    placeOfBirth: r.place_of_birth,
    spouse: r.spouse,
    household: r.household || [],
    photoUrl: r.photo_url,
  };
}

// GET /api/residents  (supports ?search=&zone=&status=)
//
// Self-registered accounts still awaiting approval (self_registered=true AND
// status='Pending') are intentionally excluded here — they show up in
// Pending Requests (GET /api/residents/pending-registrations) instead, and
// only land in this list once an admin approves them (status flips to
// 'Verified', or they're otherwise edited off 'Pending'). Residents an
// admin enrolled directly always show up here immediately, Pending or not.
router.get('/', async (req, res) => {
  try {
    const { search, zone, status } = req.query;
    const conditions = [`NOT (self_registered = true AND status = 'Pending')`];
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`LOWER(full_name) LIKE $${params.length}`);
    }
    if (zone && zone !== 'All Zones') {
      params.push(zone);
      conditions.push(`zone = $${params.length}`);
    }
    if (status && status !== 'All Types') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await pool.query(
      `SELECT * FROM residents ${where} ORDER BY created_at DESC`,
      params
    );

    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE gender = 'Male')::int AS male,
        COUNT(*) FILTER (WHERE gender = 'Female')::int AS female,
        COUNT(*) FILTER (WHERE status = 'Verified')::int AS verified
      FROM residents
      WHERE NOT (self_registered = true AND status = 'Pending')
    `);

    res.json({
      residents: rows.map(toResident),
      stats: statRows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading residents.' });
  }
});

// GET /api/residents/pending-registrations
// Self-registered accounts awaiting admin approval before they can sign in
// or appear in the main Resident Records list.
router.get('/pending-registrations', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM residents WHERE self_registered = true AND status = 'Pending' ORDER BY created_at ASC`
    );
    res.json(rows.map(toResident));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading pending registrations.' });
  }
});

// POST /api/residents/:id/approve  (approve a self-registered account)
router.post('/:id/approve', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE residents SET status = 'Verified' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });
    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error approving resident.' });
  }
});

// POST /api/residents/:id/reject  (reject a self-registered account)
// Keeps the row (so the login route can show a clear "not approved"
// message rather than a generic account-not-found error) but it stays out
// of Resident Records and Pending Requests either way, since it's no
// longer 'Pending'.
router.post('/:id/reject', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE residents SET status = 'Rejected' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });
    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error rejecting resident.' });
  }
});

// GET /api/residents/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });
    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading resident.' });
  }
});

// POST /api/residents  (Enroll New Resident)
router.post('/', async (req, res) => {
  try {
    const {
      fullName, birthDate, gender, occupation, address, zone, residencyYears,
      household, contact, email,
    } = req.body;

    if (!fullName || !address) {
      return res.status(400).json({ message: 'Full name and address are required.' });
    }

    const age = birthDate ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear()) : null;
    const id = `res-${uuidv4().slice(0, 8)}`;

    const { rows } = await pool.query(
      `INSERT INTO residents
        (id, full_name, birth_date, age, gender, occupation, address, zone, residency_years,
         contact, email, status, category, household)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending',$12,$13)
       RETURNING *`,
      [
        id, fullName, birthDate || null, age, gender || 'Unspecified', occupation || '', address,
        zone || '', residencyYears || 0, contact || '', email || '',
        JSON.stringify(['Resident']), JSON.stringify(household || []),
      ]
    );

    res.status(201).json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error enrolling resident.' });
  }
});

// POST /api/residents/:id/photo  (upload/replace a resident's photo)
router.post('/:id/photo', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file was provided.' });
    }

    try {
      const { rows: existingRows } = await pool.query('SELECT photo_url FROM residents WHERE id = $1', [req.params.id]);
      if (existingRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Resident not found.' });
      }

      // Clean up the old photo file, if any, now that we have a new one.
      const oldPhotoUrl = existingRows[0].photo_url;
      if (oldPhotoUrl) {
        const oldPath = path.join(__dirname, '..', oldPhotoUrl.replace(/^\//, ''));
        fs.unlink(oldPath, () => {});
      }

      const photoUrl = `/uploads/residents/${req.file.filename}`;
      const { rows } = await pool.query(
        'UPDATE residents SET photo_url = $1 WHERE id = $2 RETURNING *',
        [photoUrl, req.params.id]
      );

      res.json(toResident(rows[0]));
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error saving photo.' });
    }
  });
});

// PUT /api/residents/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Resident not found.' });

    const existing = toResident(existingRows[0]);
    const merged = { ...existing, ...req.body };

    if (req.body.birthDate && req.body.birthDate !== existing.birthDate) {
      merged.age = Math.max(0, new Date().getFullYear() - new Date(req.body.birthDate).getFullYear());
    }

    const { rows } = await pool.query(
      `UPDATE residents SET
        full_name=$1, birth_date=$2, age=$3, gender=$4, occupation=$5, address=$6, zone=$7,
        residency_years=$8, contact=$9, email=$10, status=$11, category=$12, education=$13,
        blood_type=$14, place_of_birth=$15, spouse=$16, household=$17
       WHERE id=$18 RETURNING *`,
      [
        merged.fullName, merged.birthDate, merged.age, merged.gender, merged.occupation, merged.address,
        merged.zone, merged.residencyYears, merged.contact, merged.email, merged.status,
        JSON.stringify(merged.category || []), merged.education, merged.bloodType, merged.placeOfBirth,
        merged.spouse, JSON.stringify(merged.household || []), req.params.id,
      ]
    );

    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating resident.' });
  }
});

// DELETE /api/residents/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM residents WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });

    if (rows[0].photo_url) {
      const oldPath = path.join(__dirname, '..', rows[0].photo_url.replace(/^\//, ''));
      fs.unlink(oldPath, () => {});
    }

    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error deleting resident.' });
  }
});

module.exports = router;
