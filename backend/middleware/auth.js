const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Admin-portal auth. Rejects resident-scoped tokens so a resident login
// can never be used to reach admin-only routes.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope === 'resident') {
      return res.status(403).json({ message: 'This account does not have administrative access.' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Resident-portal auth. Only accepts tokens issued by resident login/register.
function requireResidentAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.scope !== 'resident') {
      return res.status(403).json({ message: 'This route is for resident accounts only.' });
    }
    req.resident = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth, requireResidentAuth, JWT_SECRET };
