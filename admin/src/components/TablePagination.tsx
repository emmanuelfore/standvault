type TablePaginationProps = {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const PAGE_SIZES = [10, 25, 50, 100];

const TablePagination = ({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-4 border-t border-white/10 bg-white/5">
      <div className="text-sm text-secondary-400">
        Showing <span className="font-bold text-white">{rangeStart}</span> to <span className="font-bold text-white">{rangeEnd}</span> of{' '}
        <span className="font-bold text-white">{totalItems}</span> records
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-secondary-500 font-bold">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-secondary-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-600/50 text-white"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-all"
          >
            Previous
          </button>
          <div className="px-4 py-2 rounded-xl border border-white/10 bg-secondary-950 text-sm font-bold text-white">
            Page {currentPage} of {totalPages}
          </div>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || totalItems === 0}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold transition-all"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TablePagination;
