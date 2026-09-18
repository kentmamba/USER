const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/overview
router.get('/overview', async (req, res) => {
  try {
    const { rows: complaintStatRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'Resolved')::int AS pending,
        COUNT(*) FILTER (WHERE priority = 'High')::int AS high_priority
      FROM complaints
    `);
    // Matches the same exclusion as GET /api/residents: self-registered
    // accounts still awaiting approval aren't "enrolled" yet.
    const { rows: residentCountRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM residents WHERE NOT (self_registered = true AND status = 'Pending')`
    );

    const { rows: recentComplaints } = await pool.query(
      'SELECT * FROM complaints ORDER BY created_at DESC LIMIT 1'
    );
    const { rows: recentMeetings } = await pool.query(
      'SELECT * FROM meetings ORDER BY date DESC, created_at DESC LIMIT 1'
    );

    const recentActivity = [
      ...recentComplaints.map((c) => ({
        type: 'case',
        title: `New Case Filed: #${c.id}`,
        detail: `Resident ${c.resident} registered a ${c.category.toLowerCase()} complaint.`,
        when: 'Recently',
      })),
      ...recentMeetings.map((m) => ({
        type: 'meeting',
        title: 'Session Adjourned',
        detail: `${m.title} concluded. Minutes and proposed resolutions have been uploaded to the archives.`,
        when: 'Yesterday',
      })),
    ];

    res.json({
      totalPopulation: 12482,
      totalEnrolledResidents: residentCountRows[0].count,
      pendingComplaints: complaintStatRows[0].pending,
      highPriorityComplaints: complaintStatRows[0].high_priority,
      activeProjects: 8,
      activeProjectsCompletionPct: 75,
      recentActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading dashboard.' });
  }
});

module.exports = router;
