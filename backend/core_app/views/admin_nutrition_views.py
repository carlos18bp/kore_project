"""Admin-only management of the nutrition add-on price (a single active row)."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription
from core_app.models.nutrition_product import NutritionProduct
from core_app.permissions import IsAdminRole
from core_app.serializers.nutrition_product_serializers import NutritionProductSerializer

DEFAULT_NAME = 'Nutrición'
DEFAULT_PRICE_COP = 0


def _load_product() -> NutritionProduct:
    """Return the add-on row, preferring the active one, creating it if absent.

    An inactive-only row is reused rather than shadowed by a new one, so the
    admin can reactivate it instead of silently accumulating duplicates.
    """
    product = (
        NutritionProduct.objects.filter(is_active=True).first()
        or NutritionProduct.objects.order_by('-created_at').first()
    )
    if product:
        return product
    return NutritionProduct.objects.create(
        name=DEFAULT_NAME, price_cop=DEFAULT_PRICE_COP, is_active=True,
    )


def _active_nutrition_subscriptions() -> int:
    return Subscription.objects.filter(
        status=Subscription.Status.ACTIVE, includes_nutrition=True,
    ).count()


class AdminNutritionProductView(APIView):
    """GET/PATCH /api/admin/nutrition-product/

    `nutrition_surcharge()` reads this price at charge time, so a change here
    hits every nutrition subscriber's next renewal. `active_nutrition_subscriptions`
    is the blast radius the admin UI confirms against before saving.
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        return Response(self._payload(NutritionProductSerializer(_load_product()).data))

    def patch(self, request):
        serializer = NutritionProductSerializer(_load_product(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self._payload(serializer.data))

    def _payload(self, data):
        return {**data, 'active_nutrition_subscriptions': _active_nutrition_subscriptions()}
