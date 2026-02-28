# Guía de Despliegue — kore_project

Instrucciones paso a paso para desplegar kore_project en producción desde la rama `master`.

---

## Prerequisitos

- Ubuntu/Debian con Python 3.12+, Node 22+, MySQL 8+, Redis, Nginx
- Certificado SSL (Let's Encrypt via certbot)
- Dominio apuntando al servidor (`korehealths.com`)

---

## Despliegue inicial (primera vez)

```bash
# 1. Clonar
git clone https://github.com/carlos18bp/kore_project.git /home/ryzepeck/webapps/kore_project
cd /home/ryzepeck/webapps/kore_project

# 2. Backend: virtualenv + dependencias
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Backend: crear .env
cp .env.example .env
nano .env   # <-- llenar TODAS las variables (ver sección "Variables de producción" abajo)

# 4. Backend: migraciones
python manage.py migrate

# 5. Frontend: dependencias + build
cd ../frontend
npm ci
npm run build

# 6. Backend: collectstatic (admin CSS/JS)
cd ../backend
source venv/bin/activate
python manage.py collectstatic --noinput

# 7. Copiar gunicorn config
cp ../scripts/systemd/gunicorn.conf.py ./gunicorn.conf.py

# 8. Instalar servicios systemd
sudo cp ../scripts/systemd/core_project.service /etc/systemd/system/core_project.service
sudo cp ../scripts/systemd/core_project.socket /etc/systemd/system/core_project.socket
sudo cp ../scripts/systemd/huey.service /etc/systemd/system/kore-huey.service
sudo systemctl daemon-reload
sudo systemctl enable --now core_project.socket
sudo systemctl enable --now core_project.service
sudo systemctl enable --now kore-huey

# 9. Configurar Nginx
sudo cp ../scripts/nginx/kore_project.conf /etc/nginx/sites-available/kore_project
sudo ln -sf /etc/nginx/sites-available/kore_project /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 10. Verificar
curl -I https://korehealths.com
sudo systemctl status core_project
sudo systemctl status kore-huey
```

---

## Actualización (deploys futuros)

```bash
cd /home/ryzepeck/webapps/kore_project
git pull origin master

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate

# Frontend
cd ../frontend
npm ci
npm run build

# Collectstatic + restart
cd ../backend
source venv/bin/activate
python manage.py collectstatic --noinput
sudo systemctl restart core_project
sudo systemctl restart kore-huey
```

---

## Variables de producción (.env)

```env
DJANGO_ENV=production
DJANGO_SECRET_KEY=<generar con: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DJANGO_ALLOWED_HOSTS=korehealths.com,www.korehealths.com
DJANGO_LOG_LEVEL=WARNING

DB_ENGINE=django.db.backends.mysql
DB_NAME=kore_project
DB_USER=<usuario-mysql>
DB_PASSWORD=<password-mysql>
DB_HOST=localhost
DB_PORT=3306

CORS_ALLOWED_ORIGINS=https://korehealths.com,https://www.korehealths.com
CSRF_TRUSTED_ORIGINS=https://korehealths.com,https://www.korehealths.com

JWT_ACCESS_TOKEN_LIFETIME_DAYS=1
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

SITE_BASE_URL=https://korehealths.com
API_BASE_URL=https://korehealths.com

EMAIL_HOST_USER=<email-smtp>
EMAIL_HOST_PASSWORD=<app-password>
DEFAULT_FROM_EMAIL=KÓRE <noreply@korehealths.com>

WOMPI_ENVIRONMENT=production
WOMPI_PUBLIC_KEY=<valor-real>
WOMPI_PRIVATE_KEY=<valor-real>
WOMPI_INTEGRITY_KEY=<valor-real>
WOMPI_EVENTS_KEY=<valor-real>

RECAPTCHA_SITE_KEY=<valor-real>
RECAPTCHA_SECRET_KEY=<valor-real>

HUEY_REDIS_URL=redis://localhost:6379/0
HUEY_IMMEDIATE=false

BACKUP_STORAGE_PATH=/var/backups/kore_project

ENABLE_SILK=false
```

---

## Arquitectura en producción

```
Internet
  │
  ▼
Nginx (SSL termination, port 443)
  ├── /static/     → backend/staticfiles/    (admin assets)
  ├── /media/      → backend/media/          (user uploads)
  ├── /_next/static/ → backend/templates/_next/static/  (Next.js chunks, cached 1y)
  └── /* (todo lo demás) → unix:/run/core_project.sock
                              │
                              ▼
                     Gunicorn (2 workers)
                              │
                     Django (core_project)
                       ├── /api/*        → DRF views
                       ├── /admin/*      → Django admin
                       └── /*            → serve_nextjs_page (HTML estático de Next.js export)
```

---

## Notas

- **`SECURE_PROXY_SSL_HEADER`** está configurado en `settings_prod.py` — Nginx DEBE enviar `X-Forwarded-Proto: https` para evitar redirect loops.
- **`output: 'export'`** en `next.config.ts` genera HTML estático en `out/` → movido a `backend/templates/` por el script de build.
- **Huey** procesa tareas async (emails, backups). Verificar que Redis esté corriendo antes de iniciar el servicio.
- **Backups**: configurar cron o systemd timer para ejecutar `python manage.py dbbackup` periódicamente.
