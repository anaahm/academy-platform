# Hostinger Migration — Phase 1

Target: academy.egtaz.online

## Architecture

- Frontend: existing HTML/CSS/JavaScript academy.
- Backend: PHP 8.2+ REST API under /api.
- Database: a new Hostinger MySQL/MariaDB database.
- Authentication: academy-owned users and independent bearer sessions per portal.
- Firebase remains the working fallback until Hostinger QA passes.

## Hostinger setup

1. Create academy.egtaz.online as an independent website/subdomain.
2. Deploy repository anaahm/academy-platform from branch hostinger-migration-phase1 using Hostinger Git integration.
3. In the academy website dashboard, create a NEW MySQL database and user dedicated to the academy. Do not reuse the Egtaz database.
4. Open phpMyAdmin and import hostinger/schema.sql.
5. In File Manager, copy api/config.example.php to api/config.local.php and fill the database connection values shown by Hostinger. Keep the database host as localhost. Use a long random app_secret.
6. Never commit api/config.local.php. It is excluded by .gitignore.

## First server check

Open /api/health on academy.egtaz.online.

Expected response includes:
- ok: true
- service: academy-hostinger-api
- database: connected

When this passes, PHP and MySQL are connected.

## Security

- Database connection values are not committed.
- User passwords use PHP password_hash.
- Only session token hashes are stored in MySQL.
- Login/register endpoints are rate-limited.
- Sensitive API configuration files are blocked from direct web access.
- Data changes are recorded in academy_audit_log.
- Unknown data paths are denied by default.

## Next phase

After /api/health passes:
1. Add the browser compatibility adapter for the Firebase methods currently used by the academy.
2. Enable Hostinger mode only on academy.egtaz.online.
3. Run student, teacher, parent and admin journeys against Hostinger.
4. Remove Firebase SDK/config from Hostinger production after parity is confirmed.
5. Keep the current Firebase build available as rollback until final acceptance.
