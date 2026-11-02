import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../api";
import { hasAiScore } from "../utils/aiScore";
import { POLICY_TONES, STATUS_LABELS, getResultTone } from "../utils/policyTone";
import { padRows } from "../utils/table";
import PaginationBar from "./PaginationBar";
import SecurityDetailDialog from "./SecurityDetailDialog";

// 10줄 페이징으로 수정
const PER_PAGE = 10;

function EmployeeColumn({ employees, onEmployeeClick }) {
  const [page, setPage] = useState(1);
  const rows = padRows(employees.slice((page - 1) * PER_PAGE, page * PER_PAGE), PER_PAGE);

  return (
    <div className="info-box sub-panel">
      <h4 className="info-box-title">
        접속 사원 <span className="text-primary">{employees.length}명</span>
      </h4>
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <colgroup>
            {/* 이름 잘림 방지를 위해 다른 컬럼 가로폭 축소 */}
            <col />
            <col style={{ width: "80px" }} />
            <col style={{ width: "45px" }} />
            <col style={{ width: "45px" }} />
            <col style={{ width: "115px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>이름</th>
              <th>아이디</th>
              <th>접속</th>
              <th>차단</th>
              <th>최근 접속</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, idx) => (
              <tr key={e.isEmpty ? `empty-${idx}` : e.employee_id || "unknown"}>
                {e.isEmpty ? (
                  <td colSpan="5" className="text-muted">
                    {idx === 0 && employees.length === 0 ? "접속 기록이 없습니다." : " "}
                  </td>
                ) : (
                  <>
                    <td
                      className={`cell-ellipsis ${e.employee_id ? "cell-link" : ""}`}
                      onClick={() => e.employee_id && onEmployeeClick(e.employee_id)}
                    >
                      {e.name}
                    </td>
                    <td className="cell-ellipsis">{e.employee_id || "-"}</td>
                    <td>{e.access_count}</td>
                    <td className={e.blocked_count > 0 ? "text-danger fw-bold" : ""}>{e.blocked_count}</td>
                    <td className="text-muted">{e.last_access.slice(0, 16)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} totalPages={Math.ceil(employees.length / PER_PAGE) || 1} onPageChange={setPage} />
    </div>
  );
}

function AccessLogColumn({ logs }) {
  const [page, setPage] = useState(1);
  const rows = padRows(logs.slice((page - 1) * PER_PAGE, page * PER_PAGE), PER_PAGE);

  return (
    <div className="info-box sub-panel">
      <h4 className="info-box-title">
        접속 기록 <span className="text-primary">{logs.length}건</span>
      </h4>
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <colgroup>
            <col style={{ width: "135px" }} />
            <col />
            <col style={{ width: "100px" }} />
            <col style={{ width: "70px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>시간</th>
              <th>이름</th>
              <th>IP</th>
              <th>접속 결과</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, idx) => (
              <tr key={idx}>
                {l.isEmpty ? (
                  <td colSpan="4" className="text-muted">
                    {idx === 0 && logs.length === 0 ? "접속 기록이 없습니다." : "\u00a0"}
                  </td>
                ) : (
                  <>
                    <td className="text-muted">{l.time.slice(0, 16)}</td>
                    <td className="cell-ellipsis">{l.name}</td>
                    <td>{l.ip}</td>
                    <td>
                      <span className={`tag ${l.result === "차단" ? "text-danger" : "text-success"}`}>{l.result}</span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} totalPages={Math.ceil(logs.length / PER_PAGE) || 1} onPageChange={setPage} />
    </div>
  );
}

function PolicyHistoryColumn({ history }) {
  const [page, setPage] = useState(1);
  const rows = padRows(history.slice((page - 1) * PER_PAGE, page * PER_PAGE), PER_PAGE);

  return (
    <div className="info-box sub-panel">
      <h4 className="info-box-title">
        정책 이력 <span className="text-primary">{history.length}건</span>
      </h4>
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <colgroup>
            <col style={{ width: "135px" }} />
            <col />
            <col style={{ width: "65px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>시간</th>
              <th>변경 내용</th>
              <th>변경 주체</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, idx) => (
              <tr key={idx}>
                {h.isEmpty ? (
                  <td colSpan="3" className="text-muted">
                    {idx === 0 && history.length === 0 ? "변경 이력이 없습니다." : "\u00a0"}
                  </td>
                ) : (
                  <>
                    <td className="text-muted">{h.time.slice(0, 16)}</td>
                    <td className="cell-ellipsis" title={`${h.before} → ${h.after}`}>
                      {h.before} →{" "}
                      <strong className={`text-${POLICY_TONES[h.after] || "muted"}`}>{h.after}</strong>
                    </td>
                    <td>{h.actor}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} totalPages={Math.ceil(history.length / PER_PAGE) || 1} onPageChange={setPage} />
    </div>
  );
}

function DomainDetailDialog({ domain, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [security, setSecurity] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  const baseUrl = API_BASE_URL;

  const fetchDetail = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/domain-detail/${encodeURIComponent(domain)}/`);
      setDetail(res.data.data);
      setError("");
    } catch {
      setError("도메인 상세 정보를 불러올 수 없습니다.");
    } finally {
      setRefreshing(false);
    }
  }, [baseUrl, domain]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const fetchSecurity = async (employeeId) => {
    setSecurityLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/employee-security/${employeeId}/`);
      setSecurity(res.data.data);
    } catch {
      alert("사원 보안 상세 현황을 불러올 수 없습니다.");
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <>
      <div className="dialog-overlay">
        <div className="dialog-box dialog-lg">
          <div className="dialog-header">
            <h3 className="dialog-title">도메인 상세 현황</h3>
            <div className="btn-group">
              <span className="tag tag-primary">{domain}</span>
              <button
                type="button"
                className="btn-action btn-primary btn-w-md btn-header"
                onClick={fetchDetail}
                disabled={refreshing}
              >
                {refreshing ? "갱신 중" : "새로고침"}
              </button>
              <button
                type="button"
                className="btn-action btn-neutral btn-w-md btn-header"
                onClick={onClose}
              >
                닫기
              </button>
            </div>
          </div>

          {error && !detail && <div className="empty-state">{error}</div>}
          {!error && !detail && <div className="empty-state">불러오는 중입니다...</div>}

          {detail && (
            <>
              <div className="dialog-summary">
                <div className="info-box">
                  <div className="info-row is-compact">
                    <span className="info-label">정책 판단</span>
                    <strong className={`info-value text-${POLICY_TONES[detail.policy] || "muted"}`}>{detail.policy}</strong>
                  </div>
                  <div className="info-row is-compact">
                    <span className="info-label">최근 AI 위협 점수</span>
                    <strong className={`info-value text-${POLICY_TONES[detail.policy] || "muted"}`}>
                      {hasAiScore(detail.ai_score) ? `${detail.ai_score}점` : "-"}
                    </strong>
                  </div>
                </div>
                <div className="info-box info-grid-2">
                  <div className="info-row is-compact">
                    <span className="info-label">전체 접속</span>
                    <strong className="info-value">{detail.total_count}건</strong>
                  </div>
                  {[
                    ["정상", detail.pass_count],
                    ["의심", detail.suspect_count],
                    ["차단", detail.blocked_count],
                  ].map(([status, count]) => (
                    <div className="info-row is-compact" key={status}>
                      <span className="info-label">{STATUS_LABELS[status]}</span>
                      <strong className={`info-value text-${getResultTone(status, detail.policy)}`}>{count}건</strong>
                    </div>
                  ))}
                </div>
                <div className="info-box">
                  {/* 날짜 정렬 맞춤을 위해 인라인 블록 및 고정 너비 할당 */}
                  <div className="info-row is-compact">
                    <span className="info-label" style={{ display: "inline-block", width: "65px" }}>첫 접속</span>
                    <span className="info-value" style={{ display: "inline-block", minWidth: "145px" }}>
                      {detail.first_access || "-"}
                    </span>
                  </div>
                  <div className="info-row is-compact">
                    <span className="info-label" style={{ display: "inline-block", width: "65px" }}>최근 접속</span>
                    <span className="info-value" style={{ display: "inline-block", minWidth: "145px" }}>
                      {detail.last_access || "-"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="dialog-grid-3 dialog-grid-even">
                <EmployeeColumn
                  employees={detail.employees}
                  onEmployeeClick={(id) => !securityLoading && fetchSecurity(id)}
                />
                <AccessLogColumn logs={detail.logs} />
                <PolicyHistoryColumn history={detail.history} />
              </div>
            </>
          )}
        </div>
      </div>

      {security && (
        <SecurityDetailDialog
          security={security}
          onClose={() => setSecurity(null)}
          onRefresh={() => fetchSecurity(security.employee_id)}
          refreshing={securityLoading}
        />
      )}
    </>
  );
}

export default DomainDetailDialog;