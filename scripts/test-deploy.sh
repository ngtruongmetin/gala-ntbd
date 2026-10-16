#!/usr/bin/env bash
# shellcheck disable=SC2329
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_DIR

new_fixture() {
  local fixture
  fixture=$(mktemp -d)
  cp "${REPO_DIR}/deploy.sh" "${fixture}/deploy.sh"
  printf '%s' "${fixture}"
}

test_env_idempotency() {
  local fixture
  fixture=$(new_fixture)
  (
    trap 'rm -rf "${fixture}"' EXIT
    cd "${fixture}"
    # shellcheck source=/dev/null
    source ./deploy.sh
    printf '%s\n' 'ADMIN_EMAILS=owner@sacmautuoitre.io.vn' >.env
    chmod 600 .env
    initialize_env >/dev/null
    local first_db first_session first_qr
    first_db=$(get_env POSTGRES_PASSWORD)
    first_session=$(get_env SESSION_SECRET)
    first_qr=$(get_env TICKET_QR_KEYS)
    initialize_env >/dev/null
    [[ "${first_db}" == "$(get_env POSTGRES_PASSWORD)" ]]
    [[ "${first_session}" == "$(get_env SESSION_SECRET)" ]]
    [[ "${first_qr}" == "$(get_env TICKET_QR_KEYS)" ]]
    if [[ "${OSTYPE}" != msys* && "${OSTYPE}" != cygwin* ]]; then
      [[ "$(stat -c %a .env)" == '600' ]]
    fi
  )
}

test_pay2s_skip() {
  local fixture
  fixture=$(new_fixture)
  (
    trap 'rm -rf "${fixture}"' EXIT
    cd "${fixture}"
    # shellcheck source=/dev/null
    source ./deploy.sh
    printf '%s\n' 'PAYMENTS_ENABLED=false' >.env
    confirm() { return 1; }
    pause_sales_without_payments() { :; }
    configure_pay2s >/dev/null 2>&1
    [[ "$(get_env PAYMENTS_ENABLED)" == 'false' ]]
  )
}

test_pay2s_enable() {
  local fixture
  fixture=$(new_fixture)
  (
    trap 'rm -rf "${fixture}"' EXIT
    cd "${fixture}"
    # shellcheck source=/dev/null
    source ./deploy.sh
    printf '%s\n' 'PAYMENTS_ENABLED=false' >.env
    confirm() { return 0; }
    compose() { return 0; }
    wait_local_health() { return 0; }
    wait_https_health() { return 0; }
    curl() { printf '403'; }
    configure_pay2s >/dev/null 2>&1 <<'EOF'

123456789
NGUYEN VAN A
test-token
EOF
    [[ "$(get_env PAYMENTS_ENABLED)" == 'true' ]]
    [[ "$(get_env PAYMENT_BANK_CODE)" == 'MB' ]]
    [[ "$(get_env PAYMENT_ACCOUNT_NUMBER)" == '123456789' ]]
    [[ "$(get_env PAYMENT_ACCOUNT_NAME)" == 'NGUYEN VAN A' ]]
    [[ "$(get_env PAY2S_WEBHOOK_TOKEN)" == 'test-token' ]]
  )
}

test_env_idempotency
printf 'ok - env initialization is idempotent\n'
test_pay2s_skip
printf 'ok - Pay2S can be skipped safely\n'
test_pay2s_enable
printf 'ok - Pay2S enables only with complete input\n'
