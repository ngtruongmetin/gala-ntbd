# Gala Ticketing

> Vé điện tử không được gửi qua email. Email Google đã xác minh chỉ dùng để đăng nhập và xác định chủ sở hữu; người mua mở QR, in vé hoặc xuất PDF trực tiếp tại `/tai-khoan`.

> Trong giai đoạn chưa tích hợp thanh toán, đặt `PAYMENTS_ENABLED=false` để đơn được xác nhận và phát hành vé ngay. Hệ thống không tạo giao dịch thanh toán giả; khi Pay2S sẵn sàng, đổi thành `true` để quay lại luồng giữ vé chờ thanh toán.

Bộ khung hệ thống bán vé riêng cho **Gala Sắc màu tuổi trẻ**. Repository là npm workspace gồm React frontend, Express API và PostgreSQL 16.

Website chính thức: [sacmautuoitre.io.vn](https://sacmautuoitre.io.vn). Email liên hệ: [contact@sacmautuoitre.io.vn](mailto:contact@sacmautuoitre.io.vn).

## Đã có

- React 19, TypeScript, Vite 7, Tailwind CSS 3 và React Router 7.
- Axios instance dùng base URL từ môi trường và TanStack Query cho cấu hình sự kiện.
- Express 5 CommonJS, health check có kiểm tra PostgreSQL và public event settings API.
- PostgreSQL session store, Helmet, CORS allowlist, rate limiting và structured logging có redact.
- Migration SQL nền tảng, migration tracking theo checksum và development seed gọi thủ công.
- Docker Compose với PostgreSQL healthcheck, backend chờ database, Nginx phục vụ frontend và proxy API.
- Oxlint, Prettier, TypeScript, Node test runner và build scripts.
- Google OpenID Connect với PKCE, state, nonce, session regeneration, CSRF và logout.
- Đặt vé nguyên tử, khóa tồn kho PostgreSQL, tự loại reservation hết hạn và xem đơn theo owner/admin.
- Trang `/admin` để cấu hình sự kiện, giá, tồn kho, giới hạn đơn, thời gian bán và mở hoặc tạm dừng bán.
- Admin app có dashboard doanh thu, quản lý đơn, ghi nhận chuyển khoản, đối soát, refund, quản lý vé và nhân sự.
- Portal `/tai-khoan` cho người mua xem đơn, hủy đơn pending và mở QR từng vé đã phát hành.
- QR vé được mã hóa xác thực AES-256-GCM, lưu hash để reissue/thu hồi và check-in nguyên tử chống dùng lại.
- Trang `/check-in` hỗ trợ camera sau, máy quét USB và mã vé thủ công theo role.

## Chưa triển khai

QR chuyển khoản MB Bank và webhook Pay2S tự động. Hiện admin chỉ xác nhận giao dịch ngân hàng có thật bằng mã giao dịch, số tiền và thời điểm; không có thanh toán thành công giả.

## Yêu cầu

- Node.js 22+
- npm 10+
- Docker Desktop hoặc PostgreSQL 16 local

## Cấu hình

PowerShell:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Đặt chuỗi vừa tạo vào `SESSION_SECRET` và thay `POSTGRES_PASSWORD` trong `.env`. Không commit `.env`.

Tạo OAuth Client loại Web application trong Google Cloud Console, sau đó cấu hình:

```dotenv
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:1511/api/auth/google/callback
ADMIN_EMAILS=ngtruongmetin@gmail.com,another-admin@example.com
TICKET_QR_ACTIVE_KEY_ID=local-v1
TICKET_QR_KEYS=local-v1:<base64url-encoded-32-byte-key>
```

Production dùng authorized JavaScript origin `https://sacmautuoitre.io.vn` và redirect URI `https://sacmautuoitre.io.vn/api/auth/google/callback`. Khi chạy local, đổi hai giá trị này về origin và callback localhost tương ứng. Khi ba biến Google còn trống, API báo chưa cấu hình và frontend không giả vờ đăng nhập thành công.

Local HTTP phải dùng `SESSION_COOKIE_SECURE=false`. Khi triển khai sau HTTPS, đặt giá trị này thành `true`.

`ADMIN_EMAILS` là allowlist các email Google đã xác minh, phân cách bằng dấu phẩy. Quyền được đồng bộ vào `admin_permissions` ở backend khi user đăng nhập hoặc gọi `/api/auth/me`; đăng nhập Google đơn thuần không tự cấp quyền admin.

`ADMIN_EMAILS` bootstrap role `super_admin`. Super-admin quản lý thêm role `admin` và `check_in` tại `/admin/nhan-su`. `TICKET_QR_ACTIVE_KEY_ID` chỉ là mã định danh, không phải secret. Khi xoay QR key, thêm key mới vào `TICKET_QR_KEYS`, đổi active ID và giữ key cũ trong key ring khi vẫn còn vé đã phát hành bằng key đó.

`.env.example` là mẫu chạy local qua Vite proxy. `.env.production.example` là mẫu triển khai HTTPS tại `sacmautuoitre.io.vn`; file này không chứa secret thật và không dùng `VITE_DEV_API_PROXY_TARGET`.

## Chạy local

Cài dependency và chỉ chạy PostgreSQL bằng Docker:

```powershell
npm install
docker compose up -d postgres
npm run migrate
npm run seed:development
npm run dev
```

- Frontend: http://localhost:1411
- Backend health: http://localhost:1511/api/health
- PostgreSQL: `127.0.0.1:1611`

Seed luôn để `sales_status` là `paused`. Mở bán phải được thực hiện qua luồng quản trị ở giai đoạn nghiệp vụ, không sửa trực tiếp frontend.
Tên chương trình, mục đích gây quỹ, địa điểm và giờ tổ chức được cấu hình bằng nhóm `SEED_EVENT_*` rồi lưu vào PostgreSQL khi chạy seed.

## Chạy toàn bộ bằng Docker Compose

Sau khi có `.env` hợp lệ:

```powershell
docker compose up --build
```

Compose tự chạy migration nhưng không chạy seed. Để nạp cấu hình development một cách chủ động:

```powershell
docker compose exec backend npm run seed:development
```

Các biến `SEED_*` được đọc từ `.env` nhưng chỉ được sử dụng khi lệnh seed được gọi rõ ràng.

Dừng container mà không xóa dữ liệu:

```powershell
docker compose down
```

Không dùng `docker compose down -v` nếu muốn giữ dữ liệu.

## Triển khai Ubuntu

Với VPS Ubuntu 22.04/24.04 và domain đã trỏ về máy chủ, chạy script tương tác:

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

Script cài Docker, Nginx, Certbot và UFW; dựng HTTPS; sau đó mới yêu cầu Google OAuth
và tùy chọn Pay2S. Xem quy trình, điều kiện DNS, backup và khôi phục tại
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Scripts

```powershell
npm run lint
npm run format
npm run format:check
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
npm run migrate
npm run seed:development
npm run orders:expire --workspace backend
```

`test:integration` cần `TEST_DATABASE_URL`; suite tạo schema tạm, chạy kiểm thử concurrency thật rồi tự xóa schema.

## Migration mới

Thêm file SQL có thứ tự vào `backend/src/database/migrations`, ví dụ `002_add_order_reservations.sql`, rồi chạy:

```powershell
npm run migrate
```

Không sửa migration đã chạy. Script sẽ phát hiện checksum thay đổi và dừng.

## Cấu trúc

```text
frontend/   React application và Nginx production config
backend/    Express API, module nghiệp vụ, SQL migration, scripts và tests
docs/       Kiến trúc và hợp đồng API
```

Chi tiết nằm trong [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) và [docs/API.md](docs/API.md).

## Tài sản giao diện

Ảnh hero hiện tại là placeholder lấy từ [Unsplash](https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b). Thay ảnh này bằng tài sản chính thức của Gala trước khi phát hành production; không có logo hoặc nội dung nhà tài trợ giả trong repository.

Đặt logo PNG nền trong suốt tại:

```text
frontend/public/images/logotruong.png
frontend/public/images/logodoan.png
```

`logotruong.png` được dùng cho header, favicon và Apple touch icon. `logodoan.png` xuất hiện trong lockup hai đơn vị phối hợp. Giao diện dùng biểu tượng fallback cho tới khi hai file thật được thêm vào.
