const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');
const { requireResidentAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireResidentAuth);

// Case ID prefixes by category, matching the resident-app mockups
// (e.g. "PS-2024-0891" for Public Safety/Nuisance, "BC-2024-00123" for a
// formal Barangay Complaint/blotter). Anything else falls back to "CASE".
const PREFIXES = {
  'Public Nuisance': 'PS',
  'Noise Complaint': 'PS',
  'Infrastructure': 'IN',
  'Public Works': 'IN',
  'Formal Complaint': 'BC',
};

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'complaint-evidence');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `evidence-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, matches "Up to 10MB" in the mockup
});

function toComplaint(c) {
  return {
    id: c.id,
    resident: c.resident,
    category: c.category,
    status: c.status,
    filingDate: c.filing_date,
    description: c.description,
    priority: c.priority,
    respondent: c.respondent,
    respondentAddress: c.respondent_address,
    complainantAddress: c.complainant_address,
    narrative: c.narrative,
    reliefSought: c.relief_sought,
    attachmentUrl: c.attachment_url,
    submittedAt: c.created_at,
    underReviewAt: c.under_review_at,
    resolvedAt: c.resolved_at,
  };
}

// POST /api/resident/complaints  (File Complaint - quick or formal blotter)
router.post('/', (req, res) => {
  upload.single('evidence')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload attachment.' });
    }

    try {
      const {
        category, description, respondent, respondentAddress, complainantAddress,
        narrative, reliefSought,
      } = req.body;

      if (!category) {
        return res.status(400).json({ message: 'Category is required.' });
      }

      const { rows: residentRows } = await pool.query('SELECT full_name FROM residents WHERE id = $1', [req.resident.id]);
      const residentName = residentRows[0]?.full_name || req.resident.fullName || 'Resident';

      const prefix = PREFIXES[category] || 'CASE';
      const year = new Date().getFullYear();
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*)::int AS count FROM complaints WHERE id LIKE $1",
        [`${prefix}-${year}-%`]
      );
      const seq = String(countRows[0].count + 1).padStart(prefix === 'BC' ? 5 : 4, '0');
      const id = `${prefix}-${year}-${seq}`;

      const attachmentUrl = req.file ? `/uploads/complaint-evidence/${req.file.filename}` : null;

      const { rows } = await pool.query(
        `INSERT INTO complaints
          (id, resident, category, status, filing_date, description, priority,
           respondent, respondent_address, complainant_address, narrative, relief_sought,
           attachment_url, filed_by_resident_id)
         VALUES ($1,$2,$3,'Pending',CURRENT_DATE,$4,'Normal',$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          id, residentName, category, description || narrative || '', respondent || null,
          respondentAddress || null, complainantAddress || null, narrative || null,
          reliefSought || null, attachmentUrl, req.resident.id,
        ]
      );

      res.status(201).json(toComplaint(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Database error filing complaint.' });
    }
  });
});

// GET /api/resident/complaints  (Portal Activity / Recent History for the logged-in resident)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM complaints WHERE filed_by_resident_id = $1 ORDER BY created_at DESC',
      [req.resident.id]
    );
    res.json(rows.map(toComplaint));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading complaints.' });
  }
});

// GET /api/resident/complaints/:id  (Track Your Request - lookup by reference ID)
// Scoped to the logged-in resident's own complaints for privacy.
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM complaints WHERE id = $1 AND filed_by_resident_id = $2',
      [req.params.id, req.resident.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No request found with that reference ID on your account.' });
    }
    res.json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading request.' });
  }
});

module.exports = router;
