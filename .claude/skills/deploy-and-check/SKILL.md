---
name: deploy-and-check
description: "Deploy latest master/main to the production server with pre-deploy checks, build, restart, and post-deploy verification."
disable-model-invocation: true
allowed-tools: Bash
---

> Ejecutar estos pasos conectado al servidor de producción vía SSH.
> Ruta base: `/home/ryzepeck/webapps/kore_project`
> NO ejecutar en local.

# Deploy kore_project to Production

Run these steps on the production server at `/home/ryzepeck/webapps/kore_project` to deploy the latest `main` branch.

## Pre-Deploy

1. Quick status snapshot before deploy:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/diagnostics/quick-status.sh
```

## Deploy Steps

2. Pull the latest code from main:
```bash
cd /home/ryzepeck/webapps/kore_project && git pull origin master
```

3. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && pip install -r requirements.txt && DJANGO_SETTINGS_MODULE=core_project.settings_prod python manage.py migrate
```

4. Build the frontend (Next.js static export to backend/templates/):
```bash
cd /home/ryzepeck/webapps/kore_project/frontend && npm ci && npm run build
```

5. Collect static files:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && DJANGO_SETTINGS_MODULE=core_project.settings_prod python manage.py collectstatic --noinput
```

6. Restart services:
```bash
sudo systemctl restart kore_project && sudo systemctl restart kore-huey
```

## Post-Deploy Verification

7. Run post-deploy check for kore_project:
```bash
bash /home/ryzepeck/webapps/ops/vps/scripts/deployment/post-deploy-check.sh kore_project
```
Expected: PASS on all checks, FAIL=0.

8. If something fails, check the logs:
```bash
sudo journalctl -u kore_project.service --no-pager -n 30
sudo journalctl -u kore-huey.service --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```

## Architecture Reference

- **Domain**: `korehealths.com` / `www.korehealths.com`
- **Backend**: Django (`core_project` module), settings selected via `DJANGO_SETTINGS_MODULE=core_project.settings_prod` in systemd unit
- **Frontend**: Next.js 16 SSG → `backend/templates/` + Django catch-all view
- **Services**: `kore_project.service` (Gunicorn via socket), `kore_project.socket`, `kore-huey.service`
- **Nginx**: `/etc/nginx/sites-available/kore_project`
- **Socket**: `/run/kore_project.sock`
- **Static**: `/home/ryzepeck/webapps/kore_project/backend/staticfiles/`
- **Media**: `/home/ryzepeck/webapps/kore_project/backend/media/`
- **Resource limits**: MemoryMax=512M, CPUQuota=40%, OOMScoreAdjust=300

## Cleanup

9. Remove `node_modules` to save disk space (frontend already compiled):
```bash
rm -rf /home/ryzepeck/webapps/kore_project/frontend/node_modules
```

## Notes

- VPS operations scripts live in `/home/ryzepeck/webapps/ops/vps/scripts/`.
- Frontend uses `npm run build` which runs `next build` with `output: 'export'` and moves the `out/` directory to `backend/templates/`.
- `DJANGO_SETTINGS_MODULE=core_project.settings_prod` must be set for migrate and collectstatic commands (manage.py defaults to settings_dev).
