"""Tests for email_service.py — covers exception handling path (lines 70-72)."""

import pytest
from unittest.mock import patch, MagicMock

from core_app.services.email_service import send_template_email


@pytest.mark.django_db
class TestSendTemplateEmail:
    @patch('core_app.services.email_service.EmailMessage')
    @patch('core_app.services.email_service.render_to_string', return_value='<html></html>')
    def test_send_failure_returns_false(self, mock_render, mock_email_cls):
        """Email send() exception is caught and returns False (lines 70-72)."""
        mock_instance = MagicMock()
        mock_instance.send.side_effect = Exception('SMTP failure')
        mock_email_cls.return_value = mock_instance

        result = send_template_email(
            template_name='booking_confirmation',
            subject='Test',
            to_emails=['test@example.com'],
        )

        assert result is False
        mock_instance.send.assert_called_once()

    @patch('core_app.services.email_service.EmailMessage')
    @patch('core_app.services.email_service.render_to_string', return_value='<html></html>')
    def test_send_success_returns_true(self, mock_render, mock_email_cls):
        """Successful send returns True."""
        mock_instance = MagicMock()
        mock_instance.send.return_value = 1
        mock_email_cls.return_value = mock_instance

        result = send_template_email(
            template_name='booking_confirmation',
            subject='Test',
            to_emails=['test@example.com'],
            attachments=[('file.ics', b'data', 'text/calendar')],
        )

        assert result is True
