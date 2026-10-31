import { useMemo, useState } from "react";
import { getSecurityTheme } from "../utils/securityTheme";
import PaginationBar from "./PaginationBar";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push({ isEmpty: true });
  }
  return padded;
};

function IpMacHistoryColumn({ logs }) {
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filteredLogs = useMemo(
    () =>
      logs
        .filter(
          (item) =>
            !search ||
            (item.ip || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()) ||
            (item.mac || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sortAsc
            ? (a.login_time || "").localeCompare(b.login_time || "")
            : (b.login_time || "").localeCompare(a.login_time || ""),
        ),
    [logs, search, sortAsc],
  );

  const totalPages = Math.ceil(filteredLogs.length / perPage) || 1;
  const currentItems = padRows(
    filteredLogs.slice((page - 1) * perPage, page * perPage),
    perPage,
  );

  return (
    <div className="info-box sub-panel">
      <div className="info-box-row">
        <h4 className="info-box-title">
          최근 접속 현황 <span className="text-primary">{filteredLogs.length}건</span>
        </h4>
        <button
          type="button"
          className="btn-action btn-neutral btn-w-sm"
          onClick={() => {
            setSortAsc(!sortAsc);
            setPage(1);
          }}
        >
          {sortAsc ? "오래된순" : "최신순"}
        </button>
      </div>
      <input
        type="text"
        className="custom-input"
        placeholder="IP, MAC 검색..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <thead>
            <tr>
              <th>IP</th>
              <th>MAC</th>
              <th>시간</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, idx) => (
              <tr key={idx} className={item.is_mismatch ? "row-danger" : ""}>
                {item.isEmpty ? (
                  <td colSpan="3">&nbsp;</td>
                ) : (
                  <>
                    <td className="text-success fw-bold">{item.ip}</td>
                    <td className={`cell-mono cell-ellipsis ${item.is_mismatch ? "text-danger" : ""}`}>
                      {item.mac}
                      {item.is_mismatch && " !"}
                    </td>
                    <td className="text-muted">{item.login_time}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

function ExternalAccessColumn({ externalLogs }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filteredLogs = useMemo(
    () =>
      externalLogs
        .filter((item) => {
          if (statusFilter === "allowed" && item.is_blocked) return false;
          if (statusFilter === "blocked" && !item.is_blocked) return false;
          return (
            !search ||
            (item.ip || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()) ||
            (item.domain || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase())
          );
        })
        .sort((a, b) =>
          sortAsc
            ? (a.time || "").localeCompare(b.time || "")
            : (b.time || "").localeCompare(a.time || ""),
        ),
    [externalLogs, search, statusFilter, sortAsc],
  );

  const totalPages = Math.ceil(filteredLogs.length / perPage) || 1;
  const currentItems = padRows(
    filteredLogs.slice((page - 1) * perPage, page * perPage),
    perPage,
  );

  return (
    <div className="info-box sub-panel">
      <div className="info-box-row">
        <div className="card-title-group">
          <h4 className="info-box-title">
            활동현황 <span className="text-primary">{filteredLogs.length}건</span>
          </h4>
          <div className="btn-group">
            {[
              { k: "all", l: "전체" },
              { k: "allowed", l: "허용" },
              { k: "blocked", l: "차단" },
            ].map((t) => (
              <button
                type="button"
                key={t.k}
                className={`btn-action btn-toggle btn-w-xs ${statusFilter === t.k ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(t.k);
                  setPage(1);
                }}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn-action btn-neutral btn-w-sm"
          onClick={() => {
            setSortAsc(!sortAsc);
            setPage(1);
          }}
        >
          {sortAsc ? "오래된순" : "최신순"}
        </button>
      </div>
      <input
        type="text"
        className="custom-input"
        placeholder="도메인 검색..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <colgroup>
            <col style={{ width: "60px" }} />
            <col style={{ width: "100px" }} />
            <col />
            <col style={{ width: "145px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>구분</th>
              <th>IP</th>
              <th>도메인</th>
              <th>시간</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, idx) => (
              <tr key={idx} className={item.is_blocked ? "row-danger" : ""}>
                {item.isEmpty ? (
                  <td colSpan="4">&nbsp;</td>
                ) : (
                  <>
                    <td>
                      <span className={`tag ${item.is_blocked ? "text-danger" : "text-success"}`}>
                        {item.is_blocked ? "차단" : "허용"}
                      </span>
                    </td>
                    <td>{item.ip || "-"}</td>
                    <td className={`cell-ellipsis fw-bold ${item.is_blocked ? "text-danger" : "text-primary"}`}>
                      {item.domain || "-"}
                    </td>
                    <td className="text-muted">{item.time || "-"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

// 사원 인증 현황과 로그 분석실이 함께 쓰는 단말 보안 상세 창
function SecurityDetailDialog({ security, onClose, onRefresh, refreshing }) {
  const theme = getSecurityTheme(security.security_score);
  const totalAccess = security.normal_access_count + security.violation_count;
  const safeRatio =
    totalAccess > 0
      ? Math.round((security.normal_access_count / totalAccess) * 100)
      : 100;

  return (
    <div className="dialog-overlay" onClick={() => onClose()}>
      <div className="dialog-box dialog-lg" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 className="dialog-title">보안 관제 상세 현황</h3>
          <div className="btn-group">
            <span className="tag tag-primary">ID: {security.employee_id}</span>
            <button
              type="button"
              className="btn-action btn-primary btn-w-md btn-header"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? "갱신 중" : "새로고침"}
            </button>
            <button
              type="button"
              className="btn-action btn-neutral btn-w-md btn-header"
              onClick={() => onClose()}
            >
              닫기
            </button>
          </div>
        </div>
        <div className="dialog-grid-3">
          <div className="info-stack">
            <div className={`info-box tone-${theme.tone}`}>
              <div className="info-box-row">
                <span className="info-box-title">단말 보안 건전성</span>
                <span className={`fw-bold text-${theme.tone}`}>
                  {security?.security_score}점 ({theme.label})
                </span>
              </div>
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{ width: `${security?.security_score}%` }}
                />
              </div>
              <div className="info-box-row info-box-note">
                <span>정상: {security?.normal_access_count}건</span>
                <span>변조 탐지: {security?.mismatch_count}건</span>
              </div>
            </div>
            <div className="info-box info-box-row">
              <div>
                <span className="info-box-label">사번</span>
                <strong className="info-box-value">{security.emp_code}</strong>
              </div>
              <span className="tag">입사일: {security.hire_date || "-"}</span>
            </div>
            <div className="info-box info-box-row">
              <div>
                <span className="info-box-label">이름 / 권한</span>
                <strong className="info-box-value">{security.name}</strong>
              </div>
              <span className="tag tag-primary">
                {security.is_manager ? "관리자" : "일반사원"}
              </span>
            </div>
            <div className="info-box">
              <span className="info-box-label">실시간 접속 IP / MAC</span>
              <div className="info-box-row">
                <strong className="info-box-value text-success">
                  {security.current_ip}
                </strong>
                <span className="tag tag-mono">{security.current_mac || "-"}</span>
              </div>
            </div>
            <div className="info-box tone-primary">
              <div className="info-box-row">
                <span className="info-box-label">유해 사이트 차단 누적</span>
                <strong className="text-danger">{security.violation_count}건</strong>
              </div>
              <div className="progress is-danger-track">
                <div className="progress-fill" style={{ width: `${safeRatio}%` }} />
              </div>
              <div className="info-box-row info-box-note">
                <span>준수율: {safeRatio}%</span>
                <span>
                  총 접속:{" "}
                  {security.normal_access_count +
                    security.violation_count}
                  건
                </span>
              </div>
            </div>
            <div className={`info-box tone-box tone-${theme.tone}`}>
              <span className="info-box-title">AI 보안 어드바이저</span>
              <p
                className="tone-box-text"
                dangerouslySetInnerHTML={{
                  __html: security.security_advisor
                    ? security.security_advisor.replace(
                      /\*\*(.*?)\*\*/g,
                      "<b>$1</b>",
                    )
                    : "분석 중...",
                }}
              />
            </div>
          </div>

          <IpMacHistoryColumn logs={security.recent_logs || []} />
          <ExternalAccessColumn
            externalLogs={
              security.external_access_logs ||
              (security.recent_violations || []).map((v) => ({
                ip: v.ip,
                domain: v.domain,
                time: v.time,
                status: "차단",
                is_blocked: true,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}

export default SecurityDetailDialog;
