import Pill from './Pill';

type PillTone = 'wine' | 'sage' | 'amber' | 'sakura' | 'neutral' | 'dark';

type Props = {
  label: string;
  value: React.ReactNode;
  valuePill?: PillTone;
  last?: boolean;
};

export default function InfoRow({ label, value, valuePill, last }: Props) {
  return (
    <div
      className={`flex justify-between items-center py-2.5 ${
        last ? '' : 'border-b border-dashed border-kore-burgundy/8'
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-kore-burgundy/55">
        {label}
      </div>
      <div className="text-[13px] font-medium text-kore-gray-dark text-right">
        {valuePill ? (
          <Pill tone={valuePill} size="sm" dot>
            {value}
          </Pill>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
