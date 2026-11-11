// 임직원의 네트워크 접속 기록, 위협 로그 및 MAC 스푸핑 이력을 통합 조회하고 필터링하는 로그 분석실 UI 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL, MONITOR_REFRESH_MS } from "../../api";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import DomainDetailDialog from "../../components/DomainDetailDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import SecurityDetailDialog from "../../components/SecurityDetailDialog";
import { hasAiScore } from "../../utils/aiScore";
import { appAlert } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { LEVEL_TONES } from "../../utils/levelTone";
import { POLICY_TONES, getResultTone } from "../../utils/policyTone";
import { padRows, useResetPage } from "../../utils/table";
import useDebounce from "../../utils/useDebounce";

const itemsPerPage = 10;

const LogAnalysis = () => {
  const [searchParams] = useSearchParams();
  const [detailDomain, setDetailDomain] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, allowed: 0, blocked: 0, ai_suspicious: 0, suspicious_blocked: 0 });
  const [loadingAction, setLoadingAction] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const [search, setSearch] = useState(() => searchParams.get("domain") || "");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [releaseRequest, setReleaseRequest] = useState(null);

  const baseUrl = API_BASE_URL;
  const isFetchingRef = useRef(false);
  const fetchTimeoutRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoadingAction(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/integrated-logs/`, {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearch,
          statusFilter,
          subFilter,
          startDate,
          endDate,
        },
      });
      if (res.data?.status === "success") {
        setLogs(res.data.general_logs || []);
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.total_pages) setTotalPages(res.data.total_pages);
        setLastUpdated(formatTimeKR());
      }
    } catch (err) {
      console.error("로그 데이터 갱신 오류:", err);
    } finally {
      setLoadingAction(false);
      isFetchingRef.current = false;
    }
  }, [baseUrl, currentPage, debouncedSearch, statusFilter, subFilter, startDate, endDate]);

  useResetPage([debouncedSearch, statusFilter, subFilter, startDate, endDate], () => setCurrentPage(1));

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return undefined;
    const loopFetch = () => {
      fetchTimeoutRef.current = setTimeout(async () => {
        await fetchData();
        loopFetch();
      }, MONITOR_REFRESH_MS);
    };
    loopFetch();
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchData, autoRefresh]);

  const selectStatusFilter = useCallback((value) => {
    setStatusFilter(value);
    setSubFilter("all");
  }, []);

  const handleEmpClick = useCallback(async (violatorStr) => {
    const match = violatorStr.match(/\((.*?)\)/);
    if (!match) return;
    const empId = match[1];

    setDetailLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/employee-security/${empId}/`);
      if (res.data?.status === "success") {
        setSelectedSecurity(res.data.data);
        setIsModalOpen(true);
      }
    } catch {
      await appAlert("해당 사원의 상세 보안 정보를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  }, [baseUrl]);

  const handleRefreshDetail = useCallback(async () => {
    if (!selectedSecurity) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/employee-security/${selectedSecurity.employee_id}/`);
      if (res.data?.status === "success") setSelectedSecurity(res.data.data);
    } catch {
      await appAlert("상세 보안 정보를 새로 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  }, [baseUrl, selectedSecurity]);

  const submitReleaseMismatch = useCallback(async (credentials) => {
    try {
      const res = await axios.post(`${baseUrl}/api/dashboard/mac-mismatch/release/`, {
        mismatch_id: releaseRequest.mismatchId,
        ...credentials,
      });
      await appAlert(res.data.message);
      setReleaseRequest(null);
      fetchData();
    } catch (err) {
      await appAlert(err.response?.data?.message || "해제 처리에 실패했습니다.");
    }
  }, [baseUrl, releaseRequest, fetchData]);

  const exportToCSV = useCallback(async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/integrated-logs/`, {
        params: { limit: 100000, search, statusFilter, subFilter, startDate, endDate }
      });
      const allData = res.data?.general_logs || [];
      const headers = ["접속 시간", "이름(아이디)", "출발지 IP", "MAC 주소", "도메인", "AI 레벨", "정책 판단", "AI 위협 점수", "처리 결과"];
      const csvRows = [headers.join(",")];

      allData.forEach((r) => {
        let resultText = "정상 통과";
        if (r.is_mismatch) resultText = "MAC 스푸핑 차단";
        else if (r.status === "의심") resultText = r.type === "차단" ? "AI 의심 차단" : "AI 의심 통과";
        else if (r.type === "차단") resultText = "차단";

        csvRows.push(`"${r.time}","${r.violator}","${r.ip || "-"}","${r.mac || "-"}","${r.domain}","${r.ai_level || "-"}","${r.policy || "-"}","${hasAiScore(r.ai_score) ? r.ai_score : "-"}","${resultText}"`);
      });

      const bom = "\uFEFF";
      const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `SecureTech_Access_Logs_${new Date().getTime()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      await appAlert("CSV 다운로드에 실패했습니다.");
    }
  }, [baseUrl, search, statusFilter, subFilter, startDate, endDate]);

  const displayLogs = useMemo(() => padRows(logs, itemsPerPage), [logs]);

  const subFilterOptions = useMemo(() => {
    if (statusFilter === "의심") return ["화이트 의심", "블랙 의심"];
    if (statusFilter === "차단" || statusFilter === "all") return ["수동", "AI", "MAC 스푸핑"];
    return ["수동", "AI"];
  }, [statusFilter]);

  return (
    <div className="page-container admin-page">
      {releaseRequest && (
        <AdminAuthDialog
          title="MAC 스푸핑 해제 인증"
          target="MAC 스푸핑 건"
          onSubmit={submitReleaseMismatch}
          onCancel={() => setReleaseRequest(null)}
        />
      )}

      <PageHeader
        title="로그 분석실"
        subtitle="임직원의 네트워크 접속 기록을 조회하고 추적합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={loadingAction}
      >
        <label className="check-label">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          자동 갱신
        </label>
      </PageHeader>

      <div className="stat-row">
        <div onClick={() => selectStatusFilter("all")} className={`stat-card tone-primary ${statusFilter === "all" ? "is-active" : ""}`}>
          <div className="stat-label">전체 접속</div>
          <div className="stat-value">{stats.total}<span className="stat-unit">건</span></div>
        </div>
        <div onClick={() => selectStatusFilter("허용")} className={`stat-card tone-success ${statusFilter === "허용" ? "is-active" : ""}`}>
          <div className="stat-label">정상 통과</div>
          <div className="stat-value">{stats.allowed}<span className="stat-unit">건</span></div>
        </div>
        <div onClick={() => selectStatusFilter("의심")} className={`stat-card tone-warning ${statusFilter === "의심" ? "is-active" : ""}`}>
          <div>
            <div className="stat-label">AI 의심</div>
            <div className="stat-sub">통과 {stats.ai_suspicious - stats.suspicious_blocked} / 차단 {stats.suspicious_blocked}</div>
          </div>
          <div className="stat-value">{stats.ai_suspicious}<span className="stat-unit">건</span></div>
        </div>
        <div onClick={() => selectStatusFilter("차단")} className={`stat-card tone-danger ${statusFilter === "차단" ? "is-active" : ""}`}>
          <div className="stat-label">차단</div>
          <div className="stat-value">{stats.blocked}<span className="stat-unit">건</span></div>
        </div>
      </div>

      <div className="panel-row">
        <div className="card dashboard-card card-fill">
          <div className="card-toolbar">
            <div className="toolbar-group">
              <input type="text" className="custom-input search-input" placeholder="이름, 아이디, IP, 도메인 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="custom-input date-input" />
              <span className="text-muted fw-bold">~</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="custom-input date-input" />
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStartDate("");
                  setEndDate("");
                  selectStatusFilter("all");
                }}
                className="btn-action btn-neutral btn-w-sm btn-form"
              >
                초기화
              </button>
            </div>
            <div className="toolbar-group">
              {subFilterOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSubFilter(subFilter === opt ? "all" : opt)}
                  className={`btn-action btn-w-md btn-form ${subFilter === opt ? "btn-primary" : "btn-neutral"}`}
                >
                  {opt}
                </button>
              ))}
              <button type="button" onClick={exportToCSV} className="btn-action btn-neutral btn-w-lg btn-form">CSV 다운로드</button>
            </div>
          </div>

          <div className="table-responsive table-fill">
            <table className="custom-table">
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>접속 시간</th>
                  <th>이름(아이디)</th>
                  <th>출발지 IP</th>
                  <th>MAC 주소</th>
                  <th>도메인</th>
                  <th>AI 레벨</th>
                  <th>정책 판단</th>
                  <th>AI 위협 점수</th>
                  <th>처리 결과</th>
                </tr>
              </thead>
              <tbody>
                {displayLogs.map((log, idx) => {
                  let resultText = "정상 통과";
                  if (log.is_mismatch) resultText = "MAC 스푸핑 차단";
                  else if (log.status === "의심") resultText = log.type === "차단" ? "AI 의심 차단" : "AI 의심 통과";
                  else if (log.type === "차단") resultText = "차단";

                  const isBlockedResult = resultText.includes("차단");

                  return (
                    <tr key={log.isEmpty ? `empty-${idx}` : log.mismatch_id ? `mismatch-${log.mismatch_id}` : `log-${log.log_id}`}>
                      {log.isEmpty ? (
                        <td colSpan="9">&nbsp;</td>
                      ) : (
                        <>
                          <td className="cell-time">{log.time}</td>
                          <td className={log.violator !== "내부 단말" ? "cell-link" : "text-primary fw-bold"} onClick={() => handleEmpClick(log.violator)}>
                            {log.violator}
                          </td>
                          <td className="cell-mono">{log.ip || "-"}</td>
                          <td className="cell-mono">{log.mac || "-"}</td>
                          {log.is_mismatch ? (
                            <td className="cell-main text-danger">{log.domain}</td>
                          ) : (
                            <td className={`cell-main cell-clickable text-${getResultTone(log.status, log.policy)}`} onClick={() => setDetailDomain(log.domain)}>
                              {log.domain}
                            </td>
                          )}
                          <td className={`fw-bold text-${LEVEL_TONES[log.ai_level] || "muted"}`}>{log.ai_level || "-"}</td>
                          <td className={`fw-bold text-${POLICY_TONES[log.policy] || "muted"}`}>{log.policy || "-"}</td>
                          <td className={`fw-bold text-${POLICY_TONES[log.policy] || "muted"}`}>
                            {hasAiScore(log.ai_score) ? `${log.ai_score}점` : "-"}
                          </td>
                          <td>
                            {log.is_mismatch ? (
                              <button type="button" onClick={() => setReleaseRequest({ mismatchId: log.mismatch_id })} className="btn-action btn-danger btn-w-sm btn-header">
                                해제
                              </button>
                            ) : (
                              <span className={`status-badge badge-${log.status === "의심" ? POLICY_TONES[log.policy] : isBlockedResult ? "danger" : "success"}`}>
                                {resultText}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {detailDomain && <DomainDetailDialog domain={detailDomain} onClose={() => setDetailDomain(null)} />}

      {isModalOpen && selectedSecurity && (
        <SecurityDetailDialog security={selectedSecurity} onClose={() => setIsModalOpen(false)} onRefresh={handleRefreshDetail} refreshing={detailLoading} />
      )}
    </div>
  );
};

export default LogAnalysis;