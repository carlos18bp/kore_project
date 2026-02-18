from django.contrib.auth.hashers import make_password
from django.core import signing
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core_app.models import User
from core_app.serializers import LoginSerializer, RegisterUserSerializer, UserSerializer
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    return Response({'user': UserSerializer(request.user).data}, status=status.HTTP_200_OK)
