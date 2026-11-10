#!/usr/bin/env bash
# Smoke test keamanan HabitRiver: memeriksa kontrol dari threat model terhadap
# aplikasi yang SUDAH berjalan (Nginx -> Express -> MongoDB).
#
# Pemakaian:
#   BASE_URL=http://127.0.0.1:8080 \
#   ADMIN_USERNAME=admin ADMIN_PASSWORD=xxxx \
#   bash scripts/security-smoke.sh
#
# Catatan: login dan register memakai satu rate limiter (10 request / 15 menit / IP).
# Skrip ini sengaja memakai <= 8 request auth sebelum uji rate limit, yang dijalankan
# paling akhir karena sengaja menghabiskan jatah tersebut.
# Setelah menjalankannya di VM sungguhan: docker compose restart backend

set -u

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

command -v jq >/dev/null      || { echo "jq tidak ditemukan"; exit 2; }
command -v curl >/dev/null    || { echo "curl tidak ditemukan"; exit 2; }
command -v openssl >/dev/null || { echo "openssl tidak ditemukan"; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0; FAIL=0; WARN=0
STATUS=""; BODY=""

ok()   { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; }
warn() { WARN=$((WARN + 1)); printf "  \033[33mWARN\033[0m  %s\n" "$1"; [ -n "${GITHUB_ACTIONS:-}" ] && echo "::warning::$1"; return 0; }
section() { printf '\n== %s\n' "$1"; }

# req METHOD PATH [TOKEN] [JSON_BODY]  -> mengisi STATUS dan BODY
req() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$method" -D "$TMP/headers" "$BASE_URL$path")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ]  && args+=(-H 'Content-Type: application/json' --data-binary "$data")
  STATUS="$(curl "${args[@]}" 2>/dev/null)" || STATUS="000"
  BODY="$(cat "$TMP/body" 2>/dev/null)"
}

header_of() { grep -i "^$1:" "$TMP/headers" | head -1 | tr -d '\r'; }

# expect "deskripsi" "status1 status2 ..."   (STATUS harus salah satunya)
expect() {
  local desc="$1" allowed="$2" s
  for s in $allowed; do
    [ "$STATUS" = "$s" ] && { ok "$desc (HTTP $STATUS)"; return; }
  done
  bad "$desc: dapat HTTP $STATUS, diharapkan: $allowed"
}

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

forge_none_token() {
  local h p
  h="$(printf '%s' '{"alg":"none","typ":"JWT"}' | b64url)"
  p="$(printf '%s' '{"id":"000000000000000000000000","role":"admin"}' | b64url)"
  printf '%s.%s.' "$h" "$p"
}

forge_hs256_token() {
  local h p sig
  h="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)"
  p="$(printf '%s' '{"id":"000000000000000000000000","role":"admin"}' | b64url)"
  sig="$(printf '%s' "$h.$p" | openssl dgst -sha256 -hmac 'secret-tebakan-penyerang' -binary | b64url)"
  printf '%s.%s.%s' "$h" "$p" "$sig"
}

echo "Target: $BASE_URL"

# ---------------------------------------------------------------- Dasar
section "Ketersediaan"
req GET /api/health
expect "GET /api/health" "200"
[ "$(printf '%s' "$BODY" | jq -r '.status' 2>/dev/null)" = "ok" ] \
  && ok "health mengembalikan status ok" || bad "body health tidak berisi status=ok"

# ------------------------------------------------- T-11: header & hardening
section "T-11  Header keamanan dan hardening Nginx"
req GET /
expect "GET / (frontend)" "200"
for h in x-content-type-options x-frame-options referrer-policy; do
  [ -n "$(header_of "$h")" ] && ok "Nginx mengirim header $h" || bad "Nginx tidak mengirim header $h"
done
if header_of server | grep -qE '[0-9]+\.[0-9]+'; then
  bad "Header Server membocorkan versi: $(header_of server)"
else
  ok "Header Server tidak membocorkan versi (server_tokens off)"
fi
[ -n "$(header_of content-security-policy)" ] \
  && ok "Content-Security-Policy ada di frontend" \
  || warn "Frontend belum mengirim Content-Security-Policy (T-06/T-11, perlu ditambahkan di nginx.conf)"

req GET /api/health
[ -z "$(header_of x-powered-by)" ] && ok "API tidak mengirim X-Powered-By" || bad "API membocorkan X-Powered-By"
[ -n "$(header_of x-content-type-options)" ] && ok "API (helmet) mengirim nosniff" || bad "API tidak mengirim nosniff"

req GET /js/
case "$STATUS" in
  403|404|301|302) ok "Directory listing /js/ tidak terbuka (HTTP $STATUS)" ;;
  200) printf '%s' "$BODY" | grep -qi 'index of' && bad "Directory listing terbuka di /js/" || ok "/js/ tidak menampilkan daftar direktori" ;;
  *) ok "/js/ tidak menampilkan daftar direktori (HTTP $STATUS)" ;;
esac

# ------------------------------------- T-04 / T-02: akses tanpa/palsu token
section "T-02 / T-04  Autentikasi dan JWT"
req GET /api/me;              expect "GET /api/me tanpa token ditolak" "401"
req GET /api/me/data;         expect "GET /api/me/data tanpa token ditolak" "401"
req PUT /api/me/data "" '{}'; expect "PUT /api/me/data tanpa token ditolak" "401"
req GET /api/admin/users;     expect "GET /api/admin/users tanpa token ditolak" "401"

req GET /api/admin/users "$(forge_none_token)"
expect "JWT palsu alg=none ditolak" "401"
req GET /api/admin/users "$(forge_hs256_token)"
expect "JWT HS256 dengan secret tebakan ditolak" "401"
req GET /api/me "not.a.jwt"
expect "Token sampah ditolak" "401"

# ------------------------------------------------- Registrasi dan login user
section "T-01 / T-06  Registrasi, login, validasi input"
SUFFIX="$(openssl rand -hex 4)"
U1="ci_user_$SUFFIX"
P1="Sup3r-rahasia-$SUFFIX"

# Sengaja menyelipkan role:"admin" di body: server harus mengabaikannya (mass assignment, T-04)
req POST /api/auth/register "" "$(jq -nc --arg u "$U1" --arg p "$P1" '{username:$u,password:$p,role:"admin"}')"
expect "Register user baru (body berisi role=admin)" "201"

req POST /api/auth/register "" "$(jq -nc --arg u "$U1" --arg p "$P1" '{username:$u,password:$p}')"
expect "Register username yang sama ditolak" "409"

req POST /api/auth/register "" "$(jq -nc --arg u "ci_weak_$SUFFIX" '{username:$u,password:"123"}')"
expect "Password lemah (< 8 karakter) ditolak" "400"

req POST /api/auth/login "" "$(jq -nc --arg u "$U1" --arg p "$P1" '{username:$u,password:$p}')"
expect "Login user" "200"
TOKEN="$(printf '%s' "$BODY" | jq -r '.token // empty')"
[ -n "$TOKEN" ] && ok "Login mengembalikan token" || bad "Login tidak mengembalikan token"
[ "$(printf '%s' "$BODY" | jq -r '.role // empty')" = "user" ] \
  && ok "User baru berperan 'user' (tidak bisa memilih role sendiri)" || bad "Role user baru bukan 'user'"

req POST /api/auth/login "" "$(jq -nc --arg u "$U1" '{username:$u,password:"password-salah-123"}')"
expect "Login dengan password salah ditolak" "401"

req POST /api/auth/login "" '{"username":{"$ne":null},"password":"apa-saja-12345"}'
expect "NoSQL injection di login ditolak" "400 401"
[ "$STATUS" = "200" ] && bad "NoSQL injection di login berhasil masuk"

# ---------------------------------------------------- T-04: RBAC
section "T-04  RBAC"
req GET /api/admin/users "$TOKEN"
expect "User biasa tidak bisa membuka /api/admin/users" "403"
req GET /api/me "$TOKEN"
expect "GET /api/me dengan token user" "200"

if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
  req POST /api/auth/login "" "$(jq -nc --arg u "$ADMIN_USERNAME" --arg p "$ADMIN_PASSWORD" '{username:$u,password:$p}')"
  expect "Login admin dari .env" "200"
  ATOKEN="$(printf '%s' "$BODY" | jq -r '.token // empty')"
  req GET /api/admin/users "$ATOKEN"
  expect "Admin bisa membuka /api/admin/users" "200"

  req POST /api/auth/login "" "$(jq -nc --arg u "$ADMIN_USERNAME" '{username:$u,password:"admin123"}')"
  expect "Password demo lama admin123 tidak berlaku" "401"
else
  warn "ADMIN_USERNAME / ADMIN_PASSWORD tidak diberikan: uji sisi admin dilewati"
fi

# ---------------------------------------------- Data per user (/api/me/data)
section "T-05 / T-06  Validasi dan isolasi data (/api/me/data)"
VALID_DATA='{"habits":[{"id":"1","name":"Coding","category":"Study","history":{"2026-11-09":true}}],"userProfile":{"xp":15,"level":1},"unlockedAchievements":["first_habit"],"habitNotes":{}}'
req PUT /api/me/data "$TOKEN" "$VALID_DATA"
expect "PUT /api/me/data dengan data valid" "200"

req GET /api/me/data "$TOKEN"
expect "GET /api/me/data" "200"
[ "$(printf '%s' "$BODY" | jq -r '.habits[0].name // empty')" = "Coding" ] \
  && ok "Data yang disimpan terbaca kembali" || bad "Data yang disimpan tidak terbaca kembali"

req PUT /api/me/data "$TOKEN" '{"habits":[{"id":"1","name":"x","history":{"bukan-tanggal":true}}],"userProfile":{"xp":1,"level":1},"unlockedAchievements":[],"habitNotes":{}}'
expect "Kunci history bukan tanggal ditolak" "400"

req PUT /api/me/data "$TOKEN" '{"habits":[{"id":"1","name":"x","history":{"2026-11-09":false}}],"userProfile":{"xp":1,"level":1},"unlockedAchievements":[],"habitNotes":{}}'
expect "Nilai history selain true ditolak" "400"

req PUT /api/me/data "$TOKEN" '{"habits":"bukan-array","userProfile":{"xp":1,"level":1},"unlockedAchievements":[],"habitNotes":{}}'
expect "Tipe data salah ditolak" "400"

req PUT /api/me/data "$TOKEN" '{"habits":[],"userProfile":{"xp":1,"level":1},"unlockedAchievements":[],"habitNotes":{},"$where":"1==1"}'
case "$STATUS" in
  200|400) ok "Properti operator Mongo ('\$where') tidak menimbulkan error server (HTTP $STATUS)" ;;
  *) bad "Properti '\$where' menyebabkan HTTP $STATUS" ;;
esac

# ---------------------------------------------------- T-07: batas ukuran body
section "T-07  Batas ukuran body"
{ printf '{"x":"'; head -c 400000 /dev/zero | tr '\0' 'a'; printf '"}'; } > "$TMP/big.json"
STATUS="$(curl -s -o "$TMP/body" -w '%{http_code}' -X PUT "$BASE_URL/api/me/data" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  --data-binary @"$TMP/big.json" 2>/dev/null)" || STATUS="000"
case "$STATUS" in
  413) ok "Body 400 KB ditolak (HTTP 413)" ;;
  500) warn "Body 400 KB ditolak tetapi dengan HTTP 500; error handler sebaiknya meneruskan err.status (413)" ;;
  4??) ok "Body 400 KB ditolak (HTTP $STATUS)" ;;
  *)   bad "Body 400 KB tidak ditolak (HTTP $STATUS)" ;;
esac

# ------------------------------------- T-01: rate limit (SELALU PALING AKHIR)
section "T-01  Rate limit login (menghabiskan jatah 10 request / 15 menit)"
GOT_429=0
for i in $(seq 1 12); do
  req POST /api/auth/login "" "$(jq -nc --arg u "brute_$SUFFIX" '{username:$u,password:"tebak-tebakan-123"}')"
  [ "$STATUS" = "429" ] && { GOT_429=1; break; }
done
[ "$GOT_429" = "1" ] && ok "Brute force login diblokir HTTP 429 pada percobaan ke-$i" \
                     || bad "12 percobaan login beruntun tidak pernah kena rate limit"

# ---------------------------------------------------------------- Ringkasan
printf '\n== Ringkasan: %d lulus, %d gagal, %d peringatan\n' "$PASS" "$FAIL" "$WARN"
[ "$FAIL" -eq 0 ]
