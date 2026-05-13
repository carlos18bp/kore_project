type Props = {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
};

export default function Card({ children, className = '', as: As = 'div' }: Props) {
  return (
    <As
      className={`bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm ${className}`}
    >
      {children}
    </As>
  );
}
