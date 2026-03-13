"""Views for posturometry evaluations.

Trainer endpoints: list/create/detail evaluations for their clients.
Client endpoints: read-only access to their own evaluations.
"""

import json

from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Booking, PosturometryEvaluation, User
from core_app.permissions import IsTrainerRole


class PosturometrySerializer(serializers.ModelSerializer):
    trainer_name = serializers.SerializerMethodField()
    anterior_photo = serializers.SerializerMethodField()
    lateral_right_photo = serializers.SerializerMethodField()
    lateral_left_photo = serializers.SerializerMethodField()
    posterior_photo = serializers.SerializerMethodField()

    class Meta:
        model = PosturometryEvaluation
        fields = (
            'id',
            'customer_id',
            'trainer_name',
            'evaluation_date',
            'anterior_data', 'lateral_right_data', 'lateral_left_data', 'posterior_data',
            'anterior_photo', 'lateral_right_photo', 'lateral_left_photo', 'posterior_photo',
            'anterior_observations', 'lateral_right_observations',
            'lateral_left_observations', 'posterior_observations',
            'notes', 'recommendations',
            'global_index', 'global_category', 'global_color',
            'upper_index', 'upper_category', 'upper_color',
            'central_index', 'central_category', 'central_color',
            'lower_index', 'lower_category', 'lower_color',
            'segment_scores', 'findings',
            'created_at',
        )
        read_only_fields = (
            'id', 'customer_id', 'trainer_name',
            'global_index', 'global_category', 'global_color',
            'upper_index', 'upper_category', 'upper_color',
            'central_index', 'central_category', 'central_color',
            'lower_index', 'lower_category', 'lower_color',
            'segment_scores', 'findings',
            'created_at',
        )

    def get_trainer_name(self, obj):
        if obj.trainer and obj.trainer.user:
            return f'{obj.trainer.user.first_name} {obj.trainer.user.last_name}'.strip()
        return ''

    def _photo_url(self, obj, field_name):
        field = getattr(obj, field_name, None)
        if field and field.name:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(field.url)
            return field.url
        return None

    def get_anterior_photo(self, obj):
        return self._photo_url(obj, 'anterior_photo')

    def get_lateral_right_photo(self, obj):
        return self._photo_url(obj, 'lateral_right_photo')

    def get_lateral_left_photo(self, obj):
        return self._photo_url(obj, 'lateral_left_photo')

    def get_posterior_photo(self, obj):
        return self._photo_url(obj, 'posterior_photo')


def _parse_json_field(data, field_name):
    """Parse a JSON field from multipart form data (string → dict)."""
    value = data.get(field_name)
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return {}
    return {}


# ── Trainer endpoints ──

class TrainerPosturometryListCreateView(APIView):
    """List and create posturometry evaluations for a trainer's client.

    GET  /api/trainer/my-clients/<id>/posturometry/
    POST /api/trainer/my-clients/<id>/posturometry/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        evals = PosturometryEvaluation.objects.filter(
            customer_id=customer_id, trainer=trainer_profile,
        ).order_by('-created_at')
        return Response(PosturometrySerializer(evals, many=True, context={'request': request}).data)

    def post(self, request, customer_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        has_bookings = Booking.objects.filter(
            trainer=trainer_profile, customer_id=customer_id,
        ).exists()
        if not has_bookings:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            customer = User.objects.get(id=customer_id, role=User.Role.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        # Parse JSON fields from multipart data
        anterior_data = _parse_json_field(request.data, 'anterior_data')
        lateral_right_data = _parse_json_field(request.data, 'lateral_right_data')
        lateral_left_data = _parse_json_field(request.data, 'lateral_left_data')
        posterior_data = _parse_json_field(request.data, 'posterior_data')

        evaluation = PosturometryEvaluation(
            customer=customer,
            trainer=trainer_profile,
            evaluation_date=request.data.get('evaluation_date') or None,
            anterior_data=anterior_data,
            lateral_right_data=lateral_right_data,
            lateral_left_data=lateral_left_data,
            posterior_data=posterior_data,
            anterior_observations=request.data.get('anterior_observations', ''),
            lateral_right_observations=request.data.get('lateral_right_observations', ''),
            lateral_left_observations=request.data.get('lateral_left_observations', ''),
            posterior_observations=request.data.get('posterior_observations', ''),
            notes=request.data.get('notes', ''),
        )

        # Handle photo uploads
        for photo_field in ('anterior_photo', 'lateral_right_photo', 'lateral_left_photo', 'posterior_photo'):
            photo = request.FILES.get(photo_field)
            if photo:
                setattr(evaluation, photo_field, photo)

        evaluation.save()

        return Response(
            PosturometrySerializer(evaluation, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class TrainerPosturometryDetailView(APIView):
    """Get, update, or delete a specific posturometry evaluation.

    GET    /api/trainer/my-clients/<id>/posturometry/<eval_id>/
    PATCH  /api/trainer/my-clients/<id>/posturometry/<eval_id>/
    PUT    /api/trainer/my-clients/<id>/posturometry/<eval_id>/
    DELETE /api/trainer/my-clients/<id>/posturometry/<eval_id>/
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_evaluation(self, request, customer_id, eval_id):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if not trainer_profile:
            return None, Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            evaluation = PosturometryEvaluation.objects.get(
                id=eval_id, customer_id=customer_id, trainer=trainer_profile,
            )
        except PosturometryEvaluation.DoesNotExist:
            return None, Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return evaluation, None

    def get(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        return Response(PosturometrySerializer(evaluation, context={'request': request}).data)

    def _apply_full_update(self, evaluation, request):
        """Apply all mutable fields from request data onto the evaluation."""
        json_fields = ('anterior_data', 'lateral_right_data', 'lateral_left_data', 'posterior_data')
        for field in json_fields:
            if field in request.data:
                evaluation.__setattr__(field, _parse_json_field(request.data, field))

        text_fields = (
            'anterior_observations', 'lateral_right_observations',
            'lateral_left_observations', 'posterior_observations', 'notes',
        )
        for field in text_fields:
            if field in request.data:
                setattr(evaluation, field, request.data.get(field, ''))

        if 'evaluation_date' in request.data:
            setattr(evaluation, 'evaluation_date', request.data.get('evaluation_date') or None)

        if 'recommendations' in request.data:
            value = request.data['recommendations']
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except (json.JSONDecodeError, ValueError):
                    pass
            evaluation.recommendations = value

        for photo_field in ('anterior_photo', 'lateral_right_photo', 'lateral_left_photo', 'posterior_photo'):
            photo = request.FILES.get(photo_field)
            if photo:
                setattr(evaluation, photo_field, photo)

    def put(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        self._apply_full_update(evaluation, request)
        evaluation.save()
        return Response(PosturometrySerializer(evaluation, context={'request': request}).data)

    def patch(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        self._apply_full_update(evaluation, request)
        evaluation.save()
        return Response(PosturometrySerializer(evaluation, context={'request': request}).data)

    def delete(self, request, customer_id, eval_id):
        evaluation, err = self._get_evaluation(request, customer_id, eval_id)
        if err:
            return err
        evaluation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Client endpoints ──

class ClientPosturometryListView(APIView):
    """List the authenticated client's own posturometry evaluations.

    GET /api/my-posturometry/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        evals = PosturometryEvaluation.objects.filter(
            customer=request.user,
        ).order_by('-created_at')
        return Response(PosturometrySerializer(evals, many=True, context={'request': request}).data)


class ClientPosturometryDetailView(APIView):
    """Get a specific posturometry evaluation belonging to the authenticated client.

    GET /api/my-posturometry/<eval_id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, eval_id):
        try:
            evaluation = PosturometryEvaluation.objects.get(
                id=eval_id, customer=request.user,
            )
        except PosturometryEvaluation.DoesNotExist:
            return Response({'detail': 'Evaluación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PosturometrySerializer(evaluation, context={'request': request}).data)
