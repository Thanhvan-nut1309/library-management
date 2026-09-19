-- ============================================
-- Mini Library Management System - DB Schema
-- Engine: MySQL 8.0 (dùng cho Amazon RDS)
-- ============================================

CREATE DATABASE IF NOT EXISTS library_db;
USE library_db;

-- Bảng người dùng (độc giả + admin)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng sách
CREATE TABLE IF NOT EXISTS books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    cover_image_url VARCHAR(500),
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lượt mượn/trả
CREATE TABLE IF NOT EXISTS borrow_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    user_id INT NOT NULL,
    borrow_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE DEFAULT NULL,
    status ENUM('borrowing', 'returned', 'overdue') NOT NULL DEFAULT 'borrowing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index hỗ trợ tra cứu nhanh sách sắp/quá hạn (dùng cho Lambda nhắc hạn sau này)
CREATE INDEX idx_borrow_status_due ON borrow_records (status, due_date);

-- Tài khoản admin mẫu (password: Admin@123 -> cần hash lại khi seed thật)
-- INSERT INTO users (name, email, password_hash, role) VALUES
-- ('Admin', 'admin@library.local', '<bcrypt_hash>', 'admin');
