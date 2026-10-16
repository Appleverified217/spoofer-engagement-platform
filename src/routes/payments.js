const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Simulate Create Checkout Session (e.g. buying 500 credits for $5.00)
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { creditPackage } = req.body; // e.g. 100, 500, 1000
    const packages = {
      100: { price: 1.00, credits: 100 },
      500: { price: 4.50, credits: 500 },
      1000: { price: 8.00, credits: 1000 },
    };

    const selectedPackage = packages[creditPackage] || packages[100];

    // In a real Stripe integration, you would create a Stripe Checkout Session here.
    // For simulation, we return a mock checkout session URL.
    const checkoutSessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`;

    res.json({
      checkoutUrl: `/api/payments/webhook-simulate?session_id=${checkoutSessionId}&user_id=${req.user.id}&credits=${selectedPackage.credits}`,
      message: 'Checkout session created successfully (Simulation mode)',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate Webhook / Payment Fulfillment
router.get('/webhook-simulate', async (req, res) => {
  try {
    const { user_id, credits } = req.query;
    if (!user_id || !credits) {
      return res.status(400).send('Invalid webhook parameters');
    }

    const creditAmount = parseInt(credits, 10);
    const userId = parseInt(user_id, 10);

    await db.query('BEGIN');
    const userRes = await db.query('UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING credits, username', [creditAmount, userId]);

    await db.query(
      'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
      [userId, creditAmount, 'purchase', `Purchased ${creditAmount} credits via payment gateway`]
    );
    await db.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('credit_update', {
        credits: userRes.rows[0].credits,
        message: `Successfully purchased and added ${creditAmount} credits!`,
      });
    }

    res.send(`<h1>Payment Successful!</h1><p>Added ${creditAmount} credits to user ${userRes.rows[0].username}. You can close this tab and return to the app.</p>`);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).send(`Payment processing failed: ${err.message}`);
  }
});

module.exports = router;
