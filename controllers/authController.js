const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
require('dotenv').config();

// Đăng ký tài khoản độc giả mới
async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đủ name, email, password.' });
    }

    const pool = await getPool();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'user']
    );

    res.status(201).json({ id: result.insertId, name, email, role: 'user' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi đăng ký.', error: err.message });
  }
}

// Đăng nhập, trả về JWT
async function login(req, res) {
  try {
    const { email, password } = req.body;
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi đăng nhập.', error: err.message });
  }
}

module.exports = { register, login };
