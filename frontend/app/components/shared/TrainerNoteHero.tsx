'use client';

type Props = {
  note: string;
  trainerName?: string | null;
  date?: string | null;
  kicker?: string;
  className?: string;
};

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TrainerNoteHero({
  note,
  trainerName,
  date,
  kicker = 'Notas de tu trainer',
  className = '',
}: Props) {
  const trimmed = (note ?? '').trim();
  if (!trimmed) return null;

  const dateLabel = formatLongDate(date);
  const author = trainerName?.trim() || 'Tu entrenador';
  const showFooter = !!(author || dateLabel);

  return (
    <div
      className={`relative ${className}`}
      style={{
        background: '#F5EFE3',
        border: '1px solid rgba(103,15,34,0.10)',
        borderRadius: 22,
        padding: '22px 26px',
        boxShadow: '0 4px 16px -10px rgba(45,15,26,0.18)',
      }}
    >
      <p
        style={{
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#670F22',
          marginBottom: 10,
        }}
      >
        {kicker}
      </p>
      <p
        style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 'clamp(18px, 3.4vw, 22px)',
          fontWeight: 600,
          color: '#670F22',
          lineHeight: 1.35,
          margin: 0,
          letterSpacing: '-0.005em',
          whiteSpace: 'pre-wrap',
        }}
      >
        &ldquo;{trimmed}&rdquo;
      </p>
      {showFooter && (
        <p
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'rgba(103,15,34,0.55)',
            marginTop: 14,
            marginBottom: 0,
          }}
        >
          {author ? `— ${author}` : ''}
          {author && dateLabel ? ' · ' : ''}
          {dateLabel}
        </p>
      )}
    </div>
  );
}
