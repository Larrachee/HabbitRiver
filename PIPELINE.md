# Pipeline CI/CD HabitRiver

## Isi paket

```
.github/workflows/ci.yml     pipeline utama
.github/dependabot.yml       update dependency, Dockerfile, dan action otomatis
scripts/security-smoke.sh    uji keamanan terhadap aplikasi yang berjalan
sonar-project.properties     konfigurasi SonarQube/SonarCloud (opsional)
```

Semua path relatif terhadap root repo (`~/habitriver`, yang berisi `backend/`, `frontend/`, `docker-compose.yml`).

## Memasang

Dari laptop (bukan upload ke VM, karena pipeline hanya perlu ada di repo GitHub):

```bash
# ekstrak ke root repo, lalu
git add .github scripts sonar-project.properties
git add backend/package-lock.json      # wajib ada di repo, dipakai npm ci
git commit -m "ci: pipeline DevSecOps"
git push origin main
```

Buka tab **Actions** di GitHub. Run pertama berjalan otomatis.

## Alur dan pemetaan ke threat model

| Job | Alat | Ancaman | Gagal build kalau |
|---|---|---|---|
| secrets-scan | gitleaks | T-13 | ada secret di riwayat commit |
| sca | npm ci + npm audit | T-12 | ada severity HIGH/CRITICAL (runtime dependency) |
| sast-semgrep | Semgrep (OWASP, Node.js) | T-06 | ada temuan severity ERROR |
| sast-sonar | SonarQube/SonarCloud | T-06 | quality gate gagal (hanya jika dikonfigurasi) |
| build-scan | docker build, cek non-root, Trivy | T-12, T-14 | image jalan sebagai root, atau ada CVE HIGH/CRITICAL yang sudah ada patchnya |
| dast | smoke test + OWASP ZAP baseline | T-01, T-02, T-04 s.d. T-07, T-11 | satu pun uji smoke gagal (ZAP: hanya laporan) |
| deploy | Tailscale + SSH | - | opsional, nonaktif secara bawaan |

`dast` baru jalan setelah empat job sebelumnya lulus. Laporan tersimpan di bagian **Artifacts** pada halaman run: `npm-audit-report`, `semgrep-report`, `zap-baseline-report`.

### Yang diuji `security-smoke.sh`

- Header Nginx dan helmet, tanpa versi server, tanpa directory listing (T-11)
- Endpoint tanpa token, JWT `alg:none`, JWT dengan secret tebakan (T-02)
- User biasa ke endpoint admin, `role:"admin"` pada body register diabaikan, password demo `admin123` tidak berlaku (T-04)
- NoSQL injection di login, validasi `/api/me/data` (tipe, tanggal, nilai), batas ukuran body (T-06, T-07)
- Brute force login berujung HTTP 429 (T-01)

Bukti ini bisa langsung dipakai di laporan: log job `dast` menampilkan PASS/FAIL per kontrol.

## Secret dan variabel yang perlu diisi

Tidak ada yang wajib untuk job `secrets-scan` sampai `dast`. Semua nilai `.env` di CI dibuat acak per run.

| Nama | Jenis | Untuk |
|---|---|---|
| `SONAR_TOKEN`, `SONAR_HOST_URL` | secret | job sast-sonar. Tanpa keduanya job dilewati. Runner GitHub tidak bisa menjangkau SonarQube di Proxmox, jadi pakai SonarCloud (`https://sonarcloud.io`, gratis untuk repo publik) dan isi `sonar-project.properties` |
| `DEPLOY_ENABLED=true` | variable | menyalakan job deploy |
| `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | secret | OAuth client Tailscale dengan tag `tag:ci` |
| `VM_SSH_KEY` | secret | private key khusus deploy (ed25519) |
| `VM_KNOWN_HOSTS` | secret | hasil `ssh-keyscan 100.125.17.0` dari perangkat yang sudah tersambung Tailscale |
| `VM_HOST`, `VM_USER` | secret | `100.125.17.0` dan `habitriver` |

Job deploy butuh setup di sisi VM dan Tailscale (ACL untuk `tag:ci`, repo di VM bisa `git pull` lewat deploy key read-only). Karena itu sebaiknya dinyalakan terakhir, setelah pipeline hijau.

## Pengaturan GitHub yang melengkapi pipeline (T-13)

Settings → Branches → rule untuk `main`: wajib pull request, wajib status check `Secret scan`, `SCA`, `SAST (Semgrep)`, `Build + Trivy`, `DAST`. Aktifkan juga Settings → Code security → Secret scanning dan Dependabot alerts.

## Catatan hasil run pertama

- **ZAP** hampir pasti melaporkan peringatan (misalnya CSP belum ada, Chart.js dari CDN tanpa SRI). Itu bukan kegagalan pipeline; masukkan sebagai temuan dan perbaikannya di laporan. Setelah dibereskan, ubah `fail_action: false` menjadi `true`.
- **Trivy** bisa gagal bila base image punya CVE HIGH/CRITICAL yang sudah ada patchnya. Node 20 sudah end-of-life sejak April 2026, jadi `FROM node:20-alpine` di `backend/Dockerfile` layak diganti ke LTS yang masih didukung (uji dulu di VM). MongoDB 4.4 juga sudah end-of-life, tetapi image `mongo` sengaja tidak dipindai karena memang tidak akan bersih.
- **Smoke test** menghabiskan jatah rate limit login. Kalau dijalankan manual di VM: `docker compose restart backend` setelahnya.
- Versi action (`trivy-action@0.28.0`, `action-baseline@v0.14.0`, `sonarqube-scan-action@v5.0.0`, gitleaks `v8.21.2`) saya tulis dari pengetahuan sendiri dan belum bisa dicek ke GitHub dari sini. Kalau ada yang tidak ditemukan, ganti ke tag terbaru di halaman Releases action tersebut; Dependabot akan mengurus pembaruan sesudahnya.
