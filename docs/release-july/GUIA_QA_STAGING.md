# Guía de QA — Staging Fase 2 (economía de créditos)

Documento técnico para el equipo de QA. Define **qué registros sembrar** en
staging y **con qué usuario/contraseña probar cada funcionalidad**, con la ruta
exacta de pantallas. Complementa a `GUIA_DE_VALIDACION.md` (esa es la explicación
no técnica para el cliente; esta es el setup reproducible para probar).

> **Importante:** en cada despliegue a staging hay que **sembrar los registros
> de abajo** en los usuarios de prueba; sin ellos las pantallas salen vacías y no
> se puede validar nada. Al final hay un snippet listo para pegar en el shell de
> Django.

---

## 1. Usuarios de prueba

| Rol | Email | Contraseña | Para probar |
|---|---|---|---|
| Entrenador | `german.franco@kore.com` | `password` | Parte 1: asistencia, test físico |
| Cliente | `customer1@kore.com` | `password` | Partes 2 y 3: check-in, cámara, créditos |

> El cliente `customer1` debe estar **asignado** al entrenador `german.franco`
> (`User.assigned_trainer`) y tener **suscripción activa**. Si al entrar te
> bloquea por suscripción vencida, renuévala (ver snippet §5).

---

## 2. Registros a sembrar por funcionalidad

### Parte 1 — Panel del entrenador
| Funcionalidad | Registros necesarios |
|---|---|
| Confirmar asistencia | Al menos **1 `Booking` pasado** (starts_at < ahora), `status=confirmed`, `attendance_status=unset`, del cliente asignado al trainer. |
| Test físico quincenal | El cliente debe estar **asignado** al trainer (`assigned_trainer`). |

### Parte 2 — Cliente: check-in, hábitos, cámara
| Funcionalidad | Registros necesarios |
|---|---|
| Check-in de 4 pasos | **Sin `MoodEntry` de hoy** para el cliente (si ya registró, el modal no abre). |
| Bloque "Hoy ganas" / pills | `CreditSettings` sembrado (valores por acción) — se auto-siembra al pedir `/api/credits/values/`. |
| Validación por cámara | Un **`MonthlyProgram` publicado** con un **`ProgramDay` de tipo `training` fechado HOY**, con ejercicios (con `youtube_url`). `require_workout_captures=True` (ya activado por migración). |

### Parte 3 — Cliente: balance, racha, historial
| Funcionalidad | Registros necesarios |
|---|---|
| Balance y pendiente | `CreditWallet` con `balance` y varias `CreditTransaction` (mezcla de `confirmed` y `pending`). |
| Racha y bono | `CreditWallet.current_streak` > 0 y `streak_bonuses` en `CreditSettings` (para calcular el próximo hito). |
| Historial | Varias `CreditTransaction` con distintos `action`/`status` y fechas escalonadas. |

### Parte 4 — Tienda interna y canjes
| Funcionalidad | Registros necesarios |
|---|---|
| Catálogo cliente | Varios `StoreItem` con `is_active=True`, `price_credits` variados y `item_type` distintos (al menos uno por encima del balance para ver "Sin saldo"). |
| Canjear | Cliente con `CreditWallet.balance` > 0 (créditos **confirmados**); el canje crea `RedemptionRequest` en `pending` y descuenta del balance. |
| Balance disponible vs. por aprobar | Mezcla de `CreditTransaction` `confirmed` (disponibles) y `pending` (por aprobar) para el mismo cliente. |
| Gestión trainer | `StoreItem` en catálogo + `RedemptionRequest` `pending` de un cliente **asignado** al trainer (para entregar/rechazar). |

---

## 3. Rutas de prueba paso a paso

### 3.1 Entrenador — Confirmar asistencia
1. Login `german.franco@kore.com` / `password`.
2. Tablero → widget **Agenda** → vista **Semana** → clic en el día de **hoy** (o el día de la sesión pasada).
3. En la sesión ya iniciada verás **✓ Asistió / ✗ No asistió**. Púlsalos → queda una etiqueta de estado.
4. Alterno: ficha del cliente (**Mis Clientes** → cliente) → **Sesiones recientes** → mismos botones.

### 3.2 Entrenador — Test físico quincenal
1. Login trainer → **Mis Clientes** → abre `customer1`.
2. Pestaña **Ev. Física** → sección **Test quincenal** → **Registrar test** → elige **Aprobado** → **Guardar test**.
3. Verifica que aparece como "Último test" con badge verde.

### 3.3 Cliente — Check-in de 4 pasos
1. Login `customer1@kore.com` / `password`.
2. Al entrar aparece el modal **"¿Cómo te sientes hoy?"** con la etiqueta **"+X créditos"**.
3. Toca: ánimo (1-10) → energía → dolor (sí/no) → **"¡Listo para entrenar!"**.
4. Confirma que sale "Registrado. ¡Gracias!" y la fila de check-in del hero queda marcada.

### 3.4 Cliente — Validación por cámara de la rutina
> **Requiere contexto seguro para la cámara**: `https://` o `localhost`. En staging con dominio HTTPS funciona directo; en la VM host-only con `http://IP` la cámara no abre (limitación del navegador).
1. Login cliente → tablero → **Iniciar rutina** (o "Entrenar ahora").
2. Primera vez: pantalla **"Validación de tu rutina"** → **Activar cámara** (acepta el permiso).
3. Durante cada ejercicio: fondo de cámara en espejo + señal **"● Validando tu rutina"**.
4. Al terminar: **"Rutina en validación · +X créditos cuando tu entrenador la apruebe"**.
5. Verificar que se guardaron capturas: `ls backend/media/workout_captures/` (deben aparecer .jpg).

### 3.5 Cliente — Balance, racha e historial (Parte 3)
1. Login cliente → tablero → arriba: **etiqueta de saldo** + **racha** (llamita).
2. Toca el saldo (o menú → **Mis créditos**).
3. Verifica: **balance dividido** en "Disponibles" y "Por aprobar", **anillo de racha** con días y progreso al bono, e **historial** con scroll (verde=ganado, rojo=perdido, ámbar=pendiente).

### 3.6 Cliente — Tienda: canjear un artículo (Parte 4)
1. Login `customer1@kore.com` / `password` → menú → **Tienda** (o "Más" en móvil).
2. Verifica el chip **"X disponibles"** (tus créditos confirmados) y la grilla de artículos.
3. Toca **Canjear** en un artículo que puedas pagar → confirma en **"¿Canjear …?"**.
4. Debe salir **"¡Canje solicitado!"** y el chip de disponibles baja el precio del artículo.
5. Menú → **Mis créditos** → verifica el split **Disponibles / Por aprobar** y la sección **Mis canjes** con estado **Pendiente**.

### 3.7 Entrenador — Tienda: gestionar catálogo y canjes (Parte 4)
1. Login `german.franco@kore.com` / `password` → menú → **Tienda**.
2. En **Solicitudes de canje** verás el canje de `customer1` (artículo, cliente, créditos).
3. Toca **Entregar** → desaparece de pendientes (al cliente le llega aviso y su canje pasa a **Entregado**).
4. Alterno: **Rechazar** → al cliente se le **devuelven** los créditos y su canje pasa a **Rechazado**.
5. En **Catálogo** agrega un artículo (nombre, precio, tipo) y usa el botón de estado para **Activo/Inactivo**.
6. Al **Entregar** un producto/servicio se abre un diálogo que **pide foto obligatoria**; sube una imagen y confirma.
7. Entra como el cliente a **Mis créditos → Mis canjes**: el canje entregado muestra **"Ver comprobante"** con la foto.

### 3.8 Cliente — Sesiones adicionales (Parte 6)
1. Login cliente → **Tienda** → canjea el artículo **"sesión adicional"** (pack).
2. El canje se marca **Entregado** de inmediato (no pasa por el entrenador).
3. **Mis créditos** → aparece **"Sesiones adicionales"** con la cantidad y **"vencen el …"** (1 mes).
4. **Reservar sesión** → arriba elige la fuente **"Sesiones adicionales"** y agenda; el contador baja al reservar.
5. Cancela esa reserva → la sesión vuelve al grant (el contador sube de nuevo).

---

## 4. Verificación del efecto en créditos (backend)

El crédito de rutina (`workout_day`) no aparece al instante: se genera en el
**cierre del día** (tarea Huey 23:57) como `pending`, y se **auto-confirma a los
3 días** si el trainer no lo revisa. Para forzar el cierre en QA:

```python
from django.utils import timezone
from core_app.services.credit_day_close import process_credits_day_close
process_credits_day_close(today=timezone.localdate())
```

---

## 5. Snippet de siembra (Django shell)

`cd backend && source venv/bin/activate && python manage.py shell`, luego pegar:

```python
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from core_app.models import User, Booking, Package, MoodEntry
from core_app.models.monthly_program import MonthlyProgram, ProgramDay, DailyLog
from core_app.models.nutrition_daily_log import NutritionDailyLog
from core_app.models.credit import CreditTransaction, CreditWallet

u = User.objects.get(email='customer1@kore.com')
german = User.objects.get(email='german.franco@kore.com')
tp = german.trainer_profile
today = timezone.localdate(); now = timezone.now()

# Asignación + limpieza del día
u.assigned_trainer = tp; u.save(update_fields=['assigned_trainer'])
MoodEntry.objects.filter(user=u, date=today).delete()
NutritionDailyLog.objects.filter(customer=u, date=today).delete()
DailyLog.objects.filter(customer=u, date=today).delete()

# Programa con día de entrenamiento HOY
p = MonthlyProgram.objects.filter(customer=u, status='published').order_by('-start_date').first()
if p:
    p.end_date = today + timedelta(days=14); p.save(update_fields=['end_date'])
    d = ProgramDay.objects.filter(program=p, day_type='training').order_by('day_number').first()
    if d: d.date = today; d.save(update_fields=['date'])

# Sesiones: pasada sin confirmar + futura
pkg = Package.objects.filter(is_active=True).first()
Booking.objects.create(customer=u, trainer=tp, package=pkg, starts_at=now-timedelta(hours=3), ends_at=now-timedelta(hours=2), status='confirmed')
Booking.objects.create(customer=u, trainer=tp, package=pkg, starts_at=now+timedelta(days=2), ends_at=now+timedelta(days=2, hours=1), status='confirmed')

# Economía de créditos (neta positiva, con historial variado)
CreditTransaction.objects.filter(customer=u).delete()
CreditWallet.objects.update_or_create(customer=u, defaults={'balance': 0, 'current_streak': 5, 'longest_streak': 9, 'last_active_date': today})
def mk(action, amount, status, desc, ref, days_ago):
    t = CreditTransaction.objects.create(customer=u, action=action, amount=amount, status=status, description=desc, reference_type='seed', reference_id=ref)
    CreditTransaction.objects.filter(pk=t.pk).update(created_at=now - timedelta(days=days_ago))
mk('checkin', 5, 'confirmed', 'Completaste tu check-in del lunes', 's1', 5)
mk('water_goal', 10, 'confirmed', 'Cumpliste tu meta de hidratación del lunes', 's2', 5)
mk('session_attended', 50, 'confirmed', 'Asististe a tu sesión del martes', 's3', 4)
mk('streak_bonus', 20, 'confirmed', '¡Racha de 3 días! Bono de constancia', 's4', 3)
mk('checkin', 5, 'confirmed', 'Completaste tu check-in del miércoles', 's5', 2)
mk('no_show_penalty', -40, 'confirmed', 'No asististe a tu sesión del jueves', 's6', 1)
mk('meal_photo', 5, 'confirmed', 'Registraste tu almuerzo del viernes', 's7', 1)
mk('workout_day', 15, 'pending', 'Completaste tu entrenamiento de hoy', 's8', 0)
bal = CreditTransaction.objects.filter(customer=u, status='confirmed').aggregate(s=Sum('amount'))['s'] or 0
CreditWallet.objects.filter(customer=u).update(balance=bal)
print('OK — balance:', bal)

# Tienda (Parte 4): catálogo con artículos accesibles y uno caro
from core_app.models.store import StoreItem
StoreItem.objects.get_or_create(name='Camiseta KÓRE', defaults={'description': 'Algodón premium', 'price_credits': 50, 'item_type': 'producto'})
StoreItem.objects.get_or_create(name='Botella KÓRE', defaults={'description': 'Termo 750ml', 'price_credits': 30, 'item_type': 'producto'})
StoreItem.objects.get_or_create(name='Sesión adicional (pack 3)', defaults={'description': '3 sesiones extra, 1 mes de vigencia', 'price_credits': 40, 'item_type': 'sesion_adicional', 'sessions_granted': 3})
print('OK — store items:', StoreItem.objects.filter(is_active=True).count())
```

> Ajusta emails/contraseñas si en staging los usuarios de prueba son otros.
> Idealmente esto se empaqueta como management command (`seed_qa_credits`) para
> correrlo con un solo comando en cada despliegue.
