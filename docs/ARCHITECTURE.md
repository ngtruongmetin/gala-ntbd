# Kiến trúc Gala Ticketing

## Phạm vi

Hệ thống phục vụ đúng một sự kiện và một loại vé. Backend là nguồn dữ liệu có thẩm quyền cho cấu hình bán vé, tồn kho, đơn hàng và thanh toán. Frontend không tự tính hoặc xác nhận trạng thái nghiệp vụ.

## Thành phần

```text
Browser
  -> React/Vite (port 1411)
      -> /api qua Axios
          -> Express (port 1511)
              -> PostgreSQL 16
              -> Google OpenID Connect
              -> Pay2S VietQR và webhook
```

Trong Docker, Nginx phục vụ frontend và reverse proxy `/api` sang backend. Khi chạy local, Vite proxy `/api` sang `http://localhost:1511`.

## Ranh giới module backend

- `event-settings`: đọc cấu hình công khai; trang quản trị cập nhật cấu hình sẽ được bổ sung sau.
- `auth`: OpenID Connect với Google, quản lý session và ánh xạ `sub` vào `users`.
- `orders`: tạo/hủy đơn và quản lý reservation nguyên tử.
- `payments`: VietQR, ledger giao dịch thủ công, đối soát và refund.
- `webhooks`: xác thực Bearer token, nhận batch giao dịch Pay2S và kích hoạt payment-confirmation service.
- `tickets`: phát hành idempotent, QR AES-256-GCM, reissue, thu hồi và lịch sử vé.
- `checkin`: scanner online, request idempotency và atomic first-scan-wins.
- `account`: order/ticket portal giới hạn theo owner Google.
- `admin`: dashboard, orders, tickets, staff roles và cấu hình mở bán.

Tất cả module trên đã có route; email gửi vé tự động chưa được triển khai.

## Dữ liệu và tính đồng thời

Migration đầu tiên tạo `users`, `event_settings`, `orders`, `payment_transactions`, `tickets`, `admin_permissions` và `user_sessions`. Các ràng buộc unique đã được đặt cho Google subject, mã đơn, nội dung chuyển khoản, giao dịch nhà cung cấp, mã vé và QR token hash.

Khi đặt vé, transaction khóa dòng `event_settings` trước khi kiểm tra cửa bán. Tồn kho lấy từ `inventory_reservations`: `active`, `review_hold` và `consumed` giữ capacity; `released` không giữ. Tác vụ hết hạn chỉ release reservation của đơn pending.

Webhook ghi `payment_transactions` trong cùng transaction xác nhận đơn. Unique `(provider, provider_transaction_id)` là lớp idempotency ở database. Việc phát hành vé dựa trên số lượng của đơn đã chuyển sang `paid`, với constraint duy nhất ngăn phát hành lại.

QR có dạng `gala:t1:<kid>:<ciphertext>`. AES-256-GCM dùng header làm AAD; plaintext chỉ có ticket UUID, issuance UUID và timestamp. Database lưu ciphertext cùng SHA-256 hash. Check-in phải decrypt, đối chiếu hash rồi khóa ticket trước khi chuyển `valid` sang `checked_in`.

## Migration

`backend/scripts/migrate.js`:

- Dùng advisory lock để chỉ một tiến trình migration chạy tại một thời điểm.
- Ghi filename và SHA-256 vào `schema_migrations`.
- Từ chối chạy nếu migration đã áp dụng bị sửa nội dung.
- Chạy mỗi migration trong transaction.
- Không xóa dữ liệu và không chạy seed.

Timestamp dùng `TIMESTAMPTZ`. Việc hiển thị luôn chỉ định múi giờ `Asia/Ho_Chi_Minh` ở frontend.

## Bảo mật nền tảng

- Helmet, CORS allowlist, request size limit và rate limit được bật sẵn.
- Session lưu trong PostgreSQL, cookie `HttpOnly`, `Secure` ở production và `SameSite=Lax`.
- Logger loại bỏ cookie, authorization header, token và secret.
- Lỗi production không trả stack trace.
- Secret chỉ nhận qua biến môi trường.

Google OIDC dùng Authorization Code, PKCE, `state` và `nonce`; callback regenerate session trước khi lưu user. Các POST dùng session cookie phải gửi synchronizer CSRF token từ `/api/auth/me`. Pay2S webhook không dùng session hoặc CSRF; nó xác thực `Authorization: Bearer` bằng token riêng và phải được công khai qua HTTPS.
