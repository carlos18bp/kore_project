"""Custom DRF renderers."""
from rest_framework.renderers import JSONRenderer


class NullableJSONRenderer(JSONRenderer):
    """JSONRenderer that emits the literal JSON ``null`` (b'null') when the
    response data is ``None``, instead of DRF's default behavior of producing
    an empty body (0 bytes).

    Why: an empty body is surfaced by axios as the empty string ``""``, which
    slips past ``data ?? null`` on the frontend (an empty string is not
    *nullish*). Consumers that optional-chain with ``state?.foo.bar`` then
    crash because ``""?.foo`` accesses ``.foo`` on a string, returning
    ``undefined``, and ``undefined.bar`` throws. Returning ``null`` literally
    on the wire makes axios surface ``data === null`` and the frontend's
    ``?? null`` works as intended.

    Use on views whose contract documents "200 OK + null when the resource is
    empty/unavailable" (the customer-facing my-program / projection /
    weekly-summary / nutrition-plan endpoints).
    """

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b'null'
        return super().render(data, accepted_media_type, renderer_context)
