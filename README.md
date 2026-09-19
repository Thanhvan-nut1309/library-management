# Mini Library Management System — Backend API

Hệ thống quản lý thư viện mini: quản lý sách, độc giả, mượn/trả sách.
Dùng làm project cho workshop thực tập AWS.

## Tech stack
- Node.js + Express
- MySQL (local khi dev, Amazon RDS khi deploy)
- JWT authentication, bcrypt hash mật khẩu

## Chạy local

1. Cài MySQL local (hoặc chạy container MySQL), tạo database bằng file `schema.sql`:
   ```bash
   mysql -u root -p < schema.sql
   ```

2. Copy `.env.example` thành `.env` và điền thông tin DB:
   ```bash
   cp .env.example .env
   ```

3. Cài dependencies và chạy:
   ```bash
   npm install
   npm run dev
   ```

4. Test nhanh API:
   ```bash
   curl http://localhost:3000/health
   ```

## Danh sách API chính

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | /api/auth/register | Public | Đăng ký độc giả |
| POST | /api/auth/login | Public | Đăng nhập, nhận JWT |
| GET | /api/books | Public | Danh sách/tìm kiếm sách (?q=) |
| GET | /api/books/:id | Public | Chi tiết sách |
| POST | /api/books | Admin | Thêm sách |
| PUT | /api/books/:id | Admin | Sửa sách |
| DELETE | /api/books/:id | Admin | Xoá sách |
| POST | /api/borrow | User | Mượn sách |
| PUT | /api/borrow/:id/return | User | Trả sách |
| GET | /api/borrow/me | User | Lịch sử mượn của tôi |
| GET | /api/borrow | Admin | Tất cả lượt mượn (lọc ?status=) |

## Build Docker image (bước containerize trong workshop)

```bash
docker build -t library-management .
docker run -p 3000:3000 --env-file .env library-management
```

## Roadmap workshop tiếp theo (AWS)

1. ✅ **Foundation** — code app chạy local (bước này)
2. **Networking** — tạo VPC, subnet public/private, security group
3. **Application services** — tạo Amazon RDS (MySQL), S3 bucket (ảnh bìa sách), Secrets Manager (DB credentials)
4. **Containerize** — build Docker image, push lên Amazon ECR
5. **Deploy** — ALB + ECS Fargate
6. **Domain & HTTPS** — Route 53 + ACM
7. **Automation** — Lambda + EventBridge quét `borrow_records`, gửi email nhắc hạn qua SES
8. **CI/CD** — CodeBuild/CodePipeline tự build & deploy khi push code
9. **Monitoring** — CloudWatch logs + alarm
10. **Testing & Cleanup**

## Ghi chú upload ảnh bìa sách (S3)
Hiện tại field `cover_image_url` trong bảng `books` chỉ lưu URL string.
Ở bước "Application services", sẽ bổ sung endpoint upload ảnh lên S3
(dùng thư viện `multer` + `@aws-sdk/client-s3`) và lưu URL trả về vào field này.
