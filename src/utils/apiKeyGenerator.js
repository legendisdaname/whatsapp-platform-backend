const crypto = require('crypto');

/**
 * Generate a secure API key
 * Format: wp_live_[32 random hex characters]
 * Example: wp_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(32);
  const hexString = randomBytes.toString('hex');
  return `wp_live_${hexString}`;
}

/**
 * Validate API key format
 */
function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Check format: wp_live_[64 hex characters]
  const regex = /^wp_live_[a-f0-9]{64}$/;
  return regex.test(apiKey);
}

module.exports = {
  generateApiKey,
  validateApiKeyFormat
};

