import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import BlockedEmployeesDialog from "../../components/BlockedEmployeesDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import SecurityDetailDialog from "../../components/SecurityDetailDialog";
import { padRows, useResetPage } from "../../utils/table";
import { API_BASE_URL, MONITOR_REFRESH_MS } from "../../api";

const EmployeeAuth = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isBlockedOpen, setIsBlockedOpen] = useState(false);
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
  const baseUrl = API_BASE_URL;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, blockedRes] = await Promise.all([
        axios.get(`${baseUrl}/api/dashboard/employee-auth-status/`),
        axios.get(`${baseUrl}/api/dashboard/blocked-employees/`),
      ]);
      setOnlineUsers(
        (res.data || []).filter(
          (u) => u.is_active && !u.is_blocked && u.external_status !== "차단됨",
        ),
      );
      setBlockedUsers(blockedRes.data || []);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    } catch (err) {
      console.error("사원 인증 현황 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, MONITOR_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  useResetPage([searchTerm], () => setCurrentPage(1));

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
    } catch (err) {
      console.error("보안 상세 현황 조회 실패:", err);
    }
    // 점수를 알 수 없을 때 안전한 값처럼 보여 주지 않는다
    alert("보안 상세 현황을 불러올 수 없습니다.");
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
      console.error("보안 상세 현황 갱신 실패:", err);
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
      await fetchData();
    } catch (err) {
      console.error("단말 차단 실패:", err);
      alert("차단에 실패했습니다.");
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

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="사원 인증 현황"
        subtitle="사번을 클릭하면 사원별 보안 상세 현황을 확인할 수 있습니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={loading}
      />
      <div className="card dashboard-card card-fill">
        <div className="card-toolbar">
          <input
            type="text"
            className="custom-input search-input"
            placeholder="사번, 이름, 아이디 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="btn-group">
            <button
              type="button"
              className="btn-action btn-neutral btn-w-lg btn-header"
              onClick={() => setIsBlockedOpen(true)}
            >
              차단된 사원 {blockedUsers.length}명
            </button>
            <span className="count-badge badge-primary">
              인증 사원 {onlineUsers.length}명
            </span>
          </div>
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
                <th>이름</th>
                <th>아이디</th>
                <th>인증 상태</th>
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

      {isBlockedOpen && (
        <BlockedEmployeesDialog
          employees={blockedUsers}
          onChanged={fetchData}
          onClose={() => setIsBlockedOpen(false)}
        />
      )}

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
export default EmployeeAuth;
