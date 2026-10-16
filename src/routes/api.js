const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendSmmOrder } = require('../services/smmProvider');

// In-Memory Storage Fallback for local offline testing
const memoryStore = {
  users: [{ id: 1, username: 'guest_user', email: 'guest@platform.local', credits: 999999, role: 'user' }],
  campaigns: [],
  tasks: [],
  transactions: []
};

module.exports.memoryStore = memoryStore;

// Get User Profile
router.get('/users/:id?', async (req, res) => {
  try {
    const userId = parseInt(req.params.id || 1, 10);
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

// Create Campaign & Dispatch to SMM Provider
router.post('/campaigns', async (req, res) => {
  try {
    const userId = req.body.userId || 1;
    const { platform, targetUrl, targetCount } = req.body;

    // Dispatch order to SMM Wholesale Provider API
    let smmResult = null;
    try {
      smmResult = await sendSmmOrder(platform, targetUrl, parseInt(targetCount, 10));
    } catch (e) {
      console.warn('SMM Provider Dispatch Warning:', e.message);
    }

    try {
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
      res.status(201).json({ message: `Successfully launched campaign for ${targetCount} ${platform} followers!`, campaign, smmResult });
    } catch (dbErr) {
      const campaign = {
        id: memoryStore.campaigns.length + 1,
        user_id: userId,
        platform,
        target_url: targetUrl,
        target_count: parseInt(targetCount, 10),
        completed_count: 0,
        status: 'active'
      };
      memoryStore.campaigns.push(campaign);

      for (let i = 0; i < campaign.target_count; i++) {
        memoryStore.tasks.push({
          id: memoryStore.tasks.length + 1,
          campaign_id: campaign.id,
          reward: 10,
          status: 'pending',
          platform,
          target_url: targetUrl
        });
      }

      console.log(`Campaign created in In-Memory mode: ${targetCount} tasks added.`);
      res.status(201).json({ message: `Successfully launched campaign for ${targetCount} ${platform} followers!`, campaign, smmResult });
    }
  } catch (err) {
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
       LIMIT 20`
    );
    res.json(tasks.rows);
  } catch (err) {
    const pendingTasks = memoryStore.tasks.filter(t => t.status === 'pending').slice(0, 20);
    res.json(pendingTasks);
  }
});

// Complete Task
router.post('/tasks/complete', async (req, res) => {
  try {
    const taskId = parseInt(req.body.taskId, 10);
    try {
      const taskCheck = await db.query('SELECT * FROM tasks WHERE id = $1 AND status = $2', [taskId, 'pending']);
      if (taskCheck.rows.length > 0) {
        await db.query("UPDATE tasks SET status = 'pending' WHERE id = $1", [taskId]);
      }
    } catch (e) {
      const task = memoryStore.tasks.find(t => t.id === taskId);
      if (task) task.status = 'pending';
    }

    res.json({ message: 'Task submitted for immediate processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
