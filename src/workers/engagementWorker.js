const { Worker } = require('bullmq');
const { connection } = require('./queue');
const db = require('../db');
const { createStealthBrowser, performPlatformAction } = require('./automationWorker');
const { defaultProxyManager } = require('../utils/proxyManager');

function initWorker(io) {
  const worker = new Worker('engagement-tasks', async (job) => {
    const { taskId, workerId, campaignId, reward } = job.data;
    console.log(`Processing automated engagement task ${taskId}...`);

    let browserInstance = null;
    try {
      // Fetch campaign details (platform & targetUrl)
      const campaignRes = await db.query('SELECT platform, target_url FROM campaigns WHERE id = $1', [campaignId]);
      const campaign = campaignRes.rows[0] || {};
      const platform = campaign.platform || 'generic';
      const targetUrl = campaign.target_url || 'https://example.com';

      // Get proxy for rotation
      const proxy = defaultProxyManager.getNextProxy();
      const { browser, page } = await createStealthBrowser(proxy);
      browserInstance = browser;

      // Execute platform-specific automated action (Follow/Like)
      await performPlatformAction(page, platform, targetUrl);

      // Begin database transaction for completing task & rewarding worker
      await db.query('BEGIN');

      await db.query('UPDATE tasks SET status = $1, worker_id = $2 WHERE id = $3', ['completed', workerId || 1, taskId]);
      await db.query('UPDATE campaigns SET completed_count = completed_count + 1 WHERE id = $4', [campaignId]);

      const targetWorkerId = workerId || 1;
      const userRes = await db.query('UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING credits', [reward, targetWorkerId]);
      const newCredits = userRes.rows[0].credits;

      await db.query(
        'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [targetWorkerId, reward, 'earn', `Earned reward for completing automated task ${taskId} on ${platform}`]
      );

      await db.query('COMMIT');
      console.log(`Task ${taskId} successfully completed via automation worker.`);

      if (io && targetWorkerId) {
        io.to(`user_${targetWorkerId}`).emit('credit_update', { credits: newCredits, message: `Earned ${reward} credits from automated ${platform} task!` });
      }
    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Failed to process automation task ${taskId}:`, err);
      if (err.proxy) {
        defaultProxyManager.markFailed(err.proxy);
      }
      throw err;
    } finally {
      if (browserInstance) {
        await browserInstance.close();
      }
    }
  }, { connection });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error ${err.message}`);
  });

  return worker;
}

module.exports = { initWorker };
