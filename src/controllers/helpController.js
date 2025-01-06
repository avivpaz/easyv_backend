
// controllers/helpController.js
const nodemailer = require('nodemailer');

async function submitHelp(req, res, next) {
  try {
    const { category, title, description, email, priority } = req.body;
    
    // Get uploaded files from multer
    const screenshots = req.files || [];

    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Prepare email attachments
    const attachments = screenshots.map((file, index) => ({
      filename: file.originalname || `screenshot-${index + 1}.png`,
      content: file.buffer
    }));

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: 'info@rightcruiter.com',
      subject: `New Help Request: ${title}`,
      html: `
        <h2>New Help Request</h2>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Description:</strong> ${description}</p>
        ${priority ? `<p><strong>Priority:</strong> ${priority}</p>` : ''}
        ${email ? `<p><strong>User Email:</strong> ${email}</p>` : ''}
        <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
      `,
      attachments
    });

    res.status(200).json({
      success: true,
      message: 'Help request sent successfully'
    });

  } catch (error) {
    console.error('Submit help error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send help request',
      error: error.message
    });
  }
}

module.exports = {
  submitHelp
};