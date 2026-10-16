#!/usr/bin/env bash
set -Eeuo pipefail

readonly DOMAIN="sacmautuoitre.io.vn"
readonly APP_NAME="gala-ticketing"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly ENV_FILE="${SCRIPT_DIR}/.env"
readonly DEPLOY_STATE_DIR="/etc/${APP_NAME}"
readonly DEPLOY_STATE_FILE="${DEPLOY_STATE_DIR}/deploy.conf"
readonly NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
readonly NGINX_SITE_LINK="/etc/nginx/sites-enabled/${DOMAIN}"
readonly BACKUP_DIR="${SCRIPT_DIR}/backups"

CHECK_ONLY=false

log() { printf '\n\033[1;32m[%s]\033[0m %s\n' "${APP_NAME}" "$*"; }
warn() { printf '\n\033[1;33m[canh bao]\033[0m %s\n' "$*" >&2; }
die() { printf '\n\033[1;31m[loi]\033[0m %s\n' "$*" >&2; exit 1; }

on_error() {
  local exit_code=$?
  printf '\n\033[1;31m[loi]\033[0m Deploy dung tai dong %s (ma %s).\n' "${BASH_LINENO[0]}" "${exit_code}" >&2
  printf 'Khong mo ban ve. Xem log bang: docker compose logs --tail=200 backend frontend\n' >&2
  exit "${exit_code}"
}
trap on_error ERR

usage() {
  cat <<'EOF'
Usage:
  sudo ./deploy.sh          Cai dat va deploy tuong tac
  ./deploy.sh --check       Chi kiem tra dieu kien, khong thay doi he thong
EOF
}

confirm() {
  local prompt=$1
  local default=${2:-n}
  local answer
  local suffix='[y/N]'
  [[ "${default}" == 'y' ]] && suffix='[Y/n]'
  read -r -p "${prompt} ${suffix} " answer
  answer=${answer:-${default}}
  [[ "${answer,,}" == 'y' || "${answer,,}" == 'yes' ]]
}

prompt_value() {
  local prompt=$1
  local default=${2:-}
  local value
  while true; do
    if [[ -n "${default}" ]]; then
      read -r -p "${prompt} [${default}]: " value
      value=${value:-${default}}
    else
      read -r -p "${prompt}: " value
    fi
    [[ -n "${value}" ]] && { printf '%s' "${value}"; return; }
    warn 'Gia tri nay khong duoc de trong.'
  done
}

prompt_secret() {
  local prompt=$1
  local value
  while true; do
    read -r -s -p "${prompt}: " value
    printf '\n' >&2
    [[ -n "${value}" ]] && { printf '%s' "${value}"; return; }
    warn 'Gia tri nay khong duoc de trong.'
  done
}

require_repo_files() {
  local file
  for file in docker-compose.yml package.json frontend/Dockerfile backend/Dockerfile .env.production.example; do
    [[ -f "${SCRIPT_DIR}/${file}" ]] || die "Thieu ${file}. Hay chay script trong repository da clone."
  done
}

check_os() {
  [[ -r /etc/os-release ]] || die 'Khong doc duoc /etc/os-release.'
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID:-}" == 'ubuntu' ]] || die "Chi ho tro Ubuntu 22.04/24.04 (dang la ${ID:-unknown})."
  case "${VERSION_ID:-}" in
    22.04|24.04) ;;
    *) die "Ubuntu ${VERSION_ID:-unknown} chua duoc ho tro." ;;
  esac
}

public_ipv4() {
  command -v curl >/dev/null 2>&1 || return 0
  curl -4fsS --max-time 8 https://api.ipify.org 2>/dev/null || true
}

dns_ipv4() {
  getent ahostsv4 "${DOMAIN}" 2>/dev/null | awk '{print $1}' | sort -u
}

check_dns() {
  local public_ip dns_ips
  public_ip=$(public_ipv4)
  dns_ips=$(dns_ipv4 || true)
  [[ -n "${dns_ips}" ]] || die "DNS A cua ${DOMAIN} chua phan giai duoc."
  printf 'DNS %s -> %s\n' "${DOMAIN}" "$(tr '\n' ' ' <<<"${dns_ips}")"
  if [[ -n "${public_ip}" ]] && ! grep -qxF "${public_ip}" <<<"${dns_ips}"; then
    die "DNS chua tro toi IPv4 cong khai cua VPS (${public_ip})."
  fi
}

check_port_conflicts() {
  command -v ss >/dev/null 2>&1 || return 0
  local port listeners
  for port in 80 443 1411 1511; do
    listeners=$(ss -H -ltnp "sport = :${port}" 2>/dev/null || true)
    [[ -n "${listeners}" ]] || continue
    if [[ "${port}" == 80 || "${port}" == 443 ]]; then
      grep -q 'nginx' <<<"${listeners}" || die "Port ${port} dang bi tien trinh khac chiem: ${listeners}"
    else
      grep -Eq 'docker-proxy|com\.docker' <<<"${listeners}" || die "Port ${port} dang bi tien trinh khac chiem: ${listeners}"
    fi
  done
}

show_port_status() {
  command -v ss >/dev/null 2>&1 || { warn 'Khong co lenh ss de kiem tra port.'; return; }
  local port
  for port in 80 443 1411 1511; do
    if ss -H -ltn "sport = :${port}" | grep -q .; then
      printf 'Port %-4s: dang duoc su dung\n' "${port}"
    else
      printf 'Port %-4s: trong\n' "${port}"
    fi
  done
}

check_mode() {
  log 'Kiem tra dieu kien deploy (khong thay doi he thong)'
  require_repo_files
  check_os
  check_dns
  check_port_conflicts
  show_port_status
  local command_name
  for command_name in docker nginx certbot ufw openssl curl; do
    if command -v "${command_name}" >/dev/null 2>&1; then
      printf '%-10s: OK\n' "${command_name}"
    else
      printf '%-10s: chua cai (deploy se tu cai)\n' "${command_name}"
    fi
  done
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    printf 'compose   : OK\n'
  else
    printf 'compose   : chua cai (deploy se tu cai)\n'
  fi
  log 'Preflight hoan tat.'
}

install_system_packages() {
  log 'Cai dat Nginx, Certbot, UFW va cong cu he thong'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl gnupg openssl nginx certbot python3-certbot-nginx ufw

  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    log 'Cai Docker Engine tu repository chinh thuc'
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    # shellcheck disable=SC1091
    source /etc/os-release
    printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
      "${VERSION_CODENAME}" "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.sources
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  systemctl enable --now docker nginx
  docker compose version >/dev/null
}

detect_ssh_ports() {
  local ports=''
  if [[ -n "${SSH_CONNECTION:-}" ]]; then
    ports=$(awk '{print $4}' <<<"${SSH_CONNECTION}")
  fi
  if command -v sshd >/dev/null 2>&1; then
    ports=$(printf '%s\n%s\n' "${ports}" "$(sshd -T 2>/dev/null | awk '$1 == "port" {print $2}')")
  fi
  printf '%s\n' "${ports}" | awk '/^[0-9]+$/ && !seen[$0]++'
}

configure_firewall() {
  log 'Cau hinh UFW'
  local ports port
  ports=$(detect_ssh_ports)
  [[ -n "${ports}" ]] || die 'Khong phat hien duoc cong SSH; dung lai de tranh khoa VPS.'
  while IFS= read -r port; do
    ufw allow "${port}/tcp" comment 'SSH'
  done <<<"${ports}"
  ufw allow 'Nginx Full'
  ufw --force enable
  ufw status verbose
}

generate_hex() { openssl rand -hex "$1"; }
generate_base64url() { openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '=\n'; }

get_env() {
  local key=$1
  [[ -f "${ENV_FILE}" ]] || return 0
  sed -n "s/^${key}=//p" "${ENV_FILE}" | tail -n 1
}

validate_env_value() {
  local value=$1
  [[ "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] || die 'Gia tri env khong duoc chua ky tu xuong dong.'
  [[ "${value}" != *'$'* ]] || die 'Gia tri env khong duoc chua ky tu $ vi Docker Compose se noi suy ky tu nay.'
}

set_env() {
  local key=$1 value=$2 line found=false temp
  validate_env_value "${value}"
  temp=$(mktemp)
  if [[ -f "${ENV_FILE}" ]]; then
    while IFS= read -r line || [[ -n "${line}" ]]; do
      if [[ "${line}" == "${key}="* ]]; then
        printf '%s=%s\n' "${key}" "${value}" >>"${temp}"
        found=true
      else
        printf '%s\n' "${line}" >>"${temp}"
      fi
    done <"${ENV_FILE}"
  fi
  [[ "${found}" == true ]] || printf '%s=%s\n' "${key}" "${value}" >>"${temp}"
  install -m 600 "${temp}" "${ENV_FILE}"
  rm -f "${temp}"
}

initialize_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    local backup
    backup="${ENV_FILE}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
    cp --preserve=mode "${ENV_FILE}" "${backup}"
    chmod 600 "${ENV_FILE}" "${backup}"
    log "Da backup .env hien tai tai ${backup}"
  else
    install -m 600 /dev/null "${ENV_FILE}"
  fi

  local admin_emails email valid_emails
  local -a email_items=()
  admin_emails=$(get_env ADMIN_EMAILS)
  if [[ -z "${admin_emails}" || "${admin_emails}" == 'admin@example.com' ]]; then
    while true; do
      admin_emails=$(prompt_value 'Email quan tri Google (nhieu email cach nhau boi dau phay)')
      valid_emails=true
      IFS=',' read -ra email_items <<<"${admin_emails}"
      for email in "${email_items[@]}"; do
        [[ "${email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || valid_emails=false
      done
      [[ "${valid_emails}" == true ]] && break
      warn 'Danh sach email quan tri khong hop le.'
    done
  fi

  set_env NODE_ENV production
  set_env FRONTEND_ORIGIN "https://${DOMAIN}"
  set_env CORS_ALLOWED_ORIGINS "https://${DOMAIN}"
  [[ -n "$(get_env POSTGRES_DB)" ]] || set_env POSTGRES_DB gala_ticketing
  [[ -n "$(get_env POSTGRES_USER)" ]] || set_env POSTGRES_USER gala_app
  [[ -n "$(get_env POSTGRES_PASSWORD)" && "$(get_env POSTGRES_PASSWORD)" != replace-* ]] || set_env POSTGRES_PASSWORD "$(generate_hex 24)"
  [[ -n "$(get_env POSTGRES_PORT)" ]] || set_env POSTGRES_PORT 1611
  set_env DATABASE_SSL false
  [[ -n "$(get_env SESSION_SECRET)" && "$(get_env SESSION_SECRET)" != replace-* ]] || set_env SESSION_SECRET "$(generate_hex 48)"
  [[ -n "$(get_env SESSION_COOKIE_NAME)" ]] || set_env SESSION_COOKIE_NAME gala.sid
  set_env SESSION_COOKIE_SECURE true
  set_env GOOGLE_REDIRECT_URI "https://${DOMAIN}/api/auth/google/callback"
  set_env ADMIN_EMAILS "${admin_emails}"
  [[ -n "$(get_env PAYMENTS_ENABLED)" ]] || set_env PAYMENTS_ENABLED false
  [[ -n "$(get_env PAY2S_VIETQR_URL)" ]] || set_env PAY2S_VIETQR_URL https://api.pay2s.vn/vietqr/generate
  [[ -n "$(get_env TICKET_QR_ACTIVE_KEY_ID)" ]] || set_env TICKET_QR_ACTIVE_KEY_ID "prod-$(date -u +%Y)-v1"
  if [[ -z "$(get_env TICKET_QR_KEYS)" || "$(get_env TICKET_QR_KEYS)" == *replace-* ]]; then
    set_env TICKET_QR_KEYS "$(get_env TICKET_QR_ACTIVE_KEY_ID):$(generate_base64url 32)"
  fi
  set_env VITE_API_BASE_URL /api

  local db_user db_password db_name
  db_user=$(get_env POSTGRES_USER)
  db_password=$(get_env POSTGRES_PASSWORD)
  db_name=$(get_env POSTGRES_DB)
  set_env DATABASE_URL "postgresql://${db_user}:${db_password}@postgres:5432/${db_name}"
}

compose() { docker compose --project-directory "${SCRIPT_DIR}" -f "${SCRIPT_DIR}/docker-compose.yml" "$@"; }

backup_database_if_running() {
  [[ -n "$(compose ps -q postgres 2>/dev/null || true)" ]] || return 0
  compose exec -T postgres pg_isready -U "$(get_env POSTGRES_USER)" -d "$(get_env POSTGRES_DB)" >/dev/null 2>&1 || return 0
  mkdir -p "${BACKUP_DIR}"
  chmod 700 "${BACKUP_DIR}"
  local backup
  backup="${BACKUP_DIR}/postgres-$(date -u +%Y%m%dT%H%M%SZ).dump"
  log "Backup database vao ${backup}"
  compose exec -T postgres pg_dump -U "$(get_env POSTGRES_USER)" -d "$(get_env POSTGRES_DB)" -Fc >"${backup}"
  chmod 600 "${backup}"
}

wait_local_health() {
  local attempt payload
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    payload=$(curl -fsS http://127.0.0.1:1411/api/health 2>/dev/null || true)
    if grep -q '"status":"ok"' <<<"${payload}" && grep -q '"database":"connected"' <<<"${payload}"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

event_count() {
  compose exec -T postgres psql -U "$(get_env POSTGRES_USER)" -d "$(get_env POSTGRES_DB)" -tAc \
    "SELECT CASE WHEN to_regclass('public.event_settings') IS NULL THEN 0 ELSE (SELECT COUNT(*) FROM event_settings) END" | tr -d '[:space:]'
}

prompt_positive_integer() {
  local label=$1 default=$2 value
  while true; do
    value=$(prompt_value "${label}" "${default}")
    [[ "${value}" =~ ^[1-9][0-9]*$ ]] && { printf '%s' "${value}"; return; }
    warn 'Can nhap so nguyen duong.'
  done
}

prompt_datetime() {
  local label=$1 default=$2 value
  while true; do
    value=$(prompt_value "${label} (RFC3339, co mui gio)" "${default}")
    if [[ "${value}" =~ T.*(Z|[+-][0-9]{2}:[0-9]{2})$ ]] && date -d "${value}" >/dev/null 2>&1; then
      printf '%s' "${value}"
      return
    fi
    warn 'Vi du hop le: 2026-11-14T18:00:00+07:00'
  done
}

seed_event_if_empty() {
  [[ "$(event_count)" == '0' ]] || { log 'Database da co cau hinh su kien; bo qua seed.'; return; }
  log 'Database chua co su kien. Nhap cau hinh ban dau (ban ve se tam dung).'
  set_env SEED_EVENT_NAME "$(prompt_value 'Ten su kien' 'GALA Sac mau tuoi tre')"
  set_env SEED_EVENT_SUBTITLE "$(prompt_value 'Muc dich su kien' 'Gay quy hoc bong Cung ban den truong')"
  set_env SEED_EVENT_VENUE "$(prompt_value 'Dia diem' 'Truong THPT Nguyen Trai - Binh Duong')"
  set_env SEED_EVENT_STARTS_AT "$(prompt_datetime 'Thoi gian dien ra' '2026-11-14T18:00:00+07:00')"
  set_env SEED_TICKET_PRICE_VND "$(prompt_positive_integer 'Gia ve VND' 35000)"
  local total_capacity min_per_order max_per_order
  total_capacity=$(prompt_positive_integer 'Tong so ve' 3500)
  min_per_order=$(prompt_positive_integer 'So ve toi thieu moi don' 1)
  while true; do
    max_per_order=$(prompt_positive_integer 'So ve toi da moi don' 100)
    if (( min_per_order <= max_per_order && max_per_order <= total_capacity )); then
      break
    fi
    warn 'So ve toi da phai >= toi thieu va <= tong so ve.'
  done
  set_env SEED_TOTAL_CAPACITY "${total_capacity}"
  set_env SEED_MIN_TICKETS_PER_ORDER "${min_per_order}"
  set_env SEED_MAX_TICKETS_PER_ORDER "${max_per_order}"
  set_env SEED_SALES_START_AT "$(prompt_datetime 'Bat dau ban' '2026-10-01T00:00:00+07:00')"
  set_env SEED_SALES_END_AT "$(prompt_datetime 'Ket thuc ban' '2026-11-14T17:30:00+07:00')"
  set_env SEED_RESERVATION_MINUTES "$(prompt_positive_integer 'So phut giu cho' 5)"
  compose up -d --force-recreate backend
  compose exec -T backend npm run seed:development
}

pause_sales_without_payments() {
  [[ "$(get_env PAYMENTS_ENABLED)" == 'true' ]] && return 0
  log 'Thanh toan chua bat: dam bao ban ve dang tam dung'
  compose exec -T postgres psql -U "$(get_env POSTGRES_USER)" -d "$(get_env POSTGRES_DB)" -v ON_ERROR_STOP=1 -c \
    "UPDATE event_settings SET sales_status = 'paused', updated_at = NOW() WHERE singleton_key = TRUE AND sales_status <> 'paused';" >/dev/null
}

write_nginx_site() {
  log 'Cau hinh reverse proxy Nginx'
  if [[ -f "${NGINX_SITE}" ]]; then
    cp "${NGINX_SITE}" "${NGINX_SITE}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  cat >"${NGINX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 3m;

    location /api/ {
        proxy_pass http://127.0.0.1:1511;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:1411;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }
}
EOF
  ln -sfn "${NGINX_SITE}" "${NGINX_SITE_LINK}"
  nginx -t
  systemctl reload nginx
}

get_letsencrypt_email() {
  local email=''
  if [[ -f "${DEPLOY_STATE_FILE}" ]]; then
    email=$(sed -n 's/^LETSENCRYPT_EMAIL=//p' "${DEPLOY_STATE_FILE}" | tail -n 1)
  fi
  [[ -n "${email}" ]] || email=$(prompt_value "Email nhan thong bao Let's Encrypt")
  mkdir -p "${DEPLOY_STATE_DIR}"
  chmod 700 "${DEPLOY_STATE_DIR}"
  printf 'LETSENCRYPT_EMAIL=%s\n' "${email}" >"${DEPLOY_STATE_FILE}"
  chmod 600 "${DEPLOY_STATE_FILE}"
  printf '%s' "${email}"
}

configure_https() {
  local email first_issue=false
  email=$(get_letsencrypt_email)
  [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]] || first_issue=true
  log 'Cap dat chung chi HTTPS bang Certbot'
  certbot --nginx --non-interactive --agree-tos --redirect --keep-until-expiring \
    --email "${email}" -d "${DOMAIN}"
  systemctl enable --now certbot.timer
  if [[ "${first_issue}" == true ]]; then
    log 'Kiem tra tu dong gia han chung chi'
    certbot renew --dry-run
  fi
}

wait_https_health() {
  local attempt payload
  for ((attempt = 1; attempt <= 30; attempt += 1)); do
    payload=$(curl -fsS --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health" 2>/dev/null || true)
    if grep -q '"status":"ok"' <<<"${payload}" && grep -q '"database":"connected"' <<<"${payload}"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

configure_google() {
  local auth_payload client_id client_secret
  auth_payload=$(curl -fsS --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/auth/me" || true)
  if grep -q '"googleAuthAvailable":true' <<<"${auth_payload}"; then
    log 'Google OAuth da duoc cau hinh; giu nguyen credentials hien tai.'
    return
  fi

  cat <<EOF

Google Cloud Console can khai bao:
  Authorized JavaScript origin: https://${DOMAIN}
  Authorized redirect URI:      https://${DOMAIN}/api/auth/google/callback
EOF
  confirm 'Ban da them chinh xac hai URL tren trong Google Cloud Console?' y || die 'Can hoan tat Google Console truoc khi tiep tuc.'
  client_id=$(prompt_value 'Google Client ID')
  client_secret=$(prompt_secret 'Google Client Secret')
  set_env GOOGLE_CLIENT_ID "${client_id}"
  set_env GOOGLE_CLIENT_SECRET "${client_secret}"
  set_env GOOGLE_REDIRECT_URI "https://${DOMAIN}/api/auth/google/callback"
  compose up -d --force-recreate backend
  wait_https_health || die 'HTTPS health check that bai sau khi cau hinh Google.'
  auth_payload=$(curl -fsS --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/auth/me")
  grep -q '"googleAuthAvailable":true' <<<"${auth_payload}" || die 'Backend chua nhan cau hinh Google OAuth.'
}

configure_pay2s() {
  if [[ "$(get_env PAYMENTS_ENABLED)" == 'true' ]]; then
    log 'Pay2S da bat; giu nguyen cau hinh hien tai.'
    return
  fi

  cat <<EOF

Webhook Pay2S cong khai:
  https://${DOMAIN}/api/webhooks/pay2s

Chi bat thanh toan khi ban co du thong tin ngan hang va token Bearer dung voi Pay2S.
EOF
  if ! confirm 'Cau hinh Pay2S ngay bay gio?' n; then
    set_env PAYMENTS_ENABLED false
    pause_sales_without_payments
    warn 'Da bo qua Pay2S. Website hoat dong nhung ban ve van tam dung.'
    return
  fi

  local bank_code account_number account_name webhook_token
  bank_code=$(prompt_value 'Ma ngan hang' 'MB')
  account_number=$(prompt_value 'So tai khoan nhan tien')
  account_name=$(prompt_value 'Ten chu tai khoan')
  read -r -s -p 'Pay2S webhook token (Enter de tu sinh): ' webhook_token
  printf '\n'
  webhook_token=${webhook_token:-$(generate_base64url 48)}

  set_env PAYMENT_BANK_CODE "${bank_code}"
  set_env PAYMENT_ACCOUNT_NUMBER "${account_number}"
  set_env PAYMENT_ACCOUNT_NAME "${account_name}"
  set_env PAY2S_WEBHOOK_TOKEN "${webhook_token}"
  set_env PAYMENTS_ENABLED true

  if ! compose up -d --force-recreate backend || ! wait_local_health; then
    set_env PAYMENTS_ENABLED false
    compose up -d --force-recreate backend || true
    wait_local_health || true
    pause_sales_without_payments
    die 'Backend khong khoi dong voi cau hinh Pay2S; da tat lai thanh toan.'
  fi
  wait_https_health || die 'HTTPS health check that bai sau khi bat Pay2S.'

  local status
  status=$(curl -sS -o /dev/null -w '%{http_code}' --resolve "${DOMAIN}:443:127.0.0.1" \
    -X POST -H 'Content-Type: application/json' -d '{"transactions":[]}' \
    "https://${DOMAIN}/api/webhooks/pay2s")
  [[ "${status}" == '403' ]] || die "Webhook khong token phai tra 403, nhung nhan ${status}."

  cat <<EOF

PAY2S DA BAT. Hay cau hinh phia Pay2S:
  URL:   https://${DOMAIN}/api/webhooks/pay2s
  Auth:  Authorization: Bearer ${webhook_token}

Token chi hien thi lan nay. No da duoc luu trong .env quyen 600.
Ban ve van KHONG tu dong mo. Hay thu mot giao dich that truoc.
EOF
}

final_checks() {
  log 'Kiem tra cuoi'
  wait_https_health || die 'HTTPS health check cuoi khong thanh cong.'
  nginx -t
  compose ps
  local direct_port
  for direct_port in 1411 1511 1611; do
    ss -H -ltn "sport = :${direct_port}" | awk -v port="${direct_port}" '
      { if ($4 !~ /127\.0\.0\.1:/ && $4 !~ /\[::1\]:/) { print "Port " port " dang bind ngoai loopback: " $4; bad=1 } }
      END { exit bad ? 1 : 0 }
    ' || die "Port ${direct_port} dang bi public truc tiep."
  done
  log "Deploy hoan tat: https://${DOMAIN}"
  printf '%s\n' \
    'Ban ve khong duoc tu dong mo.' \
    'Sau khi test Google va mot giao dich Pay2S that, vao /admin/cau-hinh de mo ban.' \
    "Backup nam tai: ${BACKUP_DIR}"
}

main() {
  case "${1:-}" in
    --check) CHECK_ONLY=true ;;
    -h|--help) usage; exit 0 ;;
    '') ;;
    *) usage; die "Tham so khong ho tro: ${1}" ;;
  esac

  cd "${SCRIPT_DIR}"
  if [[ "${CHECK_ONLY}" == true ]]; then
    check_mode
    exit 0
  fi

  [[ "${EUID}" -eq 0 ]] || die 'Hay chay: sudo ./deploy.sh'
  require_repo_files
  check_os
  check_port_conflicts
  install_system_packages
  check_dns
  check_port_conflicts
  show_port_status
  configure_firewall
  initialize_env
  backup_database_if_running

  log 'Build va khoi dong Docker Compose'
  compose config --quiet
  compose up -d --build
  if ! wait_local_health; then
    compose logs --tail=100 backend frontend >&2 || true
    die 'Health check noi bo khong thanh cong sau 120 giay.'
  fi
  seed_event_if_empty
  pause_sales_without_payments
  write_nginx_site
  configure_https
  wait_https_health || die 'HTTPS health check khong thanh cong.'
  configure_google
  configure_pay2s
  final_checks
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
