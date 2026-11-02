import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, MONITOR_REFRESH_MS } from "../../api";
import DomainDetailDialog from "../../components/DomainDetailDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import SecurityDetailDialog from "../../components/SecurityDetailDialog";
import { hasAiScore } from "../../utils/aiScore";
import { POLICY_TONES, getResultTone } from "../../utils/policyTone";
import { padRows, useResetPage } from "../../utils/table";

const LogAnalysis = () => {
  const [detailDomain, setDetailDomain] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const baseUrl = API_BASE_URL;

  const fetchData = useCallback(async () => {
    setLoadingAction(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/integrated-logs/`);
      setLogs(res.data.general_logs || []);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    } catch (err) {
      console.error("로그 데이터 갱신 오류:", err);
    } finally {
      setLoadingAction(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, MONITOR_REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  useResetPage([search, statusFilter, startDate, endDate], () => setCurrentPage(1));

  const handleEmpClick = async (violatorStr) => {
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
      alert("해당 사원의 상세 보안 정보를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRefreshDetail = async () => {
    if (!selectedSecurity) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/employee-security/${selectedSecurity.employee_id}/`);
      if (res.data?.status === "success") setSelectedSecurity(res.data.data);
    } catch {
      alert("상세 보안 정보를 새로 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const baseFilteredData = useMemo(() => {
    let filtered = logs;
    if (startDate) filtered = filtered.filter((l) => l.time && l.time.substring(0, 10) >= startDate);
    if (endDate) filtered = filtered.filter((l) => l.time && l.time.substring(0, 10) <= endDate);
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter((l) => (l.violator || "").toLowerCase().includes(s) || (l.domain || "").toLowerCase().includes(s) || (l.ip || "").toLowerCase().includes(s));
    }
    return filtered;
  }, [logs, startDate, endDate, search]);

  // 1. stat 계산 로직 수정
  const statTotal = baseFilteredData.length;
  // "안전"이나 "허용"이라는 글자가 포함되어 있으면 정상 통과로 집계
  const statAllowed = baseFilteredData.filter((l) => l.status === "정상").length;
  // "차단"이라는 글자가 포함되어 있으면 차단으로 집계
  const statBlocked = baseFilteredData.filter((l) => l.status === "차단").length;
  // "의심"이라는 글자가 포함되어 있으면 의심으로 집계
  const suspiciousLogs = baseFilteredData.filter((l) => l.status === "의심");
  const statAiSuspicious = suspiciousLogs.length;
  const statSuspiciousBlocked = suspiciousLogs.filter((l) => l.type === "차단").length;

 // 2. 하단 currentData(탭 클릭 시 필터링) 로직도 함께 수정
  const currentData = useMemo(() => {
    if (statusFilter === "all") return baseFilteredData;
    if (statusFilter === "허용") return baseFilteredData.filter((l) => l.status === "정상");
    if (statusFilter === "차단") return baseFilteredData.filter((l) => l.status === "차단");
    if (statusFilter === "의심") return baseFilteredData.filter((l) => l.status === "의심");
    return baseFilteredData;
  }, [baseFilteredData, statusFilter]);

  const paginatedData = useMemo(() => padRows(currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), itemsPerPage), [currentData, currentPage]);
  const totalPages = Math.ceil(currentData.length / itemsPerPage) || 1;

  // 처리 결과는 접속 시점의 실제 결과를 보여 준다
  const getProcessingResult = (log) => {
    if (log.status === "의심") return log.type === "차단" ? "AI 의심 차단" : "AI 의심 통과";
    return log.type === "차단" ? "차단" : "정상 통과";
  };

  const exportToCSV = useCallback(() => {
    const headers = ["접속 시간", "이름(아이디)", "출발지 IP", "MAC 주소", "도메인", "정책 판단", "AI 위협 점수", "처리 결과"];
    const csvRows = [headers.join(",")];
    currentData.forEach((r) => {
      const resultText = getProcessingResult(r);
      csvRows.push(`"${r.time}","${r.violator}","${r.ip || "-"}","${r.mac || "-"}","${r.domain}","${r.policy || "-"}","${hasAiScore(r.ai_score) ? r.ai_score : "-"}","${resultText}"`);
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
  }, [currentData]);

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="로그 분석실"
        subtitle="임직원의 네트워크 접속 기록을 조회하고 추적합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={loadingAction}
      />

      <div className="stat-row">
        <div
          onClick={() => setStatusFilter("all")}
          className={`stat-card tone-primary ${statusFilter === "all" ? "is-active" : ""}`}
        >
          <div className="stat-label">전체 접속</div>
          <div className="stat-value">{statTotal}<span className="stat-unit">건</span></div>
        </div>
        <div
          onClick={() => setStatusFilter("허용")}
          className={`stat-card tone-success ${statusFilter === "허용" ? "is-active" : ""}`}
        >
          <div className="stat-label">정상 통과</div>
          <div className="stat-value">{statAllowed}<span className="stat-unit">건</span></div>
        </div>
        <div
          onClick={() => setStatusFilter("의심")}
          className={`stat-card tone-warning ${statusFilter === "의심" ? "is-active" : ""}`}
        >
          <div>
            <div className="stat-label">AI 의심</div>
            <div className="stat-sub">통과 {statAiSuspicious - statSuspiciousBlocked} / 차단 {statSuspiciousBlocked}</div>
          </div>
          <div className="stat-value">{statAiSuspicious}<span className="stat-unit">건</span></div>
        </div>
        <div
          onClick={() => setStatusFilter("차단")}
          className={`stat-card tone-danger ${statusFilter === "차단" ? "is-active" : ""}`}
        >
          <div className="stat-label">차단</div>
          <div className="stat-value">{statBlocked}<span className="stat-unit">건</span></div>
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
            </div>
            <button type="button" onClick={exportToCSV} className="btn-action btn-neutral btn-w-auto btn-form">CSV 다운로드</button>
          </div>

          <div className="table-responsive table-fill">
            <table className="custom-table">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "11%" }} />
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
                  <th>정책 판단</th>
                  <th>AI 위협 점수</th>
                  <th>처리 결과</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((log, idx) => {
                  const resultText = getProcessingResult(log);
                  const isBlockedResult = resultText === "차단";
                  return (
                    <tr key={log.isEmpty ? `empty-${idx}` : `${log.domain}-${log.time || idx}`}>
                      {log.isEmpty ? (
                        <td colSpan="8">&nbsp;</td>
                      ) : (
                        <>
                          <td className="cell-time">{log.time}</td>
                          <td
                            className={log.violator !== "내부 단말" ? "cell-link" : "text-primary fw-bold"}
                            onClick={() => handleEmpClick(log.violator)}
                          >
                            {log.violator}
                          </td>
                          <td className="cell-mono">{log.ip || "-"}</td>
                          <td className="cell-mono">{log.mac || "-"}</td>
                          <td
                            className={`cell-main cell-clickable text-${getResultTone(log.status, log.policy)}`}
                            onClick={() => setDetailDomain(log.domain)}
                          >
                            {log.domain}
                          </td>
                          <td className={`fw-bold text-${POLICY_TONES[log.policy] || "muted"}`}>{log.policy || "-"}</td>
                          <td className={`fw-bold text-${POLICY_TONES[log.policy] || "muted"}`}>
                            {hasAiScore(log.ai_score) ? `${log.ai_score}점` : "-"}
                          </td>
                          <td>
                            <span className={`status-badge badge-${log.status === "의심" ? POLICY_TONES[log.policy] : isBlockedResult ? "danger" : "success"}`}>
                              {resultText}
                            </span>
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
        <SecurityDetailDialog
          security={selectedSecurity}
          onClose={() => setIsModalOpen(false)}
          onRefresh={handleRefreshDetail}
          refreshing={detailLoading}
        />
      )}
    </div>
  );
};

export default LogAnalysis;