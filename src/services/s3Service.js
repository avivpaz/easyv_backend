const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const deleteFromS3 = async (path, bucket = process.env.AWS_BUCKET_NAME) => {
  const params = {
    Bucket: bucket,
    Key: path
  };

  try {
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

// Helper function to determine if a file should be forced to download
const shouldForceDownload = (filename) => {
  const downloadExtensions = [
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', 'exe', 'msi'
  ];
  const ext = filename.toLowerCase().split('.').pop();
  return downloadExtensions.includes(ext);
};

// Helper function to get content type based on file extension
const getContentType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'csv': 'text/csv'
  };
  return contentTypes[ext] || 'application/octet-stream';
};

const uploadToS3 = async (
  file,
  fileName,
  folder = '',
  bucket = process.env.AWS_BUCKET_NAME,
  cloudfront = ''
) => {
  const params = {
    Bucket: bucket,
    Key: folder ? `${folder}/${fileName}` : fileName,
    Body: file,
    ContentType: getContentType(fileName),
    ContentDisposition: shouldForceDownload(fileName) 
      ? `attachment; filename="${fileName}"` 
      : 'inline'
  };

  
  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    
    // If CloudFront domain exists, return CloudFront URL
    if (cloudfront || process.env.CLOUDFRONT_DOMAIN) {
      const cloudfrontDomain = cloudfront || process.env.CLOUDFRONT_DOMAIN;
      return `${cloudfrontDomain}/${params.Key}`;
    }
    
    // Otherwise return S3 URL
    return `${bucket}.s3.amazonaws.com/${params.Key}`;
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

module.exports = { uploadToS3, deleteFromS3 };