"""Views for terms and conditions acceptance tracking."""

import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.terms_acceptance import CURRENT_TERMS_VERSION, TermsAcceptance

logger = logging.getLogger(__name__)


def _get_client_ip(request):
    """Extract the real client IP from the request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


class TermsAcceptanceStatusView(APIView):
    """Check whether the current user has accepted the latest terms version.

    GET /api/terms-acceptance/status/
    Returns: {"accepted": true/false, "terms_version": "v1.0"}
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        accepted = TermsAcceptance.objects.filter(
            user=request.user,
            terms_version=CURRENT_TERMS_VERSION,
        ).exists()
        return Response({
            'accepted': accepted,
            'terms_version': CURRENT_TERMS_VERSION,
        })


class TermsAcceptanceCreateView(APIView):
    """Record the user's acceptance of the current terms version.

    POST /api/terms-acceptance/accept/
    Returns: {"accepted": true, "terms_version": "v1.0", "accepted_at": ...}
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ip_address = _get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        acceptance, created = TermsAcceptance.objects.get_or_create(
            user=request.user,
            terms_version=CURRENT_TERMS_VERSION,
            defaults={
                'ip_address': ip_address,
                'user_agent': user_agent,
                'accepted_at': timezone.now(),
            },
        )

        if created:
            logger.info(
                'Terms %s accepted by %s from IP %s',
                CURRENT_TERMS_VERSION,
                request.user.email,
                ip_address,
            )

        return Response(
            {
                'accepted': True,
                'terms_version': acceptance.terms_version,
                'accepted_at': acceptance.accepted_at.isoformat(),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
