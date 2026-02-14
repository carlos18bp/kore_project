import pytest

from core_app.forms import UserCreationForm
from core_app.models import User


@pytest.mark.django_db
class TestUserCreationForm:
    def test_passwords_match_valid(self):
        """Happy path: matching passwords pass validation (lines 15-20)."""
        form = UserCreationForm(data={
            'email': 'formtest@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'role': 'customer',
            'password1': 'securepass123',
            'password2': 'securepass123',
        })
        assert form.is_valid(), form.errors

    def test_passwords_mismatch_rejected(self):
        """Mismatched passwords raise ValidationError (lines 16-19)."""
        form = UserCreationForm(data={
            'email': 'formtest2@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'password1': 'securepass123',
            'password2': 'differentpass',
        })
        assert not form.is_valid()
        assert 'password2' in form.errors

    def test_save_commit_true(self):
        """save(commit=True) persists user to DB (lines 22-27)."""
        form = UserCreationForm(data={
            'email': 'formcommit@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'role': 'customer',
            'password1': 'securepass123',
            'password2': 'securepass123',
        })
        assert form.is_valid(), form.errors
        user = form.save(commit=True)

        assert user.pk is not None
        assert user.check_password('securepass123')
        assert User.objects.filter(email='formcommit@example.com').exists()

    def test_save_commit_false(self):
        """save(commit=False) returns unsaved user (lines 23-24)."""
        form = UserCreationForm(data={
            'email': 'formnocommit@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'role': 'customer',
            'password1': 'securepass123',
            'password2': 'securepass123',
        })
        assert form.is_valid(), form.errors
        user = form.save(commit=False)

        assert user.pk is None
        assert user.check_password('securepass123')
        assert not User.objects.filter(email='formnocommit@example.com').exists()
