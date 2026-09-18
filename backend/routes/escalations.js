const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toEscalation(e) {
  return {
    id: e.id,
    category: e.category,
    reason: e.reason,
    priority: e.priority,
    overseer: e.overseer,
    status: e.status,
    escalated: e.escalated,
    toDepartment: e.to_department,
    toRecipient: e.to_recipient,
    subject: e.subject,
    body: e.body,
    caseRef: e.case_ref,
  };
}

// GET /api/escalations
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM escalations ORDER BY created_at DESC');

    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE priority IN ('Critical','High'))::int AS high_urgency,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved
      FROM escalations
    `);
    const { total, high_urgency: highUrgency, resolved } = statRows[0];
    const resolutionRate = total ? Math.round((resolved / total) * 1000) / 10 : 0;

    res.json({
      escalations: rows.map(toEscalation),
      stats: { total, highUrgency, resolutionRate, avgResponseHours: 4.2 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading escalations.' });
  }
});

// GET /api/escalations/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM escalations WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Escalation not found.' });
    res.json(toEscalation(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading escalation.' });
  }
});

// POST /api/escalations  (Create Escalation Letter)
router.post('/', async (req, res) => {
  try {
    const { category, reason, priority, toDepartment, toRecipient, subject, body, caseRef } = req.body;
    if (!category || !subject) {
      return res.status(400).json({ message: 'Category and subject are required.' });
    }

    const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS count FROM escalations');
    const year = new Date().getFullYear();
    const seq = String(countRows[0].count + 1).padStart(3, '0');
    const id = `ESC-${year}-${seq}`;

    const { rows } = await pool.query(
      `INSERT INTO escalations
        (id, category, reason, priority, overseer, status, escalated, to_department, to_recipient, subject, body, case_ref)
       VALUES ($1,$2,$3,$4,'Unassigned','Under Review',CURRENT_DATE,$5,$6,$7,$8,$9)
       RETURNING *`,
      [id, category, reason || '', priority || 'Medium', toDepartment || '', toRecipient || '', subject, body || '', caseRef || '']
    );

    res.status(201).json(toEscalation(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error creating escalation.' });
  }
});

// PUT /api/escalations/:id  (issue letter / update status)
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM escalations WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Escalation not found.' });

    const existing = toEscalation(existingRows[0]);
    const merged = { ...existing, ...req.body };

    const { rows } = await pool.query(
      `UPDATE escalations SET
        category=$1, reason=$2, priority=$3, overseer=$4, status=$5, escalated=$6,
        to_department=$7, to_recipient=$8, subject=$9, body=$10, case_ref=$11
       WHERE id=$12 RETURNING *`,
      [
        merged.category, merged.reason, merged.priority, merged.overseer, merged.status, merged.escalated,
        merged.toDepartment, merged.toRecipient, merged.subject, merged.body, merged.caseRef, req.params.id,
      ]
    );

    res.json(toEscalation(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating escalation.' });
  }
});

module.exports = router;
