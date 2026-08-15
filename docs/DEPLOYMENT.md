# Fotolio — Deployment

Fotolio has two deployable parts:

1. **API + public site renderer** — the PHP app in `/api` (serves `/api/*` and every
   published portfolio site).
2. **Dashboard SPA** — the static build of `/dashboard` (React/Vite).

The recommended topology puts the platform (landing + dashboard + API) on one host and lets the
same PHP app serve every user's public site by resolving the `Host` header.

```
app.fotolio.app      → dashboard SPA (static)   + /api/* proxied to PHP
fotolio.app          → dashboard SPA (landing lives in the SPA at /)
*.fotolio.app        → PHP public renderer (subdomain sites)
<custom domains>     → PHP public renderer (verified custom-domain sites)
```

---

## 1. Server requirements

- PHP **8.2+** with extensions: `pdo_mysql`, `gd` (or **`imagick`**, preferred), `exif`, `zip`,
  `mbstring`, `fileinfo`, `openssl`.
  - **GD** covers JPEG/PNG/WebP/GIF/BMP. Install **Imagick** to additionally accept **HEIC/HEIF**
    and **TIFF** — set nothing else; `ImageOptimizationService` prefers Imagick when present.
- **PHP upload limits** must accommodate photos: set `upload_max_filesize`, `post_max_size`
  (≥ the app's `UPLOAD_MAX_MB`, e.g. 64M/80M), `max_file_uploads` (≥100 for folder/ZIP batches),
  and a generous `memory_limit` (512M) in `php.ini` / the FPM pool. Files over these limits are
  rejected by PHP before the app sees them — Fotolio now reports them in the upload review, but they
  still won't be processed.
- **MySQL 8 / MariaDB 10.4+**
- **Composer 2**, **Node 18+** (build only)
- Nginx (or Apache) + PHP-FPM
- Certbot / Let's Encrypt for TLS

---

## 2. Database

```sql
CREATE DATABASE fotolio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'fotolio'@'localhost' IDENTIFIED BY 'a-strong-password';
GRANT ALL PRIVILEGES ON fotolio.* TO 'fotolio'@'localhost';
FLUSH PRIVILEGES;
```

Set `/api/.env` from `.env.example`:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://app.fotolio.app
DASHBOARD_URL=https://app.fotolio.app
PLATFORM_HOSTS=app.fotolio.app,fotolio.app
PLATFORM_BASE_DOMAIN=fotolio.app
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_NAME=fotolio
DB_USER=fotolio
DB_PASS=a-strong-password
JWT_SECRET=<64 hex chars — `php -r "echo bin2hex(random_bytes(32));"`>
REFRESH_COOKIE_SECURE=true
```

Then:

```bash
cd api
composer install --no-dev --optimize-autoloader
php bin/console migrate
php bin/console seed        # optional demo data
```

The migration runner is driver-aware — the same migrations produce the MySQL schema in production
and SQLite locally.

---

## 3. Build & place the dashboard

```bash
cd dashboard
npm ci
npm run build          # → dashboard/dist
```

Serve `dashboard/dist` as static files for `app.fotolio.app` / `fotolio.app`, with `/api` and
`/media` proxied to PHP-FPM. History-API fallback to `index.html`.

---

## 4. Nginx

**Platform host (dashboard + API):**

```nginx
server {
  server_name app.fotolio.app fotolio.app;
  root /var/www/fotolio/dashboard/dist;

  location /api/   { include fastcgi_params; fastcgi_pass unix:/run/php/php8.2-fpm.sock;
                     fastcgi_param SCRIPT_FILENAME /var/www/fotolio/api/public/index.php; }
  location /media/ { alias /var/www/fotolio/api/public/media/; access_log off; expires 30d; }
  location /assets/{ alias /var/www/fotolio/api/public/assets/; expires 30d; }
  location /       { try_files $uri $uri/ /index.html; }   # SPA
}
```

**Public sites (subdomains + custom domains) → PHP front controller:**

```nginx
server {
  server_name ~^(?<sub>.+)\.fotolio\.app$;     # wildcard subdomains
  root /var/www/fotolio/api/public;
  location / { try_files $uri /index.php$is_args$args; }
  location ~ \.php$ { include fastcgi_params; fastcgi_pass unix:/run/php/php8.2-fpm.sock;
                      fastcgi_param SCRIPT_FILENAME $document_root/index.php; }
}
# Repeat a server block (or use a default_server + on-demand TLS) for custom domains.
```

`api/public/index.php` inspects the `Host` header and path:
`/api/*` → API · `/@slug` → that site · matched subdomain/verified custom domain → that site.

---

## 5. Wildcard DNS & TLS (deployment concern, not app code)

- **Wildcard subdomains:** add an `A`/`AAAA` record for `*.fotolio.app` → server IP. Issue a
  wildcard cert via DNS-01: `certbot certonly --dns-<provider> -d '*.fotolio.app' -d fotolio.app`.
- **Custom domains:** the dashboard shows each user the exact records
  (`A`/`CNAME` to point the domain + a `TXT _fotolio-challenge` to prove ownership). The
  `POST /api/site/domain/verify` endpoint checks resolution and flips the site to verified.
  Provision per-domain TLS **on demand** (e.g. Caddy's on-demand TLS, or Certbot triggered after
  verification). The application never provisions certificates itself.

---

## 6. Storage & permissions

- `api/storage/originals` (private originals) and `api/public/media` (variants) must be writable by
  PHP-FPM. Keep `api/storage` **outside** any web root — only `api/public` is served.
- Back up `api/storage/originals` (the only irreplaceable data) and the database.

---

## 7. One-command helper

`scripts/deploy.sh` bundles: pull, `composer install`, `npm ci && npm run build`, and
`php bin/console migrate`. Configure it with your host/path and run from CI or over SSH. It runs
migrations but never destructive commands.
