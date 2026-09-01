from rest_framework import serializers

from core_app.models.session_rating import SessionRating


class SessionRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionRating
        # rater_role is derived from the requesting user in the view, never accepted
        # from the client — otherwise anyone could forge a "trainer" rating.
        fields = ('id', 'booking', 'rater_role', 'score', 'comment', 'created_at')
        read_only_fields = ('id', 'booking', 'rater_role', 'created_at')

    def validate_score(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('La calificación debe estar entre 1 y 5.')
        return value
