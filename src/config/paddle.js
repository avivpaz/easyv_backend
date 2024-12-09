const { Paddle } = require('@paddle/paddle-node-sdk');

let paddleClient = null;

const getPaddleClient = () => {
  if (!paddleClient) {
    paddleClient = new Paddle({
      apiKey: process.env.PADDLE_API_KEY,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    });
  }
  return paddleClient;
};

const verifyPaddleWebhook = async (req) => {
  // Implement Paddle webhook signature verification
  // https://developer.paddle.com/webhooks/verify-webhook-signature
  return true; // Replace with actual verification
};

module.exports = {
  getPaddleClient,
  verifyPaddleWebhook
};