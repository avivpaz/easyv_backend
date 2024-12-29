// src/middleware/errorHandler.js
const { Logtail } = require("@logtail/node");
const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);
const axios = require('axios');

const errorHandler = async (err, req, res, next) => {
  // Log different types of errors differently
  if (axios.isAxiosError(err)) {
    // Handle Axios errors
    await logtail.error("API Request Failed", {
      error: err.message,
      status: err.response?.status,
      url: err.config?.url,
      method: err.config?.method,
      response: err.response?.data,
      path: req.path,
      requestBody: req.body
    });
  } else {
    // Handle all other errors
    await logtail.error("Server Error", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      userId: req.user?.id // if you have user authentication
    });
  }

  await logtail.flush();

  // Send appropriate response
  const statusCode = err.response?.status || err.statusCode || 500;
  const message = err.response?.data?.message || err.message || 'Internal Server Error';

  res.status(statusCode).json({ 
    error: message,
    path: req.path,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;