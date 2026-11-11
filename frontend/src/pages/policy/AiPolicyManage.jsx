// AI 엔진이 탐지한 위험 및 의심 도메인을 관리하고 수동 허용·차단 정책으로 이관하는 관리자 UI 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../../api";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import DomainDetailDialog from "../../components/DomainDetailDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { hasAiScore } from "../../utils/aiScore";
import { appAlert } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { padRows } from "../../utils/table";

const AiPolicyManage = () => {
  const [searchParams] = useSearchParams();
  const [aiData, setAiData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [detailDomain, setDetailDomain] = useState(
    () => searchParams.get("domain") || null,
  );

  // 검색 디바운스를 위한 상태 및 Ref 분리
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const searchTimeoutRef = useRef(null);

  const [whitePage, setWhitePage] = useState(1);
  const [blackPage, setBlackPage] = useState(1);

  const [whiteSuspiciousOnly, setWhiteSuspiciousOnly] = useState(false);
  const [blackSuspiciousOnly, setBlackSuspiciousOnly] = useState(false);

  const [selectedWhite, setSelectedWhite] = useState([]);
  const [selectedBlack, setSelectedBlack] = useState([]);
  const itemsPerPage = 10;

  const [authModal, setAuthModal] = useState({ isOpen: false, domains: [], action: "" });

  const baseUrl = API_BASE_URL;

  const fetchAiPolicies = useCallback(async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/policies/ai/`);
      setAiData(res.data.ai_data || []);
      setLastUpdated(formatTimeKR());
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

  // 컴포넌트 언마운트 시 작동 중인 타이머 안전하게 해제
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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
      await appAlert(res.data.message);
      closeAuthModal();
      fetchAiPolicies();
    } catch (err) {
      await appAlert(err.response?.data?.error || "인증에 실패했습니다.");
    }
  };

  // 검색어 입력 시 0.5초 대기 후 필터링을 한 번만 실행 (메인 스레드 연산 최소화)
  const handleSearchChange = useCallback((e) => {
    setSearchInput(e.target.value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(e.target.value);
      setWhitePage(1);
      setBlackPage(1);
    }, 500);
  }, []);

  const filteredData = useMemo(() => aiData.filter((d) => (d.domain || "").toLowerCase().includes(searchTerm.toLowerCase())), [aiData, searchTerm]);

  const whiteListAll = useMemo(() => filteredData.filter((d) => d.source === "white" && (!whiteSuspiciousOnly || d.ai_status === "DOUBT")), [filteredData, whiteSuspiciousOnly]);
  const blackListAll = useMemo(() => filteredData.filter((d) => d.source === "black" && (!blackSuspiciousOnly || d.ai_status === "DOUBT")), [filteredData, blackSuspiciousOnly]);

  const paginatedWhite = useMemo(() => padRows(whiteListAll.slice((whitePage - 1) * itemsPerPage, whitePage * itemsPerPage), itemsPerPage), [whiteListAll, whitePage]);
  const paginatedBlack = useMemo(() => padRows(blackListAll.slice((blackPage - 1) * itemsPerPage, blackPage * itemsPerPage), itemsPerPage), [blackListAll, blackPage]);

  const toggleSelect = (domain, setSelectedList) => {
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
    if (source === "white" && aiStatus === "DOUBT") return <span className="status-badge badge-score-yellow">화이트 의심</span>;
    if (source === "black" && aiStatus === "DOUBT") return <span className="status-badge badge-score-orange">블랙 의심</span>;
    if (source === "black" && aiStatus === "AI") return <span className="status-badge badge-danger">AI 위험</span>;
    return <span className="text-muted">-</span>;
  };

  const SCORE_TONES = { "white-AI": "text-success", "white-DOUBT": "text-score-yellow", "black-DOUBT": "text-score-orange", "black-AI": "text-danger" };

  const renderScore = (score, source, aiStatus) => (
    <span className={`fw-bold ${SCORE_TONES[`${source}-${aiStatus}`] || "text-muted"}`}>{hasAiScore(score) ? `${score}점` : "-"}</span>
  );

  const renderActions = (domain, aiStatus) => {
    if (aiStatus === "DOUBT") {
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
      {detailDomain && <DomainDetailDialog domain={detailDomain} onClose={() => setDetailDomain(null)} />}

      {authModal.isOpen && (
        <AdminAuthDialog
          title={AUTH_TITLES[authModal.action]}
          target={authModal.domains.length === 1 ? authModal.domains[0] : `선택한 ${authModal.domains.length}건`}
          danger={authModal.action !== "to_user_white"}
          onSubmit={confirmPromote}
          onCancel={closeAuthModal}
        />
      )}

      <PageHeader
        title="AI 탐지 도메인 관리"
        subtitle="AI 엔진이 판별한 도메인을 확인하고 수동 정책으로 이관합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchAiPolicies}
      >
        <input
          type="text"
          placeholder="도메인 검색..."
          value={searchInput}
          onChange={handleSearchChange}
          className="custom-input search-input"
        />
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
                선택 허용 이관 ({selectedWhite.length})
              </button>
            </div>
          </div>
          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" onChange={() => toggleSelectAll(paginatedWhite, selectedWhite, setSelectedWhite)} checked={paginatedWhite.filter((p) => !p.isEmpty).length > 0 && paginatedWhite.filter((p) => !p.isEmpty).every((p) => selectedWhite.includes(p.domain))} /></th>
                  <th className="col-status">정책 판단</th>
                  <th className="th-main">도메인</th>
                  <th className="col-status">AI 위협 점수</th>
                  <th className="col-action">조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWhite.map((p, idx) => (
                  <tr key={p.isEmpty ? `w-empty-${idx}` : p.domain}>
                    {p.isEmpty ? (<td colSpan="5">&nbsp;</td>) : (
                      <>
                        <td className="cell-check"><input type="checkbox" checked={selectedWhite.includes(p.domain)} onChange={() => toggleSelect(p.domain, setSelectedWhite)} /></td>
                        <td>{renderBadge("white", p.ai_status)}</td>
                        <td className="cell-main cell-clickable" onClick={() => setDetailDomain(p.domain)}>{p.domain}</td>
                        <td>{renderScore(p.ai_score, p.source, p.ai_status)}</td>
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
                선택 차단 이관 ({selectedBlack.length})
              </button>
            </div>
          </div>
          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-check"><input type="checkbox" onChange={() => toggleSelectAll(paginatedBlack, selectedBlack, setSelectedBlack)} checked={paginatedBlack.filter((p) => !p.isEmpty).length > 0 && paginatedBlack.filter((p) => !p.isEmpty).every((p) => selectedBlack.includes(p.domain))} /></th>
                  <th className="col-status">정책 판단</th>
                  <th className="th-main">도메인</th>
                  <th className="col-status">AI 위협 점수</th>
                  <th className="col-action">조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBlack.map((p, idx) => (
                  <tr key={p.isEmpty ? `b-empty-${idx}` : p.domain}>
                    {p.isEmpty ? (<td colSpan="5">&nbsp;</td>) : (
                      <>
                        <td className="cell-check"><input type="checkbox" checked={selectedBlack.includes(p.domain)} onChange={() => toggleSelect(p.domain, setSelectedBlack)} /></td>
                        <td>{renderBadge("black", p.ai_status)}</td>
                        <td className="cell-main cell-clickable" onClick={() => setDetailDomain(p.domain)}>{p.domain}</td>
                        <td>{renderScore(p.ai_score, p.source, p.ai_status)}</td>
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