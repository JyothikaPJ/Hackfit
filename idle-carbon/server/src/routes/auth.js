const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getStore } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'idle-carbon-hackathon-secret-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const store = getStore();
    const user = store.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Only managers and admins can access this system
    if (user.role === 'employee') {
      return res.status(403).json({ success: false, error: 'Access restricted. Only managers and admins can log in.' });
    }

    const dept = store.departments.find(d => d.id === user.departmentId);
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
          departmentName: dept ? dept.name : null
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/auth/me
const { authMiddleware } = require('../middleware');
router.get('/me', authMiddleware, (req, res) => {
  const store = getStore();
  const dept = store.departments.find(d => d.id === req.user.departmentId);
  res.json({
    success: true,
    data: { ...req.user, departmentName: dept ? dept.name : null }
  });
});

module.exports = router;
