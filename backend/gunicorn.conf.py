"""Gunicorn configuration for kore_project production deployment."""

bind = 'unix:/run/kore_project.sock'
workers = 2
max_requests = 800
max_requests_jitter = 80
timeout = 30
graceful_timeout = 20
accesslog = '-'
errorlog = '-'
