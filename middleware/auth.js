const jwt = require('jsonwebtoken');
require('dotenv').config();

// Kiểm tra người dùng đã đăng nhập (có token hợp lệ)
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Thiếu token xác thực.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    req.user = user; // { id, email, role }
    next();
  });
}

// Chỉ cho phép admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ admin mới có quyền thực hiện thao tác này.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
