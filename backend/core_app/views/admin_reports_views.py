"""Admin-only KPI report endpoint (Fase 2 — Parte 11a)."""

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.permissions import IsAdminRole
from core_app.services import reports_service


class AdminReportsView(APIView):
    """GET /api/admin/reports/?window=today|30d|90d|all — business KPIs."""

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        window = request.query_params.get('window', '30d')
        if window not in reports_service.WINDOWS:
            return Response({'detail': 'Invalid window.'}, status=400)
        report = reports_service.build_admin_report(window, timezone.now())
        return Response(report)
