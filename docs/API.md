# API

Base URL local: `http://localhost:1511/api`

Mọi response dùng JSON. Lỗi có cấu trúc:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông báo tiếng Việt"
  }
}
```

## GET /health

Kiểm tra tiến trình API và kết nối PostgreSQL.

Thành công `200`:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Database chưa sẵn sàng `503`:

```json
{
  "status": "degraded",
  "database": "unavailable"
}
```

## GET /event-settings

Trả cấu hình công khai của sự kiện duy nhất.

Thành công `200`:

```json
{
  "data": {
    "eventName": "Gala Sắc màu tuổi trẻ",
    "eventSubtitle": "Gây quỹ học bổng Cùng bạn đến trường",
    "venue": "Trường THPT Nguyễn Trãi - Bình Dương",
    "eventStartsAt": "2026-11-14T11:00:00.000Z",
    "ticketPriceVnd": 35000,
    "totalCapacity": 1000,
    "minTicketsPerOrder": 1,
    "maxTicketsPerOrder": 100,
    "salesStartAt": "2026-10-01T00:00:00.000Z",
    "salesEndAt": "2026-12-31T16:59:59.000Z",
    "reservationMinutes": 5,
    "salesStatus": "paused",
    "remainingQuantity": 1000,
    "availabilityStatus": "paused",
    "canOrder": false,
    "serverTime": "2026-10-12T08:00:00.000Z"
  }
}
```

Các con số trên chỉ minh họa response sau khi chạy seed với `.env.example`; source code không dùng chúng làm giới hạn cố định.

Chưa cấu hình `404` với code `EVENT_NOT_CONFIGURED`.

## Authentication

- `GET /auth/google`: bắt đầu Google Authorization Code flow với PKCE, state và nonce.
- `GET /auth/google/callback`: xác minh callback, upsert user theo Google `sub`, regenerate session rồi redirect về frontend.
- `GET /auth/me`: trả trạng thái đăng nhập, verified email, CSRF token và trạng thái cấu hình Google.
- `POST /auth/logout`: yêu cầu đăng nhập và header `X-CSRF-Token`, trả `204`.

## POST /orders

Yêu cầu session đăng nhập và `X-CSRF-Token`. Body chỉ chấp nhận:

```json
{
  "fullName": "NGUYỄN VĂN AN",
  "phone": "0901234567",
  "quantity": 2
}
```

Email lấy từ Google session. Giá và tổng tiền do backend tính. Khi `PAYMENTS_ENABLED=false`, thành công trả `201`, đơn chuyển ngay sang `paid`, reservation thành `consumed` và các vé được phát hành trong cùng transaction mà không tạo giao dịch thanh toán giả. Khi bật thanh toán, đơn dùng trạng thái `pending_payment` và thời hạn giữ vé như bình thường.

## GET /orders/:reference

Chỉ owner của đơn hoặc user có `admin_permissions.role = 'admin'` được đọc. Reference đúng nhưng không có quyền vẫn trả `404` để tránh dò đơn.

## GET /orders/:reference/payment-instructions

Chỉ owner của đơn `pending_payment` được lấy tài khoản nhận, số tiền, nội dung chuyển khoản, hạn giữ vé và payload VietQR. Backend tạo QR qua Pay2S; token webhook không được trả cho frontend.

## POST /webhooks/pay2s

Endpoint công khai dành riêng cho Pay2S, xác thực bằng `Authorization: Bearer <PAY2S_WEBHOOK_TOKEN>`. Body chứa `transactions[]`; giao dịch được ghi ledger và đối soát trong database transaction. Thành công trả `200` với `{ "success": true }`.

## Admin

### Đơn vị đồng hành

- `POST /api/admin/partners`: tạo đơn vị đồng hành.
- `PUT /api/admin/partners/:id`: cập nhật tên, logo, website, thứ tự và trạng thái hiển thị.
- `DELETE /api/admin/partners/:id`: xóa đơn vị đồng hành.

Các endpoint ghi yêu cầu quyền admin và header CSRF. Danh sách đang bật được trả trong trường `partners` của `GET /api/event-settings`; Trường và Đoàn trường là nhận diện cố định, không thuộc dữ liệu CRUD này.

Tất cả endpoint admin yêu cầu session Google và quyền `admin` trong database. Quyền được đồng bộ từ allowlist `ADMIN_EMAILS` của backend.

- `GET /admin/dashboard`: cấu hình sự kiện, tồn kho, thống kê đơn và danh sách admin đã cấu hình.
- `PUT /admin/event-settings`: cập nhật cấu hình sự kiện và trạng thái mở bán; yêu cầu `X-CSRF-Token`.
- `GET /admin/orders` và `GET /admin/orders/:reference`: danh sách phân trang và chi tiết đơn.
- Các action order: cancel, manual payment, resolve payment review, refund request và manual refund.
- `GET /admin/tickets` và `GET /admin/tickets/:code`: danh sách/chi tiết vé.
- Các action ticket: void, reactivate với QR mới và reissue QR.
- `GET/POST/DELETE /admin/staff`: quản lý role `admin` và `check_in`, chỉ dành cho super-admin.

Backend khóa dòng cấu hình khi cập nhật và không cho giảm `totalCapacity` xuống thấp hơn số vé đã bán hoặc đang được giữ.

## Account

- `GET /account/orders`, `GET /account/orders/:reference`.
- `POST /account/orders/:reference/cancel`: owner chỉ được hủy order `pending_payment`.
- `GET /account/tickets`, `GET /account/tickets/:code`: QR payload chỉ trả cho owner khi ticket `valid`.

## Check-in

- `POST /check-in/preview/scan`: nhận QR và trả thông tin/trạng thái vé để nhân viên xác nhận, không đổi trạng thái vé.
- `POST /check-in/preview/manual`: tra cứu mã vé dự phòng để xác nhận, không đổi trạng thái vé.
- `POST /check-in/scan`: nhận encrypted QR, `requestId` và source `camera|usb`.
- `POST /check-in/manual`: nhận ticket code cho trường hợp dự phòng.
- `POST /check-in/tickets/:ticketCode/undo`: admin hoàn tác check-in có lý do.

Kết quả scan gồm `success`, `already_checked_in`, `invalid`, `revoked`, `refunded` hoặc `unpaid`. Raw QR không được ghi log hoặc audit.

## Chính sách phân phối vé

Hệ thống không gửi vé qua email. QR chỉ được trả cho chủ sở hữu đã đăng nhập khi vé còn hợp lệ; người mua có thể mở QR hoặc xuất PDF từ frontend tại `/tai-khoan`.

## Endpoint chưa triển khai

- Email gửi vé tự động.

Các endpoint này không trả thành công giả trong giai đoạn khởi tạo.
