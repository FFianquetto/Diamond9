import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 5000),
  dbMode: (process.env.DB_MODE || 'json').toLowerCase(),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/diamante9',
  roboflow: {
    apiKey: process.env.ROBOFLOW_API_KEY || '',
    model: process.env.ROBOFLOW_MODEL || 'baseball-gear',
    version: process.env.ROBOFLOW_VERSION || '1',
    baseUrl: process.env.ROBOFLOW_BASE_URL || 'https://detect.roboflow.com',
  },
};
