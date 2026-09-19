require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'library-db.cb826ysqej0o.ap-southeast-2.rds.amazonaws.com',
        user: process.env.DB_USER || 'admin',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'library_db'
    });

    const [result] = await connection.execute(
        "UPDATE users SET role = 'admin' WHERE email = 'admin@library.com'"
    );
    console.log('Đã cập nhật thành công, số dòng bị ảnh hưởng:', result.affectedRows);
    await connection.end();
}

updateAdmin().catch(console.error);