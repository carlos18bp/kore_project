from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.services.progress_service import get_monthly_summary, get_projection, get_weekly_summary


class WeeklySummaryView(APIView):
    """GET /api/my-program/weekly-summary/?week=N"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        week_param = request.query_params.get('week')
        week_number = None
        if week_param:
            try:
                week_number = int(week_param)
                if not (1 <= week_number <= 4):
                    return Response({'detail': 'week must be 1–4.'}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({'detail': 'Invalid week parameter.'}, status=status.HTTP_400_BAD_REQUEST)

        data = get_weekly_summary(request.user, week_number)
        if data is None:
            return Response(None)
        return Response(data)


class ProjectionView(APIView):
    """GET /api/my-program/projection/"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = get_projection(request.user)
        if data is None:
            return Response(None)
        return Response(data)


class MonthlySummaryView(APIView):
    """GET /api/my-program/monthly-summary/?program=<id>"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        program_id = request.query_params.get('program')
        pid = int(program_id) if program_id and program_id.isdigit() else None
        data = get_monthly_summary(request.user, pid)
        if data is None:
            return Response(None)
        return Response(data)
