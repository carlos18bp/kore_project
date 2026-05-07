"""
Trainer Intelligence Center views.

Endpoints for risk dashboard, KPI per client, alerts, photo gallery,
comparative metrics, trainer messages, program pause/resume, and daily logs.
"""
from datetime import date, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Booking, ClientRiskScore, TrainerAlertResolution, TrainerMessage, User
from core_app.permissions import IsTrainerRole


def _get_trainer_profile(request):
    """Return trainer_profile or None."""
    return getattr(request.user, 'trainer_profile', None)


def _get_trainer_customer(trainer_profile, customer_id):
    """Return customer User if they belong to this trainer, else None."""
    has_booking = Booking.objects.filter(
        trainer=trainer_profile, customer_id=customer_id
    ).exists()
    if not has_booking:
        return None
    try:
        return User.objects.get(pk=customer_id, role=User.Role.CUSTOMER)
    except User.DoesNotExist:
        return None


def _trainer_customer_ids(trainer_profile):
    return list(
        Booking.objects.filter(trainer=trainer_profile)
        .values_list('customer_id', flat=True)
        .distinct()
    )


# ── Risk Dashboard ────────────────────────────────────────────────────────────

class TrainerRiskDashboardView(APIView):
    """GET /api/trainer/risk-dashboard/

    Returns current (non-stale) risk scores for all trainer's clients,
    sorted alto → medio → bajo → sin_riesgo, with a summary count.
    """
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        level_order = {
            ClientRiskScore.Level.ALTO: 0,
            ClientRiskScore.Level.MEDIO: 1,
            ClientRiskScore.Level.BAJO: 2,
            ClientRiskScore.Level.SIN_RIESGO: 3,
        }

        # Latest non-stale score per customer
        customer_ids = _trainer_customer_ids(trainer)
        scores = (
            ClientRiskScore.objects
            .filter(trainer=trainer, customer_id__in=customer_ids, is_stale=False)
            .select_related('customer')
            .order_by('customer_id', '-computed_at')
        )
        # Deduplicate: keep first (latest) per customer
        seen = set()
        unique_scores = []
        for s in scores:
            if s.customer_id not in seen:
                seen.add(s.customer_id)
                unique_scores.append(s)

        unique_scores.sort(key=lambda s: level_order.get(s.level, 99))

        summary = {
            'alto': sum(1 for s in unique_scores if s.level == ClientRiskScore.Level.ALTO),
            'medio': sum(1 for s in unique_scores if s.level == ClientRiskScore.Level.MEDIO),
            'bajo': sum(1 for s in unique_scores if s.level == ClientRiskScore.Level.BAJO),
            'sin_riesgo': sum(1 for s in unique_scores if s.level == ClientRiskScore.Level.SIN_RIESGO),
        }

        clients_by_risk = [
            {
                'customer_id': s.customer_id,
                'name': f'{s.customer.first_name} {s.customer.last_name}',
                'avatar_url': s.customer.avatar_url if hasattr(s.customer, 'avatar_url') else None,
                'level': s.level,
                'signals_count': len(s.behavioral_signals) + len(s.clinical_signals),
                'last_computed': s.computed_at.isoformat(),
                'kore_score': float(s.kore_score) if s.kore_score is not None else None,
            }
            for s in unique_scores
        ]

        return Response({'risk_summary': summary, 'clients_by_risk': clients_by_risk})


# ── Client KPI ────────────────────────────────────────────────────────────────

class TrainerClientKPIView(APIView):
    """GET /api/trainer/my-clients/<customer_id>/kpi/

    Returns behavioral (7-day adherence, streak) and clinical (evaluations snapshot) KPIs.
    """
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models import (
            AnthropometryEvaluation, MoodEntry, NutritionHabit,
            PhysicalEvaluation, PosturometryEvaluation, Subscription,
        )
        from core_app.models.monthly_program import DailyLog, MonthlyProgram, ProgramDay
        from core_app.models.nutrition_daily_log import NutritionDailyLog
        from core_app.services.adherence_calculator import (
            compute_combined_adherence, compute_nutrition_adherence,
            compute_streak, compute_training_adherence,
        )

        today = date.today()
        seven_days_ago = today - timedelta(days=7)

        program = (
            MonthlyProgram.objects
            .filter(customer=customer, status=MonthlyProgram.Status.PUBLISHED)
            .order_by('-start_date').first()
        )

        # Behavioral KPIs
        training_7d = 0.0
        nutrition_7d = 0.0
        combined_7d = 0.0
        streak_current = 0
        streak_longest = 0
        last_activity_date = None
        daily_combined_list = []

        if program:
            program_days = list(
                ProgramDay.objects
                .filter(program=program, date__range=(program.start_date, today))
                .prefetch_related('exercises').order_by('date')
            )
            daily_logs_map = {
                log.date: log for log in
                DailyLog.objects.filter(customer=customer, date__range=(program.start_date, today))
                .prefetch_related('exercise_logs')
            }
            nutrition_map = {
                log.date: log for log in
                NutritionDailyLog.objects.filter(customer=customer, date__range=(program.start_date, today))
                .prefetch_related('meal_entries')
            }

            for pd in program_days:
                dl = daily_logs_map.get(pd.date)
                nl = nutrition_map.get(pd.date)
                ex_logs = list(dl.exercise_logs.all()) if dl else []
                meal_entries = list(nl.meal_entries.all()) if nl else []
                t = compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
                n = compute_nutrition_adherence(meal_entries)
                c = compute_combined_adherence(t, n)
                daily_combined_list.append((pd.date, c))

                if any(e.status == 'completed' for e in ex_logs):
                    last_activity_date = pd.date.isoformat()

            streak_result = compute_streak(daily_combined_list)
            streak_current = streak_result.current
            streak_longest = streak_result.longest

            recent_7d = [c for d, c in daily_combined_list if d >= seven_days_ago]
            if recent_7d:
                training_7d = round(sum(
                    compute_training_adherence(
                        list(daily_logs_map[pd.date].exercise_logs.all()) if daily_logs_map.get(pd.date) else [],
                        pd.day_type,
                        len(pd.exercises.all()),
                    )
                    for pd in program_days if pd.date >= seven_days_ago
                ) / len([pd for pd in program_days if pd.date >= seven_days_ago]), 4)
                nutrition_7d = round(sum(
                    compute_nutrition_adherence(
                        list(nutrition_map[pd.date].meal_entries.all()) if nutrition_map.get(pd.date) else []
                    )
                    for pd in program_days if pd.date >= seven_days_ago
                ) / len([pd for pd in program_days if pd.date >= seven_days_ago]), 4)
                combined_7d = round(sum(recent_7d) / len(recent_7d), 4)

        sub = (
            Subscription.objects.filter(customer=customer, status='active')
            .order_by('-starts_at').first()
        )
        last_mood = MoodEntry.objects.filter(user=customer).order_by('-date').values_list('score', flat=True).first()

        # Clinical KPIs
        latest_anthro = AnthropometryEvaluation.objects.filter(customer=customer).order_by('-evaluation_date').first()
        latest_posturo = PosturometryEvaluation.objects.filter(customer=customer).order_by('-evaluation_date').first()
        latest_physical = PhysicalEvaluation.objects.filter(customer=customer).order_by('-evaluation_date').first()
        latest_nutrition = NutritionHabit.objects.filter(customer=customer).order_by('-created_at').first()

        kore_score = None
        kore_color = 'gray'
        kore_category = 'Sin datos'
        if latest_anthro or latest_posturo or latest_physical:
            from core_app.services.kore_index_calculator import compute_kore_index
            kore_result = compute_kore_index(
                anthropometry=latest_anthro,
                posturometry=latest_posturo,
                physical=latest_physical,
                mood_score=last_mood,
                nutrition_habit_score=float(latest_nutrition.habit_score) if latest_nutrition else None,
            )
            kore_score = kore_result.get('score')
            kore_color = kore_result.get('color', 'gray')
            kore_category = kore_result.get('category', 'Sin datos')

        from core_app.models import ParqAssessment
        last_eval_dates = {
            'anthropometry': latest_anthro.evaluation_date.isoformat() if latest_anthro else None,
            'posturometry': latest_posturo.evaluation_date.isoformat() if latest_posturo else None,
            'physical': latest_physical.evaluation_date.isoformat() if latest_physical else None,
            'parq': ParqAssessment.objects.filter(customer=customer).order_by('-evaluation_date').values_list('evaluation_date', flat=True).first(),
            'nutrition': latest_nutrition.created_at.date().isoformat() if latest_nutrition else None,
        }
        if last_eval_dates['parq']:
            last_eval_dates['parq'] = last_eval_dates['parq'].isoformat()

        return Response({
            'behavioral': {
                'training_adherence_7d': training_7d,
                'nutrition_adherence_7d': nutrition_7d,
                'combined_adherence_7d': combined_7d,
                'streak_current': streak_current,
                'streak_longest': streak_longest,
                'sessions_completed': Booking.objects.filter(trainer=trainer, customer=customer, status='confirmed').count(),
                'sessions_remaining': sub.sessions_remaining if sub else 0,
                'last_activity_date': last_activity_date,
                'last_mood_score': last_mood,
            },
            'clinical': {
                'kore_score': kore_score,
                'kore_color': kore_color,
                'kore_category': kore_category,
                'bmi': float(latest_anthro.bmi) if latest_anthro and latest_anthro.bmi else None,
                'bmi_color': latest_anthro.bmi_color if latest_anthro else '',
                'body_fat_pct': float(latest_anthro.body_fat_pct) if latest_anthro and latest_anthro.body_fat_pct else None,
                'bf_color': latest_anthro.bf_color if latest_anthro else '',
                'global_postural_index': float(latest_posturo.global_index) if latest_posturo and latest_posturo.global_index else None,
                'postural_color': latest_posturo.global_color if latest_posturo and hasattr(latest_posturo, 'global_color') else '',
                'physical_general_index': float(latest_physical.general_index) if latest_physical and latest_physical.general_index else None,
                'physical_color': latest_physical.general_color if latest_physical and hasattr(latest_physical, 'general_color') else '',
                'nutrition_habit_score': float(latest_nutrition.habit_score) if latest_nutrition else None,
                'nutrition_color': 'green' if latest_nutrition and latest_nutrition.habit_score >= 7 else ('amber' if latest_nutrition and latest_nutrition.habit_score >= 4 else 'red') if latest_nutrition else 'gray',
                'last_eval_dates': last_eval_dates,
            },
        })


# ── Comparative Metrics ───────────────────────────────────────────────────────

class TrainerComparativeMetricsView(APIView):
    """GET /api/trainer/comparative-metrics/

    Returns adherence ranking for all clients, improved/worsened this week,
    global patterns, and expired evaluations.
    """
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models import AnthropometryEvaluation, NutritionHabit, ParqAssessment, PhysicalEvaluation, PosturometryEvaluation
        from core_app.models.monthly_program import DailyLog, MonthlyProgram, ProgramDay
        from core_app.models.nutrition_daily_log import NutritionDailyLog
        from core_app.services.adherence_calculator import (
            compute_combined_adherence, compute_nutrition_adherence, compute_training_adherence,
        )

        today = date.today()
        this_week_start = today - timedelta(days=6)
        last_week_start = today - timedelta(days=13)

        customer_ids = _trainer_customer_ids(trainer)
        customers = User.objects.filter(id__in=customer_ids, role=User.Role.CUSTOMER)

        ranking = []
        global_training = []
        global_nutrition = []
        missed_days_count: dict[int, int] = {}  # weekday → miss count

        for customer in customers:
            program = (
                MonthlyProgram.objects
                .filter(customer=customer, status=MonthlyProgram.Status.PUBLISHED)
                .order_by('-start_date').first()
            )
            if not program:
                continue

            def _week_avg(start, end):
                pdays = list(
                    ProgramDay.objects
                    .filter(program=program, date__range=(start, end))
                    .prefetch_related('exercises').order_by('date')
                )
                if not pdays:
                    return None, None, []
                dlogs = {
                    l.date: l for l in
                    DailyLog.objects.filter(customer=customer, date__range=(start, end))
                    .prefetch_related('exercise_logs')
                }
                nlogs = {
                    l.date: l for l in
                    NutritionDailyLog.objects.filter(customer=customer, date__range=(start, end))
                    .prefetch_related('meal_entries')
                }
                combined_list = []
                missed = []
                for pd in pdays:
                    dl = dlogs.get(pd.date)
                    nl = nlogs.get(pd.date)
                    ex = list(dl.exercise_logs.all()) if dl else []
                    me = list(nl.meal_entries.all()) if nl else []
                    t = compute_training_adherence(ex, pd.day_type, len(pd.exercises.all()))
                    n = compute_nutrition_adherence(me)
                    c = compute_combined_adherence(t, n)
                    combined_list.append(c)
                    if c < 0.5 and pd.day_type == 'training':
                        missed.append(pd.date.weekday())
                avg = round(sum(combined_list) / len(combined_list), 4) if combined_list else 0.0
                t_avg = round(sum(
                    compute_training_adherence(
                        list(dlogs[pd.date].exercise_logs.all()) if dlogs.get(pd.date) else [],
                        pd.day_type,
                        len(pd.exercises.all()),
                    ) for pd in pdays
                ) / len(pdays), 4)
                n_avg = round(sum(
                    compute_nutrition_adherence(
                        list(nlogs[pd.date].meal_entries.all()) if nlogs.get(pd.date) else []
                    ) for pd in pdays
                ) / len(pdays), 4)
                return avg, (t_avg, n_avg), missed

            this_avg, this_detail, this_missed = _week_avg(this_week_start, today)
            last_avg, _, _ = _week_avg(last_week_start, this_week_start - timedelta(days=1))

            if this_avg is None:
                continue

            delta = round(this_avg - last_avg, 4) if last_avg is not None else 0.0
            trend = 'improving' if delta > 0.05 else ('declining' if delta < -0.05 else 'stable')

            ranking.append({
                'customer_id': customer.pk,
                'name': f'{customer.first_name} {customer.last_name}',
                'avatar_url': getattr(customer, 'avatar_url', None),
                'combined_7d': this_avg,
                'delta_vs_last_week': delta,
                'trend': trend,
            })

            if this_detail:
                global_training.append(this_detail[0])
                global_nutrition.append(this_detail[1])
            for wd in this_missed:
                missed_days_count[wd] = missed_days_count.get(wd, 0) + 1

        ranking.sort(key=lambda r: r['combined_7d'], reverse=True)
        improved = [r for r in ranking if r['delta_vs_last_week'] > 0.05]
        worsened = [r for r in ranking if r['delta_vs_last_week'] < -0.05]

        day_names = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
        most_missed = day_names[max(missed_days_count, key=missed_days_count.get)] if missed_days_count else None

        # Expired evaluations
        THRESHOLDS = {'anthropometry': 60, 'posturometry': 60, 'physical': 60, 'parq': 90}
        LABELS = {'anthropometry': 'Antropometría', 'posturometry': 'Posturometría', 'physical': 'Evaluación física', 'parq': 'PAR-Q+'}
        expired_evals = []
        for cid in customer_ids:
            try:
                c = User.objects.get(pk=cid)
            except User.DoesNotExist:
                continue
            for module, threshold in THRESHOLDS.items():
                if module == 'anthropometry':
                    last = AnthropometryEvaluation.objects.filter(customer_id=cid).order_by('-evaluation_date').values_list('evaluation_date', flat=True).first()
                elif module == 'posturometry':
                    last = PosturometryEvaluation.objects.filter(customer_id=cid).order_by('-evaluation_date').values_list('evaluation_date', flat=True).first()
                elif module == 'physical':
                    last = PhysicalEvaluation.objects.filter(customer_id=cid).order_by('-evaluation_date').values_list('evaluation_date', flat=True).first()
                else:
                    last_dt = ParqAssessment.objects.filter(customer_id=cid).order_by('-created_at').values_list('created_at', flat=True).first()
                    last = last_dt.date() if last_dt is not None else None

                if last is None:
                    days_since = threshold + 1
                else:
                    days_since = (today - last).days

                if days_since > threshold:
                    expired_evals.append({
                        'customer_id': cid,
                        'name': f'{c.first_name} {c.last_name}',
                        'module': module,
                        'module_label': LABELS[module],
                        'days_since': days_since,
                        'urgency': 'alto' if days_since > threshold * 2 else 'medio',
                    })

        # Most failed exercises and meal blocks (last 7 days)
        from core_app.models.monthly_program import ExerciseLog
        from core_app.models.nutrition_daily_log import MealEntry
        from django.db.models import Count

        most_failed_exercises = list(
            ExerciseLog.objects
            .filter(
                status=ExerciseLog.Status.SKIPPED,
                daily_log__customer_id__in=customer_ids,
                daily_log__date__range=(this_week_start, today),
            )
            .values('program_exercise__exercise__name')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        most_failed_exercises = [
            {'name': e['program_exercise__exercise__name'], 'count': e['count']}
            for e in most_failed_exercises
        ]

        meal_block_labels = dict(MealEntry.MealBlock.choices)
        most_failed_meal_blocks = list(
            MealEntry.objects
            .filter(
                status=MealEntry.Status.SKIPPED,
                daily_log__customer_id__in=customer_ids,
                daily_log__date__range=(this_week_start, today),
            )
            .values('meal_block')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        most_failed_meal_blocks = [
            {
                'block': m['meal_block'],
                'block_label': meal_block_labels.get(m['meal_block'], m['meal_block']),
                'count': m['count'],
            }
            for m in most_failed_meal_blocks
        ]

        return Response({
            'adherence_ranking': ranking,
            'improved_this_week': improved,
            'worsened_this_week': worsened,
            'global_patterns': {
                'avg_training_adherence': round(sum(global_training) / len(global_training), 4) if global_training else 0.0,
                'avg_nutrition_adherence': round(sum(global_nutrition) / len(global_nutrition), 4) if global_nutrition else 0.0,
                'most_missed_day_of_week': most_missed,
            },
            'most_failed_exercises': most_failed_exercises,
            'most_failed_meal_blocks': most_failed_meal_blocks,
            'expired_evaluations': sorted(expired_evals, key=lambda e: e['days_since'], reverse=True),
        })


# ── Alert Center ──────────────────────────────────────────────────────────────

class TrainerAlertCenterView(APIView):
    """GET /api/trainer/alerts/?resolved=false&level=alto,medio"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        resolved_param = request.query_params.get('resolved', 'false').lower()
        level_param = request.query_params.get('level', '')

        qs = (
            ClientRiskScore.objects
            .filter(trainer=trainer, is_stale=False)
            .exclude(level=ClientRiskScore.Level.SIN_RIESGO)
            .select_related('customer')
            .prefetch_related('resolutions')
            .order_by('-computed_at')
        )

        if level_param:
            levels = [l.strip() for l in level_param.split(',')]
            qs = qs.filter(level__in=levels)

        alerts = []
        for score in qs:
            resolutions = [
                {
                    'id': r.pk,
                    'signal_type': r.signal_type,
                    'resolution_type': r.resolution_type,
                    'note': r.note,
                    'is_public': r.is_public,
                    'resolved_at': r.resolved_at.isoformat(),
                }
                for r in score.resolutions.all()
            ]
            alerts.append({
                'id': score.pk,
                'customer_id': score.customer_id,
                'customer_name': f'{score.customer.first_name} {score.customer.last_name}',
                'avatar_url': getattr(score.customer, 'avatar_url', None),
                'level': score.level,
                'computed_at': score.computed_at.isoformat(),
                'behavioral_signals': score.behavioral_signals,
                'clinical_signals': score.clinical_signals,
                'resolutions': resolutions,
            })

        total_alto = sum(1 for a in alerts if a['level'] == ClientRiskScore.Level.ALTO)
        return Response({'alerts': alerts, 'total_unresolved_alto': total_alto})


class TrainerAlertResolveView(APIView):
    """POST /api/trainer/alerts/<risk_score_id>/resolve/"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def post(self, request, risk_score_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            score = ClientRiskScore.objects.get(pk=risk_score_id, trainer=trainer)
        except ClientRiskScore.DoesNotExist:
            return Response({'detail': 'Alerta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        signal_type = request.data.get('signal_type', '')
        resolution_type = request.data.get('resolution_type', '')
        note = request.data.get('note', '').strip()
        is_public = bool(request.data.get('is_public', False))

        valid_types = [c[0] for c in TrainerAlertResolution.ResolutionType.choices]
        if not note:
            return Response({'detail': 'La nota es obligatoria.'}, status=status.HTTP_400_BAD_REQUEST)
        if resolution_type not in valid_types:
            return Response({'detail': f'Tipo de resolución inválido. Opciones: {valid_types}'}, status=status.HTTP_400_BAD_REQUEST)

        resolution = TrainerAlertResolution.objects.create(
            risk_score=score,
            trainer=trainer,
            signal_type=signal_type,
            resolution_type=resolution_type,
            note=note,
            is_public=is_public,
        )
        return Response({
            'id': resolution.pk,
            'signal_type': resolution.signal_type,
            'resolution_type': resolution.resolution_type,
            'note': resolution.note,
            'is_public': resolution.is_public,
            'resolved_at': resolution.resolved_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


# ── Photo Gallery ─────────────────────────────────────────────────────────────

class TrainerPhotoGalleryView(APIView):
    """GET /api/trainer/photo-gallery/?customer_id=X"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.nutrition_daily_log import MealEntry, NutritionDailyLog

        customer_ids = _trainer_customer_ids(trainer)
        customer_id_param = request.query_params.get('customer_id')
        if customer_id_param:
            customer_ids = [int(customer_id_param)] if int(customer_id_param) in customer_ids else []

        entries = (
            MealEntry.objects
            .filter(
                daily_log__customer_id__in=customer_ids,
                photo__isnull=False,
            )
            .exclude(photo='')
            .select_related('daily_log__customer')
            .order_by('trainer_comment', '-daily_log__date')  # empty comment = unreviewed first
        )

        photos = [
            {
                'meal_entry_id': e.pk,
                'log_id': e.daily_log_id,
                'customer_id': e.daily_log.customer_id,
                'customer_name': f'{e.daily_log.customer.first_name} {e.daily_log.customer.last_name}',
                'photo_url': e.photo.url if e.photo else None,
                'meal_block': e.meal_block,
                'date': e.daily_log.date.isoformat(),
                'trainer_comment': e.trainer_comment,
                'trainer_comment_at': e.trainer_comment_at.isoformat() if e.trainer_comment_at else None,
                'flagged_for_session': e.flagged_for_session,
                'status': e.status,
            }
            for e in entries
        ]
        return Response({'photos': photos})


class TrainerMealCommentView(APIView):
    """PATCH /api/trainer/photo-gallery/<meal_id>/comment/"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def patch(self, request, meal_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.nutrition_daily_log import MealEntry
        customer_ids = _trainer_customer_ids(trainer)

        try:
            entry = MealEntry.objects.get(pk=meal_id, daily_log__customer_id__in=customer_ids)
        except MealEntry.DoesNotExist:
            return Response({'detail': 'Foto no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        comment = request.data.get('trainer_comment', entry.trainer_comment)
        flagged = request.data.get('flagged_for_session', entry.flagged_for_session)

        entry.trainer_comment = comment
        entry.flagged_for_session = bool(flagged)
        if comment and comment != entry.trainer_comment:
            entry.trainer_comment_at = timezone.now()
        elif comment and not entry.trainer_comment_at:
            entry.trainer_comment_at = timezone.now()

        entry.save(update_fields=['trainer_comment', 'trainer_comment_at', 'flagged_for_session'])

        return Response({
            'meal_entry_id': entry.pk,
            'trainer_comment': entry.trainer_comment,
            'trainer_comment_at': entry.trainer_comment_at.isoformat() if entry.trainer_comment_at else None,
            'flagged_for_session': entry.flagged_for_session,
        })


# ── Trainer Messages ──────────────────────────────────────────────────────────

class TrainerMessagesView(APIView):
    """GET/POST /api/trainer/messages/?customer_id=X"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        customer_id_param = request.query_params.get('customer_id')
        qs = TrainerMessage.objects.filter(trainer=trainer, is_visible=True)
        if customer_id_param:
            qs = qs.filter(customer_id=customer_id_param)

        messages = [
            {
                'id': m.pk,
                'customer_id': m.customer_id,
                'trigger_type': m.trigger_type,
                'message': m.message,
                'is_visible': m.is_visible,
                'seen_by_customer': m.seen_by_customer,
                'created_at': m.created_at.isoformat(),
            }
            for m in qs[:50]
        ]
        return Response({'messages': messages})

    def post(self, request):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)

        customer_id = request.data.get('customer_id')
        message_text = request.data.get('message', '').strip()
        trigger_type = request.data.get('trigger_type', TrainerMessage.TriggerType.MANUAL)
        trigger_ref_id = request.data.get('trigger_ref_id')

        if not customer_id or not message_text:
            return Response({'detail': 'customer_id y message son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        customer = _get_trainer_customer(trainer, int(customer_id))
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        msg = TrainerMessage.objects.create(
            customer=customer,
            trainer=trainer,
            trigger_type=trigger_type,
            trigger_ref_id=trigger_ref_id,
            message=message_text,
        )
        return Response({
            'id': msg.pk,
            'customer_id': msg.customer_id,
            'trigger_type': msg.trigger_type,
            'message': msg.message,
            'created_at': msg.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


# ── Client Resumen (Tab 1) ────────────────────────────────────────────────────

class TrainerClientResumenView(APIView):
    """GET /api/trainer/my-clients/<customer_id>/resumen/"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models import Subscription

        # Latest risk score
        risk_score = (
            ClientRiskScore.objects
            .filter(customer=customer, trainer=trainer, is_stale=False)
            .order_by('-computed_at').first()
        )

        # Upcoming session
        upcoming = (
            Booking.objects
            .filter(trainer=trainer, customer=customer, status='pending')
            .filter(slot__start_time__gte=timezone.now())
            .select_related('slot', 'package')
            .order_by('slot__start_time').first()
        )

        # Active subscription
        sub = Subscription.objects.filter(customer=customer, status='active').order_by('-starts_at').first()

        # Recent sessions (last 5)
        recent_sessions = list(
            Booking.objects
            .filter(trainer=trainer, customer=customer)
            .select_related('slot', 'package')
            .order_by('-created_at')[:5]
            .values('id', 'status', 'canceled_reason', 'slot__start_time', 'package__title')
        )

        result = {
            'risk': {
                'level': risk_score.level if risk_score else 'sin_riesgo',
                'signals_count': (len(risk_score.behavioral_signals) + len(risk_score.clinical_signals)) if risk_score else 0,
                'computed_at': risk_score.computed_at.isoformat() if risk_score else None,
            },
            'subscription': {
                'package_title': sub.package.title if sub else None,
                'sessions_remaining': sub.sessions_remaining if sub else 0,
                'sessions_total': sub.sessions_total if sub else 0,
                'expires_at': sub.expires_at.isoformat() if sub else None,
            },
            'upcoming_session': {
                'starts_at': upcoming.slot.start_time.isoformat() if upcoming else None,
                'package_title': upcoming.package.title if upcoming else None,
            } if upcoming else None,
            'recent_sessions': [
                {
                    'id': s['id'],
                    'status': s['status'],
                    'canceled_reason': s['canceled_reason'],
                    'starts_at': s['slot__start_time'].isoformat() if s['slot__start_time'] else None,
                    'package_title': s['package__title'],
                }
                for s in recent_sessions
            ],
        }
        return Response(result)


# ── Client Alerts (Tab 6) ─────────────────────────────────────────────────────

class TrainerClientAlertsView(APIView):
    """GET /api/trainer/my-clients/<customer_id>/alerts/"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        scores = (
            ClientRiskScore.objects
            .filter(customer=customer, trainer=trainer)
            .prefetch_related('resolutions')
            .order_by('-computed_at')[:20]
        )

        return Response({
            'alerts': [
                {
                    'id': s.pk,
                    'level': s.level,
                    'computed_at': s.computed_at.isoformat(),
                    'is_stale': s.is_stale,
                    'behavioral_signals': s.behavioral_signals,
                    'clinical_signals': s.clinical_signals,
                    'resolutions': [
                        {
                            'id': r.pk,
                            'signal_type': r.signal_type,
                            'resolution_type': r.resolution_type,
                            'note': r.note,
                            'is_public': r.is_public,
                            'resolved_at': r.resolved_at.isoformat(),
                        }
                        for r in s.resolutions.all()
                    ],
                }
                for s in scores
            ]
        })


# ── Program Pause / Resume ────────────────────────────────────────────────────

class TrainerProgramPauseView(APIView):
    """POST /api/trainer/my-clients/<customer_id>/program/<program_id>/pause/"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def post(self, request, customer_id, program_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.monthly_program import MonthlyProgram
        try:
            program = MonthlyProgram.objects.get(pk=program_id, customer=customer)
        except MonthlyProgram.DoesNotExist:
            return Response({'detail': 'Programa no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if program.is_paused:
            return Response({'detail': 'El programa ya está pausado.'}, status=status.HTTP_400_BAD_REQUEST)

        pause_reason = request.data.get('pause_reason', '').strip()
        program.is_paused = True
        program.paused_at = timezone.now()
        program.pause_reason = pause_reason
        program.save(update_fields=['is_paused', 'paused_at', 'pause_reason'])

        return Response({'status': 'paused', 'paused_at': program.paused_at.isoformat()})


class TrainerProgramResumeView(APIView):
    """POST /api/trainer/my-clients/<customer_id>/program/<program_id>/resume/"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def post(self, request, customer_id, program_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.monthly_program import MonthlyProgram
        try:
            program = MonthlyProgram.objects.get(pk=program_id, customer=customer)
        except MonthlyProgram.DoesNotExist:
            return Response({'detail': 'Programa no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if not program.is_paused:
            return Response({'detail': 'El programa no está pausado.'}, status=status.HTTP_400_BAD_REQUEST)

        program.is_paused = False
        program.save(update_fields=['is_paused'])

        return Response({'status': 'resumed', 'resumed_at': timezone.now().isoformat()})


# ── Client Daily Logs (Rutina tab) ────────────────────────────────────────────

class TrainerClientDailyLogsView(APIView):
    """GET /api/trainer/my-clients/<customer_id>/daily-logs/?days=7"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.monthly_program import DailyLog, MonthlyProgram, ProgramDay
        from core_app.services.adherence_calculator import compute_combined_adherence, compute_nutrition_adherence, compute_training_adherence
        from core_app.models.nutrition_daily_log import NutritionDailyLog

        days = min(int(request.query_params.get('days', 7)), 28)
        today = date.today()
        start = today - timedelta(days=days - 1)

        program = (
            MonthlyProgram.objects
            .filter(customer=customer, status=MonthlyProgram.Status.PUBLISHED)
            .order_by('-start_date').first()
        )

        if not program:
            return Response({'days': [], 'program': None})

        program_days = list(
            ProgramDay.objects.filter(program=program, date__range=(start, today))
            .prefetch_related('exercises__exercise').order_by('date')
        )
        daily_logs = {
            l.date: l for l in
            DailyLog.objects.filter(customer=customer, date__range=(start, today))
            .prefetch_related('exercise_logs__program_exercise__exercise')
        }
        nutrition_logs = {
            l.date: l for l in
            NutritionDailyLog.objects.filter(customer=customer, date__range=(start, today))
            .prefetch_related('meal_entries')
        }

        result_days = []
        for pd in program_days:
            dl = daily_logs.get(pd.date)
            nl = nutrition_logs.get(pd.date)
            ex_logs = list(dl.exercise_logs.all()) if dl else []
            meal_entries = list(nl.meal_entries.all()) if nl else []
            training_adh = compute_training_adherence(ex_logs, pd.day_type, len(pd.exercises.all()))
            nutrition_adh = compute_nutrition_adherence(meal_entries)
            combined_adh = compute_combined_adherence(training_adh, nutrition_adh)

            result_days.append({
                'date': pd.date.isoformat(),
                'day_number': pd.day_number,
                'day_type': pd.day_type,
                'training_adherence': training_adh,
                'nutrition_adherence': nutrition_adh,
                'combined_adherence': combined_adh,
                'exercises': [
                    {
                        'exercise_id': pe.exercise_id,
                        'exercise_name': pe.exercise.name,
                        'sets': pe.sets,
                        'reps': pe.reps,
                        'duration_seconds': pe.duration_seconds,
                        'status': next(
                            (el.status for el in ex_logs if el.program_exercise_id == pe.pk),
                            'not_done'
                        ),
                    }
                    for pe in pd.exercises.all()
                ],
            })

        return Response({
            'program_id': program.pk,
            'is_paused': program.is_paused,
            'days': result_days,
        })


# ── Client Nutrition Logs (Nutrición tab) ─────────────────────────────────────

class TrainerClientNutritionLogsView(APIView):
    """GET /api/trainer/my-clients/<customer_id>/nutrition-logs/?days=7"""
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.nutrition_daily_log import MealEntry, NutritionDailyLog
        from core_app.services.adherence_calculator import compute_nutrition_adherence

        days = min(int(request.query_params.get('days', 7)), 28)
        today = date.today()
        start = today - timedelta(days=days - 1)

        nutrition_logs = (
            NutritionDailyLog.objects
            .filter(customer=customer, date__range=(start, today))
            .prefetch_related('meal_entries__suggestion')
            .order_by('-date')
        )

        result = []
        for nlog in nutrition_logs:
            entries = list(nlog.meal_entries.all())
            adherence = compute_nutrition_adherence(entries)
            result.append({
                'date': nlog.date.isoformat(),
                'adherence': adherence,
                'is_closed': nlog.is_closed,
                'meals': [
                    {
                        'meal_entry_id': me.pk,
                        'meal_block': me.meal_block,
                        'status': me.status,
                        'suggestion': me.suggestion.description if me.suggestion else None,
                        'notes': me.notes,
                        'photo_url': me.photo.url if me.photo else None,
                        'trainer_comment': me.trainer_comment,
                        'flagged_for_session': me.flagged_for_session,
                    }
                    for me in entries
                ],
            })

        return Response({'days': result})


# ── Client Sessions Full (Sesiones tab) ───────────────────────────────────────

class TrainerClientSessionsFullView(APIView):
    """GET /api/trainer/my-clients/<customer_id>/sessions-full/

    Returns all sessions (all statuses) with canceled_reason visible.
    """
    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        trainer = _get_trainer_profile(request)
        if not trainer:
            return Response({'detail': 'No trainer profile.'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_trainer_customer(trainer, customer_id)
        if not customer:
            return Response({'detail': 'Cliente no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        bookings = (
            Booking.objects
            .filter(trainer=trainer, customer=customer)
            .select_related('slot', 'package')
            .order_by('-created_at')
        )

        sessions = [
            {
                'id': b.pk,
                'status': b.status,
                'package_title': b.package.title if b.package else None,
                'starts_at': b.slot.start_time.isoformat() if b.slot else None,
                'ends_at': b.slot.end_time.isoformat() if b.slot else None,
                'notes': b.notes,
                'canceled_reason': b.canceled_reason,
                'session_notes_for_customer': b.session_notes_for_customer if hasattr(b, 'session_notes_for_customer') else '',
                'created_at': b.created_at.isoformat(),
            }
            for b in bookings
        ]

        stats = {
            'total': len(sessions),
            'completed': sum(1 for s in sessions if s['status'] == 'confirmed'),
            'pending': sum(1 for s in sessions if s['status'] == 'pending'),
            'canceled': sum(1 for s in sessions if s['status'] == 'canceled'),
        }

        return Response({'sessions': sessions, 'stats': stats})


# ── Customer: Trainer Messages ────────────────────────────────────────────────

class TrainerMessagesForCustomerView(APIView):
    """GET /api/my-trainer-messages/

    Returns visible, non-dismissed trainer messages for the authenticated
    customer. Marks them as seen on fetch (server-side seen flag).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'customer':
            return Response({'detail': 'Solo para clientes.'}, status=status.HTTP_403_FORBIDDEN)

        messages = list(
            TrainerMessage.objects
            .filter(customer=request.user, is_visible=True, dismissed_at__isnull=True)
            .order_by('-created_at')[:10]
        )

        unseen_ids = [m.pk for m in messages if not m.seen_by_customer]
        if unseen_ids:
            TrainerMessage.objects.filter(pk__in=unseen_ids).update(
                seen_by_customer=True,
                seen_at=timezone.now(),
            )

        return Response({
            'messages': [
                {
                    'id': m.pk,
                    'trigger_type': m.trigger_type,
                    'message': m.message,
                    'seen_by_customer': True if m.pk in unseen_ids else m.seen_by_customer,
                    'created_at': m.created_at.isoformat(),
                    'trainer_name': f'{m.trainer.user.first_name} {m.trainer.user.last_name}' if hasattr(m.trainer, 'user') else '',
                }
                for m in messages
            ]
        })


class TrainerMessageDismissView(APIView):
    """POST /api/my-trainer-messages/<id>/dismiss/

    Customer dismisses a trainer message; it stops appearing in subsequent
    fetches. Only the message owner can dismiss.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id):
        if request.user.role != 'customer':
            return Response({'detail': 'Solo para clientes.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            msg = TrainerMessage.objects.get(pk=message_id, customer=request.user)
        except TrainerMessage.DoesNotExist:
            return Response({'detail': 'Mensaje no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if msg.dismissed_at is None:
            msg.dismissed_at = timezone.now()
            msg.save(update_fields=['dismissed_at'])

        return Response({'id': msg.pk, 'dismissed_at': msg.dismissed_at.isoformat()})
