"""Trainer-facing views for WeeklyNutritionPlan management."""
from datetime import date

from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import MealSuggestion, User, WeeklyNutritionPlan, WeeklyPlanDay, WeeklyPlanMeal
from core_app.permissions import IsTrainerRole
from core_app.services.nutrition_plan_generator import generate_weekly_plan
from core_app.utils.renderers import NullableJSONRenderer

MEAL_BLOCKS = [
    MealSuggestion.MealBlock.BREAKFAST,
    MealSuggestion.MealBlock.MID_MORNING,
    MealSuggestion.MealBlock.LUNCH,
    MealSuggestion.MealBlock.SNACK,
    MealSuggestion.MealBlock.DINNER,
]

MEAL_BLOCK_META = {
    'desayuno':    {'label': 'Desayuno',     'time': '07:00'},
    'media_manana':{'label': 'Media mañana', 'time': '10:30'},
    'almuerzo':    {'label': 'Almuerzo',     'time': '13:00'},
    'merienda':    {'label': 'Merienda',     'time': '16:30'},
    'cena':        {'label': 'Cena',         'time': '20:00'},
}


def _serialize_suggestion(s):
    if s is None:
        return None
    return {
        'id': s.id,
        'title': s.title,
        'description': s.description,
        'calories_estimate': s.calories_estimate,
        'nova_max': s.nova_max,
        'goal_tags': s.goal_tags,
    }


def _serialize_meal(meal):
    meta = MEAL_BLOCK_META.get(meal.meal_block, {})
    return {
        'id': meal.id,
        'meal_block': meal.meal_block,
        'meal_block_label': meta.get('label', meal.meal_block),
        'meal_block_time': meta.get('time', ''),
        'suggestion': _serialize_suggestion(meal.suggestion),
        'trainer_notes': meal.trainer_notes,
        'order': meal.order,
    }


def _serialize_day(day):
    return {
        'id': day.id,
        'day_number': day.day_number,
        'week_number': (day.day_number - 1) // 7 + 1,  # 1–4
        'date': day.date.isoformat(),
        'meals': [_serialize_meal(m) for m in day.meals.select_related('suggestion').order_by('order')],
    }


def _serialize_plan(plan, include_days=True):
    data = {
        'id': plan.id,
        'status': plan.status,
        'goal': plan.goal,
        'fitness_level': plan.fitness_level,
        'week_start': plan.week_start.isoformat(),
        'week_end': plan.week_end.isoformat(),
        'trainer_notes': plan.trainer_notes,
        'approved_at': plan.approved_at.isoformat() if plan.approved_at else None,
        'created_at': plan.created_at.isoformat(),
    }
    if include_days:
        data['days'] = [_serialize_day(d) for d in plan.days.prefetch_related('meals__suggestion').order_by('day_number')]
    return data


# ---------------------------------------------------------------------------

class CustomerNutritionPlanListView(APIView):
    """GET list of nutrition plans for a customer (trainer view).

    GET /api/nutrition-plans/customer/<customer_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        plans = (
            WeeklyNutritionPlan.objects.filter(customer_id=customer_id)
            .order_by('-week_start')
        )
        return Response([_serialize_plan(p, include_days=False) for p in plans])


class GenerateNutritionPlanView(APIView):
    """POST — generate a WeeklyNutritionPlan draft for a customer.

    POST /api/nutrition-plans/generate/
    Body: { "customer_id": 42 }
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def post(self, request):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No se encontró perfil de entrenador.'}, status=status.HTTP_404_NOT_FOUND)

        customer_id = request.data.get('customer_id')
        if not customer_id:
            return Response({'detail': 'customer_id requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = User.objects.select_related('customer_profile').get(
                id=customer_id, role=User.Role.CUSTOMER
            )
        except User.DoesNotExist:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent duplicate drafts
        existing_draft = WeeklyNutritionPlan.objects.filter(
            customer=customer, status=WeeklyNutritionPlan.Status.DRAFT
        ).first()
        if existing_draft:
            return Response(
                {
                    'detail': 'Ya existe un borrador de plan nutricional para este cliente.',
                    'plan_id': existing_draft.id,
                },
                status=status.HTTP_409_CONFLICT,
            )

        week_start = None
        if 'week_start' in request.data:
            try:
                week_start = date.fromisoformat(request.data['week_start'])
            except (ValueError, TypeError):
                return Response({'detail': 'Formato de week_start inválido (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)

        plan = generate_weekly_plan(customer, trainer_profile, week_start=week_start)
        return Response(_serialize_plan(plan), status=status.HTTP_201_CREATED)


class NutritionPlanDetailView(APIView):
    """GET — full plan detail including days and meals.

    GET /api/nutrition-plans/<plan_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, plan_id):
        try:
            plan = WeeklyNutritionPlan.objects.get(pk=plan_id)
        except WeeklyNutritionPlan.DoesNotExist:
            return Response({'detail': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(_serialize_plan(plan))


class UpdateNutritionPlanNoteView(APIView):
    """PATCH — trainer updates `trainer_notes` of any WeeklyNutritionPlan (draft or published)."""

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def patch(self, request, plan_id):
        try:
            plan = WeeklyNutritionPlan.objects.get(pk=plan_id)
        except WeeklyNutritionPlan.DoesNotExist:
            return Response({'detail': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        plan.trainer_notes = request.data.get('trainer_notes', '') or ''
        plan.save(update_fields=['trainer_notes'])
        return Response({'id': plan.pk, 'trainer_notes': plan.trainer_notes})


class ApproveNutritionPlanView(APIView):
    """POST — publish a draft plan so the customer can see it.

    POST /api/nutrition-plans/<plan_id>/approve/
    Optional body: { "trainer_notes": "..." }
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def post(self, request, plan_id):
        try:
            plan = WeeklyNutritionPlan.objects.get(pk=plan_id, status=WeeklyNutritionPlan.Status.DRAFT)
        except WeeklyNutritionPlan.DoesNotExist:
            return Response({'detail': 'Borrador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if 'trainer_notes' in request.data:
            plan.trainer_notes = request.data['trainer_notes']

        plan.status = WeeklyNutritionPlan.Status.PUBLISHED
        plan.approved_at = timezone.now()
        plan.save(update_fields=['status', 'approved_at', 'trainer_notes'])
        return Response(_serialize_plan(plan))


class DeleteNutritionPlanView(APIView):
    """DELETE — delete a nutrition plan (any status).

    Used both to discard a draft and to "relaunch" a published plan from the
    trainer's client detail view. NutritionDailyLog rows are keyed by
    (customer, date) and survive the deletion.

    DELETE /api/nutrition-plans/<plan_id>/delete/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def delete(self, request, plan_id):
        try:
            plan = WeeklyNutritionPlan.objects.get(pk=plan_id)
        except WeeklyNutritionPlan.DoesNotExist:
            return Response({'detail': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EditPlanMealView(APIView):
    """PATCH — swap suggestion or update notes for a meal.

    PATCH /api/nutrition-plans/<plan_id>/days/<day_id>/meals/<meal_id>/
    Body: { "suggestion_id": 5 }  or  { "trainer_notes": "..." }
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def patch(self, request, plan_id, day_id, meal_id):
        try:
            plan = WeeklyNutritionPlan.objects.get(pk=plan_id)
        except WeeklyNutritionPlan.DoesNotExist:
            return Response({'detail': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if plan.status == WeeklyNutritionPlan.Status.COMPLETED:
            return Response({'detail': 'No se puede editar un plan completado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meal = WeeklyPlanMeal.objects.select_related('suggestion', 'plan_day').get(
                pk=meal_id, plan_day__pk=day_id, plan_day__plan__pk=plan_id
            )
        except WeeklyPlanMeal.DoesNotExist:
            return Response({'detail': 'Comida no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []

        if 'suggestion_id' in request.data:
            sid = request.data['suggestion_id']
            if sid is None:
                meal.suggestion = None
            else:
                try:
                    meal.suggestion = MealSuggestion.objects.get(pk=sid, is_active=True)
                except MealSuggestion.DoesNotExist:
                    return Response({'detail': 'Sugerencia no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
            update_fields.append('suggestion')

        if 'trainer_notes' in request.data:
            meal.trainer_notes = request.data['trainer_notes']
            update_fields.append('trainer_notes')

        if update_fields:
            meal.save(update_fields=update_fields)

        return Response(_serialize_meal(meal))


def _serialize_suggestion_full(s):
    return {
        'id': s.id,
        'title': s.title,
        'meal_block': s.meal_block,
        'description': s.description,
        'calories_estimate': s.calories_estimate,
        'nova_max': s.nova_max,
        'goal_tags': s.goal_tags,
        'fitness_level_min': s.fitness_level_min,
        'fitness_level_max': s.fitness_level_max,
        'is_active': s.is_active,
        'created_at': s.created_at.isoformat(),
    }


class MealSuggestionCatalogView(APIView):
    """GET — paginated meal suggestions for the swap picker and catalog manager.

    GET /api/meal-suggestions/?meal_block=desayuno&search=avena&limit=20&offset=0&all=1
    POST /api/meal-suggestions/ — create a new suggestion (trainer role)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        include_inactive = request.query_params.get('all') == '1'
        qs = MealSuggestion.objects.all() if include_inactive else MealSuggestion.objects.filter(is_active=True)

        meal_block = request.query_params.get('meal_block')
        if meal_block:
            qs = qs.filter(meal_block=meal_block)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(title__icontains=search)

        qs = qs.order_by('meal_block', 'title')
        total = qs.count()

        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
        except (ValueError, TypeError):
            limit = 20

        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (ValueError, TypeError):
            offset = 0

        results = [_serialize_suggestion_full(s) for s in qs[offset:offset + limit]]
        return Response({'results': results, 'count': total})

    def post(self, request):
        from core_app.permissions import IsTrainerRole
        if not IsTrainerRole().has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo los entrenadores pueden crear sugerencias.')

        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'detail': 'El título es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        meal_block = request.data.get('meal_block', '').strip()
        valid_blocks = [c[0] for c in MealSuggestion.MealBlock.choices]
        if meal_block not in valid_blocks:
            return Response({'detail': f'meal_block debe ser uno de: {", ".join(valid_blocks)}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            calories = int(request.data.get('calories_estimate', 0))
            if calories <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'calories_estimate debe ser un entero positivo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            nova_max = int(request.data.get('nova_max', 2))
            if not 1 <= nova_max <= 4:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'nova_max debe estar entre 1 y 4.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            fl_min = int(request.data.get('fitness_level_min', 1))
            fl_max = int(request.data.get('fitness_level_max', 5))
            if not (1 <= fl_min <= 5 and 1 <= fl_max <= 5 and fl_min <= fl_max):
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'fitness_level_min/max deben estar entre 1 y 5 (min ≤ max).'}, status=status.HTTP_400_BAD_REQUEST)

        goal_tags = request.data.get('goal_tags', [])
        if isinstance(goal_tags, str):
            import json
            try:
                goal_tags = json.loads(goal_tags)
            except Exception:
                goal_tags = [t.strip() for t in goal_tags.split(',') if t.strip()]
        if not isinstance(goal_tags, list):
            goal_tags = []

        valid_goals = {'fat_loss', 'muscle_gain', 'general_health'}
        goal_tags = [g for g in goal_tags if g in valid_goals]

        suggestion = MealSuggestion.objects.create(
            title=title,
            meal_block=meal_block,
            description=(request.data.get('description') or '').strip(),
            calories_estimate=calories,
            nova_max=nova_max,
            fitness_level_min=fl_min,
            fitness_level_max=fl_max,
            goal_tags=goal_tags,
            is_active=True,
        )
        return Response(_serialize_suggestion_full(suggestion), status=status.HTTP_201_CREATED)


class CustomerNutritionPlanWeekView(APIView):
    """GET the active (published) plan for the authenticated customer's current week.

    GET /api/my-nutrition-plan/
    Used by TodayNutritionView to override auto-rotation with trainer-curated meals.
    """

    permission_classes = [IsAuthenticated]
    renderer_classes = [NullableJSONRenderer]

    def get(self, request):
        today = date.today()
        plan = (
            WeeklyNutritionPlan.objects.filter(
                customer=request.user,
                status=WeeklyNutritionPlan.Status.PUBLISHED,
                week_start__lte=today,
                week_end__gte=today,
            )
            .prefetch_related('days__meals__suggestion')
            .first()
        )
        if not plan:
            return Response(None)
        return Response(_serialize_plan(plan))


class CustomerNutritionPlanHistoryView(APIView):
    """GET list of all published nutrition plans for the authenticated customer.

    GET /api/my-nutrition-plans/
    Returns plans ordered by week_start desc, with trainer_notes exposed so the
    customer can see the coach's note per cycle plus the historical trail.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = (
            WeeklyNutritionPlan.objects
            .filter(
                customer=request.user,
                status=WeeklyNutritionPlan.Status.PUBLISHED,
            )
            .order_by('-week_start')
        )
        return Response([_serialize_plan(p, include_days=False) for p in plans])
