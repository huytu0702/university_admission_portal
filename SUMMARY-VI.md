# Tóm tắt Hệ thống Cổng Tuyển Sinh Đại Học (Mốc Milestone 1)

## Tổng Quan

Cổng Tuyển Sinh Đại Học là một hệ thống toàn diện được thiết kế nhằm minh họa các **mẫu thiết kế kiến trúc (architectural design patterns)** và **thực hành tốt nhất** trong việc xây dựng các ứng dụng web **mở rộng, ổn định và đáng tin cậy**.
**Milestone 1** triển khai **phiên bản đồng bộ cơ bản (baseline synchronous version)** với các chức năng cốt lõi: xác thực người dùng, nộp hồ sơ, xử lý thanh toán, và gửi email thông báo.

---

## Tính Năng Chính (Milestone 1 - Triển khai cơ bản)

### Chức năng cho thí sinh

* **Xác thực người dùng**: Đăng ký và đăng nhập an toàn bằng JWT tokens
* **Quản lý hồ sơ dự tuyển**: Quy trình nhiều bước cho phép nộp hồ sơ và tải tệp đính kèm
* **Xử lý tài liệu**: Kiểm tra và xác thực tệp PDF/JPEG/PNG (đồng bộ)
* **Xử lý thanh toán**: Dịch vụ thanh toán mô phỏng với luồng checkout (đồng bộ)
* **Gửi email thông báo**: Email xác nhận tự động (đồng bộ)
* **Theo dõi trạng thái**: Hiển thị tiến độ xử lý hồ sơ theo từng giai đoạn
* **Giao diện đáp ứng (Responsive UI)**: Giao diện web hiện đại sử dụng Tailwind CSS và shadcn/ui

---

## Yêu Cầu Chức Năng (Milestone 1)

### Dành cho Thí sinh

* Đăng ký và xác thực tài khoản an toàn
* Nộp hồ sơ theo quy trình nhiều bước
* Tải lên các tài liệu bắt buộc (PDF/JPEG/PNG) kèm xác thực
* Gửi hồ sơ với xử lý đồng bộ
* Theo dõi trạng thái hồ sơ: `created`, `submitted`, `verified`, `paid`, `completed`
* Nhận email thông báo khi trạng thái thay đổi
* Theo dõi tiến độ xử lý thông qua thanh hiển thị phần trăm

### Các API Chính (Milestone 1)

* `POST /auth/register` – Đăng ký người dùng
* `POST /auth/login` – Đăng nhập
* `POST /auth/refresh` – Làm mới token
* `POST /applications` – Gửi hồ sơ (xử lý đồng bộ)
* `GET /applications/:id` – Lấy thông tin trạng thái hồ sơ
* `POST /payments/checkout` – Khởi tạo quá trình thanh toán (mô phỏng)
* `POST /webhooks/payment` – Xử lý xác nhận thanh toán (mô phỏng)
* `POST /upload` – API tải tệp lên máy chủ

---

## Yêu Cầu Phi Chức Năng (Milestone 1)

### Hiệu Năng

* Xử lý đồng bộ → độ trễ cao hơn khi có tải lớn
* Thời gian phản hồi tăng đáng kể trong điều kiện tải cao
* Thu thập dữ liệu hiệu năng cơ bản để so sánh ở các giai đoạn sau

### Độ Tin Cậy

* Xử lý đồng bộ → nếu một bước thất bại, toàn bộ yêu cầu thất bại
* Chưa có cơ chế retry (thử lại)
* Xử lý lỗi trong cùng luồng yêu cầu

### Bảo Mật

* Xác thực dựa trên JWT (access + refresh tokens)
* Phân quyền (RBAC) – chỉ có vai trò thí sinh
* Kiểm tra tệp tải lên (loại MIME, kích thước)
* Kiểm tra và lọc dữ liệu đầu vào
* Cấu hình CORS an toàn
* Mã hóa mật khẩu bằng Argon2/bcrypt

### Khả Năng Quan Sát (Observability)

* Ghi log yêu cầu bằng middleware
* Theo dõi lỗi cơ bản
* Thu thập chỉ số độ trễ
* Theo dõi thời gian phản hồi của API
* Endpoint kiểm tra tình trạng hệ thống (health check)

---

## Các Design Pattern Được Áp Dụng (Milestone 1)

### Triển khai hiện tại (Đồng bộ)

* **Synchronous Processing**: Tất cả thao tác (tải lên, xác thực, thanh toán, gửi email) được xử lý trong cùng một luồng yêu cầu
* **Kiến trúc Monolithic**: Toàn bộ chức năng nằm trong một service duy nhất
* **Truy cập cơ sở dữ liệu trực tiếp**: Thực thi đồng bộ với PostgreSQL thông qua Prisma ORM
* **Xác thực JWT**: Dựa trên token để kiểm soát truy cập
* **Xác thực biểu mẫu (Form Validation)**: Thực hiện kiểm tra đầu vào ở tầng API
* **Kiểm tra tệp tải lên**: Xác thực loại và kích thước tệp ở cả phía client và server

---

## Công Nghệ Sử Dụng (Milestone 1)

### Frontend

* **Next.js 15** – Framework React với App Router
* **TypeScript** – Ngôn ngữ JavaScript có kiểu tĩnh
* **Tailwind CSS** – Framework CSS dạng tiện ích
* **shadcn/ui** – Thư viện component tái sử dụng

### Backend

* **NestJS** – Framework Node.js hướng module và mở rộng
* **TypeScript** – Ngôn ngữ phát triển phía server
* **JWT** – Xác thực và phân quyền người dùng

### Cơ Sở Dữ Liệu & Lưu Trữ

* **PostgreSQL** – CSDL quan hệ để lưu trữ dữ liệu
* **Prisma ORM** – Công cụ ORM có kiểm tra kiểu dữ liệu an toàn

### Hạ Tầng

* **Docker** – Nền tảng container hóa
* **Docker Compose** – Dàn xếp multi-container

### Kiểm Thử & Tài Liệu

* **Jest** – Kiểm thử đơn vị và tích hợp
* **Swagger/OpenAPI** – Sinh tài liệu API tự động

---

## Hiệu Năng Cơ Bản (Milestone 1)

* Độ trễ API khi nộp hồ sơ: p95 > 3–10 giây trong điều kiện tải cao
* Thông lượng (throughput): Giới hạn do xử lý đồng bộ
* Tỷ lệ lỗi: Tăng cao khi có tải lớn
* Mức sử dụng tài nguyên: Tăng mạnh khi xử lý đồng bộ gây nghẽn

---
