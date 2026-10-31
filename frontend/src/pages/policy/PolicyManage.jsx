import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) padded.push({ isEmpty: true });
  return padded;
};

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

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`).replace(/\/+$/, "");

  const fetchPolicies = useCallback(async () => {
    try {
      const [resBlock, resWhite] = await Promise.all([
        axios.get(`${baseUrl}/api/policies/blocklist/`),
        axios.get(`${baseUrl}/api/policies/whitelist/`),
      ]);
      setPolicies(Array.isArray(resBlock.data) ? resBlock.data : []);
      setWhitePolicies(Array.isArray(resWhite.data) ? resWhite.data : []);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
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
  };

  const handleAuthSubmit = async (credentials) => {
    try {
      const endpoint = authModal.action === "upgrade" ? "/api/policies/whitelist/upgrade/" : "/api/policies/whitelist/force-delete/";
      await axios.post(`${baseUrl}${endpoint}`, { domain: authModal.domain, ...credentials });
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
      <PageHeader
        title="차단 및 허용 정책 관리"
        subtitle="네트워크 접근 제어를 위한 도메인 허용/차단 목록 통합 관리 (수동 정책)"
        lastUpdated={lastUpdated}
        onRefresh={fetchPolicies}
      />

      <div className="panel-row">
        {/* 허용 도메인 */}
        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <h3 className="card-title title-success">허용 도메인 주소</h3>
            <span className="count-badge badge-success">총 {whitePolicies.length}건</span>
          </div>
          <form onSubmit={handleAddWhitePolicy} className="inline-form">
            <input type="text" className="custom-input search-input" placeholder="도메인 입력 (예: safe.com)" value={whiteDomain} onChange={(e) => setWhiteDomain(e.target.value)} required />
            <button type="submit" className="btn-action btn-success btn-w-md btn-header">허용</button>
          </form>
          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-no">No</th>
                  <th className="th-main">허용 도메인 주소 (URL)</th>
                  <th className="col-action">조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWhite.map((p, idx) => (
                  <tr key={p.isEmpty ? `white-empty-${idx}` : p.domain}>
                    {p.isEmpty ? (
                      <td colSpan="3">&nbsp;</td>
                    ) : (
                      <>
                        <td className="cell-no">{(whitePage - 1) * itemsPerPage + idx + 1}</td>
                        <td className={`cell-main ${p.is_protected ? "is-protected" : ""}`}>{p.domain}</td>
                        <td>
                          <div className="action-btn-group">
                            {p.is_protected ? (
                              <>
                                <span className="status-badge badge-outline btn-w-sm">보호</span>
                                <button type="button" onClick={() => handleAuthRequest("force_delete", p.domain)} className="btn-action btn-danger btn-w-sm">해제</button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => handleAuthRequest("upgrade", p.domain)} className="btn-action btn-primary btn-w-sm">보호</button>
                                <button type="button" onClick={() => handleDeleteWhitePolicy(p.domain)} className="btn-action btn-danger btn-w-sm">해제</button>
                              </>
                            )}
                          </div>
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
        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <h3 className="card-title title-danger">차단 도메인 주소</h3>
            <span className="count-badge badge-danger">총 {policies.length}건</span>
          </div>
          <form onSubmit={handleAddPolicy} className="inline-form">
            <input type="text" className="custom-input search-input" placeholder="도메인 입력 (예: evil.com)" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} required />
            <button type="submit" className="btn-action btn-danger btn-w-md btn-header">차단</button>
          </form>
          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-no">No</th>
                  <th className="th-main">차단 도메인 주소 (URL)</th>
                  <th className="col-action">조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBlock.map((p, idx) => (
                  <tr key={p.isEmpty ? `block-empty-${idx}` : p.blacklist_domain}>
                    {p.isEmpty ? (
                      <td colSpan="3">&nbsp;</td>
                    ) : (
                      <>
                        <td className="cell-no">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                        <td className="cell-main">{p.blacklist_domain}</td>
                        <td>
                          <div className="action-btn-group">
                            <button type="button" onClick={() => handleDeletePolicy(p.blacklist_domain)} className="btn-action btn-danger btn-w-sm">해제</button>
                          </div>
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
        <AdminAuthDialog
          title={authModal.action === "upgrade" ? "시스템 보호 도메인 등록" : "시스템 보호 해제 인증"}
          target={authModal.domain}
          danger={authModal.action !== "upgrade"}
          onSubmit={handleAuthSubmit}
          onCancel={() => setAuthModal({ isOpen: false, action: null, domain: "" })}
        />
      )}
    </div>
  );
};

export default PolicyManage;