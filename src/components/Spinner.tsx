interface Props {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

const SIZE_CLASS = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

export default function Spinner({ size = 'md', color = 'border-secondary', className = '' }: Props) {
  return (
    <div className={`${SIZE_CLASS[size]} border-2 ${color} border-t-transparent rounded-full animate-spin ${className}`} />
  );
}
