const express = require('express');
const router = express.Router();
const {
  borrowBook,
  returnBook,
  myBorrowRecords,
  getAllBorrowRecords,
} = require('../controllers/borrowController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/', authenticate, borrowBook);              // Mượn sách
router.put('/:id/return', authenticate, returnBook);      // Trả sách
router.get('/me', authenticate, myBorrowRecords);         // Lịch sử mượn của tôi
router.get('/', authenticate, requireAdmin, getAllBorrowRecords); // Admin xem tất cả

module.exports = router;
