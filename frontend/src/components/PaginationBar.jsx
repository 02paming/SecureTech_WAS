// 모든 표(테이블) 하단에서 페이지 이동을 제어하는 공용 페이지네이션 컴포넌트
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
