const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
// GET is public: announcements are shown on the resident dashboard
// before/without login context in the original portal design (see README
// API table: Auth "—"). Writes require an authenticated admin — applied
// per-route below rather than with router.use(), so GET stays public.

// ---- Upload setup: optional announcement image ----
const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'announcements');
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMAGE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `announcement-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

function toAnnouncement(a) {
  return {
    id: a.id,
    title: a.title,
    tag: a.tag,
    body: a.body,
    eventDate: a.event_date,
    imageUrl: a.image_url,
    createdAt: a.created_at,
  };
}

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filePath = path.join(__dirname, '..', imageUrl.replace(/^\//, ''));
  fs.unlink(filePath, () => {}); // best-effort; fine if it's already gone
}

// GET /api/announcements
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(rows.map(toAnnouncement));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading announcements.' });
  }
});

// POST /api/announcements  (admin only, multipart — optional "image" file)
router.post('/', requireAuth, (req, res) => {
  imageUpload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload image.' });
    }
    try {
      const { title, tag, body, eventDate } = req.body;
      if (!title || !title.trim()) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'Title is required.' });
      }

      const id = `ann-${uuidv4().slice(0, 8)}`;
      const imageUrl = req.file ? `/uploads/announcements/${req.file.filename}` : null;
      const { rows } = await pool.query(
        `INSERT INTO announcements (id, title, tag, body, event_date, image_url)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, title.trim(), tag || null, body || null, eventDate || null, imageUrl]
      );

      res.status(201).json(toAnnouncement(rows[0]));
    } catch (err) {
      console.error(err);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ message: 'Database error creating announcement.' });
    }
  });
});

// PUT /api/announcements/:id  (admin only, multipart — optional new "image" file)
router.put('/:id', requireAuth, (req, res) => {
  imageUpload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload image.' });
    }
    try {
      const { rows: existingRows } = await pool.query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
      if (existingRows.length === 0) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Announcement not found.' });
      }

      const existing = toAnnouncement(existingRows[0]);
      const merged = { ...existing, ...req.body };
      if (!merged.title || !merged.title.trim()) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'Title is required.' });
      }

      let imageUrl = existing.imageUrl;
      if (req.file) {
        deleteImageFile(existing.imageUrl);
        imageUrl = `/uploads/announcements/${req.file.filename}`;
      } else if (req.body.removeImage === 'true') {
        deleteImageFile(existing.imageUrl);
        imageUrl = null;
      }

      const { rows } = await pool.query(
        `UPDATE announcements SET title=$1, tag=$2, body=$3, event_date=$4, image_url=$5 WHERE id=$6 RETURNING *`,
        [merged.title.trim(), merged.tag || null, merged.body || null, merged.eventDate || null, imageUrl, req.params.id]
      );

      res.json(toAnnouncement(rows[0]));
    } catch (err) {
      console.error(err);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ message: 'Database error updating announcement.' });
    }
  });
});

// DELETE /api/announcements/:id  (admin only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Announcement not found.' });
    deleteImageFile(rows[0].image_url);
    res.json(toAnnouncement(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error deleting announcement.' });
  }
});

module.exports = router;
