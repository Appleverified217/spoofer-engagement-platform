const express = require('express');
const router = express.Router();
const db = require('../db');
const { engagementQueue } = require('../workers/queue');

// Ensure a default guest user exists on startup
async function ensureGuestUser() {
  try {
    const res = await db.query('SELECT id FROM users WHERE id = 1');
    if (res.rows.length === 0) {
      await db.query(
        'INSERT INTO users (id, username, email, password_hash, credits, role) VALUES (1, $1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        ['guest_user', 'guest@platform.local', 'nopassword', 1000, 'user']
      );
    }
  } catch (err) {
    console.error('Error ensuring guest user:', err.message);
  }
}
ensureGuestUser();

// Get User Profile (Default to user 1 if not specified)
router.get('/users/:id?', async (req, res) => {
  try {
    const userId = req.params.id || 1;
    const result = await db.query('SELECT id, username, email, credits, role, created_at FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      // Return guest user 1
      const guestRes = await db.query('SELECT id, username, email, credits, role, created_at FROM users WHERE id = 1');
      if (guestRes.rows.length > 0) return res.json(guestRes.rows[0]);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Campaign
router.post('/campaigns', async (req, res) => {
  try {
    const userId = req.body.userId || 1;
    const { platform, targetUrl, targetCount } = req.body;
    const cost = targetCount * 10; // 10 credits per follower/engagement

    // Check user balance
    const userRes = await db.query('SELECT credits FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (userRes.rows[0].credits < cost) return res.status(400).json({ error: 'Insufficient credits' });

    await db.query('BEGIN');
    // Deduct credits
    await db.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [cost, userId]);

    // Create campaign
    const campRes = await db.query(
      'INSERT INTO campaigns (user_id, platform, target_url, target_count) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, platform, targetUrl, targetCount]
    );
    const campaign = campRes.rows[0];

    // Generate initial tasks for the campaign
    for (let i = 0; i < targetCount; i++) {
      const taskRes = await db.query(
        'INSERT INTO tasks (campaign_id, reward) VALUES ($1, $2) RETURNING id',
        [campaign.id, 10]
      );
      // Add to Redis queue
      await engagementQueue.add('process-engagement', {
        taskId: taskRes.rows[0].id,
        campaignId: campaign.id,
        reward: 10,
      }, { delay: i * 1000 });
    }

    await db.query('COMMIT');
    res.status(201).json({ message: 'Campaign created successfully', campaign });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Get Available Tasks for Farming
router.get('/tasks/available', async (req, res) => {
  try {
    const tasks = await db.query(
      `SELECT t.id, t.reward, c.platform, c.target_url
       FROM tasks t
       JOIN campaigns c ON t.campaign_id = c.id
       WHERE t.status = 'pending'
       LIMIT 10`
    );
    res.json(tasks.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete Task
router.post('/tasks/complete', async (req, res) => {
  try {
    const taskId = req.body.taskId;
    const workerId = req.body.workerId || 1;

    const taskCheck = await db.query('SELECT * FROM tasks WHERE id = $1 AND status = $2', [taskId, 'pending']);
    if (taskCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Task already completed or invalid' });
    }

    const task = taskCheck.rows[0];

    await engagementQueue.add('process-engagement', {
      taskId: task.id,
      workerId,
      campaignId: task.campaign_id,
      reward: task.reward,
    });

    res.json({ message: 'Task submitted for verification and processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
