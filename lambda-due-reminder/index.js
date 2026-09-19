const mysql = require('mysql2/promise');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL; // email đã verify trong SES
const DB_SECRET_NAME = process.env.DB_SECRET_NAME || 'library-db-credentials';

// Đọc DB credentials từ Secrets Manager (giống cách app backend làm)
async function getDbConfig() {
  const client = new SecretsManagerClient({ region: REGION });
  const response = await client.send(new GetSecretValueCommand({ SecretId: DB_SECRET_NAME }));
  const secret = JSON.parse(response.SecretString);
  return {
    host: secret.host,
    port: secret.port || 3306,
    user: secret.username,
    password: secret.password,
    database: secret.dbname || 'library_db',
  };
}

// Gửi 1 email nhắc hạn qua SES
async function sendReminderEmail(sesClient, toEmail, userName, bookTitle, dueDate, isOverdue) {
  const subject = isOverdue
    ? `[Thư viện] Sách "${bookTitle}" đã quá hạn trả`
    : `[Thư viện] Nhắc nhở: Sách "${bookTitle}" sắp đến hạn trả`;

  const bodyText = isOverdue
    ? `Chào ${userName},\n\nSách "${bookTitle}" bạn mượn đã quá hạn trả (hạn: ${dueDate}). Vui lòng mang sách đến trả sớm nhất có thể.\n\nCảm ơn bạn!`
    : `Chào ${userName},\n\nSách "${bookTitle}" bạn mượn sẽ đến hạn trả vào ngày ${dueDate}. Vui lòng sắp xếp trả sách đúng hạn.\n\nCảm ơn bạn!`;

  const command = new SendEmailCommand({
    Source: SES_FROM_EMAIL,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: bodyText, Charset: 'UTF-8' } },
    },
  });

  await sesClient.send(command);
}

// Lambda handler - được EventBridge gọi mỗi ngày theo lịch
exports.handler = async (event) => {
  const dbConfig = await getDbConfig();
  const connection = await mysql.createConnection(dbConfig);
  const sesClient = new SESClient({ region: REGION });

  let remindersSent = 0;
  let overdueMarked = 0;

  try {
    // 1. Tìm sách sắp đến hạn trong 2 ngày tới, còn đang mượn, chưa nhắc
    const [dueSoonRows] = await connection.query(
      `SELECT br.id, br.due_date, b.title, u.name, u.email
       FROM borrow_records br
       JOIN books b ON b.id = br.book_id
       JOIN users u ON u.id = br.user_id
       WHERE br.status = 'borrowing'
         AND br.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`
    );

    for (const row of dueSoonRows) {
      await sendReminderEmail(sesClient, row.email, row.name, row.title, row.due_date, false);
      remindersSent++;
    }

    // 2. Tìm sách đã quá hạn (due_date < hôm nay), còn đang mượn -> đổi status thành 'overdue' + gửi nhắc
    const [overdueRows] = await connection.query(
      `SELECT br.id, br.due_date, b.title, u.name, u.email
       FROM borrow_records br
       JOIN books b ON b.id = br.book_id
       JOIN users u ON u.id = br.user_id
       WHERE br.status = 'borrowing'
         AND br.due_date < CURDATE()`
    );

    for (const row of overdueRows) {
      await sendReminderEmail(sesClient, row.email, row.name, row.title, row.due_date, true);
      await connection.query(`UPDATE borrow_records SET status = 'overdue' WHERE id = ?`, [row.id]);
      remindersSent++;
      overdueMarked++;
    }

    console.log(`Hoàn tất: đã gửi ${remindersSent} email nhắc, đánh dấu ${overdueMarked} lượt quá hạn.`);

    return {
      statusCode: 200,
      body: JSON.stringify({ remindersSent, overdueMarked }),
    };
  } finally {
    await connection.end();
  }
};
