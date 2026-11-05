// 모든 표 하단의 페이지 번호: 처음 / 이전 / 번호 최대 5개 / 다음 / 마지막
function PaginationBar({ page, totalPages, onPageChange }) {
  const getPageNumbers = () => {
    const pages = [];
    let s = Math.max(1, page - 2);
    let e = Math.min(totalPages, s + 4);
    if (e - s < 4) s = Math.max(1, e - 4);
    for (let i = s; i <= e; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="pagination-bar">
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        className="btn-page"
      >
        처음
      </button>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        disabled={page === 1}
        className="btn-page"
      >
        이전
      </button>
      {getPageNumbers().map((p) => (
        <button
          type="button"
          key={p}
          onClick={() => onPageChange(p)}
          className={`btn-page ${page === p ? "active" : ""}`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages}
        className="btn-page"
      >
        다음
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        className="btn-page"
      >
        마지막
      </button>
    </div>
  );
}

export default PaginationBar;
