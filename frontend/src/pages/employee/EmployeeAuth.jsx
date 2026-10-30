import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { getSecurityTheme } from "../../utils/securityTheme";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push({ isEmpty: true });
  }
  return padded;
};

function IpMacHistoryColumn({ logs }) {
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filteredLogs = useMemo(
    () =>
      logs
        .filter(
          (item) =>
            !search ||
            (item.ip || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()) ||
            (item.mac || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sortAsc
            ? (a.login_time || "").localeCompare(b.login_time || "")
            : (b.login_time || "").localeCompare(a.login_time || ""),
        ),
    [logs, search, sortAsc],
  );

  const totalPages = Math.ceil(filteredLogs.length / perPage) || 1;
  const currentItems = padRows(
    filteredLogs.slice((page - 1) * perPage, page * perPage),
    perPage,
  );

  return (
    <div className="info-box sub-panel">
      <div className="info-box-row">
        <h4 className="info-box-title">
          최근 접속 현황 <span className="text-primary">{filteredLogs.length}건</span>
        </h4>
        <button
          type="button"
          className="btn-action btn-neutral btn-w-sm"
          onClick={() => {
            setSortAsc(!sortAsc);
            setPage(1);
          }}
        >
          {sortAsc ? "오래된순" : "최신순"}
        </button>
      </div>
      <input
        type="text"
        className="custom-input"
        placeholder="IP, MAC 검색..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <thead>
            <tr>
              <th>IP</th>
              <th>MAC</th>
              <th>시간</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, idx) => (
              <tr key={idx} className={item.is_mismatch ? "row-danger" : ""}>
                {item.isEmpty ? (
                  <td colSpan="3">&nbsp;</td>
                ) : (
                  <>
                    <td className="text-success fw-bold">{item.ip}</td>
                    <td className={`cell-mono cell-ellipsis ${item.is_mismatch ? "text-danger" : ""}`}>
                      {item.mac}
                      {item.is_mismatch && " !"}
                    </td>
                    <td className="text-muted">{item.login_time}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

function ExternalAccessColumn({ externalLogs }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filteredLogs = useMemo(
    () =>
      externalLogs
        .filter((item) => {
          if (statusFilter === "allowed" && item.is_blocked) return false;
          if (statusFilter === "blocked" && !item.is_blocked) return false;
          return (
            !search ||
            (item.ip || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()) ||
            (item.domain || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase())
          );
        })
        .sort((a, b) =>
          sortAsc
            ? (a.time || "").localeCompare(b.time || "")
            : (b.time || "").localeCompare(a.time || ""),
        ),
    [externalLogs, search, statusFilter, sortAsc],
  );

  const totalPages = Math.ceil(filteredLogs.length / perPage) || 1;
  const currentItems = padRows(
    filteredLogs.slice((page - 1) * perPage, page * perPage),
    perPage,
  );

  return (
    <div className="info-box sub-panel">
      <div className="info-box-row">
        <div className="card-title-group">
          <h4 className="info-box-title">
            활동현황 <span className="text-primary">{filteredLogs.length}건</span>
          </h4>
          <div className="btn-group">
            {[
              { k: "all", l: "전체" },
              { k: "allowed", l: "허용" },
              { k: "blocked", l: "차단" },
            ].map((t) => (
              <button
                type="button"
                key={t.k}
                className={`btn-action btn-toggle btn-w-xs ${statusFilter === t.k ? "active" : ""}`}
                onClick={() => {
                  setStatusFilter(t.k);
                  setPage(1);
                }}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn-action btn-neutral btn-w-sm"
          onClick={() => {
            setSortAsc(!sortAsc);
            setPage(1);
          }}
        >
          {sortAsc ? "오래된순" : "최신순"}
        </button>
      </div>
      <input
        type="text"
        className="custom-input"
        placeholder="도메인 검색..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className="table-responsive table-fill">
        <table className="custom-table table-sm">
          <colgroup>
            <col style={{ width: "60px" }} />
            <col style={{ width: "100px" }} />
            <col />
            <col style={{ width: "145px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>구분</th>
              <th>IP</th>
              <th>도메인</th>
              <th>시간</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, idx) => (
              <tr key={idx} className={item.is_blocked ? "row-danger" : ""}>
                {item.isEmpty ? (
                  <td colSpan="4">&nbsp;</td>
                ) : (
                  <>
                    <td>
                      <span className={`tag ${item.is_blocked ? "text-danger" : "text-success"}`}>
                        {item.is_blocked ? "차단" : "허용"}
                      </span>
                    </td>
                    <td>{item.ip || "-"}</td>
                    <td className={`cell-ellipsis fw-bold ${item.is_blocked ? "text-danger" : "text-primary"}`}>
                      {item.domain || "-"}
                    </td>
                    <td className="text-muted">{item.time || "-"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}

const EmployeeAuth = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSecurity, setSelectedSecurity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("asc");
  const [loginTimeSortOrder, setLoginTimeSortOrder] = useState("desc");
  const [activeSortField, setActiveSortField] = useState("login_time");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`
  ).replace(/\/+$/, "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${baseUrl}/api/dashboard/employee-auth-status/`,
      );
      setOnlineUsers(
        (res.data || []).filter(
          (u) => u.is_active && !u.is_blocked && u.external_status !== "차단됨",
        ),
      );
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 600000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleEmpClick = async (user) => {
    const targetKey = user.emp_id || user.emp_no;
    try {
      const res = await axios.get(
        `${baseUrl}/api/dashboard/employee-security/${targetKey}/`,
      );
      if (res.data?.status === "success") {
        setSelectedSecurity(res.data.data);
        setIsModalOpen(true);
        return;
      }
    } catch (err) { }
    setSelectedSecurity({
      emp_code: user.emp_no || "-",
      employee_id: user.emp_id,
      name: user.emp_name,
      is_manager: false,
      security_score: 100,
      current_ip: user.ip,
      current_mac: user.mac,
      login_time: user.login_time,
      violation_count: 0,
      normal_access_count: 0,
      mismatch_count: 0,
      recent_violations: [],
      recent_logs: [
        { login_time: user.login_time, ip: user.ip, mac: user.mac },
      ],
      external_access_logs: [],
      security_advisor: "분석 데이터 없음",
    });
    setIsModalOpen(true);
  };

  const handleRefreshDetail = async () => {
    if (!selectedSecurity) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(
        `${baseUrl}/api/dashboard/employee-security/${selectedSecurity.employee_id !== "-" ? selectedSecurity.employee_id : selectedSecurity.emp_code}/`,
      );
      if (res.data?.status === "success") setSelectedSecurity(res.data.data);
    } catch (err) {
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBlockUser = async (user) => {
    if (!window.confirm(`${user.emp_name} 단말을 차단하시겠습니까?`)) return;
    setLoading(true);
    try {
      await axios.post(`${baseUrl}/api/dashboard/block-employee/`, {
        employee_id: user.emp_id,
        kick_host_id: user.ip?.split(".").pop(),
      });
      alert("차단되었습니다.");
      setOnlineUsers((p) => p.filter((u) => u.emp_id !== user.emp_id));
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = onlineUsers
    .filter(
      (u) =>
        (u.emp_no || "").includes(searchTerm) ||
        (u.emp_name || "").includes(searchTerm) ||
        (u.emp_id || "").includes(searchTerm),
    )
    .sort((a, b) => {
      if (activeSortField === "emp_no") {
        const comp = String(a.emp_no || "").localeCompare(
          String(b.emp_no || ""),
          undefined,
          { numeric: true },
        );
        if (comp !== 0) return sortOrder === "asc" ? comp : -comp;
        return (b.login_time || "").localeCompare(a.login_time || "");
      } else {
        const tC =
          loginTimeSortOrder === "desc"
            ? (b.login_time || "").localeCompare(a.login_time || "")
            : (a.login_time || "").localeCompare(b.login_time || "");
        if (tC !== 0) return tC;
        return String(a.emp_no || "").localeCompare(
          String(b.emp_no || ""),
          undefined,
          { numeric: true },
        );
      }
    });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const currentUsers = padRows(
    filteredUsers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
    itemsPerPage,
  );

  const theme = getSecurityTheme(selectedSecurity?.security_score);
  const safeRatio =
    selectedSecurity?.normal_access_count + selectedSecurity?.violation_count >
      0
      ? Math.round(
        (selectedSecurity.normal_access_count /
          (selectedSecurity.normal_access_count +
            selectedSecurity.violation_count)) *
        100,
      )
      : 100;

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="사원 인증 현황 관리"
        subtitle="사번을 클릭하여 사원별 상세 보안 및 접속 관제 데이터를 확인하세요."
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={loading}
      />
      <div className="card dashboard-card card-fill">
        <div className="card-toolbar">
          <input
            type="text"
            className="custom-input search-input"
            placeholder="사번, 이름, ID 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="count-badge badge-primary">
            현재 접속 인증 사원 {onlineUsers.length}명
          </span>
        </div>
        <div className="table-responsive table-fill">
          <table className="custom-table">
            <thead>
              <tr>
                <th
                  className="th-sortable"
                  onClick={() => {
                    setActiveSortField("emp_no");
                    setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                  }}
                >
                  사번 {sortOrder === "asc" ? "▲" : "▼"}
                </th>
                <th>사원명</th>
                <th>ID</th>
                <th>인증현황</th>
                <th>조치</th>
                <th
                  className="th-sortable"
                  onClick={() => {
                    setActiveSortField("login_time");
                    setLoginTimeSortOrder((p) =>
                      p === "desc" ? "asc" : "desc",
                    );
                  }}
                >
                  로그인 시간 {loginTimeSortOrder === "desc" ? "▼" : "▲"}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user, idx) => (
                <tr key={user.emp_id || `empty-${idx}`}>
                  {user.isEmpty ? (
                    <td colSpan="6">&nbsp;</td>
                  ) : (
                    <>
                      <td className="cell-link" onClick={() => handleEmpClick(user)}>
                        {user.emp_no || user.emp_code || "-"}
                      </td>
                      <td className="cell-strong">{user.emp_name}</td>
                      <td className="text-muted">{user.emp_id}</td>
                      <td>
                        <span className="status-badge badge-primary">인증 완료</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-action btn-danger btn-w-sm"
                          onClick={() => handleBlockUser(user)}
                        >
                          차단
                        </button>
                      </td>
                      <td className="cell-time">{user.login_time || "-"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && selectedSecurity && (
        <div className="dialog-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="dialog-box dialog-lg" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 className="dialog-title">보안 관제 상세 현황</h3>
              <div className="btn-group">
                <span className="tag tag-primary">ID: {selectedSecurity.employee_id}</span>
                <button
                  type="button"
                  className="btn-action btn-primary btn-w-md btn-header"
                  onClick={handleRefreshDetail}
                  disabled={detailLoading}
                >
                  {detailLoading ? "갱신 중" : "새로고침"}
                </button>
                <button
                  type="button"
                  className="btn-action btn-neutral btn-w-md btn-header"
                  onClick={() => setIsModalOpen(false)}
                >
                  닫기
                </button>
              </div>
            </div>
            <div className="dialog-grid-3">
              <div className="info-stack">
                <div className={`info-box tone-${theme.tone}`}>
                  <div className="info-box-row">
                    <span className="info-box-title">단말 보안 건전성</span>
                    <span className={`fw-bold text-${theme.tone}`}>
                      {selectedSecurity?.security_score}점 ({theme.label})
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-fill"
                      style={{ width: `${selectedSecurity?.security_score}%` }}
                    />
                  </div>
                  <div className="info-box-row info-box-note">
                    <span>정상: {selectedSecurity?.normal_access_count}건</span>
                    <span>변조 탐지: {selectedSecurity?.mismatch_count}건</span>
                  </div>
                </div>
                <div className="info-box info-box-row">
                  <div>
                    <span className="info-box-label">사번</span>
                    <strong className="info-box-value">{selectedSecurity.emp_code}</strong>
                  </div>
                  <span className="tag">입사일: {selectedSecurity.hire_date || "-"}</span>
                </div>
                <div className="info-box info-box-row">
                  <div>
                    <span className="info-box-label">이름 / 권한</span>
                    <strong className="info-box-value">{selectedSecurity.name}</strong>
                  </div>
                  <span className="tag tag-primary">
                    {selectedSecurity.is_manager ? "관리자" : "일반사원"}
                  </span>
                </div>
                <div className="info-box">
                  <span className="info-box-label">실시간 접속 IP / MAC</span>
                  <div className="info-box-row">
                    <strong className="info-box-value text-success">
                      {selectedSecurity.current_ip}
                    </strong>
                    <span className="tag tag-mono">{selectedSecurity.current_mac || "-"}</span>
                  </div>
                </div>
                <div className="info-box tone-primary">
                  <div className="info-box-row">
                    <span className="info-box-label">유해 사이트 차단 누적</span>
                    <strong className="text-danger">{selectedSecurity.violation_count}건</strong>
                  </div>
                  <div className="progress is-danger-track">
                    <div className="progress-fill" style={{ width: `${safeRatio}%` }} />
                  </div>
                  <div className="info-box-row info-box-note">
                    <span>준수율: {safeRatio}%</span>
                    <span>
                      총 접속:{" "}
                      {selectedSecurity.normal_access_count +
                        selectedSecurity.violation_count}
                      건
                    </span>
                  </div>
                </div>
                <div className={`info-box tone-box tone-${theme.tone}`}>
                  <span className="info-box-title">AI 보안 어드바이저</span>
                  <p
                    className="tone-box-text"
                    dangerouslySetInnerHTML={{
                      __html: selectedSecurity.security_advisor
                        ? selectedSecurity.security_advisor.replace(
                          /\*\*(.*?)\*\*/g,
                          "<b>$1</b>",
                        )
                        : "분석 중...",
                    }}
                  />
                </div>
              </div>

              <IpMacHistoryColumn logs={selectedSecurity.recent_logs || []} />
              <ExternalAccessColumn
                externalLogs={
                  selectedSecurity.external_access_logs ||
                  (selectedSecurity.recent_violations || []).map((v) => ({
                    ip: v.ip,
                    domain: v.domain,
                    time: v.time,
                    status: "차단",
                    is_blocked: true,
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default EmployeeAuth;
