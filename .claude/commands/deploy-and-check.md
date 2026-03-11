---
description: Deploy latest master to production server for kore_project
---

> Ejecutar estos pasos conectado al servidor de producción vía SSH.
> Ruta base: `/home/ryzepeck/webapps/kore_project`
> NO ejecutar en local.

# Deploy kore_project to Production

Run these steps on the production server at `/home/ryzepeck/webapps/kore_project` to deploy the latest `master` branch.

## Pre-Deploy

1. Quick status snapshot before deploy:
```bash
bash ~/scripts/quick-status.sh
```

## Deploy Steps

2. Pull the latest code from master:
```bash
cd /home/ryzepeck/webapps/kore_project && git pull origin master
```

3. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && pip install -r requirements.txt && DJANGO_ENV=production python manage.py migrate
```

4. Build the frontend (Next.js export → copies to backend/templates/):
```bash
cd /home/ryzepeck/webapps/kore_project/frontend && npm ci && npm run build
```

5. Collect static files:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && DJANGO_ENV=production python manage.py collectstatic --noinput
```

6. Restart services:
```bash
sudo systemctl restart kore_project && sudo systemctl restart kore_project-huey
```

## Post-Deploy Verification

7. Run post-deploy check for kore_project:
```bash
bash ~/scripts/post-deploy-check.sh kore_project
```
Expected: PASS on all checks, FAIL=0.

8. If something fails, check the logs:
```bash
sudo journalctl -u kore_project.service --no-pager -n 30
sudo journalctl -u kore_project-huey.service --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```

## Architecture Reference

- **Domain**: `korehealths.com` / `www.korehealths.com`
- **Backend**: Django (`core_project` module), prod settings activated via `DJANGO_ENV=production` (auto-imported from `settings_prod.py`)
- **Frontend**: Next.js SSG → `next build` exports to `out/`, then moved to `backend/templates/` (served by Django catch-all)
- **Services**: `kore_project.service` (Gunicorn via socket), `kore_project.socket`, `kore_project-huey.service`
- **Nginx**: `/etc/nginx/sites-available/kore_project`
- **Socket**: `/run/kore_project.sock`
- **Static**: `/home/ryzepeck/webapps/kore_project/backend/staticfiles/`
- **Media**: `/home/ryzepeck/webapps/kore_project/backend/media/`
- **Templates**: `/home/ryzepeck/webapps/kore_project/backend/templates/` (Next.js build output)

## Notes

- `~/scripts` is a symlink to `/home/ryzepeck/webapps/ops/vps/`.
- `npm run build` runs `next build && rm -rf ../backend/templates && mv out ../backend/templates`.
- `DJANGO_ENV=production` must be set for `migrate` and `collectstatic` (settings.py defaults to development).
- The systemd unit for `kore_project.service` sets `DJANGO_ENV=production` automatically for the running service.
