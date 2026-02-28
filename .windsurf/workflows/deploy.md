---
description: Deploy latest master to production server for kore_project
---

# Deploy kore_project to Production

Run these steps on the production server at `/home/ryzepeck/webapps/kore_project` to deploy the latest `master` branch.

## Steps

// turbo
1. Pull the latest code from master:
```bash
cd /home/ryzepeck/webapps/kore_project && git pull origin master
```

2. Install backend dependencies and run migrations:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && pip install -r requirements.txt && python manage.py migrate
```

3. Build the frontend (Next.js static export):
```bash
cd /home/ryzepeck/webapps/kore_project/frontend && npm ci && npm run build
```

4. Collect static files:
```bash
cd /home/ryzepeck/webapps/kore_project/backend && source venv/bin/activate && python manage.py collectstatic --noinput
```

5. Restart services:
```bash
sudo systemctl restart kore_project && sudo systemctl restart kore-huey
```

// turbo
6. Verify services are running:
```bash
systemctl is-active kore_project.socket kore_project.service kore-huey && curl -s -o /dev/null -w "%{http_code}" https://www.korehealths.com
```
Expected output: `active`, `active`, `active`, `200`.

7. If something fails, check the logs:
```bash
sudo journalctl -u kore_project --no-pager -n 30
sudo journalctl -u kore-huey --no-pager -n 30
sudo tail -20 /var/log/nginx/error.log
```

## Architecture Reference

- **Domain**: `korehealths.com` / `www.korehealths.com`
- **Backend**: Django (`core_project` module), settings selected via `DJANGO_ENV=production` in `.env`
- **Frontend**: Next.js static export → `backend/templates/`
- **Services**: `kore_project.service` (Gunicorn via socket), `kore_project.socket`, `kore-huey.service`
- **Nginx**: `/etc/nginx/sites-available/kore_project`
- **Socket**: `/run/kore_project.sock`
- **Static**: `/home/ryzepeck/webapps/kore_project/backend/staticfiles/`
- **Media**: `/home/ryzepeck/webapps/kore_project/backend/media/`
