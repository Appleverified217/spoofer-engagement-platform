const axios = require('axios');

/**
 * Dispatch follower order to SMM Wholesale Provider API
 * @param {string} platform - e.g. 'tiktok', 'instagram', 'youtube', 'twitter'
 * @param {string} targetUrl - Target profile / post URL
 * @param {number} quantity - Target follower count
 */
async function sendSmmOrder(platform, targetUrl, quantity) {
  const SMM_API_URL = process.env.SMM_API_URL || 'https://justanotherpanel.com/api/v2';
  const SMM_API_KEY = process.env.SMM_API_KEY;

  // Map platform to service ID (examples for standard provider APIs)
  const serviceIds = {
    tiktok: process.env.SMM_SERVICE_TIKTOK || '3421',
    instagram: process.env.SMM_SERVICE_INSTAGRAM || '1204',
    youtube: process.env.SMM_SERVICE_YOUTUBE || '2210',
    twitter: process.env.SMM_SERVICE_TWITTER || '1501',
  };

  const serviceId = serviceIds[platform.toLowerCase()] || serviceIds.tiktok;

  if (!SMM_API_KEY) {
    console.log(`[SMM Simulation] Order logged for ${platform}: ${quantity} followers to ${targetUrl}`);
    return { status: 'simulated', orderId: `mock_${Date.now()}` };
  }

  try {
    const response = await axios.post(SMM_API_URL, new URLSearchParams({
      key: SMM_API_KEY,
      action: 'add',
      service: serviceId,
      link: targetUrl,
      quantity: quantity.toString(),
    }));

    console.log(`[SMM Live Order] Successfully sent to provider:`, response.data);
    return response.data;
  } catch (err) {
    console.error(`[SMM Provider Error]:`, err.response ? err.response.data : err.message);
    throw new Error('Failed to dispatch order to SMM provider');
  }
}

module.exports = { sendSmmOrder };
