// services/s3Service.js
const { S3Client, PutObjectCommand ,DeleteObjectCommand} = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const deleteFromS3 = async (fileName) => {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `cvs/${fileName}`
    };
  
    try {
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  };
const uploadToS3 = async (file, fileName) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `cvs/${fileName}`,
    Body: file
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    return `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/cvs/${fileName}`;
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

module.exports = { uploadToS3 ,deleteFromS3};