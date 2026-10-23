#!/usr/bin/env bash
set -Eeuo pipefail

# One-time production cutover. It deliberately never changes authoritative DNS.
readonly NEW_DOMAIN="gala.thptnguyentraibinhduong.edu.vn"
readonly OLD_DOMAIN="sacmautuoitre.io.vn"
readonly CUTOVER_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly OLD_NGINX_SITE="/etc/nginx/sites-available/${OLD_DOMAIN}"
readonly OLD_NGINX_SITE_LINK="/etc/nginx/sites-enabled/${OLD_DOMAIN}"

# Reuse the supported deployment primitives and the new default domain.
# shellcheck source=../deploy.sh
source "${CUTOVER_SCRIPT_DIR}/deploy.sh"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/prepare-launch-domain.sh
  ./scripts/prepare-launch-domain.sh --check

This script never changes DNS. Before running it, remove only old web DNS records
for sacmautuoitre.io.vn. Keep MX, SPF, DKIM, DMARC, and mail-host records intact.
EOF
}

require_cutover_tools() {
  local command_name
  for command_name in docker nginx certbot curl openssl; do
    command -v "${command_name}" >/dev/null 2>&1 || die "Thieu lenh bat buoc: ${command_name}."
  done
  docker compose version >/dev/null 2>&1 || die 'Docker Compose chua san sang.'
}

show_dns_guidance() {
  cat <<EOF

DNS ngoai VPS (bat buoc xac nhan truoc cutover):
  - Web moi: A/AAAA ${NEW_DOMAIN} phai tro den VPS nay.
  - Web cu: go A/AAAA/CNAME phuc vu website ${OLD_DOMAIN}.
  - GIU NGUYEN MX, SPF, DKIM, DMARC va cac ban ghi host ma dich vu mail dang dung.
Script nay khong co quyen sua DNS provider.
EOF
}

preflight() {
  require_repo_files
  check_os
  require_cutover_tools
  check_dns
  check_port_conflicts
  [[ -f "${ENV_FILE}" ]] || die 'Khong tim thay .env production.'
  [[ -n "$(get_env GOOGLE_CLIENT_ID)" && -n "$(get_env GOOGLE_CLIENT_SECRET)" ]] || \
    die 'Google OAuth credentials chua co trong .env.'
  show_dns_guidance
}

confirm_irreversible_reset() {
  local confirmation
  cat <<EOF

CANH BAO: Thao tac nay xoa VINH VIEN don hang, ve, giao dich, giu cho,
check-in, audit ban ve va tat ca phien dang nhap. Khong tao backup.
Tai khoan, phan quyen, cau hinh su kien va doi tac duoc giu lai.
EOF
  read -r -p "Nhap chinh xac ${NEW_DOMAIN} de xac nhan: " confirmation
  [[ "${confirmation}" == "${NEW_DOMAIN}" ]] || die 'Xac nhan khong khop. Khong co du lieu nao bi xoa.'
}

rotate_launch_secrets() {
  local key_id
  key_id="launch-$(date -u +%Y%m%d)-v1"
  set_env PAYMENTS_ENABLED false
  set_env SESSION_SECRET "$(generate_hex 48)"
  set_env TICKET_QR_ACTIVE_KEY_ID "${key_id}"
  set_env TICKET_QR_KEYS "${key_id}:$(generate_base64url 32)"
  set_env PAY2S_WEBHOOK_TOKEN "$(generate_base64url 48)"
}

pause_sales() {
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$(get_env POSTGRES_USER)" \
    -d "$(get_env POSTGRES_DB)" -c \
    "UPDATE event_settings SET sales_status = 'paused', updated_at = NOW() WHERE singleton_key = TRUE;" >/dev/null
}

reset_transactional_data() {
  set_env ALLOW_TRANSACTION_DATA_RESET true
  if ! compose run --rm backend npm run data:reset -- --confirm-reset; then
    set_env ALLOW_TRANSACTION_DATA_RESET false
    die 'Reset du lieu that bai; ALLOW_TRANSACTION_DATA_RESET da duoc tat lai.'
  fi
  set_env ALLOW_TRANSACTION_DATA_RESET false
  compose up -d --force-recreate backend expiration-worker
}

verify_google_login() {
  cat <<EOF

Google OAuth da phai duoc khai bao trong Google Cloud Console:
  Authorized JavaScript origin: https://${NEW_DOMAIN}
  Authorized redirect URI:      https://${NEW_DOMAIN}/api/auth/google/callback

Hay mo https://${NEW_DOMAIN}, dang nhap Google thanh cong, sau do quay lai terminal.
EOF
  confirm 'Da xac minh dang nhap Google that tren domain moi?' n || \
    die 'Dung cutover: Google OAuth chua duoc xac minh.'
}

remove_old_web_site() {
  show_dns_guidance
  confirm "Da kiem tra DNS web cu da khong con phuc vu ${OLD_DOMAIN}?" n || \
    die 'Dung cutover de tranh anh huong domain cu.'
  rm -f "${OLD_NGINX_SITE_LINK}" "${OLD_NGINX_SITE}"
  nginx -t
  systemctl reload nginx
  if [[ -d "/etc/letsencrypt/live/${OLD_DOMAIN}" ]]; then
    certbot delete --non-interactive --cert-name "${OLD_DOMAIN}"
  fi
}

final_cutover_checks() {
  wait_https_health || die 'HTTPS health check domain moi that bai.'
  nginx -t
  certbot renew --dry-run
  local direct_port
  for direct_port in 1411 1511 1611; do
    ss -H -ltn "sport = :${direct_port}" | awk -v port="${direct_port}" '
      { if ($4 !~ /127\.0\.0\.1:/ && $4 !~ /\[::1\]:/) { bad=1 } }
      END { exit bad ? 1 : 0 }
    ' || die "Port ${direct_port} dang bi public truc tiep."
  done
}

main() {
  case "${1:-}" in
    --check)
      preflight
      log 'Preflight cutover hoan tat, chua thay doi he thong.'
      return
      ;;
    '') ;;
    -h|--help) usage; return ;;
    *) usage; die "Tham so khong ho tro: $1" ;;
  esac

  [[ "${EUID}" -eq 0 ]] || die 'Hay chay: sudo ./scripts/prepare-launch-domain.sh'
  preflight
  confirm_irreversible_reset

  cd "${SCRIPT_DIR}"
  set_env FRONTEND_ORIGIN "https://${NEW_DOMAIN}"
  set_env CORS_ALLOWED_ORIGINS "https://${NEW_DOMAIN}"
  set_env GOOGLE_REDIRECT_URI "https://${NEW_DOMAIN}/api/auth/google/callback"
  rotate_launch_secrets
  compose stop frontend backend expiration-worker
  compose up -d postgres
  pause_sales
  compose up -d --build
  wait_local_health || die 'Backend khong khoi dong sau khi doi cau hinh domain.'
  reset_transactional_data
  pause_sales
  write_nginx_site
  configure_https
  wait_https_health || die 'HTTPS health check domain moi that bai.'
  verify_google_login
  configure_pay2s
  pause_sales
  final_cutover_checks
  remove_old_web_site
  log "Cutover hoan tat. Ban ve van dang tam dung: https://${NEW_DOMAIN}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
