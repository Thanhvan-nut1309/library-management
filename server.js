const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const borrowRoutes = require('./routes/borrowRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Health check - dùng cho ALB Target Group health check khi deploy ECS
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/borrow', borrowRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route không tồn tại.' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Library Management API đang chạy tại port ${PORT}`);
});
