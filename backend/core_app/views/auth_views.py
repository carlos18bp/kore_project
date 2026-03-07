from django.contrib.auth.hashers import make_password
from django.core import signing
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core_app.models import MoodEntry, PasswordResetCode, User, WeightEntry
from core_app.serializers import LoginSerializer, RegisterUserSerializer, UserSerializer
from core_app.serializers.profile_serializers import (
    AvatarUploadSerializer,
    ChangePasswordSerializer,
    MoodEntrySerializer,
    ProfileResponseSerializer,
    UpdateProfileSerializer,
    WeightEntrySerializer,
)
from core_app.views.captcha_views import verify_recaptcha

REGISTRATION_TOKEN_SALT = 'kore-pre-register-v1'


@api_view(['POST'])
@permission_classes([AllowAny])
def pre_register_user(request):
    """Validate registration data and return a signed token for guest checkout.

    This endpoint does not create a user yet. It validates captcha + form data,
    then returns a short-lived signed token consumed by the checkout purchase
    endpoint. The user account is created only after payment approval.
    """
    captcha_token = request.data.get('captcha_token', '')
    if not verify_recaptcha(captcha_token):
        return Response(
            {'captcha_token': ['La verificación de reCAPTCHA falló.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = str(request.data.get('email', '')).strip().lower()
    if email and User.objects.filter(email=email).exists():
        return Response(
            {'email': ['Ya existe una cuenta con este correo.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = RegisterUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    validated = serializer.validated_data

    registration_token = signing.dumps(
        {
            'email': validated['email'],
            'first_name': validated['first_name'],
            'last_name': validated['last_name'],
            'phone': validated.get('phone', ''),
            'password_hash': make_password(validated['password']),
        },
        salt=REGISTRATION_TOKEN_SALT,
    )

    return Response({'registration_token': registration_token}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    captcha_token = request.data.get('captcha_token', '')
    if not verify_recaptcha(captcha_token):
        return Response(
            {'captcha_token': ['La verificación de reCAPTCHA falló.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = RegisterUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    refresh = RefreshToken.for_user(user)
    data = {
        'user': UserSerializer(user).data,
        'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)},
    }
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    captcha_token = request.data.get('captcha_token', '')
    if not verify_recaptcha(captcha_token):
        return Response(
            {'captcha_token': ['La verificación de reCAPTCHA falló.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']

    refresh = RefreshToken.for_user(user)
    data = {
        'user': UserSerializer(user).data,
        'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)},
    }
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    user = request.user
    if request.method == 'GET':
        serializer = ProfileResponseSerializer(user, context={'request': request})
        return Response({'user': serializer.data}, status=status.HTTP_200_OK)

    # PATCH
    serializer = UpdateProfileSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.update(user, serializer.validated_data)
    response = ProfileResponseSerializer(user, context={'request': request})
    return Response({'user': response.data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def upload_avatar(request):
    serializer = AvatarUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    from core_app.models import CustomerProfile
    profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
    profile.avatar = serializer.validated_data['avatar']
    profile.save(update_fields=['avatar', 'updated_at'])
    avatar_url = request.build_absolute_uri(profile.avatar.url) if profile.avatar else None
    return Response({'avatar_url': avatar_url}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'detail': 'Contraseña actualizada correctamente.'}, status=status.HTTP_200_OK)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def mood_view(request):
    today = timezone.localdate()
    if request.method == 'GET':
        entry = MoodEntry.objects.filter(user=request.user, date=today).first()
        if entry:
            return Response(MoodEntrySerializer(entry).data, status=status.HTTP_200_OK)
        return Response({'mood': None}, status=status.HTTP_200_OK)

    # POST — create or update today's mood
    serializer = MoodEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry, created = MoodEntry.objects.update_or_create(
        user=request.user,
        date=today,
        defaults={'mood': serializer.validated_data['mood']},
    )
    resp_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(MoodEntrySerializer(entry).data, status=resp_status)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def weight_view(request):
    serializer = WeightEntrySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    today = timezone.localdate()
    entry, created = WeightEntry.objects.update_or_create(
        user=request.user,
        date=today,
        defaults={'weight_kg': serializer.validated_data['weight_kg']},
    )
    resp_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(WeightEntrySerializer(entry).data, status=resp_status)


# ------------------------------------------------------------------
# Password reset via email verification code
# ------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset_code(request):
    """Send a 6-digit verification code to the user's email.

    Works for both unauthenticated (login forgot-password) and
    authenticated (profile change-password) flows.
    Accepts: { "email": "..." }
    Always returns 200 to avoid email enumeration.
    """
    from core_app.services.email_service import send_password_reset_code as send_code

    email = str(request.data.get('email', '')).strip().lower()
    if not email:
        return Response(
            {'detail': 'El campo email es requerido.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal whether the email exists
        return Response({'detail': 'Si el correo existe, recibirás un código.'}, status=status.HTTP_200_OK)

    reset_code = PasswordResetCode.create_for_user(user)
    send_code(user, reset_code.code)

    return Response({'detail': 'Si el correo existe, recibirás un código.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_password_reset_code(request):
    """Verify a 6-digit code and return a short-lived token for password reset.

    Accepts: { "email": "...", "code": "123456" }
    Returns: { "reset_token": "..." } on success.
    """
    email = str(request.data.get('email', '')).strip().lower()
    code = str(request.data.get('code', '')).strip()

    if not email or not code:
        return Response(
            {'detail': 'Email y código son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'detail': 'Código inválido o expirado.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    reset_code = PasswordResetCode.objects.filter(
        user=user, code=code, used=False,
    ).order_by('-created_at').first()

    if not reset_code or not reset_code.is_valid:
        return Response(
            {'detail': 'Código inválido o expirado.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Mark code as used
    reset_code.used = True
    reset_code.save(update_fields=['used', 'updated_at'])

    # Create a short-lived signed token for the actual password reset
    reset_token = signing.dumps(
        {'user_id': user.pk, 'email': user.email},
        salt='password-reset-v1',
    )

    return Response({'reset_token': reset_token}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_with_code(request):
    """Reset the user's password using a verified reset_token.

    Accepts: { "reset_token": "...", "new_password": "...", "new_password_confirm": "..." }
    """
    from django.contrib.auth.password_validation import validate_password

    reset_token = request.data.get('reset_token', '')
    new_password = request.data.get('new_password', '')
    new_password_confirm = request.data.get('new_password_confirm', '')

    if not reset_token or not new_password:
        return Response(
            {'detail': 'Token y nueva contraseña son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if new_password != new_password_confirm:
        return Response(
            {'detail': 'Las contraseñas no coinciden.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        payload = signing.loads(reset_token, salt='password-reset-v1', max_age=600)
    except signing.BadSignature:
        return Response(
            {'detail': 'Token inválido o expirado.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(pk=payload['user_id'], email=payload['email'])
    except User.DoesNotExist:
        return Response(
            {'detail': 'Token inválido o expirado.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(new_password, user)
    except Exception as e:
        return Response(
            {'detail': list(e.messages) if hasattr(e, 'messages') else str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save(update_fields=['password'])

    return Response({'detail': 'Contraseña actualizada correctamente.'}, status=status.HTTP_200_OK)
