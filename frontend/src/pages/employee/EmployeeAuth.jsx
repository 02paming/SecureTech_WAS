import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const getSecurityTheme = (score) => {
  const numScore = Number(score) || 0;
  if (numScore >= 90) return { color: "#22c55e", label: "안전", bg: "rgba(74, 222, 128, 0.04)", border: "1px solid rgba(74, 222, 128, 0.3)" };
  if (numScore >= 50) return { color: "#eab308", label: "주의", bg: "rgba(250, 204, 21, 0.04)", border: "1px solid rgba(250, 204, 21, 0.3)" };
  return { color: "#ef4444", label: "위험", bg: "rgba(248, 113, 113, 0.04)", border: "1px solid rgba(248, 113, 113, 0.3)" };
};

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push({ isEmpty: true });
  }
  return padded;
};

function PaginationBar({ page, totalPages, onPageChange }) {
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "6px",
        paddingTop: "14px",
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        disabled={page === 1}
        style={{
          backgroundColor: "var(--bg-main)",
          border: "1px solid var(--border-color)",
          borderRadius: "6px",
          height: "30px",
          padding: "0 12px",
          fontSize: "12px",
          color: "var(--text-main)",
          cursor: page === 1 ? "not-allowed" : "pointer",
          fontWeight: "600",
        }}
      >
        이전
      </button>
      {getPageNumbers().map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          style={{
            backgroundColor:
              page === p ? "var(--color-primary)" : "var(--bg-main)",
            color: page === p ? "#fff" : "var(--text-main)",
            border:
              page === p
                ? "1px solid var(--color-primary)"
                : "1px solid var(--border-color)",
            borderRadius: "6px",
            minWidth: "30px",
            height: "30px",
            padding: "0 6px",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: page === p ? "bold" : "normal",
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages}
        style={{
          backgroundColor: "var(--bg-main)",
          border: "1px solid var(--border-color)",
          borderRadius: "6px",
          height: "30px",
          padding: "0 12px",
          fontSize: "12px",
          color: "var(--text-main)",
          cursor: page === totalPages ? "not-allowed" : "pointer",
          fontWeight: "600",
        }}
      >
        다음
      </button>
    </div>
  );
}

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
    <div
      style={{
        backgroundColor: "var(--bg-main)",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <h4 style={{ fontSize: "15px", margin: 0, color: "var(--text-title)" }}>
          💻 최근 접속 현황{" "}
          <span
            style={{
              fontSize: "12px",
              color: "var(--color-primary)",
              marginLeft: "6px",
            }}
          >
            {filteredLogs.length}건
          </span>
        </h4>
        <button
          onClick={() => {
            setSortAsc(!sortAsc);
            setPage(1);
          }}
          style={{
            fontSize: "11px",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            borderRadius: "4px",
            padding: "4px 10px",
            fontWeight: "600",
          }}
        >
          {sortAsc ? "오래된순" : "최신순"}
        </button>
      </div>
      <input
        type="text"
        className="custom-input search-input"
        placeholder="IP, MAC 검색..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "13px",
          height: "36px",
          marginBottom: "10px",
        }}
      />
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "var(--bg-card)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1.3fr 1.2fr",
            padding: "8px 6px",
            backgroundColor: "var(--bg-card-alt)",
            borderBottom: "1px solid var(--border-color)",
            fontSize: "12px",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          <span>IP</span>
          <span>MAC</span>
          <span>시간</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {currentItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1.3fr 1.2fr",
                alignItems: "center",
                padding: "6px",
                borderBottom:
                  idx < currentItems.length - 1
                    ? "1px solid var(--border-color)"
                    : "none",
                backgroundColor: item.is_mismatch
                  ? "rgba(248, 113, 113, 0.08)"
                  : "transparent",
                fontSize: "12px",
                textAlign: "center",
                height: "10%",
              }}
            >
              {item.isEmpty ? (
                <span>&nbsp;</span>
              ) : (
                <>
                  <span
                    style={{ color: "var(--color-success)", fontWeight: "600" }}
                  >
                    {item.ip}
                  </span>
                  <span
                    style={{
                      color: item.is_mismatch
                        ? "var(--color-danger)"
                        : "var(--text-main)",
                      fontFamily: "monospace",
                    }}
                  >
                    {item.mac}
                    {item.is_mismatch && "⚠️"}
                  </span>
                  <span
                    style={{ color: "var(--text-muted)", fontSize: "11px" }}
                  >
                    {item.login_time}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
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
    <div
      style={{
        backgroundColor: "var(--bg-main)",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h4
            style={{
              fontSize: "15px",
              margin: 0,
              color: "var(--text-title)",
              whiteSpace: "nowrap",
            }}
          >
            🌐 활동현황{" "}
            <span style={{ fontSize: "12px", color: "var(--color-primary)" }}>
              {filteredLogs.length}
            </span>
          </h4>
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { k: "all", l: "전체" },
              { k: "allowed", l: "허용" },
              { k: "blocked", l: "차단" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => {
                  setStatusFilter(t.k);
                  setPage(1);
                }}
                style={{
                  backgroundColor:
                    statusFilter === t.k
                      ? "var(--color-primary)"
                      : "var(--bg-card)",
                  color: statusFilter === t.k ? "#fff" : "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: statusFilter === t.k ? "bold" : "normal",
                }}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setSortAsc(!sortAsc);
            setPage(1);
          }}
          style={{
            fontSize: "11px",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            color: "var(--text-main)",
            borderRadius: "4px",
            padding: "4px 10px",
            fontWeight: "600",
          }}
        >
          {sortAsc ? "오래된순" : "최신순"}
        </button>
      </div>
      <input
        type="text"
        className="custom-input search-input"
        placeholder="도메인 검색..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: "13px",
          height: "36px",
          marginBottom: "10px",
        }}
      />
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "var(--bg-card)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "46px 1fr 1.3fr 1fr",
            padding: "8px 6px",
            backgroundColor: "var(--bg-card-alt)",
            borderBottom: "1px solid var(--border-color)",
            fontSize: "12px",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          <span>구분</span>
          <span>IP</span>
          <span>도메인</span>
          <span>시간</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {currentItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "46px 1fr 1.3fr 1fr",
                alignItems: "center",
                padding: "6px",
                borderBottom:
                  idx < currentItems.length - 1
                    ? "1px solid var(--border-color)"
                    : "none",
                fontSize: "12px",
                textAlign: "center",
                height: "10%",
                backgroundColor: item.is_blocked
                  ? "rgba(248, 113, 113, 0.06)"
                  : "transparent",
              }}
            >
              {item.isEmpty ? (
                <span>&nbsp;</span>
              ) : (
                <>
                  <span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "bold",
                        backgroundColor: item.is_blocked
                          ? "rgba(248, 113, 113, 0.15)"
                          : "rgba(74, 222, 128, 0.15)",
                        color: item.is_blocked
                          ? "var(--color-danger)"
                          : "var(--color-success)",
                        border: `1px solid ${item.is_blocked ? "rgba(248, 113, 113, 0.4)" : "rgba(74, 222, 128, 0.4)"}`,
                      }}
                    >
                      {item.is_blocked ? "차단" : "허용"}
                    </span>
                  </span>
                  <span style={{ color: "var(--text-main)" }}>
                    {item.ip || "-"}
                  </span>
                  <span
                    style={{
                      color: item.is_blocked
                        ? "var(--color-danger)"
                        : "var(--color-primary)",
                      fontWeight: "600",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.domain || "-"}
                  </span>
                  <span
                    style={{ color: "var(--text-muted)", fontSize: "11px" }}
                  >
                    {item.time || "-"}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
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
  const dashboardCardRef = useRef(null);
  const [modalWidth, setModalWidth] = useState(null);
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`
  ).replace(/\/+$/, "");

  useEffect(() => {
    if (!dashboardCardRef.current) return;
    const updateWidth = () =>
      dashboardCardRef.current &&
      setModalWidth(dashboardCardRef.current.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(dashboardCardRef.current);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

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
    if (dashboardCardRef.current)
      setModalWidth(dashboardCardRef.current.getBoundingClientRect().width);
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
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexShrink: 0,
        }}
      >
        <div>
          <h2 className="page-title">👥 사원 인증 현황 관리</h2>
          <p className="page-subtitle">
            사번을 클릭하여 사원별 상세 보안 및 접속 관제 데이터를 확인하세요.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              fontWeight: "500",
            }}
          >
            최종 갱신: {lastUpdated || "-"}
          </span>
          <button
            onClick={fetchData}
            className="btn-action btn-action-edit"
            disabled={loading}
            style={{
              height: "36px",
              padding: "0 16px",
              fontSize: "13px",
              fontWeight: "bold",
            }}
          >
            🔄 동기화
          </button>
        </div>
      </div>
      <div
        className="card dashboard-card"
        ref={dashboardCardRef}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          margin: 0,
          minHeight: 0,
        }}
      >
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexShrink: 0,
          }}
        >
          <span
            className="card-count-badge"
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          >
            현재 접속 인증 사원 <strong>{onlineUsers.length}</strong>명
          </span>
          <input
            type="text"
            className="custom-input search-input"
            style={{
              width: "240px",
              padding: "8px 12px",
              fontSize: "13px",
              height: "36px",
            }}
            placeholder="사번, 이름, ID 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div
          className="table-responsive"
          style={{
            flex: 1,
            overflow: "hidden",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <table
            className="custom-table"
            style={{
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
              margin: 0,
              height: "100%",
            }}
          >
            <thead style={{ backgroundColor: "var(--bg-main)", zIndex: 1 }}>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-color)",
                  height: "10%",
                }}
              >
                <th
                  onClick={() => {
                    setActiveSortField("emp_no");
                    setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                  }}
                  style={{ cursor: "pointer", padding: "10px" }}
                >
                  사번 {sortOrder === "asc" ? "▲" : "▼"}
                </th>
                <th style={{ padding: "10px" }}>사원명</th>
                <th style={{ padding: "10px" }}>ID</th>
                <th style={{ padding: "10px" }}>인증현황</th>
                <th style={{ padding: "10px" }}>조치</th>
                <th
                  onClick={() => {
                    setActiveSortField("login_time");
                    setLoginTimeSortOrder((p) =>
                      p === "desc" ? "asc" : "desc",
                    );
                  }}
                  style={{ cursor: "pointer", padding: "10px" }}
                >
                  로그인 시간 {loginTimeSortOrder === "desc" ? "▼" : "▲"}
                </th>
              </tr>
            </thead>
            <tbody style={{ flex: 1 }}>
              {currentUsers.map((user, idx) => (
                <tr
                  key={user.emp_id || `empty-${idx}`}
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    height: "9%",
                  }}
                >
                  {user.isEmpty ? (
                    <td colSpan="6">&nbsp;</td>
                  ) : (
                    <>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "600",
                          color: "var(--color-primary)",
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: "14px",
                        }}
                        onClick={() => handleEmpClick(user)}
                      >
                        {user.emp_no || user.emp_code || "-"}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "600",
                          fontSize: "14px",
                          color: "var(--text-title)",
                        }}
                      >
                        {user.emp_name}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        {user.emp_id}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge badge-blue">인증 완료</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn-action btn-action-reject"
                          onClick={() => handleBlockUser(user)}
                          style={{
                            height: "30px",
                            padding: "0 12px",
                            border: "1px solid var(--color-danger)",
                          }}
                        >
                          차단
                        </button>
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                        }}
                      >
                        {user.login_time || "-"}
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
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && selectedSecurity && (
        <div
          onClick={() => setIsModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--bg-main)",
              padding: "24px",
              borderRadius: "16px",
              width: modalWidth ? `${modalWidth}px` : "100%",
              maxWidth: "97vw",
              height: "85vh",
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--border-color)",
              boxShadow: "0 25px 45px -12px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "14px",
                flexShrink: 0,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: "var(--color-primary)",
                    fontSize: "20px",
                  }}
                >
                  🛡️ [보안 관제] 상세 현황
                </h3>
                <button
                  onClick={handleRefreshDetail}
                  disabled={detailLoading}
                  style={{
                    height: "30px",
                    padding: "0 14px",
                    fontSize: "12px",
                    borderRadius: "20px",
                    cursor: detailLoading ? "not-allowed" : "pointer",
                    backgroundColor: "var(--bg-card)",
                    color: "var(--text-main)",
                    border: "1px solid var(--border-color)",
                    fontWeight: "600",
                  }}
                >
                  🔄 {detailLoading ? "갱신..." : "새로고침"}
                </button>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    backgroundColor: "var(--bg-card)",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 16px",
                    borderRadius: "20px",
                    border: "1px solid var(--border-color)",
                    fontWeight: "600",
                    color: "var(--text-title)",
                  }}
                >
                  ID: {selectedSecurity.employee_id}
                </span>
                <button
                  className="btn-primary"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    height: "36px",
                    padding: "0 24px",
                    borderRadius: "20px",
                    fontWeight: "bold",
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.5fr 1.5fr",
                gap: "20px",
                flex: 1,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    }}
                  >
                    <span>단말 보안 건전성</span>
                    <span style={{ color: theme.color }}>
                      {selectedSecurity?.security_score}점 ({theme.label})
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      backgroundColor: "var(--border-color)",
                      borderRadius: "4px",
                      overflow: "hidden",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: `${selectedSecurity?.security_score}%`,
                        height: "100%",
                        backgroundColor: theme.color,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>정상: {selectedSecurity?.normal_access_count}건</span>
                    <span>변조 탐지: {selectedSecurity?.mismatch_count}건</span>
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{ color: "var(--text-muted)", fontSize: "12px" }}
                    >
                      사번
                    </span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "15px",
                        marginTop: "2px",
                      }}
                    >
                      {selectedSecurity.emp_code}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      backgroundColor: "var(--bg-main)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    입사일: {selectedSecurity.hire_date || "-"}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span
                      style={{ color: "var(--text-muted)", fontSize: "12px" }}
                    >
                      이름 / 권한
                    </span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "15px",
                        marginTop: "2px",
                        color: "var(--text-title)",
                      }}
                    >
                      {selectedSecurity.name}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-main)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    {selectedSecurity.is_manager ? "관리자" : "일반사원"}
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      marginBottom: "4px",
                      display: "block",
                    }}
                  >
                    실시간 접속 IP / MAC
                  </span>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong
                      style={{
                        color: "var(--color-success)",
                        fontSize: "14px",
                      }}
                    >
                      {selectedSecurity.current_ip}
                    </strong>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "11px",
                        backgroundColor: "var(--bg-main)",
                        color: "var(--text-muted)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {selectedSecurity.current_mac || "-"}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--bg-card)",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{ color: "var(--text-muted)", fontSize: "12px" }}
                    >
                      유해 사이트 차단 누적
                    </span>
                    <strong
                      style={{ color: "var(--color-danger)", fontSize: "14px" }}
                    >
                      {selectedSecurity.violation_count}건
                    </strong>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor: "var(--color-danger)",
                      borderRadius: "3px",
                      overflow: "hidden",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: `${safeRatio}%`,
                        height: "100%",
                        backgroundColor: "var(--color-primary)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>준수율: {safeRatio}%</span>
                    <span>
                      총 접속:{" "}
                      {selectedSecurity.normal_access_count +
                        selectedSecurity.violation_count}
                      건
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: theme.bg,
                    padding: "16px",
                    borderRadius: "10px",
                    border: theme.border,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>🤖</span>
                    <span
                      style={{
                        color: "var(--text-title)",
                        fontSize: "14px",
                        fontWeight: "bold",
                      }}
                    >
                      AI 보안 어드바이저
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--text-main)",
                      lineHeight: "1.6",
                      margin: 0,
                      flex: 1,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                    }}
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
