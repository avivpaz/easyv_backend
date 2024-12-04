// services/s3Service.js
const { S3Client, PutObjectCommand ,DeleteObjectCommand} = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const deleteFromS3 = async (fileName,bucket= process.env.AWS_BUCKET_NAME) => {
    const params = {
      Bucket: bucket,
      Key: `cvs/${fileName}`
    };
  
    try {
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  };
  const uploadToS3 = async (
    file, 
    fileName, 
    folder = '', // Make folder optional with empty default
    bucket = process.env.AWS_BUCKET_NAME
  ) => {
    const params = {
      Bucket: bucket,
      Key: folder ? `${folder}/${fileName}` : fileName, // Only add folder if it exists
      Body: file
    };
  
    try {
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
      
      // Return CloudFront URL instead of S3 URL
      const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
      const key = params.Key;
      return `https://${CLOUDFRONT_DOMAIN}/${key}`;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  };

module.exports = { uploadToS3 ,deleteFromS3};