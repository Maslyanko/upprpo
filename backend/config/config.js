require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-for-development',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  environment: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || 'https://api.offer-hunt.com/v1',
  
  // Параметры подключения к базе данных
  dbUser: process.env.DB_USER || 'postgres',
  dbHost: process.env.DB_HOST || 'localhost',
  dbName: process.env.DB_NAME || 'offer_hunt',
  dbPassword: process.env.DB_PASSWORD || 'postgres',
  dbPort: process.env.DB_PORT || 5432,
  dbSsl: process.env.DB_SSL === 'true',
};