from django.urls import path

from core_app.views import get_user_profile, login_user, pre_register_user, register_user

urlpatterns = [
    path('pre-register/', pre_register_user, name='pre-register-user'),
    path('register/', register_user, name='register-user'),
    path('login/', login_user, name='login-user'),
    path('profile/', get_user_profile, name='get-user-profile'),
]
