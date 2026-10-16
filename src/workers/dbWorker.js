const db = require('../db');
const { createStealthBrowser, performPlatformAction } = require('./automationWorker');
const { defaultProxyManager } = require('../utils/proxyManager');

function startDbWorker(io) {
  console.log('Database-backed background task worker started.');

  setInterval(async () => {
    try {
      // Fetch one pending task
      const taskRes = await db.query(
        `SELECT t.id, t.campaign_id, t.reward, c.platform, c.target_url
         FROM tasks t
         JOIN campaigns c ON t.campaign_id = c.id
         WHERE t.status = 'pending'
         LIMIT 1`
      );

      if (taskRes.rows.length === 0) return;

      const task = taskRes.rows[0];
      console.log(`Processing DB queue task ${task.id} for ${task.target_url}...`);

      // Mark task as processing to prevent duplicate pickup
      await db.query("UPDATE tasks SET status = 'processing' WHERE id = $1", [task.id]);

      let browserInstance = null;
      try {
        const proxy = defaultProxyManager.getNextProxy();
        const { browser, page } = await createStealthBrowser(proxy);
        browserInstance = browser;

        await performPlatformAction(page, task.platform, task.target_url);

        await db.query('BEGIN');
        await db.query("UPDATE tasks SET status = 'completed', worker_id = 1 WHERE id = $1", [task.id]);
        await db.query('UPDATE campaigns SET completed_count = completed_count + 1 WHERE id = $2', [task.campaign_id]);

        const userRes = await db.query('UPDATE users SET credits = credits + $1 WHERE id = 1 RETURNING credits', [task.reward]);
        const newCredits = userRes.rows.length > 0 ? userRes.rows[0].credits : 1000;

        await db.query(
          'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
          [1, task.reward, 'earn', `Earned reward for automated task ${task.id}`]
        );
        await db.query('COMMIT');

        console.log(`Task ${task.id} completed successfully.`);
        if (io) {
          io.to('user_1').emit('credit_update', { credits: newCredits, message: `Completed ${task.platform} task successfully!` });
        }
      } catch (err) {
        try { await db.query('ROLLBACK'); } catch (e) {}
        await db.query("UPDATE tasks SET status = 'pending' WHERE id = $1", [task.id]);
        console.error(`Task ${task.id} execution failed:`, err.message);
      } finally {
        if (browserInstance) await browserInstance.close();
      }
    } catch (err) {
      // DB connection waiting state
    }
  }, 5000);
}

module.exports = { startDbWorker };
