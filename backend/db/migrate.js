// Creates the schema (if not already present) and seeds starter data
// (if the tables are empty). Safe to re-run — every insert is idempotent.
//
// Usage:  npm run migrate

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { hashPassword } = require('../utils/password');

async function run() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  console.log('Applying schema...');
  await pool.query(schema);

  // Safe to re-run: adds the column only if it doesn't already exist.
  // (CREATE TABLE IF NOT EXISTS above won't add new columns to a table
  // that was already created in an earlier migration run.)
  console.log('Ensuring residents.photo_url column exists...');
  await pool.query('ALTER TABLE residents ADD COLUMN IF NOT EXISTS photo_url TEXT');

  console.log('Ensuring admins.photo_url column exists...');
  await pool.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS photo_url TEXT');

  // Resident-portal self-service account fields (self-registration, login, preferences)
  console.log('Ensuring resident-portal columns exist on residents...');
  await pool.query(`
    ALTER TABLE residents
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS civil_status TEXT,
      ADD COLUMN IF NOT EXISTS id_document_url TEXT,
      ADD COLUMN IF NOT EXISTS community_points INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'Member',
      ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS email_announcements BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'English (US)',
      ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT false
  `);

  // Backfill: any resident row that already has a portal password was
  // necessarily created via self-registration (admin-enrolled residents
  // never set password_hash), so reclassify those retroactively. This
  // catches self-registered rows created before the self_registered column
  // existed, so they're correctly hidden from Resident Records / surfaced
  // in Pending Requests if still Pending.
  await pool.query(`
    UPDATE residents SET self_registered = true
    WHERE password_hash IS NOT NULL AND self_registered = false
  `);

  // Formal-blotter / resident-portal fields on complaints
  console.log('Ensuring resident-portal columns exist on complaints...');
  await pool.query(`
    ALTER TABLE complaints
      ADD COLUMN IF NOT EXISTS respondent TEXT,
      ADD COLUMN IF NOT EXISTS respondent_address TEXT,
      ADD COLUMN IF NOT EXISTS complainant_address TEXT,
      ADD COLUMN IF NOT EXISTS narrative TEXT,
      ADD COLUMN IF NOT EXISTS relief_sought TEXT,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS filed_by_resident_id TEXT REFERENCES residents(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS under_review_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ
  `);

  // The announcements table pre-dates the current schema in some existing
  // databases, with `id` as an auto-incrementing INTEGER rather than TEXT.
  // The app now generates text ids like "ann-55b420e8", which can't fit an
  // integer column — fix that up regardless of which type is already there
  // (both statements are safe/no-ops if id is already TEXT with no default).
  console.log('Ensuring announcements.id is TEXT...');
  await pool.query(`ALTER TABLE announcements ALTER COLUMN id DROP DEFAULT`);
  await pool.query(`ALTER TABLE announcements ALTER COLUMN id TYPE TEXT USING id::text`);
  await pool.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT`);

  const { rows: adminCountRows } = await pool.query('SELECT COUNT(*) FROM admins');
  if (Number(adminCountRows[0].count) === 0) {
    console.log('Seeding default admin account (CL-8848-00X / admin123)...');
    await pool.query(
      `INSERT INTO admins (id, institutional_id, full_name, email, department, password_hash, status, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        'adm-001',
        'CL-8848-00X',
        'Poblacion Admin',
        'admin@civicledger.gov',
        'Internal Oversight',
        hashPassword('admin123'),
        'approved',
        'Administrator',
      ]
    );
  }

  const { rows: residentCountRows } = await pool.query('SELECT COUNT(*) FROM residents');
  if (Number(residentCountRows[0].count) === 0) {
    console.log('Seeding sample residents...');
    const residents = [
      {
        id: 'res-001', fullName: 'Elena B. Santos', birthDate: '1992-03-12', age: 34, gender: 'Female',
        occupation: 'Teacher', address: 'Jubasan', zone: 'Zone 2 - Bravo', residencyYears: 12,
        contact: '+63 917 555 0001', email: 'elena.santos@example.com', status: 'Verified',
        category: ['Voter'], education: null, bloodType: 'O+', placeOfBirth: 'Cebu', spouse: null, household: [],
      },
      {
        id: 'res-002', fullName: 'Ricardo M. Delgado', birthDate: '1959-07-01', age: 67, gender: 'Male',
        occupation: 'Retired', address: 'Unit 4, Block 3', zone: 'Zone 1 - Alpha', residencyYears: 30,
        contact: '', email: '', status: 'Pending',
        category: ['Voter'], education: null, bloodType: 'A+', placeOfBirth: 'Cebu', spouse: null, household: [],
      },
      {
        id: 'res-003', fullName: 'Carmelita S. Tan', birthDate: '1954-01-20', age: 72, gender: 'Female',
        occupation: 'Retired', address: 'Blk 4, Lot 12', zone: 'Zone 3 - Charlie', residencyYears: 40,
        contact: '', email: '', status: 'Verified',
        category: ['Senior Citizen', 'Voter'], education: null, bloodType: 'B+', placeOfBirth: 'Mandaue', spouse: null, household: [],
      },
      {
        id: 'res-004', fullName: 'Ricardo V. De Jesus', birthDate: '1962-01-15', age: 63, gender: 'Male',
        occupation: 'Retired Civil Engineer', address: 'Purok Manga, Sitio Rio Barangay Poblacion',
        zone: 'Purok Manga', residencyYears: 14, contact: '+63 917 555 1290', email: 'r.dejesus.62@gmail.com',
        status: 'Verified', category: ['Voter'], education: 'Post-Graduate (M.S. Eng)', bloodType: 'O Positive (O+)',
        placeOfBirth: 'Cordova Cebu', spouse: 'Maria Idesa De Jesus', household: [],
      },
    ];

    for (const r of residents) {
      await pool.query(
        `INSERT INTO residents
          (id, full_name, birth_date, age, gender, occupation, address, zone, residency_years,
           contact, email, status, category, education, blood_type, place_of_birth, spouse, household)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          r.id, r.fullName, r.birthDate, r.age, r.gender, r.occupation, r.address, r.zone, r.residencyYears,
          r.contact, r.email, r.status, JSON.stringify(r.category), r.education, r.bloodType,
          r.placeOfBirth, r.spouse, JSON.stringify(r.household),
        ]
      );
    }
  }

  // Give the first seeded resident (Elena Santos) a resident-portal
  // password so the Residents (citizen-facing) app has a working demo
  // login out of the box — same account, viewable/editable from the admin
  // Resident Records screen too, since both apps share this row.
  //
  // This runs on every migrate call (not just when residents were freshly
  // seeded above), so it also repairs a database whose residents were
  // seeded by an older version of this script that didn't set a password.
  const { rows: elenaRows } = await pool.query(
    "SELECT id FROM residents WHERE id = 'res-001' AND password_hash IS NULL"
  );
  if (elenaRows.length > 0) {
    console.log('Seeding demo resident-portal login (elena.santos@example.com / password123)...');
    await pool.query('UPDATE residents SET password_hash = $1 WHERE id = $2', [
      hashPassword('password123'),
      'res-001',
    ]);
  }

  const { rows: complaintCountRows } = await pool.query('SELECT COUNT(*) FROM complaints');
  if (Number(complaintCountRows[0].count) === 0) {
    console.log('Seeding sample complaints...');
    const complaints = [
      { id: 'CASE-2024-089', resident: 'Maria Santos', category: 'Sanitation', status: 'Pending', filingDate: '2024-10-24', description: 'Registered a noise complaint for Jurisdiction Sector 4.', priority: 'Normal' },
      { id: 'CASE-2024-072', resident: 'Juan Dela Cruz', category: 'Noise Nuisance', status: 'In Progress', filingDate: '2024-10-20', description: 'Noise nuisance complaint under review.', priority: 'Normal' },
      { id: 'CASE-2024-055', resident: 'Elena Rodriguez', category: 'Boundary Dispute', status: 'Mediation', filingDate: '2024-10-15', description: 'Boundary dispute referred to mediation.', priority: 'Normal' },
    ];
    for (const c of complaints) {
      await pool.query(
        `INSERT INTO complaints (id, resident, category, status, filing_date, description, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [c.id, c.resident, c.category, c.status, c.filingDate, c.description, c.priority]
      );
    }
  }

  const { rows: meetingCountRows } = await pool.query('SELECT COUNT(*) FROM meetings');
  if (Number(meetingCountRows[0].count) === 0) {
    console.log('Seeding sample meeting...');
    await pool.query(
      `INSERT INTO meetings (id, title, date, time, location, attendees, agenda, minutes, resolutions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        'mtg-001',
        'Monthly Community Council Meeting',
        '2024-10-24',
        '02:00 PM - 04:30 PM',
        'Barangay Hall',
        JSON.stringify(['Roberto Cruz', 'Liza Lopez', 'Juan Santos']),
        JSON.stringify([
          'Call to Order & Opening Remarks',
          'Approval of Previous Minutes',
          'Public Safety Report (Zone 4)',
          'Community Health Waiting Time Report',
        ]),
        'Meeting proceeded as scheduled with quorum present.',
        JSON.stringify([
          { id: 'R22-4200', title: 'Allocation of PHP 40,000 for Additional Street Lighting on Purok 5', status: 'Approved' },
          { id: 'R22-4199', title: 'Mandatory Curfew Reinforcement Initiative for Minors', status: 'Approved' },
          { id: 'R22-4198', title: 'Proposed 2025 Barangay Hall Front Desk Upgrades', status: 'Pending' },
        ]),
      ]
    );
  }

  const { rows: escalationCountRows } = await pool.query('SELECT COUNT(*) FROM escalations');
  if (Number(escalationCountRows[0].count) === 0) {
    console.log('Seeding sample escalations...');
    const escalations = [
      { id: 'ESC-2024-002', category: 'Noise Complaint', reason: 'Repetitive Offense', priority: 'Critical', overseer: 'Hon. J. Miller', status: 'Under Review', escalated: '2024-10-11' },
      { id: 'ESC-2024-012', category: 'Boundary Dispute', reason: 'Judicial Request', priority: 'High', overseer: 'Unassigned', status: 'Mediation', escalated: '2024-10-14' },
      { id: 'ESC-2024-045', category: 'Utility Misuse', reason: 'Multiple Appeals', priority: 'Medium', overseer: 'Dr. Sarah Kent', status: 'Resolved', escalated: '2024-10-10' },
      { id: 'ESC-2024-067', category: 'Zoning Breach', reason: 'Judicial Request', priority: 'Critical', overseer: 'Hon. P. Vance', status: 'Under Review', escalated: '2024-10-15' },
    ];
    for (const e of escalations) {
      await pool.query(
        `INSERT INTO escalations (id, category, reason, priority, overseer, status, escalated)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [e.id, e.category, e.reason, e.priority, e.overseer, e.status, e.escalated]
      );
    }
  }

  const { rows: announcementCountRows } = await pool.query('SELECT COUNT(*) FROM announcements');
  if (Number(announcementCountRows[0].count) === 0) {
    console.log('Seeding sample announcement...');
    await pool.query(
      `INSERT INTO announcements (id, title, tag, body, event_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        'ann-001',
        'Barangay Clean-up Drive',
        'CLEAN-UP DRIVE',
        'Join us this weekend for our quarterly clean-up drive. Equipment and refreshments will be provided for all volunteers.',
        '2024-10-24',
      ]
    );
  }

  console.log('Done. Database is ready.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
