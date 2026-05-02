#!/usr/bin/env python3
"""Parse Spanish exercise catalog from PDF text extraction → CSV.

NOTE: This PDF covers ~382/1302 exercises (29 %) from the full English catalog.
The rest are in other PDF files not yet downloaded.

PDF text layout (multi-column PDF extraction):
  [prev explanation] [Exercise Name] [status?] [Pattern] [Type] [Implement]
  [Primary Muscles] [Secondary Muscles] [Plane] [YouTube URL] [explanation]

Strategy:
  - Only process inline URLs (not <URL> list format at end of PDF).
  - Status is optional; if absent, skip the status-anchored name search.
  - Extract structured block using Pattern + Type + Plane as anchors.
  - Primary/Secondary split guided by English URL match item counts.
"""

import csv
import json
import re
import sys

try:
    import openpyxl
except ImportError:
    print("pip install openpyxl first", file=sys.stderr)
    sys.exit(1)

BASE = (
    '/home/cerrotico/.claude/projects/-home-cerrotico-work-kore-project/'
    '1aa1f3b1-1ac6-4758-8e58-64d29dd2aa36/tool-results/'
)
PDF_FILES = [
    BASE + 'mcp-claude_ai_Google_Drive-read_file_content-1777749729618.txt',  # spa (1)
    BASE + 'mcp-claude_ai_Google_Drive-read_file_content-1777749732052.txt',  # spa (3)
    BASE + 'mcp-claude_ai_Google_Drive-read_file_content-1777747344224.txt',  # spa (5)
]
EXCEL_PATH = '/home/cerrotico/work/kore_project/tier2_exercises_with_links.xlsx'
OUTPUT_CSV  = '/home/cerrotico/work/kore_project/tier2_exercises_spa.csv'

# ── Vocabulary ────────────────────────────────────────────────────────────────

# Match all status variants including concatenated (e.g. "refilmaciónSentadilla")
# Use lookahead for concatenated cases
STATUS_RE = re.compile(
    r'(?i)\b(hecho|realizado|filmado|'
    r're-filmaci[oó]n|refilmaci[oó]n|'
    r're-filmar|refilmar|re-filmado|refilmado|'
    r're-film)(?=[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]|[A-ZÁÉÍÓÚÜÑ])',
)

PATTERN_WORDS = sorted([
    'Una pierna', 'Pierna única', 'Pierna Única',
    'Anti-extensión', 'Anti-rotación',
    'Locomoción',
    'Sentadilla',
    'Complejo',
    'Doblar', 'Doblez', 'DOBLARSE',
    'Empujar', 'Empuje',
    'Jalar', 'Jalón', 'Tirar',
    'Llevar',
    'Núcleo', 'Core',
    'Rotación',
    'Flexión', 'Flexionar',
    'Explosividad', 'Pliométrico', 'Plyométrico',
    'Monostructural',
], key=len, reverse=True)

TYPE_WORDS = sorted([
    'Peso corporal', 'Propio peso',
    'Carga externa', 'Carga Externa',
    'Explosividad',
    'Estabilidad',
    'Correctivo',
    'Movilidad',
], key=len, reverse=True)

PLANE_WORDS = ['Sagital', 'Frontal', 'Transversal', 'Múltiple']

IMPLEMENT_TERMS = sorted([
    'Rodillo de espuma', 'Caja pliométrica', 'Caja de pliometría',
    'Barra de dominadas', 'Barra Landmine', 'Barra olímpica', 'Barra axel',
    'Balón medicinal', 'Balón de estabilidad', 'Balón de ejercicio',
    'Barra de trampa', 'Barra de seguridad', 'Barra EZ',
    'Barra paralela', 'Barra de tracción',
    'Pesa rusa', 'Pesas rusas',
    'Banda de resistencia', 'Bandas de resistencia', 'Bandas',
    'Banda de simetría',
    'Kettlebell', 'Mancuerna', 'Mancuernas',
    'GHD', 'TRX', 'Sled', 'Trineo',
    'Landmine', 'Rack', 'Step', 'Caja',
    'Anillas', 'Paralelas',
    'Máquina', 'Cable', 'Cables', 'Polea', 'Poleas',
    'Banco',
    'Ninguno', 'Barra', 'Suelo', 'Pared', 'Colchoneta', 'Cuerda',
], key=len, reverse=True)

MUSCLE_STARTS = {
    'glúteo', 'glúteos', 'isquiotibiales', 'isquiotibial', 'cuádriceps',
    'gemelos', 'gastronemios', 'gastrocnemios', 'trapecio', 'trapecios',
    'deltoides', 'pectorales', 'pectoral', 'bíceps', 'tríceps', 'dorsales',
    'dorsal', 'abdominales', 'abdominal', 'erector', 'recto', 'oblicuos',
    'pantorrillas', 'flexores', 'extensores', 'aductores', 'abductores',
    'psoas', 'tibial', 'sóleo', 'soleo', 'tensor', 'serrato', 'romboides',
    'escápulas', 'escápula', 'subescapular', 'manguito', 'antebrazos',
    'antebrazo',
}

CSV_HEADERS = [
    'Ejercicio', 'Estado', 'Patrón', 'Tipo', 'Implementación principal',
    'Músculos primarios trabajados', 'Músculos secundarios trabajados',
    'Plano', 'Explicación del ejercicio', 'URL de YouTube',
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def find_first_vocab(text: str, words: list) -> tuple:
    best = (None, len(text) + 1, -1)
    for w in words:
        m = re.search(re.escape(w), text, re.IGNORECASE)
        if m and m.start() < best[1]:
            best = (w, m.start(), m.end())
    return (None, -1, -1) if best[0] is None else best


def find_last_plane(text: str) -> tuple:
    best = (None, -1, -1)
    for pw in PLANE_WORDS:
        for m in re.finditer(re.escape(pw), text, re.IGNORECASE):
            if m.start() > best[1]:
                best = (pw, m.start(), m.end())
    return best


_EXPLAIN_RE = re.compile(
    r'\b(comienza|inicia|empieza|se\s+ejecuta|se\s+inicia|parte\s+de|'
    r'comience|se\s+realiza|está\s+de\s+pie)\b',
    re.IGNORECASE,
)


def _clean_candidate(s: str) -> str:
    """Trim explanation leak after first comma+lowercase from a candidate name."""
    s = s.strip()
    trimmed = re.split(r',\s+[a-záéíóúüñ]', s)[0].strip()
    return trimmed if 5 <= len(trimmed) <= 100 else s


def extract_name(before_status: str) -> str:
    """Extract the exercise name from text immediately before the status keyword.

    The name is the last 'label' text right before the status — it follows the
    explanation text which ends mid-sentence. Uses several ordered strategies:

    1. Last \\n\\n-separated chunk that starts uppercase and has no explanation verbs.
    2. Last non-explanation uppercase sequence in the final 300 chars.
    3. English fallback (caller must supply).
    """
    text = before_status.rstrip()
    if not text:
        return ''

    # ── Strategy 1: last paragraph-separated chunk starting with uppercase ──
    # Reject multi-sentence chunks (contain period-space, suggesting explanation+name blob)
    _SENTENCE_BOUNDARY = re.compile(r'[a-záéíóúüñ]\.\s')
    chunks = [c.strip() for c in re.split(r'\n{2,}', text) if c.strip()]
    for chunk in reversed(chunks):
        if (chunk and chunk[0].isupper()
                and not _EXPLAIN_RE.search(chunk)
                and 5 <= len(chunk) <= 120
                and ',' not in chunk
                and not _SENTENCE_BOUNDARY.search(chunk)):
            return chunk

    # ── Strategy 1b: multi-sentence chunks — extract tail phrase ─────────────
    # For chunks with sentence boundaries, find the last clean phrase at the end.
    # Pattern: (punctuation or quote) + space + Uppercase...$
    _TAIL_RE = re.compile(r"[.!?’‘'”“]\s+([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-]+)$")
    for chunk in reversed(chunks):
        if chunk:
            m = _TAIL_RE.search(chunk)
            if m:
                tail = m.group(1).strip()
                if (not _EXPLAIN_RE.search(tail)
                        and ',' not in tail
                        and 5 <= len(tail) <= 100):
                    return tail

    # ── Strategy 2: scan the last 300 chars for the last "label phrase" ─────
    # A label phrase: starts with uppercase, is preceded by a non-uppercase char
    # (space after lowercase, punctuation, or newline), has no explanation verbs.
    window = text[-300:]
    # Find all positions where an uppercase word starts after a non-uppercase context
    # We look for transitions: (non-[A-Z])(uppercase word)
    candidates = []
    for m in re.finditer(
        r'(?<=[^A-ZÁÉÍÓÚÜÑ\n])([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s-]*)',
        window,
    ):
        first_word = m.group().split()[0].lower().rstrip('-')
        if first_word not in MUSCLE_STARTS:
            candidates.append(m.start())

    # Try from LAST (closest to status) to FIRST
    for pos in reversed(candidates):
        candidate = window[pos:].strip()
        # Must have no explanation verbs, no commas, reasonable length
        if (not _EXPLAIN_RE.search(candidate)
                and ',' not in candidate
                and 5 <= len(candidate) <= 100):
            return candidate

    # Relax: allow explanation verbs but trim at them
    for pos in reversed(candidates):
        candidate = window[pos:].strip()
        m_exp = _EXPLAIN_RE.search(candidate)
        if m_exp and m_exp.start() >= 5:
            trimmed = candidate[:m_exp.start()].strip()
            if 5 <= len(trimmed) <= 100 and ',' not in trimmed:
                return trimmed
        elif not m_exp:
            clean = _clean_candidate(candidate)
            if 5 <= len(clean) <= 100:
                return clean

    # ── Last resort: last 80 chars stripped ─────────────────────────────────
    return window.strip()[-80:]


def split_muscles(muscles_section: str, eng_primary_count: int, eng_secondary_count: int) -> tuple:
    s = muscles_section.strip()
    if not s:
        return '', ''
    if eng_secondary_count == 0:
        return s, ''
    if eng_primary_count == 0:
        return '', s

    # Try comma-count split first
    parts = [p.strip() for p in s.split(',')]
    if len(parts) >= eng_primary_count + eng_secondary_count:
        primary_parts = parts[:eng_primary_count]
        secondary_parts = parts[eng_primary_count:]
        return ', '.join(primary_parts), ', '.join(secondary_parts)

    # Use comma count to find boundary
    commas = [m.start() for m in re.finditer(r',', s)]
    needed = eng_primary_count - 1
    if 0 <= needed < len(commas):
        split_after = commas[needed]
        rest = s[split_after + 1:].lstrip()
        m = re.search(r'\s(?=[A-ZÁÉÍÓÚÜÑA-Z])', rest)
        if m:
            boundary = split_after + 1 + m.start()
            return s[:boundary].strip(), s[boundary:].strip()
        elif rest:
            return s[:split_after + 1].strip(), rest

    # Last resort: return all as primary
    return s, ''


def clean_text(s: str) -> str:
    return re.sub(r'\s+', ' ', s.replace('\n', ' ')).strip()


# ── Load English reference data ───────────────────────────────────────────────

print(f"Loading English Excel: {EXCEL_PATH}")
wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb.active
eng_by_url: dict = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    url = str(row[9] or '').strip()
    if url.startswith('http'):
        primary   = str(row[5] or '').strip()
        secondary = str(row[6] or '').strip()
        eng_by_url[url] = {
            'name':            str(row[0] or '').strip(),
            'primary':         primary,
            'secondary':       secondary,
            'primary_count':   len([x for x in primary.split(',') if x.strip()]),
            'secondary_count': len([x for x in secondary.split(',') if x.strip()]),
        }
wb.close()
print(f"  {len(eng_by_url)} English exercises loaded")

# ── Parse all three PDF files ─────────────────────────────────────────────────

results = []
seen_urls: set = set()   # deduplicate across files
stats = {
    'ok': 0, 'no_status': 0, 'no_pattern': 0, 'no_plane': 0,
    'no_eng_match': 0, 'status_then_pattern': 0,
}

for pdf_path in PDF_FILES:
    print(f"Loading PDF: {pdf_path.split('/')[-1]}")
    with open(pdf_path) as f:
        data = json.load(f)
    text: str = data['fileContent']

    inline_url_matches = [
        m for m in re.finditer(r'https://www\.youtube\.com/watch\?v=[\w-]+', text)
        if (m.start() == 0 or text[m.start()-1] != '<')
    ]
    print(f"  {len(text):,} chars | {len(inline_url_matches)} inline URLs")

    for url_m in inline_url_matches:
        url       = url_m.group()
        url_start = url_m.start()
        url_end   = url_m.end()

        # Skip duplicates across files
        if url in seen_urls:
            continue
        seen_urls.add(url)

        before = text[max(0, url_start - 800): url_start]

        # ── Find last status keyword ────────────────────────────────────
        status_matches = list(STATUS_RE.finditer(before))
        if status_matches:
            last_status_m = status_matches[-1]
            status_word   = re.match(r'[a-záéíóúüñA-Z-]+', last_status_m.group(), re.IGNORECASE).group().lower()
            if 'refilm' in status_word or 're-film' in status_word:
                status_word = 're-film'
            before_status    = before[:last_status_m.start()]
            after_status_raw = before[last_status_m.end():]
            name = extract_name(before_status)
            stats['status_then_pattern'] += 1
        else:
            stats['no_status'] += 1
            status_word      = ''
            before_status    = before
            after_status_raw = before

        block = after_status_raw.strip()

        # ── Pattern ─────────────────────────────────────────────────────
        pattern, pat_start, pat_end = find_first_vocab(block, PATTERN_WORDS)
        if pattern is None:
            stats['no_pattern'] += 1
            pat_end = 0

        # ── Type ─────────────────────────────────────────────────────────
        search_start = pat_end if pat_end > 0 else 0
        type_val, _, type_end_rel = find_first_vocab(block[search_start:], TYPE_WORDS)
        type_end_abs = (search_start + type_end_rel) if type_val else search_start

        # ── Plane (last occurrence) ──────────────────────────────────────
        plane, plane_start_abs, _ = find_last_plane(block)
        if plane is None:
            stats['no_plane'] += 1
            plane_start_abs = len(block)

        # ── Muscles section ──────────────────────────────────────────────
        muscles_raw  = block[type_end_abs: plane_start_abs].strip()
        implement    = ''
        muscles_only = muscles_raw
        for term in IMPLEMENT_TERMS:
            m2 = re.match(re.escape(term), muscles_raw, re.IGNORECASE)
            if m2:
                implement    = m2.group()
                muscles_only = muscles_raw[m2.end():].strip()
                break
        if not implement:
            words = muscles_raw.split()
            if words:
                implement    = words[0]
                muscles_only = ' '.join(words[1:])

        # ── Primary / Secondary split ─────────────────────────────────────
        eng = eng_by_url.get(url)
        if eng is None:
            stats['no_eng_match'] += 1
            primary   = clean_text(muscles_only)
            secondary = ''
        else:
            spa_p, spa_s = split_muscles(muscles_only, eng['primary_count'], eng['secondary_count'])
            primary   = clean_text(spa_p) if spa_p else clean_text(eng['primary'])
            secondary = clean_text(spa_s) if spa_s else clean_text(eng['secondary'])

        # ── Name fallback when no status ─────────────────────────────────
        if not status_word and pattern:
            pat_idx = re.search(re.escape(pattern), before, re.IGNORECASE)
            if pat_idx:
                name = extract_name(before[:pat_idx.start()])
            else:
                name = eng['name'] if eng else ''

        # ── Explanation ───────────────────────────────────────────────────
        # Capture text after URL but stop before the next exercise boundary
        # (next YouTube URL or next status keyword) to avoid bleeding into
        # the following exercise's metadata block.
        after_url_text = text[url_end: url_end + 1200]
        next_url_m   = re.search(r'https://www\.youtube\.com/watch\?v=', after_url_text)
        next_stat_m  = STATUS_RE.search(after_url_text)
        boundary = len(after_url_text)
        if next_url_m:
            boundary = min(boundary, next_url_m.start())
        if next_stat_m:
            boundary = min(boundary, next_stat_m.start())
        exp_text = after_url_text[:boundary]

        # Pruning step 1: trim leaked "El NombreEjercicio comienza/empieza/inicia"
        # sentences — these appear when the next exercise's left-column description
        # bleeds into the current explanation paragraph (PDF multi-column artefact).
        # Pattern: capital-letter word then 10-100 non-newline chars then verb.
        _LEAKED_RE = re.compile(
            r'\s[A-ZÁÉÍÓÚÜÑ][^.!?\n]{10,100}'
            r'(?:comienza|empieza|inicia|se\s+ejecuta|se\s+inicia|se\s+realiza|parte\s+de)\b',
        )
        leak_m = _LEAKED_RE.search(exp_text)
        if leak_m and leak_m.start() > 15:
            exp_text = exp_text[:leak_m.start()]

        # Pruning step 2: cut at last \n\n paragraph break to remove any
        # orphaned next-exercise name that sits between the last \n\n and the
        # status keyword (e.g. "… con la barra\n\nSnatch de 3 Posiciones hecho").
        # Only apply when the trailing text looks like a short name, not a sentence.
        last_para = exp_text.rfind('\n\n')
        if last_para > 10:
            trailing = exp_text[last_para + 2:].strip()
            # Apply only if trailing text is short and lacks sentence-level verbs
            if (trailing
                    and len(trailing) < 80
                    and not re.search(
                        r'\b(comienza|empieza|inicia|se\s+ejecuta|para\s+iniciar|'
                        r'para\s+empezar|activa|flexiona|mantén|coloca|sujeta)\b',
                        trailing, re.I,
                    )):
                exp_text = exp_text[:last_para]

        # Find first real Spanish word to skip any leading junk (URL fragment, spaces)
        exp_m = re.search(r'[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]{3,}', exp_text)
        if exp_m:
            raw_exp = clean_text(exp_text[exp_m.start():])
            # Capitalize first letter so fragments read less abruptly
            explanation = raw_exp[0].upper() + raw_exp[1:] if raw_exp else ''
        else:
            explanation = ''

        # ── Name quality check — fall back to English name if still bad ────────
        _HEADER_WORDS = {'meses', 'puntos', 'partes', 'metas', 'notas', 'días', 'día'}
        _BAD_STARTERS = re.compile(
            r'^(para iniciar|para empezar|para comenzar|'
            r'activa el|activa la|activa los|'
            r'el movimiento|la posición|la barra|la banda|el ejercicio|'
            r'flexiona|mantén|mantenga|toma el|toma la|'
            r'agarra|coloca|comienza|empieza|inicia|sujeta|acuéstate|'
            r'párate|ponte de|baja las|baja los|lleva las|lleva los|sube las|sube los|'
            r'con las|con los|con una|con un|'
            r'luego|después|mientras|asegúrate|asegurate)',
            re.IGNORECASE,
        )
        name_clean = name.strip()
        if (not name_clean
                or len(name_clean) < 4
                or (name_clean and name_clean[0].islower())
                or name_clean.lower() in _HEADER_WORDS
                or len(name_clean) > 80
                or _BAD_STARTERS.match(name_clean)):
            if eng:
                name = eng['name']
            else:
                name = name_clean

        stats['ok'] += 1
        results.append({
            'Ejercicio':                       name,
            'Estado':                          status_word,
            'Patrón':                          pattern or '',
            'Tipo':                            type_val or '',
            'Implementación principal':        implement,
            'Músculos primarios trabajados':   primary,
            'Músculos secundarios trabajados': secondary,
            'Plano':                           plane or '',
            'Explicación del ejercicio':       explanation,
            'URL de YouTube':                  url,
        })

    print(f"  → {stats['ok']} total so far (this file added {len([r for r in results])})")

# ── Write CSV ─────────────────────────────────────────────────────────────────

with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
    writer.writeheader()
    writer.writerows(results)

print(f"\nResults written to {OUTPUT_CSV}")
print(f"  Total unique exercises: {len(results)}")
print(f"  With status word:  {stats['status_then_pattern']}")
print(f"  No status found:   {stats['no_status']}")
print(f"  No pattern found:  {stats['no_pattern']}")
print(f"  No plane found:    {stats['no_plane']}")
print(f"  No English match:  {stats['no_eng_match']}")
