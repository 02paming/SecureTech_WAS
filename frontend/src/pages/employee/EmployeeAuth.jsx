import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import SecurityDetailDialog from "../../components/SecurityDetailDialog";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push({ isEmpty: true });
  }
  return padded;
};

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
