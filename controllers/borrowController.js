const { getPool } = require('../config/db');

const BORROW_DAYS = 14; // số ngày mượn mặc định

// Mượn sách
async function borrowBook(req, res) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const { book_id } = req.body;
    const userId = req.user.id;

    await conn.beginTransaction();

    const [books] = await conn.query('SELECT * FROM books WHERE id = ? FOR UPDATE', [book_id]);
    if (books.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy sách.' });
    }

    const book = books[0];
    if (book.available_copies <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Sách hiện đã hết, không thể mượn.' });
    }

    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + BORROW_DAYS);

    const [result] = await conn.query(
      `INSERT INTO borrow_records (book_id, user_id, borrow_date, due_date, status)
       VALUES (?, ?, ?, ?, 'borrowing')`,
      [book_id, userId, borrowDate.toISOString().slice(0, 10), dueDate.toISOString().slice(0, 10)]
    );

    await conn.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book_id]);

    await conn.commit();
    res.status(201).json({
      id: result.insertId,
      book_id,
      due_date: dueDate.toISOString().slice(0, 10),
      message: 'Mượn sách thành công.',
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Lỗi khi mượn sách.', error: err.message });
  } finally {
    conn.release();
  }
}

// Trả sách
async function returnBook(req, res) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    const { id } = req.params; // borrow_record id
    await conn.beginTransaction();

    const [records] = await conn.query('SELECT * FROM borrow_records WHERE id = ? FOR UPDATE', [id]);
    if (records.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy lượt mượn.' });
    }

    const record = records[0];
    if (record.status === 'returned') {
      await conn.rollback();
      return res.status(400).json({ message: 'Sách này đã được trả trước đó.' });
    }

    await conn.query(
      `UPDATE borrow_records SET status = 'returned', return_date = ? WHERE id = ?`,
      [new Date().toISOString().slice(0, 10), id]
    );
    await conn.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [record.book_id]);

    await conn.commit();
    res.json({ message: 'Trả sách thành công.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Lỗi khi trả sách.', error: err.message });
  } finally {
    conn.release();
  }
}

// Lịch sử mượn của user hiện tại
async function myBorrowRecords(req, res) {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT br.*, b.title, b.author FROM borrow_records br
       JOIN books b ON b.id = br.book_id
       WHERE br.user_id = ? ORDER BY br.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy lịch sử mượn.', error: err.message });
  }
}

// Admin: xem tất cả sách đang mượn / quá hạn (dùng cho dashboard)
async function getAllBorrowRecords(req, res) {
  try {
    const pool = await getPool();
    const { status } = req.query;
    let sql = `SELECT br.*, b.title, u.name AS user_name, u.email FROM borrow_records br
               JOIN books b ON b.id = br.book_id
               JOIN users u ON u.id = br.user_id`;
    const params = [];
    if (status) {
      sql += ' WHERE br.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY br.due_date ASC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu mượn sách.', error: err.message });
  }
}

module.exports = { borrowBook, returnBook, myBorrowRecords, getAllBorrowRecords };
