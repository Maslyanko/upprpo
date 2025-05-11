const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  user: config.dbUser,
  host: config.dbHost,
  database: config.dbName,
  password: config.dbPassword,
  port: config.dbPort,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : false
});

// Проверка соединения с базой данных
pool.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Connection error', err.stack));

// Вспомогательная функция для выполнения запросов
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool
};