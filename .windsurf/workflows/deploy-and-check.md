---
description: Deploy latest master to production server for kore_project
---

# Deploy kore_project to Production

Run these steps on the production server at `/home/ryzepeck/webapps/kore_project` to deploy the latest `master` branch.

## Pre-Deploy

// turbo
1. Quick status snapshot before deploy:
```bash
bash ~/scripts/quick-status.sh
```

## Deploy Steps

// turbo
2. Pull the latest code from master:
```bash
cd /home/ryzepeck/webapps/kore_project && git pull origin master
```

3. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate
```

4. Build the frontend (Next.js static export):
```bash
cd /home/ryzepeck/webapps/kore_project/frontend && npm ci && npm run build
```

5. Collect static files:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && python manage.py collectstatic --noinput
```

6. Restart services:
```bash
sudo systemctl restart kore_project && sudo systemctl restart kore-huey
```

## Post-Deploy Verification

// turbo
7. Run post-deploy check for kore_project:
```bash
bash ~/scripts/post-deploy-check.sh kore_project
```
Expected: PASS on all checks, FAIL=0.

8. If something fails, check the logs:
```bash
sudo journalctl -u kore_project --no-pager -n 30
sudo journalctl -u kore-huey --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```

9. (Optional) Full server diagnostic with score:
```bash
bash ~/scripts/full-diagnostic.sh
```

## Verification Scripts Reference

| Script | Purpose | When to use |
|--------|---------|-------------|
| `bash ~/scripts/quick-status.sh` | Snapshot rápido: RAM, disco, servicios, SSL | Pre-deploy, sanity check |
| `bash ~/scripts/full-diagnostic.sh` | Diagnóstico completo con score | Auditorías, debugging profundo |
| `bash ~/scripts/post-deploy-check.sh kore_project` | Verificación post-deploy | Después de cada deploy |

## Architecture Reference

- **Domain**: `korehealths.com` / `www.korehealths.com`
- **Backend**: Django (`core_project` module), settings selected via `DJANGO_ENV=production` in `.env`
- **Frontend**: Next.js static export → `backend/templates/`
- **Services**: `kore_project.service` (Gunicorn via socket), `kore_project.socket`, `kore-huey.service`
- **Nginx**: `/etc/nginx/sites-available/kore_project`
- **Socket**: `/run/kore_project.sock`
- **Static**: `/home/ryzepeck/webapps/kore_project/backend/staticfiles/`
- **Media**: `/home/ryzepeck/webapps/kore_project/backend/media/`
- **Resource limits**: MemoryMax=512MB, CPUQuota=50%, OOMScoreAdjust=250

## Notes

- `~/scripts` is a symlink to `/home/ryzepeck/webapps/ops/vps/`.
- Frontend `npm ci` may take a few minutes; the backend stays up during build.
- If MemoryMax is hit during deploy, the service will be killed and restarted automatically.
