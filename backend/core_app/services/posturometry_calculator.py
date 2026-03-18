"""Posturometry calculation engine for the KÓRE diagnostic system.

Computes global and regional postural indices from raw per-view observations.
All 19 unique segments across 4 views contribute to the global index.

Scoring methodology adapted from:
- REEDCO Posture Score (1974) — all segments contribute equally.
- NYPR (1958; Howley & Frank, 1992) — 13-segment inclusive scoring.
- Kendall et al. (2005) — 4-view segmental observation framework.
- Janda (1996) — upper/central/lower regional grouping.
"""

# ── Segment registry: maps each unique segment to the views where it appears
# and its regional group (upper / central / lower).

SEGMENT_REGISTRY = {
    # ── Upper region (9 segments) ──
    'cabeza': {
        'views': ['anterior', 'lateral_right', 'lateral_left', 'posterior'],
        'region': 'upper',
        'label': 'Cabeza',
    },
    'cuello': {
        'views': ['anterior'],
        'region': 'upper',
        'label': 'Cuello',
    },
    'hombros': {
        'views': ['anterior', 'posterior'],
        'region': 'upper',
        'label': 'Hombros',
    },
    'claviculas': {
        'views': ['anterior'],
        'region': 'upper',
        'label': 'Clavículas',
    },
    'altura_tetillas': {
        'views': ['anterior'],
        'region': 'upper',
        'label': 'Altura Tetillas',
    },
    'escapulas': {
        'views': ['lateral_right', 'lateral_left', 'posterior'],
        'region': 'upper',
        'label': 'Escápulas',
    },
    'codos_angulo': {
        'views': ['lateral_right', 'lateral_left'],
        'region': 'upper',
        'label': 'Codos Ángulo',
    },
    'codos_flexionados': {
        'views': ['posterior'],
        'region': 'upper',
        'label': 'Codos Flexionados',
    },
    'espacios_brazo_tronco': {
        'views': ['posterior'],
        'region': 'upper',
        'label': 'Espacios Brazo-Tronco',
    },
    # ── Central region (7 segments) ──
    'columna_vertebral': {
        'views': ['lateral_right', 'lateral_left', 'posterior'],
        'region': 'central',
        'label': 'Columna Vertebral',
    },
    'abdomen_prominente': {
        'views': ['lateral_right', 'lateral_left'],
        'region': 'central',
        'label': 'Abdomen Prominente',
    },
    'cadera': {
        'views': ['lateral_right', 'lateral_left'],
        'region': 'central',
        'label': 'Cadera',
    },
    'pliegue_inguinal': {
        'views': ['anterior'],
        'region': 'central',
        'label': 'Pliegue Inguinal',
    },
    'pliegues_laterales': {
        'views': ['posterior'],
        'region': 'central',
        'label': 'Pliegues Laterales',
    },
    'altura_cresta_inguinales': {
        'views': ['posterior'],
        'region': 'central',
        'label': 'Altura Cresta Inguinales',
    },
    'gluteos': {
        'views': ['posterior'],
        'region': 'central',
        'label': 'Glúteos',
    },
    # ── Lower region (3 segments) ──
    'rodillas': {
        'views': ['anterior', 'lateral_right', 'lateral_left', 'posterior'],
        'region': 'lower',
        'label': 'Rodillas',
    },
    'pies': {
        'views': ['anterior', 'lateral_right', 'lateral_left', 'posterior'],
        'region': 'lower',
        'label': 'Pies',
    },
    'pliegues_popliteos': {
        'views': ['posterior'],
        'region': 'lower',
        'label': 'Pliegues Poplíteos',
    },
}

# Alias: anterior view uses "pie" instead of "pies"
_SEGMENT_ALIASES = {
    'pie': 'pies',
}

# ── View name mapping for data dict keys ──
VIEW_KEYS = {
    'anterior': 'anterior',
    'lateral_right': 'lateral_right',
    'lateral_left': 'lateral_left',
    'posterior': 'posterior',
}


def _extract_severity(segment_data):
    """Extract numeric severity (0–3) from a segment entry.

    segment_data: {is_normal: bool, severity: int, sub_fields: {...}}
    Returns 0 if normal, otherwise the severity value (clamped 0–3).
    """
    if not segment_data or not isinstance(segment_data, dict):
        return None

    is_normal = segment_data.get('is_normal', True)
    if is_normal:
        return 0

    severity = segment_data.get('severity', 0)
    try:
        severity = int(severity)
    except (ValueError, TypeError):
        return 0
    return max(0, min(3, severity))


def _get_view_data(view_name, anterior_data, lateral_right_data,
                   lateral_left_data, posterior_data):
    """Return the data dict for a given view name."""
    mapping = {
        'anterior': anterior_data,
        'lateral_right': lateral_right_data,
        'lateral_left': lateral_left_data,
        'posterior': posterior_data,
    }
    return mapping.get(view_name, {})


def compute_segment_scores(anterior_data, lateral_right_data,
                           lateral_left_data, posterior_data):
    """Compute consolidated scores for all 19 unique segments.

    For each segment, averages the severity across the views where it appears.
    Returns dict: {segment_key: {score, views: {view: severity}, label, region}}.
    """
    scores = {}

    for seg_key, seg_info in SEGMENT_REGISTRY.items():
        view_scores = {}
        for view_name in seg_info['views']:
            view_data = _get_view_data(
                view_name, anterior_data, lateral_right_data,
                lateral_left_data, posterior_data,
            )
            # Try direct key, then try alias
            segment_entry = view_data.get(seg_key)
            if segment_entry is None:
                # Check aliases (e.g. "pie" → "pies" in anterior)
                for alias, canonical in _SEGMENT_ALIASES.items():
                    if canonical == seg_key:
                        segment_entry = view_data.get(alias)
                        if segment_entry is not None:
                            break

            severity = _extract_severity(segment_entry)
            if severity is not None:
                view_scores[view_name] = severity

        if view_scores:
            avg_score = sum(view_scores.values()) / len(view_scores)
        else:
            avg_score = 0.0

        scores[seg_key] = {
            'score': round(avg_score, 2),
            'views': view_scores,
            'label': seg_info['label'],
            'region': seg_info['region'],
        }

    return scores


def classify_index(value):
    """Classify an index value into category and color.

    Returns (category, color).
    """
    if value is None:
        return ('', '')
    if value <= 0.50:
        return ('Postura funcional', 'green')
    elif value <= 1.20:
        return ('Desbalance leve', 'yellow')
    elif value <= 2.00:
        return ('Desbalance moderado', 'orange')
    else:
        return ('Desbalance importante', 'red')


def compute_indices(segment_scores):
    """Compute global and regional indices from segment scores.

    Returns dict with global_index, upper_index, central_index, lower_index
    plus their category and color.
    """
    results = {}

    # Global index: average of all 19 segment scores
    all_scores = [s['score'] for s in segment_scores.values()]
    if all_scores:
        global_val = round(sum(all_scores) / len(all_scores), 2)
    else:
        global_val = 0.0

    cat, col = classify_index(global_val)
    results['global_index'] = global_val
    results['global_category'] = cat
    results['global_color'] = col

    # Regional indices
    for region_key in ('upper', 'central', 'lower'):
        region_scores = [
            s['score'] for s in segment_scores.values()
            if s['region'] == region_key
        ]
        if region_scores:
            val = round(sum(region_scores) / len(region_scores), 2)
        else:
            val = 0.0
        cat, col = classify_index(val)
        results[f'{region_key}_index'] = val
        results[f'{region_key}_category'] = cat
        results[f'{region_key}_color'] = col

    return results


# ── Finding labels per segment per sub_field ──

_FINDING_LABELS = {
    # Vista Anterior
    'cabeza': {
        'inclinacion': 'inclinación {severity}',
        'rotacion': 'rotación {severity}',
        'protraccion': 'protracción {severity}',
        'retraccion': 'retracción {severity}',
    },
    'cuello': {
        'masa_muscular': 'alteración de masa muscular',
    },
    'hombros': {
        'ascendido_derecho': 'hombro derecho ascendido {severity}',
        'ascendido_izquierdo': 'hombro izquierdo ascendido {severity}',
    },
    'claviculas': {
        'ascendido_derecho': 'clavícula derecha ascendida {severity}',
        'ascendido_izquierdo': 'clavícula izquierda ascendida {severity}',
    },
    'altura_tetillas': {
        'ascendido_derecho': 'tetilla derecha ascendida {severity}',
        'ascendido_izquierdo': 'tetilla izquierda ascendida {severity}',
    },
    'rodillas': {
        'geno_varo': 'geno varo',
        'evertido_valgo': 'evertido valgo',
        'hiperextension': 'hiperextensión {severity}',
        'semiflexion': 'semiflexión {severity}',
    },
    'pies': {
        'abduccion': 'abducción',
        'aduccion': 'aducción',
        'eversion': 'eversión',
        'inversion': 'inversión',
        'plano': 'pie plano {severity}',
    },
    'pie': {
        'abduccion': 'abducción',
        'aduccion': 'aducción',
        'eversion': 'eversión',
        'inversion': 'inversión',
    },
    'escapulas': {
        'protuidas': 'protuidas {severity}',
        'retraidas': 'retraidas {severity}',
        'ascendida_derecho': 'escápula derecha ascendida {severity}',
        'ascendida_izquierdo': 'escápula izquierda ascendida {severity}',
    },
    'columna_vertebral': {
        'lordosis': 'lordosis {severity}',
        'cifosis': 'cifosis {severity}',
        'alineacion_apofisis': 'convexidad apófisis espinosas {severity}',
    },
    'cadera': {
        'anteversion': 'anteversión {severity}',
        'retroversion': 'retroversión {severity}',
    },
    'gluteos': {
        'tamano': 'asimetría de tamaño',
        'pliegues': 'asimetría de pliegues',
    },
    'pliegues_popliteos': {
        'pierna_derecha': 'pierna derecha',
        'pierna_izquierda': 'pierna izquierda',
    },
    'codos_flexionados': {
        'ascendido_derecho': 'codo derecho ascendido {severity}',
        'ascendido_izquierdo': 'codo izquierdo ascendido {severity}',
    },
}

_SEVERITY_LABELS = {
    'L': 'leve',
    'M': 'moderada',
    'S': 'severa',
    1: 'leve',
    2: 'moderada',
    3: 'severa',
}


def _format_finding(segment_label, sub_key, sub_val, templates):
    """Format a single finding string."""
    template = templates.get(sub_key)
    if not template:
        return None

    # For checkbox fields (bool), only report if True
    if isinstance(sub_val, bool):
        if not sub_val:
            return None
        return f"{segment_label}: {template.replace(' {severity}', '')}"

    # For severity fields (L/M/S or 1/2/3) — skip empty/falsy values
    if not sub_val:
        return None
    severity_label = _SEVERITY_LABELS.get(sub_val, str(sub_val))
    text = template.replace('{severity}', severity_label)
    return f"{segment_label}: {text}"


def generate_findings(anterior_data, lateral_right_data,
                      lateral_left_data, posterior_data):
    """Generate human-readable findings per view.

    Returns dict: {anterior: [...], lateral_right: [...], ...}.
    """
    view_map = {
        'anterior': anterior_data or {},
        'lateral_right': lateral_right_data or {},
        'lateral_left': lateral_left_data or {},
        'posterior': posterior_data or {},
    }

    findings = {}
    for view_name, view_data in view_map.items():
        view_findings = []
        for seg_key, seg_entry in view_data.items():
            if not isinstance(seg_entry, dict):
                continue
            if seg_entry.get('is_normal', True):
                continue

            # Resolve label
            canonical = _SEGMENT_ALIASES.get(seg_key, seg_key)
            reg = SEGMENT_REGISTRY.get(canonical, {})
            label = reg.get('label', seg_key.replace('_', ' ').title())

            sub_fields = seg_entry.get('sub_fields', {})
            templates = _FINDING_LABELS.get(seg_key, _FINDING_LABELS.get(canonical, {}))

            if sub_fields and templates:
                for sub_key, sub_val in sub_fields.items():
                    text = _format_finding(label, sub_key, sub_val, templates)
                    if text:
                        view_findings.append(text)
            else:
                # Generic finding
                sev = seg_entry.get('severity', 0)
                sev_label = _SEVERITY_LABELS.get(sev, '')
                view_findings.append(
                    f"{label}: alteración {sev_label}".strip()
                )

        findings[view_name] = view_findings

    return findings


def compute_all(anterior_data, lateral_right_data,
                lateral_left_data, posterior_data):
    """Run all calculations and return a flat dict of results.

    Called from PosturometryEvaluation.save() → _compute_indices().
    """
    segment_scores = compute_segment_scores(
        anterior_data, lateral_right_data,
        lateral_left_data, posterior_data,
    )

    indices = compute_indices(segment_scores)

    findings = generate_findings(
        anterior_data, lateral_right_data,
        lateral_left_data, posterior_data,
    )

    return {
        **indices,
        'segment_scores': segment_scores,
        'findings': findings,
    }


# ── Default recommendation texts ──

_REC_TEXTS = {
    'upper': {
        'green': {
            'result': 'Tu zona superior (cabeza, cuello, hombros, escápulas) muestra una alineación funcional. No se observan desbalances importantes.',
            'action': 'Mantén la consciencia postural en tu día a día. Los ejercicios de movilidad cervical y escapular ayudan a preservar este estado.',
        },
        'yellow': {
            'result': 'Se observan desbalances leves en la zona superior. Pueden estar relacionados con hábitos posturales del día a día.',
            'action': 'Incorpora ejercicios de movilidad cervical, fortalecimiento de trapecio medio/bajo y retracción escapular. La corrección es alcanzable con trabajo consistente.',
        },
        'orange': {
            'result': 'La zona superior muestra desbalances moderados que pueden estar afectando tu movilidad y generando tensión.',
            'action': 'Tu programa incluirá trabajo correctivo específico: movilidad torácica, fortalecimiento de estabilizadores escapulares y re-educación postural.',
        },
        'red': {
            'result': 'Se detectan desbalances importantes en la zona superior que requieren atención prioritaria.',
            'action': 'El abordaje correctivo será una prioridad en tu programa. Trabajo de movilidad, fortalecimiento y consciencia postural serán fundamentales.',
        },
    },
    'central': {
        'green': {
            'result': 'Tu zona central (columna, abdomen, pelvis) muestra buena alineación. El centro de tu cuerpo está equilibrado.',
            'action': 'Sigue fortaleciendo tu core y manteniendo la movilidad de columna. Esto es la base de todo movimiento saludable.',
        },
        'yellow': {
            'result': 'Se observan desbalances leves en la zona central. Pueden influir en cómo distribuyes la carga durante el movimiento.',
            'action': 'Ejercicios de estabilización de core, movilidad de columna y trabajo de control pélvico ayudarán a mejorar estos patrones.',
        },
        'orange': {
            'result': 'La zona central muestra desbalances moderados. La columna y/o pelvis presentan alteraciones que pueden afectar tu función.',
            'action': 'Se incluirá trabajo correctivo estructurado: fortalecimiento de core profundo, movilidad segmentaria de columna y re-educación del control pélvico.',
        },
        'red': {
            'result': 'Se detectan desbalances importantes en la zona central que requieren abordaje específico y prioritario.',
            'action': 'Tu programa priorizará la corrección de estos patrones. El trabajo será progresivo, enfocado en estabilidad, movilidad y control motor.',
        },
    },
    'lower': {
        'green': {
            'result': 'Tu tren inferior (rodillas, pies) muestra buena alineación. La base de apoyo es funcional.',
            'action': 'Mantén el trabajo de fuerza de tren inferior y la movilidad de tobillos. Una buena base protege todo lo que está arriba.',
        },
        'yellow': {
            'result': 'Se observan desbalances leves en el tren inferior. Pueden influir en cómo absorbes el impacto al caminar o entrenar.',
            'action': 'Ejercicios de fortalecimiento de estabilizadores de rodilla y movilidad de tobillo mejorarán estos patrones.',
        },
        'orange': {
            'result': 'El tren inferior muestra desbalances moderados que pueden estar afectando tu mecánica de movimiento.',
            'action': 'Se incluirá trabajo correctivo: fortalecimiento de glúteo medio, estabilización de rodilla y re-educación del apoyo del pie.',
        },
        'red': {
            'result': 'Se detectan desbalances importantes en el tren inferior que necesitan atención prioritaria.',
            'action': 'El programa incluirá corrección de alineación de rodillas y pies como prioridad, con progresión hacia movimientos funcionales.',
        },
    },
    'global': {
        'green': {
            'result': 'Tu postura general es funcional. No se observan desbalances importantes en ninguna zona.',
            'action': 'Sigue con tu programa de entrenamiento. La consciencia postural y el movimiento regular son tu mejor herramienta.',
        },
        'yellow': {
            'result': 'Tu postura muestra desbalances leves. Son comunes y corregibles con trabajo dirigido.',
            'action': 'Tu entrenador ajustará tu programa para incluir ejercicios correctivos específicos según las zonas identificadas.',
        },
        'orange': {
            'result': 'Tu postura presenta desbalances moderados que conviene abordar de forma estructurada.',
            'action': 'El trabajo correctivo será parte central de tu programa. Con constancia, estos patrones mejoran significativamente.',
        },
        'red': {
            'result': 'Tu postura muestra desbalances importantes que requieren atención prioritaria.',
            'action': 'Tu programa se enfocará primero en corrección postural antes de avanzar hacia cargas mayores. La paciencia y la constancia son clave.',
        },
    },
}


def generate_default_recommendations(evaluation):
    """Generate default recommendations based on computed indices."""
    recs = {}
    for region in ('global', 'upper', 'central', 'lower'):
        color = getattr(evaluation, f'{region}_color', 'green') or 'green'
        region_texts = _REC_TEXTS.get(region, {})
        texts = region_texts.get(color, region_texts.get('green', {}))
        recs[region] = {
            'result': texts.get('result', ''),
            'action': texts.get('action', ''),
        }
    return recs
