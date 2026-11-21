// 관리자가 직접 허용 및 차단 도메인 정책을 등록, 조회, 해제하고 보호 도메인을 제어하는 관리자 UI 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../api";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import DomainDetailDialog from "../../components/DomainDetailDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { appAlert } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { padRows } from "../../utils/table";

const REFRESH_MS = 60000;

const PolicyManage = () => {
  const [policies, setPolicies] = useState([]);
  const [whitePolicies, setWhitePolicies] = useState([]);
  const [deletedWhite, setDeletedWhite] = useState([]);
  const [deletedBlock, setDeletedBlock] = useState([]);
  const [showDeletedWhite, setShowDeletedWhite] = useState(false);
  const [showDeletedBlock, setShowDeletedBlock] = useState(false);
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
  const [deletedWhitePage, setDeletedWhitePage] = useState(1);
  const [deletedBlockPage, setDeletedBlockPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const handlePageSizeChange = (n) => {
    setItemsPerPage(n);
    setWhitePage(1);
    setCurrentPage(1);
    setDeletedWhitePage(1);
    setDeletedBlockPage(1);
  };

  const [authModal, setAuthModal] = useState({
    isOpen: false,
    action: null,
    domain: "",
  });

  const baseUrl = API_BASE_URL;
  // 정책 등록자 기록용: 로그인 세션의 실제 사용자 아이디를 쓴다.
  // (이전에는 저장된 적 없는 localStorage 키를 읽어 항상 "admin"으로 전송되던 버그가 있었다)
  const currentEmpId = (() => {
    try {
      const u = JSON.parse(sessionStorage.getItem("user"));
      return u?.employee_id || u?.emp_id || "";
    } catch {
      return "";
    }
  })();

  const fetchPolicies = useCallback(async () => {
    try {
      const [resBlock, resWhite, resDeletedBlock, resDeletedWhite] = await Promise.all([
        axios.get(`${baseUrl}/api/policies/blocklist/`),
        axios.get(`${baseUrl}/api/policies/whitelist/`),
        axios.get(`${baseUrl}/api/policies/blocklist/deleted/`),
        axios.get(`${baseUrl}/api/policies/whitelist/deleted/`),
      ]);
      setPolicies(Array.isArray(resBlock.data) ? resBlock.data : []);
      setWhitePolicies(Array.isArray(resWhite.data) ? resWhite.data : []);
      setDeletedBlock(Array.isArray(resDeletedBlock.data) ? resDeletedBlock.data : []);
      setDeletedWhite(Array.isArray(resDeletedWhite.data) ? resDeletedWhite.data : []);
      setLastUpdated(formatTimeKR());
    } catch (err) {
      console.error("정책 조회 실패:", err);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchPolicies();
    const interval = setInterval(fetchPolicies, REFRESH_MS);
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

  const showManualInfo = async (info) => {
    await appAlert(
      `등록자 ID : ${info?.added_by_id || "-"}\n` +
        `관리자 이름 : ${info?.added_by_name || "-"}\n` +
        `등록 시간 : ${info?.added_at || "-"}\n` +
        `등록 사유 : ${info?.description || "등록된 사유가 없습니다."}`,
    );
  };

  const handleAuthRequest = (action, domain) => {
    setAuthModal({ isOpen: true, action, domain });
  };

  const AUTH_ACTIONS = {
    upgrade: {
      endpoint: "/api/policies/whitelist/upgrade/",
      payloadKey: "domain",
      message: "보호 도메인으로 지정되었습니다.",
    },
    force_delete: {
      endpoint: "/api/policies/whitelist/force-delete/",
      payloadKey: "domain",
      message: "보호가 해제되었습니다.",
    },
    restore_white: {
      endpoint: "/api/policies/whitelist/restore/",
      payloadKey: "domain",
      message: "허용 정책이 복원되었습니다.",
    },
    restore_block: {
      endpoint: "/api/policies/restore/",
      payloadKey: "blacklist_domain",
      message: "차단 정책이 복원되었습니다.",
    },
    delete_white: {
      endpoint: "/api/policies/whitelist/delete/",
      payloadKey: "domain",
      message: "허용 정책이 삭제되었습니다.",
    },
    delete_block: {
      endpoint: "/api/policies/delete/",
      payloadKey: "blacklist_domain",
      message: "차단 정책이 해제되었습니다.",
    },
  };

  const handleAuthSubmit = async (credentials) => {
    try {
      const { endpoint, payloadKey, message } = AUTH_ACTIONS[authModal.action];
      await axios.post(`${baseUrl}${endpoint}`, {
        [payloadKey]: authModal.domain,
        ...credentials,
      });
      setAuthModal({ isOpen: false, action: null, domain: "" });
      fetchPolicies();
      await appAlert(message);
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
  const paginatedDeletedWhite = padRows(
    deletedWhite.slice(
      (deletedWhitePage - 1) * itemsPerPage,
      deletedWhitePage * itemsPerPage,
    ),
    itemsPerPage,
  );
  const paginatedDeletedBlock = padRows(
    deletedBlock.slice(
      (deletedBlockPage - 1) * itemsPerPage,
      deletedBlockPage * itemsPerPage,
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
            <div className="card-title-group">
              <h3 className="card-title title-success">허용 도메인 주소</h3>
              <span className="count-badge badge-success">
                총 {(showDeletedWhite ? deletedWhite.length : filteredWhite.length).toLocaleString()}건
              </span>
            </div>
            <div className="toolbar-group">
              <button
                type="button"
                className={`btn-action btn-w-md btn-header ${showDeletedWhite ? "btn-primary" : "btn-outline"}`}
                onClick={() => setShowDeletedWhite((v) => !v)}
              >
                {showDeletedWhite ? "목록으로" : "삭제 이력"}
              </button>
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

          {showDeletedWhite ? (
            <>
              <div className="table-responsive table-fill">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th className="col-no">No</th>
                      <th>허용 도메인 주소 (URL)</th>
                      <th>삭제 사유</th>
                      <th className="col-time-sm">삭제일</th>
                      <th className="col-action">조치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDeletedWhite.map((p, idx) => (
                      <tr key={p.isEmpty ? `dwhite-empty-${idx}` : p.domain}>
                        {p.isEmpty ? (
                          <td colSpan="5">&nbsp;</td>
                        ) : (
                          <>
                            <td className="text-muted">
                              {(deletedWhitePage - 1) * itemsPerPage + idx + 1}
                            </td>
                            <td className="cell-main" title={p.domain}>
                              {p.domain}
                            </td>
                            <td className="text-muted">{p.description || "-"}</td>
                            <td className="text-muted">{p.deleted_at || "-"}</td>
                            <td>
                              <div className="action-btn-group">
                                <button
                                  type="button"
                                  onClick={() => showManualInfo(p.manual_info)}
                                  className="btn-action btn-outline btn-w-sm"
                                >
                                  등록 정보
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAuthRequest("restore_white", p.domain)}
                                  className="btn-action btn-primary btn-w-sm"
                                >
                                  복원
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
                page={deletedWhitePage}
                totalPages={Math.ceil(deletedWhite.length / itemsPerPage) || 1}
                onPageChange={setDeletedWhitePage}
              />
            </>
          ) : (
          <>
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
                        <td>{(p.access_count || 0).toLocaleString()}건</td>
                        <td className="text-muted">{p.last_access || "-"}</td>
                        <td>
                          <div className="action-btn-group">
                            {p.is_protected ? (
                              <>
                                <span className="status-badge badge-outline btn-w-sm">
                                  보호중
                                </span>
                                {/* 같은 "해제"라는 말이 상황마다 다른 동작(보호만 풀기 / 정책 자체 삭제)을
                                    하던 문제가 있어, 보호중인 행은 "보호 해제"로 동작을 명확히 한다.
                                    이 버튼은 보호 표시만 지우고 허용 정책 자체는 남는다 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuthRequest("force_delete", p.domain)
                                  }
                                  className="btn-action btn-outline btn-w-sm"
                                >
                                  보호 해제
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
                                  보호 설정
                                </button>
                                {/* 이 버튼은 허용 정책 자체를 삭제한다(보호 해제와 다른 동작) */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuthRequest("delete_white", p.domain)
                                  }
                                  className="btn-action btn-danger btn-w-sm"
                                >
                                  허용 삭제
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
            pageSize={itemsPerPage}
            onPageSizeChange={handlePageSizeChange}
          />
          </>
          )}
        </div>

        {/* 차단 도메인 */}
        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <div className="card-title-group">
              <h3 className="card-title title-danger">차단 도메인 주소</h3>
              <span className="count-badge badge-danger">
                총 {(showDeletedBlock ? deletedBlock.length : filteredBlock.length).toLocaleString()}건
              </span>
            </div>
            <div className="toolbar-group">
              <button
                type="button"
                className={`btn-action btn-w-md btn-header ${showDeletedBlock ? "btn-primary" : "btn-outline"}`}
                onClick={() => setShowDeletedBlock((v) => !v)}
              >
                {showDeletedBlock ? "목록으로" : "삭제 이력"}
              </button>
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

          {showDeletedBlock ? (
            <>
              <div className="table-responsive table-fill">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th className="col-no">No</th>
                      <th>차단 도메인 주소 (URL)</th>
                      <th>삭제 사유</th>
                      <th className="col-time-sm">삭제일</th>
                      <th className="col-action">조치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDeletedBlock.map((p, idx) => (
                      <tr key={p.isEmpty ? `dblock-empty-${idx}` : p.blacklist_domain}>
                        {p.isEmpty ? (
                          <td colSpan="5">&nbsp;</td>
                        ) : (
                          <>
                            <td className="text-muted">
                              {(deletedBlockPage - 1) * itemsPerPage + idx + 1}
                            </td>
                            <td className="cell-main" title={p.blacklist_domain}>
                              {p.blacklist_domain}
                            </td>
                            <td className="text-muted">{p.description || "-"}</td>
                            <td className="text-muted">{p.deleted_at || "-"}</td>
                            <td>
                              <div className="action-btn-group">
                                <button
                                  type="button"
                                  onClick={() => showManualInfo(p.manual_info)}
                                  className="btn-action btn-outline btn-w-sm"
                                >
                                  등록 정보
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAuthRequest("restore_block", p.blacklist_domain)}
                                  className="btn-action btn-primary btn-w-sm"
                                >
                                  복원
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
                page={deletedBlockPage}
                totalPages={Math.ceil(deletedBlock.length / itemsPerPage) || 1}
                onPageChange={setDeletedBlockPage}
              />
            </>
          ) : (
          <>
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
                        <td>{(p.access_count || 0).toLocaleString()}건</td>
                        <td className="text-muted">{p.last_access || "-"}</td>
                        <td>
                          <div className="action-btn-group">
                            <button
                              type="button"
                              onClick={() =>
                                handleAuthRequest("delete_block", p.blacklist_domain)
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
            pageSize={itemsPerPage}
            onPageSizeChange={handlePageSizeChange}
          />
          </>
          )}
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
            {
              upgrade: "보호 도메인 지정 인증",
              force_delete: "보호 도메인 해제 인증",
              restore_white: "허용 정책 복원 인증",
              restore_block: "차단 정책 복원 인증",
              delete_white: "허용 정책 삭제 인증",
              delete_block: "차단 정책 해제 인증",
            }[authModal.action]
          }
          target={authModal.domain}
          danger={["force_delete", "delete_white", "delete_block"].includes(authModal.action)}
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
