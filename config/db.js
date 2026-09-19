const mysql = require('mysql2/promise');
require('dotenv').config();
const { getDbCredentialsFromSecretsManager } = require('./secrets');

// USE_SECRETS_MANAGER=true khi chạy trên ECS (production), không set (hoặc false) khi chạy local với docker-compose/.env
const useSecretsManager = process.env.USE_SECRETS_MANAGER === 'true';

let poolPromise = null;

// Khởi tạo pool: đọc trực tiếp từ .env khi local, đọc từ Secrets Manager khi production
async function initPool() {
  let dbConfig;

  if (useSecretsManager) {
    console.log('Đang lấy DB credentials từ AWS Secrets Manager...');
    dbConfig = await getDbCredentialsFromSecretsManager();
  } else {
    dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'library_db',
    };
  }

  return mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

// Lazy init: pool chỉ được tạo 1 lần, các lần gọi sau dùng lại cùng 1 pool
function getPool() {
  if (!poolPromise) {
    poolPromise = initPool();
  }
  return poolPromise;
}

module.exports = { getPool };
