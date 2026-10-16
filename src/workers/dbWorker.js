const db = require('../db');
const { createStealthBrowser, performPlatformAction } = require('./automationWorker');
const { defaultProxyManager } = require('../utils/proxyManager');

function startDbWorker(io) {
  console.log('Background task worker started.');

  setInterval(async () => {
    let task = null;

    try {
      if (db.isDbConnected()) {
        const taskRes = await db.query(
          `SELECT t.id, t.campaign_id, t.reward, c.platform, c.target_url
           FROM tasks t
           JOIN campaigns c ON t.campaign_id = c.id
           WHERE t.status = 'pending'
           LIMIT 1`
        );
        if (taskRes.rows.length > 0) {
          task = taskRes.rows[0];
          await db.query("UPDATE tasks SET status = 'processing' WHERE id = $1", [task.id]);
        }
      } else {
        // Fallback to In-Memory store
        const { memoryStore } = require('../routes/api');
        if (memoryStore && memoryStore.tasks) {
          task = memoryStore.tasks.find(t => t.status === 'pending');
          if (task) {
            task.status = 'processing';
          }
        }
      }

      if (!task) return;

      console.log(`Processing queue task ${task.id} for ${task.target_url}...`);

      let browserInstance = null;
      try {
        const proxy = defaultProxyManager.getNextProxy();
        const { browser, page } = await createStealthBrowser(proxy);
        browserInstance = browser;

        await performPlatformAction(page, task.platform || 'generic', task.target_url);

        if (db.isDbConnected()) {
          await db.query('BEGIN');
          await db.query("UPDATE tasks SET status = 'completed', worker_id = 1 WHERE id = $1", [task.id]);
          await db.query('UPDATE campaigns SET completed_count = completed_count + 1 WHERE id = $2', [task.campaign_id]);
          await db.query('COMMIT');
        } else {
          const { memoryStore } = require('../routes/api');
          task.status = 'completed';
          const campaign = memoryStore.campaigns.find(c => c.id === task.campaign_id);
          if (campaign) campaign.completed_count = (campaign.completed_count || 0) + 1;
        }

        console.log(`Task ${task.id} completed successfully via automation worker.`);
        if (io) {
          io.to('user_1').emit('credit_update', { message: `Completed ${task.platform} task successfully!` });
        }
      } catch (err) {
        if (db.isDbConnected()) {
          try { await db.query("UPDATE tasks SET status = 'pending' WHERE id = $1", [task.id]); } catch (e) {}
        } else {
          task.status = 'pending';
        }
        console.error(`Task ${task.id} execution failed:`, err.message);
      } finally {
        if (browserInstance) await browserInstance.close();
      }
    } catch (err) {
      // Quiet background check
    }
  }, 5000);
}

module.exports = { startDbWorker };
