from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound

TEMPLATES_DIR = settings.BASE_DIR / 'templates'


def serve_nextjs_page(request, page='index'):
    """Serve a Next.js static export HTML page without template processing."""
    # Try direct .html file
    html_path = TEMPLATES_DIR / f'{page}.html'

    if not html_path.exists():
        # Try as directory with index.html
        html_path = TEMPLATES_DIR / page / 'index.html'

    if html_path.exists():
        with open(html_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')

    return custom_404(request)


def custom_404(request, exception=None):
    """Serve the Next.js 404 page."""
    not_found_path = TEMPLATES_DIR / '404.html'
    if not_found_path.exists():
        with open(not_found_path, 'r', encoding='utf-8') as f:
            return HttpResponseNotFound(f.read(), content_type='text/html')
    return HttpResponseNotFound('<h1>404 - Página no encontrada</h1>')
