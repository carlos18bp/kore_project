import re

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


def serve_nextjs_rsc(request, path):
    """Serve Next.js RSC payload files (.txt) from the static export.

    Next.js 16 generates files like ``__next._tree.txt`` (with underscore
    prefix) but the client-side router requests ``__next.tree.txt`` (without).
    This view tries the exact path first, then falls back to the
    underscore-prefixed variant.
    """
    file_path = (TEMPLATES_DIR / path).resolve()

    # Security: ensure resolved path stays inside TEMPLATES_DIR
    if not str(file_path).startswith(str(TEMPLATES_DIR.resolve())):
        return HttpResponseNotFound('')

    if file_path.is_file():
        return HttpResponse(file_path.read_bytes(), content_type='text/plain')

    # Fallback: __next.tree.txt → __next._tree.txt
    m = re.match(r'^(__next\.)(.+\.txt)$', file_path.name)
    if m:
        alt_path = file_path.parent / f'{m.group(1)}_{m.group(2)}'
        if alt_path.is_file():
            return HttpResponse(alt_path.read_bytes(), content_type='text/plain')

    return HttpResponseNotFound('')


def custom_404(request, exception=None):
    """Serve the Next.js 404 page."""
    not_found_path = TEMPLATES_DIR / '404.html'
    if not_found_path.exists():
        with open(not_found_path, 'r', encoding='utf-8') as f:
            return HttpResponseNotFound(f.read(), content_type='text/html')
    return HttpResponseNotFound('<h1>404 - Página no encontrada</h1>')
