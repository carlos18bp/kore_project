'use client';

type Props = {
  checked: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
};

export default function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-all duration-150 ${
        checked
          ? 'bg-gradient-to-br from-kore-sage to-kore-sage-deep'
          : 'bg-kore-burgundy/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(45,15,26,0.28)] transition-all duration-150 ${
          checked ? 'left-[23px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}
