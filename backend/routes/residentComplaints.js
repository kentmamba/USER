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
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Only image or PDF evidence files are allowed.'));
    }
    cb(null, true);
  },
});

async function hasValidFileSignature(file) {
  const header = await fs.promises.readFile(file.path, { encoding: null });
  if (file.mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (file.mimetype === 'image/png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/gif') return header.subarray(0, 4).toString('ascii') === 'GIF8';
  if (file.mimetype === 'image/webp') return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if (file.mimetype === 'application/pdf') return header.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
}

async function scanWithSightengine(file) {
  if (!file || !file.mimetype.startsWith('image/')) return { status: 'manual_review', score: null };
  const userId = process.env.SIGHTENGINE_USER_ID;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!userId || !apiSecret) return { status: 'not_configured', score: null };

  try {
    const buffer = await fs.promises.readFile(file.path);
    const form = new FormData();
    form.append('media', new Blob([buffer], { type: file.mimetype }), file.originalname);
    form.append('models', 'genai');
    form.append('api_user', userId);
    form.append('api_secret', apiSecret);
    const response = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Sightengine returned ${response.status}`);
    const data = await response.json();
    const score = Number(data.type?.ai_generated ?? data.ai_generated ?? data.genai?.ai_generated ?? data.genai?.score);
    if (!Number.isFinite(score)) return { status: 'manual_review', score: null };
    return { status: score >= 0.8 ? 'possibly_ai_generated' : score <= 0.2 ? 'likely_authentic' : 'manual_review', score };
  } catch (err) {
    console.error('[sightengine] scan failed:', err.message);
    return { status: 'provider_unavailable', score: null };
  }
}

function toComplaint(c) {
  return {
    id: c.id,
    resident: c.resident,
    category: c.category,
    status: c.status,
    filingDate: c.filing_date,
    description: c.description,
    priority: c.priority,
    aiScanStatus: c.ai_scan_status,
    aiScanScore: c.ai_scan_score,
    aiScanCheckedAt: c.ai_scan_checked_at,
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
      if (req.file && !(await hasValidFileSignature(req.file))) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'The evidence file failed type validation. Please upload the original image or PDF.' });
      }
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
      const aiScan = req.file ? await scanWithSightengine(req.file) : { status: 'not_scanned', score: null };

      const { rows } = await pool.query(
        `INSERT INTO complaints
          (id, resident, category, status, filing_date, description, priority, ai_scan_status, ai_scan_score, ai_scan_checked_at,
           respondent, respondent_address, complainant_address, narrative, relief_sought,
           attachment_url, filed_by_resident_id)
         VALUES ($1,$2,$3,'Pending',CURRENT_DATE,$4,'Normal',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          id, residentName, category, description || narrative || '', aiScan.status, aiScan.score, req.file ? new Date() : null, respondent || null,
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

// GET /api/resident/complaints/escalations
// Returns formal escalation letters linked to the logged-in resident's cases.
router.get('/escalations', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.category, e.reason, e.priority, e.status, e.subject, e.case_ref,
              e.created_at, c.id AS complaint_id
       FROM escalations e
       INNER JOIN complaints c ON c.id = e.case_ref
       WHERE c.filed_by_resident_id = $1
       ORDER BY e.created_at DESC`,
      [req.resident.id]
    );
    res.json(rows.map((e) => ({
      id: e.id,
      category: e.category,
      reason: e.reason,
      priority: e.priority,
      status: e.status,
      subject: e.subject,
      caseRef: e.case_ref,
      complaintId: e.complaint_id,
      createdAt: e.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading escalation updates.' });
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
