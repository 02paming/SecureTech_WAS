import axios from "axios";
import { useCallback, useEffect, useState } from "react";

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

const PolicyManage = () => {
  const [policies, setPolicies] = useState([]);
  const [whitePolicies, setWhitePolicies] = useState([]);
  const [newDomain, setNewDomain] = useState("");
  const [whiteDomain, setWhiteDomain] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [whitePage, setWhitePage] = useState(1);
  const itemsPerPage = 10;

  const [authModal, setAuthModal] = useState({ isOpen: false, action: null, domain: "" });
  const [adminId, setAdminId] = useState("admin");
  const [adminPw, setAdminPw] = useState("");

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`).replace(/\/+$/, "");

  const fetchPolicies = useCallback(async () => {
    try {
      const [resBlock, resWhite] = await Promise.all([
        axios.get(`${baseUrl}/api/policies/blocklist/`),
        axios.get(`${baseUrl}/api/policies/whitelist/`),
      ]);
      setPolicies(Array.isArray(resBlock.data) ? resBlock.data : []);
      setWhitePolicies(Array.isArray(resWhite.data) ? resWhite.data : []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("정책 조회 실패:", err);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchPolicies();
    const interval = setInterval(fetchPolicies, 60000);
    return () => clearInterval(interval);
  }, [fetchPolicies]);

  const handleAddPolicy = async (e) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      await axios.post(`${baseUrl}/api/policies/add/`, { blacklist_domain: newDomain.trim() });
      setNewDomain("");
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || "차단 등록 실패");
    }
  };

  const handleDeletePolicy = async (domain) => {
    if (!window.confirm(`'${domain}' 차단 정책을 해제하시겠습니까?`)) return;
    try {
      await axios.post(`${baseUrl}/api/policies/delete/`, { blacklist_domain: domain });
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || "차단 해제 실패");
    }
  };

  const handleAddWhitePolicy = async (e) => {
    e.preventDefault();
    if (!whiteDomain.trim()) return;
    try {
      await axios.post(`${baseUrl}/api/policies/whitelist/add/`, { domain: whiteDomain.trim() });
      setWhiteDomain("");
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || "허용 등록 실패");
    }
  };

  const handleDeleteWhitePolicy = async (domain) => {
    if (!window.confirm(`'${domain}' 허용 정책을 해제하시겠습니까?`)) return;
    try {
      await axios.post(`${baseUrl}/api/policies/whitelist/delete/`, { domain });
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || "허용 해제 실패");
    }
  };

  const handleAuthRequest = (action, domain) => {
    setAuthModal({ isOpen: true, action, domain });
    setAdminPw("");
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authModal.action === "upgrade" ? "/api/policies/whitelist/upgrade/" : "/api/policies/whitelist/force-delete/";
      await axios.post(`${baseUrl}${endpoint}`, { domain: authModal.domain, employee_id: adminId, password: adminPw });
      setAuthModal({ isOpen: false, action: null, domain: "" });
      fetchPolicies();
      alert(authModal.action === "upgrade" ? "시스템 기본 보호 도메인으로 격상되었습니다." : "보호가 해제되었습니다.");
    } catch (err) {
      alert(err.response?.data?.error || "인증 실패");
    }
  };

  const paginatedWhite = padRows(whitePolicies.slice((whitePage - 1) * itemsPerPage, whitePage * itemsPerPage), itemsPerPage);
  const paginatedBlock = padRows(policies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), itemsPerPage);

  return (
    <div className="page-container admin-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">차단 및 허용 정책 관리</h2>
          <p className="page-subtitle">네트워크 접근 제어를 위한 도메인 허용/차단 목록 통합 관리 (수동 정책)</p>
        </div>
        <div className="header-actions">
          <span className="header-time">갱신: {lastUpdated || "-"}</span>
          <button onClick={fetchPolicies} className="btn-primary">동기화</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", flex: 1, minHeight: 0 }}>
        {/* 허용 도메인 */}
        <div className="card dashboard-card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title" style={{ color: "var(--color-success)" }}>허용 도메인 주소</h3>
            <span style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>총 {whitePolicies.length}건</span>
          </div>
          <form onSubmit={handleAddWhitePolicy} style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <input type="text" className="custom-input" placeholder="도메인 입력 (예: safe.com)" value={whiteDomain} onChange={(e) => setWhiteDomain(e.target.value)} required />
            <button type="submit" className="btn-primary" style={{ backgroundColor: "var(--color-success)" }}>허용</button>
          </form>
          <div className="table-responsive" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <table className="custom-table">
              <thead style={{ backgroundColor: "var(--bg-card-alt)" }}>
                <tr>
                  <th style={{ width: "60px", textAlign: "center" }}>No</th>
                  <th style={{ textAlign: "center" }}>허용 도메인 주소 (URL)</th>
                  <th style={{ width: "140px", textAlign: "center" }}>조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWhite.map((p, idx) => (
                  <tr key={p.isEmpty ? `white-empty-${idx}` : p.domain} style={{ height: "10%" }}>
                    {p.isEmpty ? (
                      <td colSpan="3">&nbsp;</td>
                    ) : (
                      <>
                        <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>{(whitePage - 1) * itemsPerPage + idx + 1}</td>
                        <td style={{ textAlign: "left", paddingLeft: "24px", fontWeight: "600", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.is_protected ? "var(--color-primary)" : "var(--text-title)" }}>
                          {p.domain}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {/* 💡 합의된 디자인 룰: 2글자 55px 강제 고정 (.btn-w-sm) 및 토글 텍스트 통일 */}
                          {p.is_protected ? (
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center" }}>
                              <span className="status-badge badge-primary btn-w-sm">보호</span>
                              <button type="button" onClick={() => handleAuthRequest("force_delete", p.domain)} className="btn-action btn-w-sm" style={{ backgroundColor: "var(--color-danger)", color: "#fff", border: "none" }}>해제</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                              <button type="button" onClick={() => handleAuthRequest("upgrade", p.domain)} className="btn-action-outline btn-w-sm">보호</button>
                              <button type="button" onClick={() => handleDeleteWhitePolicy(p.domain)} className="btn-action btn-w-sm" style={{ backgroundColor: "var(--color-danger)", color: "#fff", border: "none" }}>해제</button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={whitePage} totalPages={Math.ceil(whitePolicies.length / itemsPerPage) || 1} onPageChange={setWhitePage} />
        </div>

        {/* 차단 도메인 */}
        <div className="card dashboard-card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title" style={{ color: "var(--color-danger)" }}>차단 도메인 주소</h3>
            <span style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-danger)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>총 {policies.length}건</span>
          </div>
          <form onSubmit={handleAddPolicy} style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <input type="text" className="custom-input" placeholder="도메인 입력 (예: evil.com)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} required />
            <button type="submit" className="btn-primary" style={{ backgroundColor: "var(--color-danger)" }}>차단</button>
          </form>
          <div className="table-responsive" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <table className="custom-table">
              <thead style={{ backgroundColor: "var(--bg-card-alt)" }}>
                <tr>
                  <th style={{ width: "60px", textAlign: "center" }}>No</th>
                  <th style={{ textAlign: "center" }}>차단 도메인 주소 (URL)</th>
                  <th style={{ width: "100px", textAlign: "center" }}>조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBlock.map((p, idx) => (
                  <tr key={p.isEmpty ? `block-empty-${idx}` : p.blacklist_domain} style={{ height: "10%" }}>
                    {p.isEmpty ? (
                      <td colSpan="3">&nbsp;</td>
                    ) : (
                      <>
                        <td style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                        <td style={{ textAlign: "left", paddingLeft: "24px", fontWeight: "600", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-title)" }}>
                          {p.blacklist_domain}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button type="button" onClick={() => handleDeletePolicy(p.blacklist_domain)} className="btn-action btn-w-sm" style={{ backgroundColor: "var(--color-success)", color: "#fff", border: "none" }}>해제</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={currentPage} totalPages={Math.ceil(policies.length / itemsPerPage) || 1} onPageChange={setCurrentPage} />
        </div>
      </div>

      {authModal.isOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "var(--bg-card)", padding: "30px", borderRadius: "12px", width: "400px", border: "1px solid var(--border-color)" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "var(--text-title)", fontSize: "18px", letterSpacing: "-0.5px" }}>
              {authModal.action === "upgrade" ? "시스템 보호 도메인 등록" : "시스템 보호 해제 인증"}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              <strong>{authModal.domain}</strong> 도메인 제어를 위해 통제실 PC(192.168.3.23)에서 관리자 인증을 진행해주세요.
            </p>
            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input type="text" className="custom-input" value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="관리자 ID" required />
              <input type="password" className="custom-input" value={adminPw} onChange={(e) => setAdminPw(e.target.value)} placeholder="관리자 비밀번호" required autoFocus />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setAuthModal({ isOpen: false, action: null, domain: "" })} className="btn-action-edit">취소</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: authModal.action === "upgrade" ? "var(--color-primary)" : "var(--color-danger)", border: "none" }}>인증 및 적용</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyManage;