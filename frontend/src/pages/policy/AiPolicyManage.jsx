import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) padded.push({ isEmpty: true });
  return padded;
};

const getStoredUser = () => {
  try {
    const u = sessionStorage.getItem("user") || localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
};

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
    <div style={{ display: "flex", justifyContent: "center", gap: "6px", paddingTop: "14px", flexShrink: 0 }}>
      <button onClick={() => onPageChange(Math.max(page - 1, 1))} disabled={page === 1} style={{ backgroundColor: "var(--bg-main)", border: "1px solid var(--border-color)", borderRadius: "6px", height: "30px", padding: "0 12px", fontSize: "12px", color: "var(--text-main)", cursor: page === 1 ? "not-allowed" : "pointer", fontWeight: "600" }}>이전</button>
      {getPageNumbers().map((p) => (
        <button key={p} onClick={() => onPageChange(p)} style={{ backgroundColor: page === p ? "var(--color-primary)" : "var(--bg-main)", color: page === p ? "#fff" : "var(--text-main)", border: page === p ? "1px solid var(--color-primary)" : "1px solid var(--border-color)", borderRadius: "6px", minWidth: "30px", height: "30px", padding: "0 6px", fontSize: "12px", cursor: "pointer", fontWeight: page === p ? "bold" : "normal" }}>{p}</button>
      ))}
      <button onClick={() => onPageChange(Math.min(page + 1, totalPages))} disabled={page === totalPages} style={{ backgroundColor: "var(--bg-main)", border: "1px solid var(--border-color)", borderRadius: "6px", height: "30px", padding: "0 12px", fontSize: "12px", color: "var(--text-main)", cursor: page === totalPages ? "not-allowed" : "pointer", fontWeight: "600" }}>다음</button>
    </div>
  );
}

const AiPolicyManage = () => {
  const [aiData, setAiData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [whitePage, setWhitePage] = useState(1);
  const [blackPage, setBlackPage] = useState(1);

  const [whiteSuspiciousOnly, setWhiteSuspiciousOnly] = useState(false);
  const [blackSuspiciousOnly, setBlackSuspiciousOnly] = useState(false);

  const [selectedWhite, setSelectedWhite] = useState([]);
  const [selectedBlack, setSelectedBlack] = useState([]);
  const itemsPerPage = 10;

  const [authModal, setAuthModal] = useState({ isOpen: false, domains: [], action: "" });
  const [adminPassword, setAdminPassword] = useState("");

  const baseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`).replace(/\/+$/, ""), []);

  const fetchAiPolicies = useCallback(async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/policies/ai/`);
      setAiData(res.data.ai_data || []);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
      setSelectedWhite([]);
      setSelectedBlack([]);
    } catch (err) {
      console.error("AI 정책 조회 실패:", err);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchAiPolicies();
    const interval = setInterval(fetchAiPolicies, 600000);
    return () => clearInterval(interval);
  }, [fetchAiPolicies]);

  const openAuthModal = (domains, action) => {
    if (domains.length === 0) return;
    setAuthModal({ isOpen: true, domains, action });
  };
  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, domains: [], action: "" });
    setAdminPassword("");
  };

  const confirmPromote = async () => {
    if (!adminPassword) return alert("비밀번호를 입력해주세요.");
    const user = getStoredUser();
    const empId = user?.employee_id || user?.emp_id;
    if (!empId) return alert("로그인 정보가 만료되었습니다. 다시 로그인 해주세요.");

    try {
      await axios.post(`${baseUrl}/api/policies/promote/`, {
        domains: authModal.domains, action: authModal.action, employee_id: empId, password: adminPassword,
      });
      alert(`성공적으로 수동 정책으로 이관되었습니다.`);
      closeAuthModal();
      fetchAiPolicies();
    } catch (err) {
      alert(err.response?.data?.error || "이관 실패 (비밀번호 확인)");
    }
  };

  const filteredData = useMemo(() => aiData.filter((d) => (d.domain || "").toLowerCase().includes(searchTerm.toLowerCase())), [aiData, searchTerm]);

  const whiteListAll = useMemo(() => filteredData.filter((d) => d.source === "white" && (!whiteSuspiciousOnly || d.ai_status === "의심")), [filteredData, whiteSuspiciousOnly]);
  const blackListAll = useMemo(() => filteredData.filter((d) => d.source === "black" && (!blackSuspiciousOnly || d.ai_status === "의심")), [filteredData, blackSuspiciousOnly]);

  const paginatedWhite = useMemo(() => padRows(whiteListAll.slice((whitePage - 1) * itemsPerPage, whitePage * itemsPerPage), itemsPerPage), [whiteListAll, whitePage]);
  const paginatedBlack = useMemo(() => padRows(blackListAll.slice((blackPage - 1) * itemsPerPage, blackPage * itemsPerPage), itemsPerPage), [blackListAll, blackPage]);

  const toggleSelect = (domain, selectedList, setSelectedList) => {
    setSelectedList((prev) => prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]);
  };
  const toggleSelectAll = (paginatedData, selectedList, setSelectedList) => {
    const currentDomains = paginatedData.filter((p) => !p.isEmpty).map((p) => p.domain);
    const allSelected = currentDomains.length > 0 && currentDomains.every((d) => selectedList.includes(d));
    if (allSelected) setSelectedList((prev) => prev.filter((d) => !currentDomains.includes(d)));
    else setSelectedList((prev) => [...new Set([...prev, ...currentDomains])]);
  };

  const renderBadge = (source, aiStatus) => {
    if (source === "white" && aiStatus === "AI") {
      return <span style={{ color: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>AI 안전</span>;
    }
    if (source === "white" && aiStatus === "의심") {
      return <span style={{ color: "#059669", backgroundColor: "rgba(5, 150, 105, 0.15)", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", border: "1px solid #059669" }}>화이트 의심</span>;
    }
    if (source === "black" && aiStatus === "의심") {
      return <span style={{ color: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.15)", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", border: "1px solid #d97706" }}>블랙 의심</span>;
    }
    if (source === "black" && aiStatus === "AI") {
      return <span style={{ color: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.15)", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>AI 위험</span>;
    }
    return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>-</span>;
  };

  return (
    <div className="page-container admin-page">
      {authModal.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ backgroundColor: "var(--bg-card)", padding: "24px", borderRadius: "12px", width: "350px", border: "1px solid var(--border-color)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "var(--text-main)", fontSize: "16px" }}>🔒 관리자 권한 확인</h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.5" }}>선택한 <strong>{authModal.domains.length}건</strong>의 도메인을 <br />정식 수동 정책으로 이관하시려면<br />관리자 비밀번호를 입력해주세요.</p>
            <input type="password" placeholder="비밀번호 입력" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmPromote()} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", marginBottom: "20px" }} autoFocus />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={closeAuthModal} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px" }}>취소</button>
              <button onClick={confirmPromote} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "var(--color-primary)", color: "#fff", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>승인 및 이관</button>
            </div>
          </div>
        </div>
      )}

      {/* 💡 [핵심 수정] 헤더 영역을 차단 정책 관리와 100% 동일하게 구성 */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 className="page-title">🤖 AI 탐지 도메인 이관 현황</h2>
          <p className="page-subtitle">엔진이 자동으로 수집한 의심/안전 도메인을 정식 사용자 정책으로 이관합니다.</p>
        </div>

        {/* 우측 정렬: 검색창 + 시간 + 버튼 */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <input type="text" placeholder="도메인 검색..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setWhitePage(1); setBlackPage(1); }} className="custom-input search-input" style={{ width: "220px", height: "36px", padding: "0 12px", fontSize: "13px", borderRadius: "6px" }} />
          <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>갱신: {lastUpdated || "-"}</span>
          <button onClick={fetchAiPolicies} className="btn-action btn-action-edit" style={{ height: "36px", padding: "0 16px", fontSize: "13px", fontWeight: "bold", margin: 0, whiteSpace: "nowrap" }}>
            🔄 동기화
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", flex: 1, minHeight: 0 }}>
        {/* 왼쪽: AI 화이트 리스트 */}
        <div className="card dashboard-card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", margin: 0 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 className="card-title" style={{ color: "#10b981", margin: 0, fontSize: "17px" }}>🟢 AI 판별 (안전/의심)</h3>
              <span style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold" }}>총 {whiteListAll.length}건</span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setWhiteSuspiciousOnly(!whiteSuspiciousOnly); setWhitePage(1); }}
                style={{ height: "32px", padding: "0 12px", fontSize: "12px", fontWeight: "bold", borderRadius: "6px", cursor: "pointer", border: whiteSuspiciousOnly ? "1px solid #059669" : "1px solid var(--border-color)", backgroundColor: whiteSuspiciousOnly ? "rgba(5, 150, 105, 0.1)" : "transparent", color: whiteSuspiciousOnly ? "#059669" : "var(--text-muted)", transition: "all 0.2s" }}
              >
                {whiteSuspiciousOnly ? "⚠️ 의심 필터 ON" : "⚠️ 의심만 보기"}
              </button>
              <button
                onClick={() => openAuthModal(selectedWhite, "to_user_white")}
                disabled={selectedWhite.length === 0}
                style={{ backgroundColor: "#10b981", color: "#fff", border: "none", height: "32px", padding: "0 16px", fontSize: "12px", fontWeight: "bold", borderRadius: "6px", cursor: selectedWhite.length === 0 ? "not-allowed" : "pointer", opacity: selectedWhite.length === 0 ? 0.4 : 1, transition: "opacity 0.2s" }}
              >✅ 선택 일괄 정식 허용 ({selectedWhite.length})</button>
            </div>
          </div>
          <div className="table-responsive" style={{ flex: 1, overflow: "hidden", border: "1px solid var(--border-color)", borderRadius: "6px", display: "flex", flexDirection: "column" }}>
            <table className="custom-table" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", margin: 0, height: "100%" }}>
              <thead style={{ backgroundColor: "var(--bg-card-alt)" }}>
                <tr style={{ height: "40px", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ width: "40px", textAlign: "center" }}><input type="checkbox" onChange={() => toggleSelectAll(paginatedWhite, selectedWhite, setSelectedWhite)} checked={paginatedWhite.filter((p) => !p.isEmpty).length > 0 && paginatedWhite.filter((p) => !p.isEmpty).every((p) => selectedWhite.includes(p.domain))} /></th>
                  <th style={{ width: "80px", color: "#10b981", textAlign: "center" }}>상태</th>
                  <th style={{ color: "#10b981", textAlign: "left", paddingLeft: "10px" }}>도메인 (URL)</th>
                  <th style={{ width: "140px", color: "#10b981", textAlign: "center" }}>탐지 일시</th>
                  <th style={{ width: "80px", color: "#10b981", textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody style={{ flex: 1 }}>
                {paginatedWhite.map((p, idx) => (
                  <tr key={p.isEmpty ? `w-empty-${idx}` : p.domain} style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: p.ai_status === "의심" ? "rgba(5, 150, 105, 0.05)" : "transparent", height: `calc(100% / ${itemsPerPage})` }}>
                    {p.isEmpty ? (<td colSpan="5">&nbsp;</td>) : (
                      <>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={selectedWhite.includes(p.domain)} onChange={() => toggleSelect(p.domain, selectedWhite, setSelectedWhite)} /></td>
                        <td style={{ textAlign: "center" }}>{renderBadge("white", p.ai_status)}</td>
                        <td style={{ textAlign: "left", paddingLeft: "10px", fontWeight: "600", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-title)" }}>
                          {p.domain}
                        </td>
                        <td style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>{p.detect_time}</td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => openAuthModal([p.domain], "to_user_white")} className="btn-action" style={{ height: "26px", padding: "0 10px", backgroundColor: "#10b981", color: "#fff", border: "none", fontSize: "11px", fontWeight: "bold" }}>허용 이관</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={whitePage} totalPages={Math.ceil(whiteListAll.length / itemsPerPage) || 1} onPageChange={setWhitePage} />
        </div>

        {/* 오른쪽: AI 블랙 리스트 */}
        <div className="card dashboard-card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", margin: 0 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 className="card-title" style={{ color: "#ef4444", margin: 0, fontSize: "17px" }}>🛑 AI 판별 (위험/의심)</h3>
              <span style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold" }}>총 {blackListAll.length}건</span>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setBlackSuspiciousOnly(!blackSuspiciousOnly); setBlackPage(1); }}
                style={{ height: "32px", padding: "0 12px", fontSize: "12px", fontWeight: "bold", borderRadius: "6px", cursor: "pointer", border: blackSuspiciousOnly ? "1px solid #d97706" : "1px solid var(--border-color)", backgroundColor: blackSuspiciousOnly ? "rgba(217, 119, 6, 0.1)" : "transparent", color: blackSuspiciousOnly ? "#d97706" : "var(--text-muted)", transition: "all 0.2s" }}
              >
                {blackSuspiciousOnly ? "⚠️ 의심 필터 ON" : "⚠️ 의심만 보기"}
              </button>
              <button
                onClick={() => openAuthModal(selectedBlack, "to_user_black")}
                disabled={selectedBlack.length === 0}
                style={{ backgroundColor: "#ef4444", color: "#fff", border: "none", height: "32px", padding: "0 16px", fontSize: "12px", fontWeight: "bold", borderRadius: "6px", cursor: selectedBlack.length === 0 ? "not-allowed" : "pointer", opacity: selectedBlack.length === 0 ? 0.4 : 1, transition: "opacity 0.2s" }}
              >🛑 선택 일괄 정식 차단 ({selectedBlack.length})</button>
            </div>
          </div>
          <div className="table-responsive" style={{ flex: 1, overflow: "hidden", border: "1px solid var(--border-color)", borderRadius: "6px", display: "flex", flexDirection: "column" }}>
            <table className="custom-table" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", margin: 0, height: "100%" }}>
              <thead style={{ backgroundColor: "var(--bg-card-alt)" }}>
                <tr style={{ height: "40px", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ width: "40px", textAlign: "center" }}><input type="checkbox" onChange={() => toggleSelectAll(paginatedBlack, selectedBlack, setSelectedBlack)} checked={paginatedBlack.filter((p) => !p.isEmpty).length > 0 && paginatedBlack.filter((p) => !p.isEmpty).every((p) => selectedBlack.includes(p.domain))} /></th>
                  <th style={{ width: "80px", color: "var(--color-danger)", textAlign: "center" }}>상태</th>
                  <th style={{ color: "var(--color-danger)", textAlign: "left", paddingLeft: "10px" }}>도메인 (URL)</th>
                  <th style={{ width: "140px", color: "var(--color-danger)", textAlign: "center" }}>탐지 일시</th>
                  <th style={{ width: "80px", color: "var(--color-danger)", textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody style={{ flex: 1 }}>
                {paginatedBlack.map((p, idx) => (
                  <tr key={p.isEmpty ? `b-empty-${idx}` : p.domain} style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: !p.isEmpty && p.ai_status === "의심" ? "rgba(217, 119, 6, 0.05)" : "transparent", height: `calc(100% / ${itemsPerPage})` }}>
                    {p.isEmpty ? (<td colSpan="5">&nbsp;</td>) : (
                      <>
                        <td style={{ textAlign: "center" }}><input type="checkbox" checked={selectedBlack.includes(p.domain)} onChange={() => toggleSelect(p.domain, selectedBlack, setSelectedBlack)} /></td>
                        <td style={{ textAlign: "center" }}>{renderBadge("black", p.ai_status)}</td>
                        <td style={{ textAlign: "left", paddingLeft: "10px", fontWeight: "600", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-title)" }}>
                          {p.domain}
                        </td>
                        <td style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>{p.detect_time}</td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => openAuthModal([p.domain], "to_user_black")} className="btn-action" style={{ height: "26px", padding: "0 10px", backgroundColor: "#ef4444", color: "#fff", border: "none", fontSize: "11px", fontWeight: "bold" }}>차단 이관</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={blackPage} totalPages={Math.ceil(blackListAll.length / itemsPerPage) || 1} onPageChange={setBlackPage} />
        </div>
      </div>
    </div>
  );
};

export default AiPolicyManage;