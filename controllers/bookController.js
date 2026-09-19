const { getPool } = require('../config/db');

// Lấy danh sách sách, hỗ trợ tìm kiếm theo tên/tác giả/thể loại (?q=)
async function getBooks(req, res) {
  try {
    const pool = await getPool();
    const { q } = req.query;
    let sql = 'SELECT * FROM books';
    const params = [];

    if (q) {
      sql += ' WHERE title LIKE ? OR author LIKE ? OR category LIKE ?';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách sách.', error: err.message });
  }
}

async function getBookById(req, res) {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy sách.', error: err.message });
  }
}

// Admin: thêm sách mới
async function createBook(req, res) {
  try {
    const pool = await getPool();
    const { title, author, category, cover_image_url, total_copies } = req.body;
    if (!title || !author || !total_copies) {
      return res.status(400).json({ message: 'Vui lòng nhập title, author, total_copies.' });
    }

    const [result] = await pool.query(
      `INSERT INTO books (title, author, category, cover_image_url, total_copies, available_copies)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, author, category || null, cover_image_url || null, total_copies, total_copies]
    );

    res.status(201).json({ id: result.insertId, title, author, category, total_copies, available_copies: total_copies });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi thêm sách.', error: err.message });
  }
}

// Admin: cập nhật thông tin sách
async function updateBook(req, res) {
  try {
    const pool = await getPool();
    const { title, author, category, cover_image_url, total_copies } = req.body;
    const [existingRows] = await pool.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách.' });

    const existing = existingRows[0];
    // Giữ nguyên số lượng đang mượn khi điều chỉnh total_copies
    const borrowedCount = existing.total_copies - existing.available_copies;
    const newTotal = total_copies ?? existing.total_copies;
    const newAvailable = Math.max(newTotal - borrowedCount, 0);

    await pool.query(
      `UPDATE books SET title = ?, author = ?, category = ?, cover_image_url = ?, total_copies = ?, available_copies = ?
       WHERE id = ?`,
      [
        title ?? existing.title,
        author ?? existing.author,
        category ?? existing.category,
        cover_image_url ?? existing.cover_image_url,
        newTotal,
        newAvailable,
        req.params.id,
      ]
    );

    res.json({ message: 'Cập nhật sách thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi cập nhật sách.', error: err.message });
  }
}

// Admin: xoá sách
async function deleteBook(req, res) {
  try {
    const pool = await getPool();
    const [result] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sách.' });
    res.json({ message: 'Đã xoá sách.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi xoá sách.', error: err.message });
  }
}

module.exports = { getBooks, getBookById, createBook, updateBook, deleteBook };
