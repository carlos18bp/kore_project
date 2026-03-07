from django.urls import path

from core_app.views import (
    change_password,
    get_user_profile,
    login_user,
    mood_view,
    pre_register_user,
    register_user,
    request_password_reset_code,
    reset_password_with_code,
    upload_avatar,
    verify_password_reset_code,
    weight_view,
)

urlpatterns = [
    path('pre-register/', pre_register_user, name='pre-register-user'),
    path('register/', register_user, name='register-user'),
    path('login/', login_user, name='login-user'),
    path('profile/', get_user_profile, name='get-user-profile'),
    path('profile/avatar/', upload_avatar, name='upload-avatar'),
    path('change-password/', change_password, name='change-password'),
    path('mood/', mood_view, name='mood'),
    path('weight/', weight_view, name='weight'),
    path('password-reset/request-code/', request_password_reset_code, name='password-reset-request-code'),
    path('password-reset/verify-code/', verify_password_reset_code, name='password-reset-verify-code'),
    path('password-reset/reset/', reset_password_with_code, name='password-reset-reset'),
]
