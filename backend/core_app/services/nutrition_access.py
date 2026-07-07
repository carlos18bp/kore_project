def has_nutrition_access(user) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    from core_app.models import Subscription
    return Subscription.objects.filter(
        customer=user, status=Subscription.Status.ACTIVE, includes_nutrition=True,
    ).exists()


def active_nutrition_price():
    from core_app.models.nutrition_product import NutritionProduct
    product = NutritionProduct.objects.filter(is_active=True).first()
    return product.price_cop if product else None
