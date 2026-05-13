import secrets
import string


def generate_temporary_password(length: int = 12) -> str:
    """Random URL-safe password for admin-issued accounts.

    Uses :mod:`secrets` for cryptographic randomness. The alphabet
    excludes punctuation to avoid copy/paste edge cases when the user
    receives the password via email.
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
