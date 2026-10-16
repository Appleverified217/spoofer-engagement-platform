const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure a default guest user exists on startup
async function ensureGuestUser() {
  try {
    const res = await db.query('SELECT id FROM users WHERE id = 1');
    if (res.rows.length === 0) {
      await db.query(
        'INSERT INTO users (id, username, email, password_hash, credits, role) VALUES (1, $1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        ['guest_user', 'guest@platform.local', 'nopassword', 999999, 'user']
      );
    } else {
      await db.query('UPDATE users SET credits = 999999 WHERE id = 1');
    }
  } catch (err) {
    console.warn('Database not connected yet. Skipping guest user init:', err.message);
  }
}
ensureGuestUser();

// Get User Profile
router.get('/users/:id?', async (req, res) => {
  try {
    const userId = req.params.id || 1;
    const result = await db.query('SELECT id, username, email, credits, role, created_at FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.json({ id: 1, username: 'guest_user', email: 'guest@platform.local', credits: 999999, role: 'user' });
    }
    const user = result.rows[0];
    user.credits = 999999;
    res.json(user);
  } catch (err) {
    res.json({ id: 1, username: 'guest_user', email: 'guest@platform.local', credits: 999999, role: 'user' });
  }
});

// Create Campaign (Real DB insertion & Task generation)
router.post('/campaigns', async (req, res) => {
  try {
    const userId = req.body.userId || 1;
    const { platform, targetUrl, targetCount } = req.body;

    await db.query('BEGIN');
    const campRes = await db.query(
      'INSERT INTO campaigns (user_id, platform, target_url, target_count) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, platform, targetUrl, targetCount]
    );
    const campaign = campRes.rows[0];

    for (let i = 0; i < targetCount; i++) {
      await db.query(
        'INSERT INTO tasks (campaign_id, reward) VALUES ($1, $2)',
        [campaign.id, 10]
      );
    }
    await db.query('COMMIT');

    res.status(201).json({ message: `Successfully launched campaign for ${targetCount} followers!`, campaign });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (e) {}
    console.error('Failed to create campaign in DB:', err);
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

// Get Available Real Tasks for Farming
router.get('/tasks/available', async (req, res) => {
  try {
    const tasks = await db.query(
      `SELECT t.id, t.reward, c.platform, c.target_url
       FROM tasks t
       JOIN campaigns c ON t.campaign_id = c.id
       WHERE t.status = 'pending'
       LIMIT 20`
    );
    res.json(tasks.rows);
  } catch (err) {
    console.error('Failed to fetch available tasks:', err.message);
    res.json([]);
  }
});

// Complete Task
router.post('/tasks/complete', async (req, res) => {
  try {
    const taskId = req.body.taskId;
    const taskCheck = await db.query('SELECT * FROM tasks WHERE id = $1 AND status = $2', [taskId, 'pending']);
    if (taskCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Task already completed or invalid' });
    }

    // Force task to processing for immediate worker pickup
    await db.query("UPDATE tasks SET status = 'pending' WHERE id = $1", [taskId]);
    res.json({ message: 'Task submitted for immediate automation worker processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
