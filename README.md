# KÓRE Project

Backend: Django REST Framework + JWT
Frontend: Next.js + TypeScript

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
python manage.py migrate
python manage.py createsuperuser --email admin@kore.com
python manage.py runserver
```

API base URL: `http://localhost:8000/api/`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend URL: `http://localhost:3000`