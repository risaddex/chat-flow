interface Props {
  page: number;
  totalPages: number;
  totalCount: number;
  currentCount: number;
  label?: string;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, totalCount, currentCount, label = 'results', onPageChange }: Props) {
  return (
    <footer className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between shrink-0">
      <div className="text-body-sm text-on-surface-variant">
        Showing <span className="font-semibold text-on-surface">{currentCount}</span> of <span className="font-semibold text-on-surface">{totalCount}</span> {label}
      </div>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 border border-outline-variant rounded-lg text-body-sm font-medium hover:bg-surface-container-low transition-colors disabled:opacity-50">
          Prev
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => onPageChange(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-body-sm font-bold transition-colors ${
                p === page ? 'bg-secondary text-on-secondary' : 'hover:bg-surface-container-low text-on-surface'
              }`}>
              {p}
            </button>
          ))}
        </div>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 border border-outline-variant rounded-lg text-body-sm font-medium hover:bg-surface-container-low transition-colors disabled:opacity-50">
          Next
        </button>
      </div>
    </footer>
  );
}
