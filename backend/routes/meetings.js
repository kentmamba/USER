const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toMeeting(m) {
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    time: m.time,
    location: m.location,
    attendees: m.attendees || [],
    agenda: m.agenda || [],
    minutes: m.minutes || '',
    resolutions: m.resolutions || [],
  };
}

// GET /api/meetings
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM meetings ORDER BY date DESC, created_at DESC');
    res.json(rows.map(toMeeting));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading meetings.' });
  }
});

// GET /api/meetings/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Meeting not found.' });
    res.json(toMeeting(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading meeting.' });
  }
});

// POST /api/meetings
router.post('/', async (req, res) => {
  try {
    const { title, date, time, location, agenda, attendees } = req.body;
    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required.' });
    }

    const id = `mtg-${uuidv4().slice(0, 8)}`;
    const { rows } = await pool.query(
      `INSERT INTO meetings (id, title, date, time, location, attendees, agenda, minutes, resolutions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'', '[]')
       RETURNING *`,
      [id, title, date, time || '', location || '', JSON.stringify(attendees || []), JSON.stringify(agenda || [])]
    );

    res.status(201).json(toMeeting(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error creating meeting.' });
  }
});

// PUT /api/meetings/:id  (edit minutes / add resolutions)
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Meeting not found.' });

    const existing = toMeeting(existingRows[0]);
    const merged = { ...existing, ...req.body };

    const { rows } = await pool.query(
      `UPDATE meetings SET title=$1, date=$2, time=$3, location=$4, attendees=$5, agenda=$6, minutes=$7, resolutions=$8
       WHERE id=$9 RETURNING *`,
      [
        merged.title, merged.date, merged.time, merged.location, JSON.stringify(merged.attendees || []),
        JSON.stringify(merged.agenda || []), merged.minutes || '', JSON.stringify(merged.resolutions || []),
        req.params.id,
      ]
    );

    res.json(toMeeting(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating meeting.' });
  }
});

module.exports = router;
