require('dotenv').config(); // loads variables from .env
const { getOpenAiKeys } = require('../services/openAiKeyPool');

const config = {
  env: process.env.NODE_ENV || 'development',

  // Server
  server: {
    port: process.env.PORT || 5000,
    baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  },

  // JWT / Auth
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    tokenExpiry: '30d',
  },

  // Databases
  databases: {
    postgres: {
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT || 5432,
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'password',
      dbName: process.env.PG_DATABASE || 'studyhub',
    },
    mongo: {
      uri: process.env.MONGO_URI || 'mongodb://localhost:27017/studyhub',
    },
  },

  // External APIs / Services
  services: {
    cloudStorage: {
      provider: process.env.CLOUD_PROVIDER || 'aws',
      accessKey: process.env.CLOUD_ACCESS_KEY || '',
      secretKey: process.env.CLOUD_SECRET_KEY || '',
      bucketName: process.env.CLOUD_BUCKET || 'studyhub-files',
    },
    openAI: {
      apiKey: getOpenAiKeys()[0] || '',
      apiKeys: getOpenAiKeys(),
    },
  },

  // Miscellaneous
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;