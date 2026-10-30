import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

const getSecurityTheme = (score) => {
  const numScore = Number(score) || 0;
  if (numScore >= 90) return { color: "var(--color-success)", label: "안전", bg: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.3)" };
  if (numScore >= 50) return { color: "var(--color-warning)", label: "주의", bg: "rgba(245, 158, 11, 0.04)", border: "1px solid rgba(245, 158, 11, 0.3)" };
  return { color: "var(--color-danger)", label: "위험", bg: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.3)" };
};

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) padded.push({ isEmpty: true });
  return padded;
};

// 💡 Pattern Library: 페이징 버튼 전용 클래스(.btn-page) 적용으로 하드코딩 완전 제거
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
    <div style={{ display: "flex", justifyContent: "center", gap: "6px", paddingTop: "12px", flexShrink: 0 }}>
      <button
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        disabled={page === 1}
        className="btn-page"
      >
        이전
      </button>
      {getPageNumbers().map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`btn-page ${page === p ? "active" : ""}`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages}
        className="btn-page"
      >
        다음
      </button>
    </div>
  );
}

const LogAnalysis = () => {
  const [logs, setLogs] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);
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

  const baseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`).replace(/\/+$/, ""), []);

  const fetchData = useCallback(async () => {
    setLoadingAction(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/integrated-logs/`);
      setLogs(res.data.general_logs || []);
      setAiLogs(res.data.ai_data || []);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    } catch (err) {
      console.error("로그 데이터 갱신 오류:", err);
    } finally {
      setLoadingAction(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 600000);
    return () => clearInterval(t);
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, startDate, endDate]);

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
    } catch (err) {
      alert("해당 사원의 상세 보안 정보를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const aiSuspiciousDomains = useMemo(() => aiLogs.filter((d) => d.type === "AI 블랙").map((d) => d.domain), [aiLogs]);

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

  const statTotal = baseFilteredData.length;
  const statAllowed = baseFilteredData.filter((l) => l.type === "정상").length;
  const statBlocked = baseFilteredData.filter((l) => l.type === "차단").length;
  const statAiSuspicious = baseFilteredData.filter((l) => aiSuspiciousDomains.includes(l.domain)).length;

  const currentData = useMemo(() => {
    if (statusFilter === "all") return baseFilteredData;
    if (statusFilter === "허용") return baseFilteredData.filter((l) => l.type === "정상");
    if (statusFilter === "차단") return baseFilteredData.filter((l) => l.type === "차단");
    if (statusFilter === "의심") return baseFilteredData.filter((l) => aiSuspiciousDomains.includes(l.domain));
    return baseFilteredData;
  }, [baseFilteredData, statusFilter, aiSuspiciousDomains]);

  const paginatedData = useMemo(() => padRows(currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), itemsPerPage), [currentData, currentPage]);
  const totalPages = Math.ceil(currentData.length / itemsPerPage) || 1;

  const exportToCSV = useCallback(() => {
    const headers = ["발생 시간", "이름(아이디)", "출발지 IP", "목적지 도메인", "AI 위협 점수", "처리 결과"];
    const csvRows = [headers.join(",")];
    currentData.forEach((r) => {
      const resultText = r.type === "차단" ? "차단" : aiSuspiciousDomains.includes(r.domain) ? "AI의심" : "정상허용";
      csvRows.push(`"${r.time}","${r.violator}","${r.ip || "-"}","${r.domain}","${r.ai_score || 0}","${resultText}"`);
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
  }, [currentData, aiSuspiciousDomains]);

  const theme = getSecurityTheme(selectedSecurity?.security_score);

  return (
    <div className="page-container admin-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">통합 로그 분석실</h2>
          <p className="page-subtitle">사내 임직원의 네트워크 실시간 접근 이력(CCTV) 모니터링 및 추적</p>
        </div>
        <div className="header-actions">
          <span className="header-time">최종 갱신: {lastUpdated || "-"}</span>
          <button onClick={fetchData} className="btn-primary" disabled={loadingAction}>새로고침</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexShrink: 0 }}>
        <div
          onClick={() => setStatusFilter("all")}
          style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-card)", border: `2px solid ${statusFilter === "all" ? "var(--color-primary)" : "var(--border-color)"}`, borderRadius: "10px", padding: "16px 24px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <div style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "bold" }}>전체 트래픽 로그</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--text-title)" }}>{statTotal} <span style={{ fontSize: "13px", fontWeight: "normal", marginLeft: "4px" }}>건</span></div>
        </div>
        <div
          onClick={() => setStatusFilter("허용")}
          style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-card)", border: `2px solid ${statusFilter === "허용" ? "var(--color-success)" : "var(--border-color)"}`, borderRadius: "10px", padding: "16px 24px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <div style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "bold" }}>정상 통과 (허용)</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--color-success)" }}>{statAllowed} <span style={{ fontSize: "13px", fontWeight: "normal", marginLeft: "4px" }}>건</span></div>
        </div>
        <div
          onClick={() => setStatusFilter("차단")}
          style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-card)", border: `2px solid ${statusFilter === "차단" ? "var(--color-danger)" : "var(--border-color)"}`, borderRadius: "10px", padding: "16px 24px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <div style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "bold" }}>정책 위반 (차단)</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--color-danger)" }}>{statBlocked} <span style={{ fontSize: "13px", fontWeight: "normal", marginLeft: "4px" }}>건</span></div>
        </div>
        <div
          onClick={() => setStatusFilter("의심")}
          style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--bg-card)", border: `2px solid ${statusFilter === "의심" ? "var(--color-warning)" : "var(--border-color)"}`, borderRadius: "10px", padding: "16px 24px", cursor: "pointer", transition: "all 0.2s" }}
        >
          <div style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "bold" }}>AI 의심 탐지</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "var(--color-warning)" }}>{statAiSuspicious} <span style={{ fontSize: "13px", fontWeight: "normal", marginLeft: "4px" }}>건</span></div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div className="card dashboard-card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", minHeight: 0, margin: 0 }}>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexShrink: 0, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="custom-input" style={{ width: "130px" }} />
              <span style={{ color: "var(--text-muted)", fontWeight: "bold", margin: "0 4px" }}>~</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="custom-input" style={{ width: "130px" }} />
              <input type="text" className="custom-input search-input" placeholder="이름, ID, IP, 도메인 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button onClick={exportToCSV} className="btn-primary" style={{ backgroundColor: "var(--color-success)", marginLeft: "auto" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              CSV 다운로드
            </button>
          </div>

          <div className="table-responsive" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <table className="custom-table">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              <thead style={{ backgroundColor: "var(--bg-card-alt)", zIndex: 1 }}>
                <tr>
                  <th style={{ textAlign: "center" }}>발생 시간</th>
                  <th style={{ textAlign: "center" }}>이름(아이디)</th>
                  <th style={{ textAlign: "center" }}>출발지 IP</th>
                  <th style={{ textAlign: "center" }}>목적지 도메인</th>
                  <th style={{ textAlign: "center" }}>AI 위협 점수</th>
                  <th style={{ textAlign: "center" }}>처리 결과</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((log, idx) => (
                  <tr key={log.isEmpty ? `empty-${idx}` : `${log.domain}-${log.time || idx}`} style={{ height: "10%" }}>
                    {log.isEmpty ? (
                      <td colSpan="6">&nbsp;</td>
                    ) : (
                      <>
                        <td style={{ textAlign: "center", color: "var(--text-muted)" }}>{log.time}</td>
                        <td
                          style={{ textAlign: "center", fontWeight: "600", color: "var(--color-primary)", cursor: log.violator !== "내부 단말" ? "pointer" : "default", textDecoration: log.violator !== "내부 단말" ? "underline" : "none" }}
                          onClick={() => handleEmpClick(log.violator)}
                        >
                          {log.violator}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "monospace", color: "var(--text-main)" }}>{log.ip || "-"}</td>
                        <td style={{ textAlign: "left", paddingLeft: "16px", fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: log.type === "정상" ? (aiSuspiciousDomains.includes(log.domain) ? "var(--color-warning)" : "var(--text-main)") : "var(--color-danger)" }}>
                          {log.domain}
                        </td>
                        <td style={{ textAlign: "center", fontWeight: "bold", color: log.ai_score >= 50 ? "var(--color-danger)" : log.ai_score >= 31 ? "var(--color-warning)" : "var(--text-muted)" }}>
                          {log.ai_score >= 0 && log.ai_score !== null && log.ai_score !== undefined ? `${log.ai_score}점` : "-"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {log.type === "차단" ? (
                            <span className="status-badge badge-danger">차단 (룰셋)</span>
                          ) : aiSuspiciousDomains.includes(log.domain) ? (
                            <span className="status-badge badge-warning">AI 의심 통과</span>
                          ) : (
                            <span className="status-badge badge-success">정상 통과</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      {isModalOpen && selectedSecurity && (
        <div onClick={() => setIsModalOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "var(--bg-main)", padding: "24px", borderRadius: "16px", width: "1200px", maxWidth: "95vw", height: "85vh", display: "flex", flexDirection: "column", border: "1px solid var(--border-color)", boxShadow: "0 25px 45px -12px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "14px", flexShrink: 0 }}>
              <h3 style={{ margin: "0", color: "var(--text-title)", fontSize: "20px", fontWeight: "bold", letterSpacing: "-0.5px" }}>단말 보안 관제 상세</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "14px", backgroundColor: "var(--bg-card)", height: "36px", display: "flex", alignItems: "center", padding: "0 16px", borderRadius: "6px", border: "1px solid var(--border-color)", fontWeight: "600", color: "var(--text-title)" }}>
                  ID: {selectedSecurity.employee_id}
                </span>
                <button className="btn-action-edit" onClick={() => setIsModalOpen(false)}>닫기</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "20px", flex: 1, minHeight: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "12px" }}>
                <div style={{ backgroundColor: "var(--bg-card)", padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", marginBottom: "10px", fontWeight: "bold" }}>
                    <span style={{ color: "var(--text-title)" }}>단말 보안 건전성</span>
                    <span style={{ color: theme.color }}>{selectedSecurity?.security_score}점 ({theme.label})</span>
                  </div>
                  <div style={{ width: "100%", height: "10px", backgroundColor: "var(--border-color)", borderRadius: "5px", overflow: "hidden", marginBottom: "10px" }}>
                    <div style={{ width: `${selectedSecurity?.security_score}%`, height: "100%", backgroundColor: theme.color }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                    <span>정상: {selectedSecurity?.normal_access_count}건</span>
                    <span>차단 누적: {selectedSecurity?.violation_count}건</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ backgroundColor: "var(--bg-card)", padding: "14px 16px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>사원명 / 권한</span>
                    <strong style={{ display: "block", fontSize: "16px", marginTop: "4px", color: "var(--text-title)" }}>{selectedSecurity.name}</strong>
                    <span style={{ display: "inline-block", marginTop: "8px", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "4px", backgroundColor: "var(--bg-main)", color: "var(--color-primary)", border: "1px solid var(--border-color)" }}>
                      {selectedSecurity.is_manager ? "관리자" : "일반사원"}
                    </span>
                  </div>
                  <div style={{ backgroundColor: "var(--bg-card)", padding: "14px 16px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>접속 IP</span>
                    <strong style={{ display: "block", fontSize: "16px", marginTop: "4px", color: "var(--color-success)" }}>{selectedSecurity.current_ip}</strong>
                    <span style={{ display: "inline-block", marginTop: "8px", fontFamily: "monospace", fontSize: "11px", backgroundColor: "var(--bg-main)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
                      MAC: {selectedSecurity.current_mac || "-"}
                    </span>
                  </div>
                </div>

                <div style={{ backgroundColor: theme.bg, padding: "16px 20px", borderRadius: "12px", border: theme.border, display: "flex", flexDirection: "column", gap: "10px", flex: 1, minHeight: 0 }}>
                  <span style={{ color: "var(--text-title)", fontSize: "15px", fontWeight: "bold" }}>AI 보안 어드바이저 분석</span>
                  <p
                    style={{ fontSize: "13.5px", color: "var(--text-main)", lineHeight: "1.65", margin: 0, flex: 1, overflowY: "auto", whiteSpace: "pre-wrap" }}
                    dangerouslySetInnerHTML={{ __html: selectedSecurity.security_advisor ? selectedSecurity.security_advisor.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") : "분석 중..." }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: "var(--bg-card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                <h4 style={{ fontSize: "16px", margin: "0 0 16px 0", color: "var(--text-title)", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>최근 주요 접근 로그</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {selectedSecurity.external_access_logs?.slice(0, 20).map((log, i) => (
                    <div key={`modal-log-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: log.is_blocked ? "rgba(239,68,68,0.05)" : "var(--bg-main)", borderRadius: "8px", border: `1px solid ${log.is_blocked ? "rgba(239,68,68,0.2)" : "var(--border-color)"}` }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontWeight: "bold", fontSize: "14px", color: log.is_blocked ? "var(--color-danger)" : "var(--text-main)" }}>{log.domain}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{log.time}</span>
                      </div>
                      <span className={log.is_blocked ? "status-badge badge-danger" : "status-badge badge-success"}>{log.status}</span>
                    </div>
                  ))}
                  {(!selectedSecurity.external_access_logs || selectedSecurity.external_access_logs.length === 0) && (
                    <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "13px" }}>로그 기록이 없습니다.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogAnalysis;