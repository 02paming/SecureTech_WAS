// 관리자가 직접 허용 및 차단 도메인 정책을 등록, 조회, 해제하고 보호 도메인을 제어하는 관리자 UI 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../api";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import DomainDetailDialog from "../../components/DomainDetailDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { appAlert, appConfirm } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { padRows } from "../../utils/table";

const PolicyManage = () => {
  const [policies, setPolicies] = useState([]);
  const [whitePolicies, setWhitePolicies] = useState([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [detailDomain, setDetailDomain] = useState(null);

  // 검색 상태
  const [searchTerm, setSearchTerm] = useState("");

  // 등록 모달 상태 (type: 'white' | 'block')
  const [addModal, setAddModal] = useState({
    isOpen: false,
    type: null,
    domain: "",
    description: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [whitePage, setWhitePage] = useState(1);
  const itemsPerPage = 10;

  const [authModal, setAuthModal] = useState({
    isOpen: false,
    action: null,
    domain: "",
  });

  const baseUrl = API_BASE_URL;
  const currentEmpId = localStorage.getItem("employee_id") || "admin";

  const fetchPolicies = useCallback(async () => {
    try {
      const [resBlock, resWhite] = await Promise.all([
        axios.get(`${baseUrl}/api/policies/blocklist/`),
        axios.get(`${baseUrl}/api/policies/whitelist/`),
      ]);
      setPolicies(Array.isArray(resBlock.data) ? resBlock.data : []);
      setWhitePolicies(Array.isArray(resWhite.data) ? resWhite.data : []);
      setLastUpdated(formatTimeKR());
    } catch (err) {
      console.error("정책 조회 실패:", err);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchPolicies();
    const interval = setInterval(fetchPolicies, 60000);
    return () => clearInterval(interval);
  }, [fetchPolicies]);

  // 검색 필터링 적용 (검색창 1개로 허용·차단 목록을 동시에 거른다)
  const filteredWhite = whitePolicies.filter((p) =>
    p.domain.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredBlock = policies.filter((p) =>
    p.blacklist_domain.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 도메인 등록 모달 Submit 처리
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addModal.domain.trim()) return;

    const endpoint =
      addModal.type === "white"
        ? "/api/policies/whitelist/add/"
        : "/api/policies/add/";
    const payloadKey =
      addModal.type === "white" ? "domain" : "blacklist_domain";

    try {
      await axios.post(`${baseUrl}${endpoint}`, {
        [payloadKey]: addModal.domain.trim(),
        description: addModal.description.trim(),
        added_by_emp_id: currentEmpId,
      });

      setAddModal({ isOpen: false, type: null, domain: "", description: "" });
      fetchPolicies();
    } catch (err) {
      await appAlert(err.response?.data?.error || "등록에 실패했습니다.");
    }
  };

  const handleDeletePolicy = async (domain) => {
    if (!(await appConfirm(`'${domain}' 차단 정책을 해제하시겠습니까?`))) return;
    try {
      await axios.post(`${baseUrl}/api/policies/delete/`, {
        blacklist_domain: domain,
      });
      fetchPolicies();
    } catch (err) {
      await appAlert(err.response?.data?.error || "차단 해제에 실패했습니다.");
    }
  };

  const handleDeleteWhitePolicy = async (domain) => {
    if (!(await appConfirm(`'${domain}' 허용 정책을 해제하시겠습니까?`))) return;
    try {
      await axios.post(`${baseUrl}/api/policies/whitelist/delete/`, { domain });
      fetchPolicies();
    } catch (err) {
      await appAlert(err.response?.data?.error || "허용 해제에 실패했습니다.");
    }
  };

  const handleAuthRequest = (action, domain) => {
    setAuthModal({ isOpen: true, action, domain });
  };

  const handleAuthSubmit = async (credentials) => {
    try {
      const endpoint =
        authModal.action === "upgrade"
          ? "/api/policies/whitelist/upgrade/"
          : "/api/policies/whitelist/force-delete/";
      await axios.post(`${baseUrl}${endpoint}`, {
        domain: authModal.domain,
        ...credentials,
      });
      setAuthModal({ isOpen: false, action: null, domain: "" });
      fetchPolicies();
      await appAlert(
        authModal.action === "upgrade"
          ? "보호 도메인으로 지정되었습니다."
          : "보호가 해제되었습니다.",
      );
    } catch (err) {
      await appAlert(err.response?.data?.error || "인증에 실패했습니다.");
    }
  };

  const paginatedWhite = padRows(
    filteredWhite.slice(
      (whitePage - 1) * itemsPerPage,
      whitePage * itemsPerPage,
    ),
    itemsPerPage,
  );
  const paginatedBlock = padRows(
    filteredBlock.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
    itemsPerPage,
  );

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="도메인 정책 관리"
        subtitle="관리자가 직접 등록하는 허용·차단 도메인을 관리합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchPolicies}
      >
        <input
          type="text"
          className="custom-input search-input"
          placeholder="도메인 검색..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setWhitePage(1);
            setCurrentPage(1);
          }}
        />
      </PageHeader>

      <div className="panel-row">
        {/* 허용 도메인 */}
        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <h3 className="card-title title-success">허용 도메인 주소</h3>
            <div className="toolbar-group">
              <span className="count-badge badge-success">
                총 {filteredWhite.length}건
              </span>
              <button
                type="button"
                className="btn-action btn-success btn-w-md btn-header"
                onClick={() =>
                  setAddModal({
                    isOpen: true,
                    type: "white",
                    domain: "",
                    description: "",
                  })
                }
              >
                + 허용 추가
              </button>
            </div>
          </div>

          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-no">No</th>
                  <th>허용 도메인 주소 (URL)</th>
                  <th className="col-count">접속 수</th>
                  <th className="col-time-sm">최근 접속</th>
                  <th className="col-action">조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWhite.map((p, idx) => (
                  <tr key={p.isEmpty ? `white-empty-${idx}` : p.domain}>
                    {p.isEmpty ? (
                      <td colSpan="5">&nbsp;</td>
                    ) : (
                      <>
                        <td className="text-muted">
                          {(whitePage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td
                          className={`cell-main cell-clickable ${p.is_protected ? "is-protected" : ""}`}
                          title={p.domain}
                          onClick={() => setDetailDomain(p.domain)}
                        >
                          {p.domain}
                        </td>
                        <td>{p.access_count}건</td>
                        <td className="text-muted">{p.last_access || "-"}</td>
                        <td>
                          <div className="action-btn-group">
                            {p.is_protected ? (
                              <>
                                <span className="status-badge badge-outline btn-w-sm">
                                  보호
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuthRequest("force_delete", p.domain)
                                  }
                                  className="btn-action btn-danger btn-w-sm"
                                >
                                  해제
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuthRequest("upgrade", p.domain)
                                  }
                                  className="btn-action btn-primary btn-w-sm"
                                >
                                  보호
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteWhitePolicy(p.domain)
                                  }
                                  className="btn-action btn-danger btn-w-sm"
                                >
                                  해제
                                </button>
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
          <PaginationBar
            page={whitePage}
            totalPages={Math.ceil(filteredWhite.length / itemsPerPage) || 1}
            onPageChange={setWhitePage}
          />
        </div>

        {/* 차단 도메인 */}
        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <h3 className="card-title title-danger">차단 도메인 주소</h3>
            <div className="toolbar-group">
              <span className="count-badge badge-danger">
                총 {filteredBlock.length}건
              </span>
              <button
                type="button"
                className="btn-action btn-danger btn-w-md btn-header"
                onClick={() =>
                  setAddModal({
                    isOpen: true,
                    type: "block",
                    domain: "",
                    description: "",
                  })
                }
              >
                + 차단 추가
              </button>
            </div>
          </div>

          <div className="table-responsive table-fill">
            <table className="custom-table">
              <thead>
                <tr>
                  <th className="col-no">No</th>
                  <th>차단 도메인 주소 (URL)</th>
                  <th className="col-count">접속 수</th>
                  <th className="col-time-sm">최근 접속</th>
                  <th className="col-action">조치</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBlock.map((p, idx) => (
                  <tr
                    key={p.isEmpty ? `block-empty-${idx}` : p.blacklist_domain}
                  >
                    {p.isEmpty ? (
                      <td colSpan="5">&nbsp;</td>
                    ) : (
                      <>
                        <td className="text-muted">
                          {(currentPage - 1) * itemsPerPage + idx + 1}
                        </td>
                        <td
                          className="cell-main cell-clickable"
                          title={p.blacklist_domain}
                          onClick={() => setDetailDomain(p.blacklist_domain)}
                        >
                          {p.blacklist_domain}
                        </td>
                        <td>{p.access_count}건</td>
                        <td className="text-muted">{p.last_access || "-"}</td>
                        <td>
                          <div className="action-btn-group">
                            <button
                              type="button"
                              onClick={() =>
                                handleDeletePolicy(p.blacklist_domain)
                              }
                              className="btn-action btn-danger btn-w-sm"
                            >
                              해제
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={currentPage}
            totalPages={Math.ceil(filteredBlock.length / itemsPerPage) || 1}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* 등록 모달창 */}
      {addModal.isOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3 className="dialog-title">
              {addModal.type === "white"
                ? "허용 정책 도메인 등록"
                : "차단 정책 도메인 등록"}
            </h3>
            <p className="dialog-desc">
              등록할 도메인 주소와 사유를 입력해주세요.
            </p>
            <form onSubmit={handleAddSubmit} className="dialog-form">
              <div className="form-group">
                <label className="form-label">도메인 주소</label>
                <input
                  type="text"
                  className="custom-input"
                  placeholder={
                    addModal.type === "white" ? "예: safe.com" : "예: evil.com"
                  }
                  value={addModal.domain}
                  onChange={(e) =>
                    setAddModal({ ...addModal, domain: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">등록 사유</label>
                <textarea
                  className="custom-input"
                  rows="3"
                  placeholder="등록하는 구체적인 사유를 입력하세요"
                  value={addModal.description}
                  onChange={(e) =>
                    setAddModal({ ...addModal, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn-action btn-neutral btn-w-md btn-header"
                  onClick={() =>
                    setAddModal({
                      isOpen: false,
                      type: null,
                      domain: "",
                      description: "",
                    })
                  }
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`btn-action btn-w-md btn-header ${addModal.type === "white" ? "btn-success" : "btn-danger"}`}
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailDomain && (
        <DomainDetailDialog
          domain={detailDomain}
          onClose={() => setDetailDomain(null)}
        />
      )}

      {authModal.isOpen && (
        <AdminAuthDialog
          title={
            authModal.action === "upgrade"
              ? "보호 도메인 지정 인증"
              : "보호 도메인 해제 인증"
          }
          target={authModal.domain}
          danger={authModal.action !== "upgrade"}
          onSubmit={handleAuthSubmit}
          onCancel={() =>
            setAuthModal({ isOpen: false, action: null, domain: "" })
          }
        />
      )}
    </div>
  );
};

export default PolicyManage;
