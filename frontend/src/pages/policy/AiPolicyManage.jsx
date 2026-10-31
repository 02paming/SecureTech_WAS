import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) padded.push({ isEmpty: true });
  return padded;
};

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
  };

  const confirmPromote = async (credentials) => {
    try {
      const res = await axios.post(`${baseUrl}/api/policies/promote/`, {
        domains: authModal.domains, action: authModal.action, ...credentials,
      });
      alert(res.data.message);
      closeAuthModal();
      fetchAiPolicies();
    } catch (err) {
      alert(err.response?.data?.error || "인증 실패");
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
    if (source === "white" && aiStatus === "AI") return <span className="status-badge badge-success">AI 안전</span>;
    if (source === "white" && aiStatus === "의심") return <span className="status-badge badge-warning">화이트 의심</span>;
    if (source === "black" && aiStatus === "의심") return <span className="status-badge badge-warning">블랙 의심</span>;
    if (source === "black" && aiStatus === "AI") return <span className="status-badge badge-danger">AI 위험</span>;
    return <span className="text-muted">-</span>;
  };

  // 의심은 관리자가 허용/차단을 결정하고, AI가 확정한 안전/위험은 해제만 가능
  const renderActions = (domain, aiStatus) => {
    if (aiStatus === "의심") {
      return (
        <div className="action-btn-group">
          <button type="button" onClick={() => openAuthModal([domain], "to_user_white")} className="btn-action btn-success btn-w-sm">허용 이관</button>
          <button type="button" onClick={() => openAuthModal([domain], "to_user_black")} className="btn-action btn-danger btn-w-sm">차단 이관</button>
        </div>
      );
    }
    return <button type="button" onClick={() => openAuthModal([domain], "release")} className="btn-action btn-danger btn-w-sm">해제</button>;
  };

  const AUTH_TITLES = {
    to_user_white: "AI 정책 허용 이관 인증",
    to_user_black: "AI 정책 차단 이관 인증",
    release: "AI 정책 해제 인증",
  };

  return (
    <div className="page-container admin-page">
      {authModal.isOpen && (
        <AdminAuthDialog
          title={AUTH_TITLES[authModal.action]}
          target={authModal.domains.length === 1 ? authModal.domains[0] : `선택한 ${authModal.domains.length}건의`}
          danger={authModal.action !== "to_user_white"}
          onSubmit={confirmPromote}
          onCancel={closeAuthModal}
        />
      )}

      <PageHeader
        title="AI 탐지 도메인 이관 현황"
        subtitle="엔진이 자동으로 수집한 의심/안전 도메인을 정식 사용자 정책으로 이관합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchAiPolicies}
      >
        <input type="text" placeholder="도메인 검색..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setWhitePage(1); setBlackPage(1); }} className="custom-input search-input" />
      </PageHeader>

      <div className="panel-row">
        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <div className="card-title-group">
              <h3 className="card-title title-success">AI 판별 (안전/의심)</h3>
              <span className="count-badge badge-success">총 {whiteListAll.length}건</span>
            </div>
            <div className="btn-group">
              <button
                type="button"
                onClick={() => { setWhiteSuspiciousOnly(!whiteSuspiciousOnly); setWhitePage(1); }}
                className={`btn-action btn-toggle btn-w-md btn-header ${whiteSuspiciousOnly ? "active" : ""}`}
              >
                의심만 보기
              </button>
              <button
                type="button"
                onClick={() => openAuthModal(selectedWhite, "to_user_white")}
                disabled={selectedWhite.length === 0}
                className="btn-action btn-success btn-w-auto btn-header"
              >
                선택 일괄 정식 허용 ({selectedWhite.length})
              </button>
            </div>
          </div>
          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" onChange={() => toggleSelectAll(paginatedWhite, selectedWhite, setSelectedWhite)} checked={paginatedWhite.filter((p) => !p.isEmpty).length > 0 && paginatedWhite.filter((p) => !p.isEmpty).every((p) => selectedWhite.includes(p.domain))} /></th>
                  <th className="col-status">상태</th>
                  <th className="th-main">도메인 (URL)</th>
                  <th className="col-action">관리</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWhite.map((p, idx) => (
                  <tr key={p.isEmpty ? `w-empty-${idx}` : p.domain} className={!p.isEmpty && p.ai_status === "의심" ? "row-warning" : ""}>
                    {p.isEmpty ? (<td colSpan="4">&nbsp;</td>) : (
                      <>
                        <td><input type="checkbox" checked={selectedWhite.includes(p.domain)} onChange={() => toggleSelect(p.domain, selectedWhite, setSelectedWhite)} /></td>
                        <td>{renderBadge("white", p.ai_status)}</td>
                        <td className="cell-main">{p.domain}</td>
                        <td>{renderActions(p.domain, p.ai_status)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={whitePage} totalPages={Math.ceil(whiteListAll.length / itemsPerPage) || 1} onPageChange={setWhitePage} />
        </div>

        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <div className="card-title-group">
              <h3 className="card-title title-danger">AI 판별 (위험/의심)</h3>
              <span className="count-badge badge-danger">총 {blackListAll.length}건</span>
            </div>
            <div className="btn-group">
              <button
                type="button"
                onClick={() => { setBlackSuspiciousOnly(!blackSuspiciousOnly); setBlackPage(1); }}
                className={`btn-action btn-toggle btn-w-md btn-header ${blackSuspiciousOnly ? "active" : ""}`}
              >
                의심만 보기
              </button>
              <button
                type="button"
                onClick={() => openAuthModal(selectedBlack, "to_user_black")}
                disabled={selectedBlack.length === 0}
                className="btn-action btn-danger btn-w-auto btn-header"
              >
                선택 일괄 정식 차단 ({selectedBlack.length})
              </button>
            </div>
          </div>
          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" onChange={() => toggleSelectAll(paginatedBlack, selectedBlack, setSelectedBlack)} checked={paginatedBlack.filter((p) => !p.isEmpty).length > 0 && paginatedBlack.filter((p) => !p.isEmpty).every((p) => selectedBlack.includes(p.domain))} /></th>
                  <th className="col-status">상태</th>
                  <th className="th-main">도메인 (URL)</th>
                  <th className="col-action">관리</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBlack.map((p, idx) => (
                  <tr key={p.isEmpty ? `b-empty-${idx}` : p.domain} className={!p.isEmpty && p.ai_status === "의심" ? "row-warning" : ""}>
                    {p.isEmpty ? (<td colSpan="4">&nbsp;</td>) : (
                      <>
                        <td><input type="checkbox" checked={selectedBlack.includes(p.domain)} onChange={() => toggleSelect(p.domain, selectedBlack, setSelectedBlack)} /></td>
                        <td>{renderBadge("black", p.ai_status)}</td>
                        <td className="cell-main">{p.domain}</td>
                        <td>{renderActions(p.domain, p.ai_status)}</td>
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