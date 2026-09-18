const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

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
    filedByResidentId: c.filed_by_resident_id,
    submittedAt: c.created_at,
    underReviewAt: c.under_review_at,
    resolvedAt: c.resolved_at,
  };
}

// GET /api/complaints
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(id) LIKE $${params.length} OR LOWER(resident) LIKE $${params.length})`);
    }
    if (category && category !== 'All Categories') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM complaints ${where} ORDER BY created_at DESC`,
      params
    );

    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'Resolved')::int AS active,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved
      FROM complaints
    `);
    const { active, total, resolved } = statRows[0];
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

    res.json({
      complaints: rows.map(toComplaint),
      stats: { active, resolutionRate },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading complaints.' });
  }
});

// GET /api/complaints/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Case not found.' });
    res.json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading case.' });
  }
});

// POST /api/complaints (File New Case)
router.post('/', async (req, res) => {
  try {
    const { resident, category, description, priority } = req.body;
    if (!resident || !category) {
      return res.status(400).json({ message: 'Resident and category are required.' });
    }

    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS count FROM complaints');
    const year = new Date().getFullYear();
    const seq = String(countRows[0].count + 1).padStart(3, '0');
    const id = `CASE-${year}-${seq}`;

    const { rows } = await pool.query(
      `INSERT INTO complaints (id, resident, category, status, filing_date, description, priority)
       VALUES ($1,$2,$3,'Pending',CURRENT_DATE,$4,$5)
       RETURNING *`,
      [id, resident, category, description || '', priority || 'Normal']
    );

    res.status(201).json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error filing case.' });
  }
});

// PUT /api/complaints/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Case not found.' });

    const existingRaw = existingRows[0];
    const existing = toComplaint(existingRaw);
    const merged = { ...existing, ...req.body };

    // Stamp timeline timestamps the first time a case moves out of Pending,
    // and again when it's marked Resolved - the resident portal's tracker
    // timeline reads these to show "Under Review" / "Resolved" dates.
    let underReviewAt = existingRaw.under_review_at;
    let resolvedAt = existingRaw.resolved_at;
    if (merged.status !== 'Pending' && !underReviewAt) {
      underReviewAt = new Date();
    }
    if (merged.status === 'Resolved' && !resolvedAt) {
      resolvedAt = new Date();
    }

    const { rows } = await pool.query(
      `UPDATE complaints SET resident=$1, category=$2, status=$3, filing_date=$4, description=$5, priority=$6,
        under_review_at=$7, resolved_at=$8
       WHERE id=$9 RETURNING *`,
      [
        merged.resident, merged.category, merged.status, merged.filingDate, merged.description, merged.priority,
        underReviewAt, resolvedAt, req.params.id,
      ]
    );

    res.json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating case.' });
  }
});

module.exports = router;
