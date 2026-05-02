"""API views for the MonthlyProgram feature.

Trainer/admin endpoints:
  POST /api/monthly-programs/generate/          — generate a draft program for a customer
  GET  /api/monthly-programs/<id>/              — detail with all days and exercises (trainer)
  PATCH /api/monthly-programs/<id>/approve/     — publish (trainer)
  PATCH /api/monthly-programs/<id>/days/<day_id>/exercises/<ex_id>/  — edit an exercise

Customer endpoints:
  GET /api/my-program/          — active published program
  GET /api/my-program/today/    — today's ProgramDay + DailyLog (auto-creates log)
  PATCH /api/my-program/logs/<log_id>/exercises/<ex_log_id>/  — update ExerciseLog status
"""

from datetime import date

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.monthly_program import (
    DailyLog,
    ExerciseLog,
    MonthlyProgram,
    ProgramDay,
    ProgramExercise,
)
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.services.program_generator import generate_monthly_program


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class ExerciseBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    pattern = serializers.CharField()
    youtube_url = serializers.CharField()
    explanation = serializers.CharField()
    is_corrective = serializers.BooleanField()
    primary_muscles = serializers.CharField()
    secondary_muscles = serializers.CharField()


class ProgramExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseBriefSerializer(read_only=True)

    class Meta:
        model = ProgramExercise
        fields = ('id', 'exercise', 'sets', 'reps', 'duration_seconds', 'rest_seconds', 'order', 'notes')


class ProgramDaySerializer(serializers.ModelSerializer):
    exercises = ProgramExerciseSerializer(many=True, read_only=True)

    class Meta:
        model = ProgramDay
        fields = ('id', 'day_number', 'date', 'day_type', 'exercises')


class MonthlyProgramSerializer(serializers.ModelSerializer):
    days = ProgramDaySerializer(many=True, read_only=True)

    class Meta:
        model = MonthlyProgram
        fields = (
            'id', 'customer_id', 'fitness_level', 'goal',
            'start_date', 'end_date', 'status', 'trainer_notes',
            'approved_at', 'created_at', 'days',
        )
        read_only_fields = fields


class ExerciseLogSerializer(serializers.ModelSerializer):
    program_exercise = ProgramExerciseSerializer(read_only=True)

    class Meta:
        model = ExerciseLog
        fields = ('id', 'program_exercise', 'status', 'notes')


class DailyLogSerializer(serializers.ModelSerializer):
    exercise_logs = ExerciseLogSerializer(many=True, read_only=True)

    class Meta:
        model = DailyLog
        fields = ('id', 'date', 'is_closed', 'closed_at', 'exercise_logs')


# ---------------------------------------------------------------------------
# Trainer/admin views
# ---------------------------------------------------------------------------

class GenerateProgramView(APIView):
    """POST — generate a draft program for a given customer_id."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (is_admin_user(request.user) or request.user.role == 'trainer'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        customer_id = request.data.get('customer_id')
        if not customer_id:
            return Response({'detail': 'customer_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date_raw = request.data.get('start_date')
        if start_date_raw:
            try:
                start_date = date.fromisoformat(start_date_raw)
            except (ValueError, TypeError):
                return Response({'detail': 'Invalid start_date format (use YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            start_date = date.today()

        try:
            from core_app.models import User
            customer = User.objects.get(pk=customer_id, role='customer')
        except User.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        program = generate_monthly_program(customer_id=customer.pk, start_date=start_date)
        return Response(
            {'id': program.pk, 'status': program.status, 'start_date': str(program.start_date)},
            status=status.HTTP_201_CREATED,
        )


class ProgramDetailView(APIView):
    """GET — full program detail for trainer review."""

    permission_classes = [IsAuthenticated]

    def get(self, request, program_id):
        if not (is_admin_user(request.user) or request.user.role == 'trainer'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            program = MonthlyProgram.objects.prefetch_related(
                'days__exercises__exercise'
            ).get(pk=program_id)
        except MonthlyProgram.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(MonthlyProgramSerializer(program).data)


class ApproveProgramView(APIView):
    """PATCH — trainer publishes a draft program."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, program_id):
        if not (is_admin_user(request.user) or request.user.role == 'trainer'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            program = MonthlyProgram.objects.get(pk=program_id, status=MonthlyProgram.Status.DRAFT)
        except MonthlyProgram.DoesNotExist:
            return Response({'detail': 'Draft program not found.'}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('trainer_notes', '')
        program.trainer_notes = notes
        program.status = MonthlyProgram.Status.PUBLISHED
        program.approved_at = timezone.now()
        program.save(update_fields=['status', 'approved_at', 'trainer_notes'])
        return Response({'id': program.pk, 'status': program.status})


class EditProgramExerciseView(APIView):
    """PATCH — trainer swaps or edits a single exercise in a program day."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, program_id, day_id, ex_id):
        if not (is_admin_user(request.user) or request.user.role == 'trainer'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            program_ex = ProgramExercise.objects.select_related('program_day__program').get(
                pk=ex_id, program_day__pk=day_id, program_day__program__pk=program_id,
            )
        except ProgramExercise.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        swap_exercise_id = request.data.get('exercise_id')
        if swap_exercise_id:
            from core_app.models.exercise import Exercise
            try:
                new_exercise = Exercise.objects.get(pk=swap_exercise_id)
                program_ex.exercise = new_exercise
            except Exercise.DoesNotExist:
                return Response({'detail': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)

        for field in ('sets', 'reps', 'duration_seconds', 'rest_seconds', 'notes'):
            if field in request.data:
                setattr(program_ex, field, request.data[field] or None if field in ('reps', 'duration_seconds') else request.data[field])

        program_ex.save()
        return Response(ProgramExerciseSerializer(program_ex).data)


class CustomerProgramListView(APIView):
    """GET — list all programs for a given customer (trainer/admin only)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        if not (is_admin_user(request.user) or request.user.role == 'trainer'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        programs = (
            MonthlyProgram.objects
            .filter(customer_id=customer_id)
            .prefetch_related('days__exercises__exercise')
            .order_by('-start_date')
        )
        return Response(MonthlyProgramSerializer(programs, many=True).data)


# ---------------------------------------------------------------------------
# Customer views
# ---------------------------------------------------------------------------

class MyProgramView(APIView):
    """GET — active published program for the authenticated customer."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from core_app.models import Booking

        program = (
            MonthlyProgram.objects
            .filter(customer=request.user, status=MonthlyProgram.Status.PUBLISHED)
            .prefetch_related('days__exercises__exercise')
            .order_by('-start_date')
            .first()
        )
        if program is None:
            return Response({'detail': 'No active program.'}, status=status.HTTP_404_NOT_FOUND)

        data = MonthlyProgramSerializer(program).data
        booking_dates = list(
            Booking.objects.filter(
                customer=request.user,
                status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
                slot__starts_at__date__range=(program.start_date, program.end_date),
            ).values_list('slot__starts_at__date', flat=True).distinct()
        )
        data['booking_dates'] = [d.isoformat() for d in booking_dates]
        return Response(data)


class TodayProgramView(APIView):
    """GET — today's ProgramDay with the DailyLog (creates log if needed)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()

        program = (
            MonthlyProgram.objects
            .filter(
                customer=request.user,
                status=MonthlyProgram.Status.PUBLISHED,
                start_date__lte=today,
                end_date__gte=today,
            )
            .first()
        )
        if program is None:
            return Response({'detail': 'No active program for today.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            program_day = ProgramDay.objects.prefetch_related(
                'exercises__exercise'
            ).get(program=program, date=today)
        except ProgramDay.DoesNotExist:
            return Response({'detail': 'No program day for today.'}, status=status.HTTP_404_NOT_FOUND)

        daily_log, created = DailyLog.objects.get_or_create(
            customer=request.user,
            date=today,
            defaults={'program': program},
        )

        if created and program_day.exercises.exists():
            exercise_logs = [
                ExerciseLog(daily_log=daily_log, program_exercise=pe)
                for pe in program_day.exercises.all()
            ]
            ExerciseLog.objects.bulk_create(exercise_logs)
            daily_log.refresh_from_db()

        day_data = ProgramDaySerializer(program_day).data
        log_data = DailyLogSerializer(daily_log).data
        return Response({'program_day': day_data, 'daily_log': log_data})


class UpdateExerciseLogView(APIView):
    """PATCH — customer marks an exercise as completed/skipped."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, log_id, ex_log_id):
        try:
            exercise_log = ExerciseLog.objects.select_related('daily_log').get(
                pk=ex_log_id,
                daily_log__pk=log_id,
                daily_log__customer=request.user,
            )
        except ExerciseLog.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if exercise_log.daily_log.is_closed:
            return Response({'detail': 'Log is closed for editing.'}, status=status.HTTP_400_BAD_REQUEST)

        new_status = request.data.get('status')
        valid = [s.value for s in ExerciseLog.Status]
        if new_status not in valid:
            return Response({'detail': f'status must be one of {valid}.'}, status=status.HTTP_400_BAD_REQUEST)

        exercise_log.status = new_status
        exercise_log.notes = request.data.get('notes', exercise_log.notes)
        exercise_log.save(update_fields=['status', 'notes'])
        return Response(ExerciseLogSerializer(exercise_log).data)
