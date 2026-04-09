"""Tests for the maintain_availability_slots Huey periodic task."""

from unittest.mock import patch

from core_app.tasks import maintain_availability_slots


class TestMaintainAvailabilitySlots:
    """Covers the maintain_availability_slots task body."""

    def test_calls_maintain_slots_management_command(self):
        """Delegates slot maintenance to the maintain_slots management command."""
        with patch('django.core.management.call_command') as mock_call:
            maintain_availability_slots.call_local()
        assert mock_call.call_count == 1
        assert mock_call.call_args.args == ('maintain_slots',)
        assert mock_call.call_args.kwargs == {'timezone': 'America/Bogota'}

    def test_logs_completion_after_command(self):
        """Logs a completion message after delegating to the management command."""
        with patch('django.core.management.call_command'), \
             patch('core_app.tasks.logger') as mock_logger:
            maintain_availability_slots.call_local()
        assert mock_logger.info.call_count == 1
        assert mock_logger.info.call_args.args == ('maintain_availability_slots task completed',)
