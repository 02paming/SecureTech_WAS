// 모든 관리 페이지의 상단 영역: 제목은 왼쪽, 최종 갱신 시간과 새로고침 버튼은 오른쪽에 고정. center는 가운데에 놓는다
function PageHeader({
  title,
  subtitle,
  lastUpdated,
  onRefresh,
  refreshing = false,
  children,
  center,
}) {
  return (
    <div className={`page-header ${center ? "has-center" : ""}`}>
      <div className="page-heading">
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {center && <div className="header-center">{center}</div>}
      <div className="header-actions">
        {children}
        {onRefresh && (
          <>
            <span className="header-time">
              최종 갱신: {lastUpdated || "-"}
            </span>
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={refreshing}
              className="btn-action btn-primary btn-w-md btn-header"
            >
              {refreshing ? "갱신 중" : "새로고침"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
