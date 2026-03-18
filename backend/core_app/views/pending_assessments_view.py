"""Lightweight endpoint for the client dashboard to check pending items.

Returns boolean flags for self-report modules (nutrition/parq due) and
ISO timestamps of the latest trainer-created evaluations so the frontend
can compare with localStorage last-seen timestamps for "unseen" dots.
Also includes profile_incomplete and subscription_expiring flags.
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription
from core_app.models.anthropometry import AnthropometryEvaluation
from core_app.models.nutrition_habit import NutritionHabit
from core_app.models.parq_assessment import ParqAssessment
from core_app.models.physical_evaluation import PhysicalEvaluation
from core_app.models.posturometry import PosturometryEvaluation
from core_app.services.kore_index_calculator import compute_kore_index


class PendingAssessmentsView(APIView):
    """Return pending assessment flags for the authenticated client.

    GET /api/my-pending-assessments/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        user = request.user

        # ── Self-report modules: due flags ──
        latest_nutrition = NutritionHabit.objects.filter(
            customer=user,
        ).order_by('-created_at').first()
        nutrition_due = (
            latest_nutrition is None
            or latest_nutrition.created_at <= now - timedelta(days=7)
        )

        latest_parq = ParqAssessment.objects.filter(
            customer=user,
        ).order_by('-created_at').first()
        parq_due = (
            latest_parq is None
            or latest_parq.created_at <= now - timedelta(days=90)
        )

        # ── Trainer-created modules: latest evaluations ──
        latest_anthro = AnthropometryEvaluation.objects.filter(
            customer=user,
        ).order_by('-created_at').first()

        latest_posturo = PosturometryEvaluation.objects.filter(
            customer=user,
        ).order_by('-created_at').first()

        latest_physical = PhysicalEvaluation.objects.filter(
            customer=user,
        ).order_by('-created_at').first()

        # ── Profile incomplete ──
        cp = getattr(user, 'customer_profile', None)
        profile_incomplete = (
            cp is None
            or not cp.profile_completed
        )

        # ── Subscription expiring within 7 days ──
        subscription_expiring = Subscription.objects.filter(
            customer=user,
            status=Subscription.Status.ACTIVE,
            expires_at__lte=now + timedelta(days=7),
            expires_at__gte=now,
        ).exists()

        # ── Mood (latest today or recent) ──
        from core_app.models.mood_entry import MoodEntry
        latest_mood = MoodEntry.objects.filter(
            user=user,
        ).order_by('-date').first()
        mood_score = latest_mood.score if latest_mood else None

        # ── KÓRE General Index ──
        nutrition_habit_score = (
            float(latest_nutrition.habit_score)
            if latest_nutrition and latest_nutrition.habit_score is not None
            else None
        )

        kore_index = compute_kore_index(
            anthro_eval=latest_anthro,
            posturo_eval=latest_posturo,
            physical_eval=latest_physical,
            mood_score=mood_score,
            nutrition_habit_score=nutrition_habit_score,
        )

        return Response({
            'nutrition_due': nutrition_due,
            'parq_due': parq_due,
            'latest_anthropometry_at': latest_anthro.created_at.isoformat() if latest_anthro else None,
            'latest_posturometry_at': latest_posturo.created_at.isoformat() if latest_posturo else None,
            'latest_physical_eval_at': latest_physical.created_at.isoformat() if latest_physical else None,
            'profile_incomplete': profile_incomplete,
            'subscription_expiring': subscription_expiring,
            'kore_index': kore_index,
        })
