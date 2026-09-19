const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Đọc username/password DB từ AWS Secrets Manager.
// Chỉ dùng khi chạy trên AWS (ECS) — SDK tự lấy quyền qua IAM Task Role, không cần access key.
async function getDbCredentialsFromSecretsManager() {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

  const command = new GetSecretValueCommand({
    SecretId: process.env.DB_SECRET_NAME || 'library-db-credentials',
  });

  const response = await client.send(command);
  const secret = JSON.parse(response.SecretString);

  // Secrets Manager (loại "Credentials for Amazon RDS database") trả về các field: username, password, host, port, dbname
  return {
    host: secret.host || process.env.DB_HOST,
    port: secret.port || process.env.DB_PORT || 3306,
    user: secret.username,
    password: secret.password,
    database: secret.dbname || process.env.DB_NAME || 'library_db',
  };
}

module.exports = { getDbCredentialsFromSecretsManager };
