const AWS = require('aws-sdk');
const s3 = new AWS.S3();

class StorageService {
  async uploadFile(file, bucketName) {
    const params = {
      Bucket: bucketName,
      Key: file.originalname,
      Body: file.buffer,
    };
    return await s3.upload(params).promise();
  }

  async downloadFile(fileKey, bucketName) {
    const params = { Bucket: bucketName, Key: fileKey };
    return await s3.getObject(params).promise();
  }

  async deleteFile(fileKey, bucketName) {
    const params = { Bucket: bucketName, Key: fileKey };
    return await s3.deleteObject(params).promise();
  }
}

module.exports = new StorageService();