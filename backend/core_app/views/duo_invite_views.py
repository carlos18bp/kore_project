from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from core_app.models import SubscriptionGuest, User


@api_view(['POST'])
@permission_classes([AllowAny])
def accept_invite(request):
    """Accept a duo plan invitation via token.

    Body: { "token": "abc123..." }

    Possible responses:
      - 200 { accepted: true, subscription_id, host_name, package_title }
      - 200 { requires_login: true, invited_email, token }
      - 200 { requires_registration: true, invited_email, token }
      - 404 if token not found
      - 400 if token is revoked
    """
    token = str(request.data.get('token', '')).strip()
    if not token:
        return Response({'detail': 'El campo token es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        guest_link = SubscriptionGuest.objects.select_related(
            'subscription__customer', 'subscription__package'
        ).get(token=token)
    except SubscriptionGuest.DoesNotExist:
        return Response({'detail': 'Invitación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

    if guest_link.status == SubscriptionGuest.STATUS_REVOKED:
        return Response({'detail': 'Esta invitación ha sido revocada.'}, status=status.HTTP_400_BAD_REQUEST)

    invited_email = guest_link.invited_email.lower()

    if request.user.is_authenticated:
        if request.user.email.lower() != invited_email:
            return Response(
                {'detail': 'Esta invitación no corresponde a tu cuenta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        guest_link.guest = request.user
        guest_link.status = SubscriptionGuest.STATUS_ACCEPTED
        guest_link.accepted_at = timezone.now()
        guest_link.save(update_fields=['guest', 'status', 'accepted_at', 'updated_at'])

        host = guest_link.subscription.customer
        host_name = f'{host.first_name} {host.last_name}'.strip() or host.email
        return Response({
            'accepted': True,
            'subscription_id': guest_link.subscription_id,
            'host_name': host_name,
            'package_title': guest_link.subscription.package.title,
        })

    existing_user = User.objects.filter(email=invited_email).first()
    if existing_user:
        return Response({
            'requires_login': True,
            'invited_email': invited_email,
            'token': token,
        })

    return Response({
        'requires_registration': True,
        'invited_email': invited_email,
        'token': token,
    })
