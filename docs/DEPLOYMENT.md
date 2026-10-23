# Triển khai production trên Ubuntu

Script `deploy.sh` triển khai Gala Ticketing trên Ubuntu 22.04/24.04. Nginx và Certbot chạy
trên host; frontend, backend và PostgreSQL chạy trong Docker. Các cổng ứng dụng chỉ bind vào
loopback, chỉ cổng 80/443 của Nginx được public.

## Chuẩn bị

1. Tạo VPS Ubuntu và mở TCP 80/443 trong firewall của nhà cung cấp cloud.
2. Trỏ bản ghi A của `gala.thptnguyentraibinhduong.edu.vn` tới IPv4 công khai của VPS.
3. Clone repository lên VPS. Không copy `.env` development lên production.
4. Chuẩn bị email quản trị, email Let's Encrypt và quyền truy cập Google Cloud Console.

Kiểm tra không thay đổi hệ thống:

```bash
chmod +x deploy.sh
./deploy.sh --check
```

Triển khai:

```bash
sudo ./deploy.sh
```

Script sẽ hỏi cấu hình sự kiện nếu database trống. Sự kiện luôn được seed ở trạng thái tạm
dừng bán. Secrets PostgreSQL, session và QR vé được tự sinh; `.env` được đặt quyền `600`.

## Cutover launch một lần

Khi chuyển từ `sacmautuoitre.io.vn`, giữ toàn bộ bản ghi email cũ (MX, SPF, DKIM, DMARC và
mail-host records), chỉ gỡ bản ghi web cũ. Thêm origin và redirect URI của domain mới trong
Google Cloud Console trước khi chạy:

```bash
chmod +x scripts/prepare-launch-domain.sh
sudo ./scripts/prepare-launch-domain.sh --check
sudo ./scripts/prepare-launch-domain.sh
```

Script yêu cầu nhập chính xác domain mới trước khi xóa vĩnh viễn dữ liệu bán vé. Nó giữ lại tài
khoản, phân quyền, cấu hình sự kiện và đối tác; xóa đơn, vé, giao dịch, giữ chỗ, check-in, audit
bán vé và session. Sau khi domain mới, HTTPS và đăng nhập Google đã được xác nhận, script mới gỡ
Nginx/chứng chỉ website cũ. Bán vé vẫn ở trạng thái tạm dừng.

## Google OAuth

Sau khi HTTPS hoạt động, script dừng để bạn khai báo trong Google Cloud Console:

```text
Authorized JavaScript origin: https://gala.thptnguyentraibinhduong.edu.vn
Authorized redirect URI:      https://gala.thptnguyentraibinhduong.edu.vn/api/auth/google/callback
```

Google Client ID và Client Secret là bắt buộc. Script chỉ kết thúc khi API xác nhận Google
OAuth khả dụng.

## Pay2S

Pay2S được hỏi ở bước cuối vì webhook cần website HTTPS công khai:

```text
POST https://gala.thptnguyentraibinhduong.edu.vn/api/webhooks/pay2s
Authorization: Bearer <PAY2S_WEBHOOK_TOKEN>
```

Nếu bỏ qua, `PAYMENTS_ENABLED=false` và script giữ bán vé tạm dừng. Nếu cấu hình, script chỉ
bật thanh toán khi đủ token cùng thông tin tài khoản ngân hàng và backend khởi động thành công.
Script không tự mở bán và không tạo giao dịch giả. Hãy thực hiện một chuyển khoản thật giá trị
nhỏ, xác nhận đơn chuyển sang `paid` và vé được phát hành, rồi mới mở bán trong admin.

## Deploy lại

Chạy lại cùng lệnh trong repo:

```bash
sudo ./deploy.sh
```

Script backup `.env`, giữ nguyên secrets và bỏ qua seed nếu đã có sự kiện. Nếu PostgreSQL đang
chạy, script tạo backup trước migration tại `backups/postgres-<timestamp>.dump`.

## Backup và khôi phục

Tạo backup thủ công:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U gala_app -d gala_ticketing -Fc \
  > "backups/postgres-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Khôi phục vào database trống hoặc database đã được xác nhận có thể ghi đè:

```bash
docker compose stop backend
docker compose exec -T postgres pg_restore \
  -U gala_app -d gala_ticketing --clean --if-exists < backups/postgres-TIMESTAMP.dump
docker compose start backend
```

Luôn backup hiện trạng trước khi restore. Không dùng `docker compose down -v` vì lệnh này xóa
volume PostgreSQL.

## Kiểm tra vận hành

```bash
curl -fsS https://gala.thptnguyentraibinhduong.edu.vn/api/health
docker compose ps
docker compose logs --tail=200 backend frontend
sudo nginx -t
sudo certbot certificates
sudo systemctl status certbot.timer
sudo ufw status verbose
```

Health hợp lệ trả về:

```json
{ "status": "ok", "database": "connected" }
```

Các cổng 1411, 1511 và 1611 không được mở trong firewall cloud và chỉ được bind vào
`127.0.0.1` trên VPS.

## Xử lý lỗi Certbot dry-run

Nếu script báo `certbot renew --dry-run` thất bại sau khi chứng chỉ thật đã được cấp, deploy
vẫn tiếp tục và HTTPS health check vẫn được thực hiện. Kiểm tra chứng chỉ cùng timer:

```bash
sudo certbot certificates
sudo systemctl status certbot.timer
sudo journalctl -u certbot --since today
sudo certbot renew --dry-run
```

Dry-run dùng máy chủ staging của Let's Encrypt và đôi khi có thể lỗi tạm thời dù chứng chỉ thật
đã hoạt động. Không bỏ qua cảnh báo này lâu dài; phải bảo đảm dry-run thành công trước thời điểm
gia hạn chứng chỉ.
