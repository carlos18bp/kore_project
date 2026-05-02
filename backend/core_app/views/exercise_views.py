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
    """Read-only list of active exercises, filterable by pattern, level, goal, and corrective flag."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Exercise.objects.filter(is_active=True)

        pattern = request.query_params.get('pattern')
        if pattern:
            qs = qs.filter(pattern__iexact=pattern)

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

        serializer = ExerciseSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})
