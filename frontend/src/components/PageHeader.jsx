// 관리 페이지 상단 영역을 구성하는 제목, 최종 갱신 시간 및 새로고침 버튼 컴포넌트
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
