// requestLogger.js
const { Logtail } = require("@logtail/node");
const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);

const requestLogger = async (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    await logtail.info("API Request", {
      path: req.path,
      method: req.method,
      duration,
      status: res.statusCode,
      userAgent: req.headers['user-agent']
    });
    
    await logtail.flush();
  });
  
  next();
};

module.exports = requestLogger;