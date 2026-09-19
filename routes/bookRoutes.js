const express = require('express');
const router = express.Router();
const { getBooks, getBookById, createBook, updateBook, deleteBook } = require('../controllers/bookController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public: ai cũng xem được danh sách/tìm kiếm sách
router.get('/', getBooks);
router.get('/:id', getBookById);

// Admin only: thêm/sửa/xoá sách
router.post('/', authenticate, requireAdmin, createBook);
router.put('/:id', authenticate, requireAdmin, updateBook);
router.delete('/:id', authenticate, requireAdmin, deleteBook);

module.exports = router;
