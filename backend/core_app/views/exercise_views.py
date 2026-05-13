from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.exercise import Exercise


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = (
            'id',
            'name',
            'pattern',
            'exercise_type',
            'main_implement',
            'primary_muscles',
            'secondary_muscles',
            'plane',
            'explanation',
            'youtube_url',
            'fitness_level_min',
            'is_corrective',
            'goal_tags',
            'is_active',
        )


class ExerciseListView(APIView):
    """Read-only list of active exercises.

    Query params:
      pattern         — exact movement pattern (case-insensitive)
      search          — partial name match (case-insensitive)
      fitness_level_min — max level to include (lte)
      goal            — goal tag substring
      is_corrective   — true/1/yes
      similar_to      — exercise ID; results with the same pattern come first
      limit           — max results (default 20, max 100)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Exercise.objects.filter(is_active=True)

        pattern = request.query_params.get('pattern')
        if pattern:
            qs = qs.filter(pattern__iexact=pattern)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)

        level = request.query_params.get('fitness_level_min')
        if level:
            try:
                qs = qs.filter(fitness_level_min__lte=int(level))
            except ValueError:
                pass

        goal = request.query_params.get('goal')
        if goal:
            qs = qs.filter(goal_tags__icontains=f'"{goal}"')

        corrective = request.query_params.get('is_corrective')
        if corrective is not None:
            qs = qs.filter(is_corrective=(corrective.lower() in ('true', '1', 'yes')))

        # When similar_to is given, sort same-pattern exercises to the top
        similar_to = request.query_params.get('similar_to')
        if similar_to:
            try:
                ref = Exercise.objects.get(pk=similar_to, is_active=True)
                from django.db.models import Case, IntegerField, Value, When
                qs = qs.annotate(
                    _same_pattern=Case(
                        When(pattern__iexact=ref.pattern, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    )
                ).order_by('_same_pattern', 'name')
            except Exercise.DoesNotExist:
                qs = qs.order_by('name')
        else:
            qs = qs.order_by('name')

        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
        except ValueError:
            limit = 20

        qs = qs[:limit]
        serializer = ExerciseSerializer(qs, many=True)
        return Response({'count': len(serializer.data), 'results': serializer.data})
