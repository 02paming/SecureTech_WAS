import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) padded.push({ isEmpty: true });
  return padded;
};

const tdStyle = {
  padding: "8px 10px",
  borderRight: "1px solid var(--border-color)",
  verticalAlign: "middle",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "1px",
  fontSize: "13px",
};
const tdCenter = { ...tdStyle, textAlign: "center" };
const tdLeft = { ...tdStyle, textAlign: "left" };

const btnStyle = {
  margin: 0,
  height: "26px",
  padding: "0 10px",
  fontSize: "11px",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "20px",
};
const modalBoxStyle = {
  backgroundColor: "var(--bg-card)",
  padding: "30px",
  borderRadius: "12px",
  width: "480px",
  maxWidth: "100%",
  border: "1px solid var(--border-color)",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
};

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
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "6px",
        paddingTop: "16px",
        paddingBottom: "4px",
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        disabled={page === 1}
        className="btn-action"
      >
        이전
      </button>
      {getPageNumbers().map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className="btn-action"
          style={{
            backgroundColor:
              page === p ? "var(--color-primary)" : "var(--bg-main)",
            color: page === p ? "#fff" : "var(--text-main)",
            fontWeight: page === p ? "bold" : "normal",
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
        disabled={page === totalPages}
        className="btn-action"
      >
        다음
      </button>
    </div>
  );
}

const ResizableTh = ({
  colKey,
  label,
  onClick,
  colWidths,
  handleMouseDown,
}) => (
  <th
    style={{
      width: colWidths[colKey],
      borderRight: "1px solid var(--border-color)",
      position: "relative",
      padding: 0,
    }}
  >
    <div
      onClick={onClick}
      style={{
        padding: "10px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        fontSize: "13px",
      }}
    >
      {label}
    </div>
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
        handleMouseDown(e, colKey);
      }}
      style={{
        position: "absolute",
        right: -4,
        top: 0,
        bottom: 0,
        width: "8px",
        cursor: "col-resize",
        zIndex: 10,
      }}
      title="드래그하여 너비 조절"
    />
  </th>
);

const EmployeeManage = () => {
  const [employees, setEmployees] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 400);
  const [selectedEmpDetail, setSelectedEmpDetail] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [editModal, setEditModal] = useState({
    isOpen: false,
    empId: null,
    phone: "",
    address: "",
    email: "",
  });

  const COLUMNS = [
    { id: "empNum", label: "사번" },
    { id: "joinDate", label: "입사일" },
    { id: "name", label: "이름" },
    { id: "userId", label: "아이디" },
    { id: "email", label: "이메일" },
    { id: "phone", label: "연락처" },
    { id: "birth", label: "생년월일" },
    { id: "address", label: "주소" },
    { id: "jumin", label: "주민등록번호" },
  ];

  const defaultCols = {
    empNum: true,
    joinDate: true,
    name: true,
    userId: true,
    email: true,
    phone: true,
    birth: true,
    address: false,
    jumin: false,
  };
  const [checkedCols, setCheckedCols] = useState(defaultCols);
  const [activeCols, setActiveCols] = useState(defaultCols);

  const [filterRole, setFilterRole] = useState(
    () => sessionStorage.getItem("empFilterRole") || "active",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState("asc");
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(false);

  const [colWidths, setColWidths] = useState({
    empNum: 100,
    joinDate: 90,
    name: 80,
    userId: 100,
    email: 180,
    phone: 110,
    birth: 120,
    address: 220,
    jumin: 140,
    action: 90,
  });

  const baseUrl = useMemo(
    () =>
      (
        import.meta.env.VITE_API_BASE_URL ||
        `http://${window.location.hostname}:8000`
      ).replace(/\/+$/, ""),
    [],
  );

  // 💡 [핵심 수정 부분] 눈에 보이는 열의 갯수를 동적으로 계산 (데이터 컬럼 + 관리 버튼 컬럼 1개)
  const visibleColCount = useMemo(() => {
    return Object.values(activeCols).filter(Boolean).length + 1;
  }, [activeCols]);

  const formatPhone = (p) => {
    if (!p) return "";
    const clean = String(p).replace(/[^0-9]/g, "");
    if (clean.length > 10)
      return clean.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (clean.length > 6)
      return clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    if (clean.length > 3) return clean.replace(/(\d{3})(\d+)/, "$1-$2");
    return clean;
  };

  const renderMaskedJumin = (jumin) => {
    if (!jumin) return "-";
    if (
      typeof jumin === "string" &&
      (jumin.includes("*") || jumin.includes("Omitted"))
    )
      return jumin;
    const clean = String(jumin).replace(/[^0-9]/g, "");
    if (clean.length >= 7)
      return `${clean.substring(0, 6)}-${clean.charAt(6)}******`;
    return "[RRN Omitted]";
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(`${baseUrl}/api/employees/`, {
          signal: controller.signal,
        });
        if (res?.data) setEmployees(res.data);
      } catch (err) {
        if (err.name !== "CanceledError") console.error(err);
      }
    };
    fetchEmployees();
    return () => controller.abort();
  }, [baseUrl]);

  useEffect(() => {
    sessionStorage.setItem("empFilterRole", filterRole);
    setCurrentPage(1);
  }, [filterRole, debouncedSearch, activeCols, sortOrder]);

  const handleEmpCardClick = async (emp) => {
    const targetKey = emp.employee_id || emp.employee_number;
    try {
      const res = await axios.get(
        `${baseUrl}/api/dashboard/employee-security/${targetKey}/`,
      );
      if (res.data?.status === "success") {
        setSelectedEmpDetail(res.data.data);
        setIsDetailModalOpen(true);
        return;
      }
    } catch (err) {}
    setSelectedEmpDetail({
      emp_code: emp.emp_code || "-",
      employee_id: emp.employee_id || "-",
      name: emp.name || "-",
      hire_date: emp.hire_date || "-",
      email: emp.email || "-",
      phone_number: emp.phone_number || "-",
      address: emp.address || "미입력",
      birth_date: emp.birth_date || "-",
      jumin_no: emp.jumin_no
        ? renderMaskedJumin(emp.jumin_no)
        : "[RRN Omitted]",
    });
    setIsDetailModalOpen(true);
  };

  const handleEditClick = (emp) => {
    setEditModal({
      isOpen: true,
      empId: emp.employee_id,
      phone: formatPhone(emp.phone_number),
      address: emp.address || "",
      email: emp.email || "",
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanPhone = editModal.phone.replace(/[^0-9]/g, "");
      const res = await axios.post(`${baseUrl}/api/employees/update/`, {
        employee_id: editModal.empId,
        phone_number: cleanPhone,
        address: editModal.address.trim(),
        email: editModal.email.trim(),
      });
      if (res.data.status === "success") {
        alert("수정되었습니다.");
        setEditModal({
          isOpen: false,
          empId: null,
          phone: "",
          address: "",
          email: "",
        });
        window.location.reload();
      }
    } catch {
      alert("수정 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (empId, empName) => {
    if (!window.confirm(`'${empName}' 퇴사 처리하시겠습니까?`)) return;
    try {
      await axios.post(`${baseUrl}/api/employees/delete/`, {
        employee_id: empId,
      });
      alert("처리되었습니다.");
      window.location.reload();
    } catch {
      alert("오류 발생");
    }
  };

  const handleHardDelete = async (empId, empName) => {
    if (!window.confirm(`'${empName}' 데이터 파기?`)) return;
    try {
      await axios.post(`${baseUrl}/api/employees/hard-delete/`, {
        employee_id: empId,
      });
      alert("파기되었습니다.");
      window.location.reload();
    } catch {
      alert("오류 발생");
    }
  };

  const roleFiltered = useMemo(
    () =>
      employees.filter((emp) =>
        filterRole === "deleted" ? emp.is_deleted : !emp.is_deleted,
      ),
    [employees, filterRole],
  );
  const searchFiltered = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    if (!term) return roleFiltered;
    return roleFiltered.filter((emp) =>
      [
        "employee_number",
        "emp_code",
        "name",
        "employee_id",
        "phone_number",
        "email",
        "address",
      ].some((k) =>
        String(emp[k] || "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [roleFiltered, debouncedSearch]);

  const sortedEmployees = useMemo(
    () =>
      [...searchFiltered].sort((a, b) => {
        const codeA = String(a.emp_code || a.employee_number || "");
        const codeB = String(b.emp_code || b.employee_number || "");
        return sortOrder === "asc"
          ? codeA.localeCompare(codeB)
          : codeB.localeCompare(codeA);
      }),
    [searchFiltered, sortOrder],
  );

  const totalPages = Math.ceil(sortedEmployees.length / itemsPerPage) || 1;
  const currentItems = padRows(
    sortedEmployees.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
    itemsPerPage,
  );

  const totalEmployeesCount = useMemo(
    () => employees.filter((emp) => !emp.is_deleted).length,
    [employees],
  );
  const totalDeletedCount = useMemo(
    () => employees.filter((emp) => emp.is_deleted).length,
    [employees],
  );

  const handleMouseDown = (e, colKey) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];
    const onMouseMove = (moveEvent) =>
      setColWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(60, startWidth + (moveEvent.clientX - startX)),
      }));
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const exportToCSV = useCallback(() => {
    const visibleCols = COLUMNS.filter((col) => activeCols[col.id]);
    const headers = visibleCols.map((col) => col.label);
    const csvRows = [headers.join(",")];

    sortedEmployees.forEach((emp) => {
      const rowData = visibleCols.map((col) => {
        let val = "";
        switch (col.id) {
          case "empNum":
            val = emp.emp_code || emp.employee_number || "";
            break;
          case "joinDate":
            val = emp.hire_date || "";
            break;
          case "name":
            val = emp.name || "";
            break;
          case "userId":
            val = emp.employee_id || "";
            break;
          case "email":
            val = emp.email || "";
            break;
          case "phone":
            val = formatPhone(emp.phone_number);
            break;
          case "birth":
            val = emp.birth_date || "";
            break;
          case "address":
            val = emp.address || "";
            break;
          case "jumin":
            val = emp.jumin_no ? renderMaskedJumin(emp.jumin_no) : "";
            break;
          default:
            val = "";
        }
        return `"${val}"`;
      });
      csvRows.push(rowData.join(","));
    });

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SecureTech_Employees_${filterRole === "active" ? "재직자" : "퇴사자"}_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedEmployees, activeCols, filterRole, COLUMNS]);

  return (
    <div className="page-container admin-page">
      <div
        className="page-header"
        style={{ marginBottom: "20px", flexShrink: 0 }}
      >
        <div>
          <h2 className="page-title">👥 사원 관리</h2>
          <p className="page-subtitle">
            사번을 클릭하여 사원의 상세 개인정보 및 인적 사항을 확인하세요.
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "20px",
          minHeight: 0,
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "12px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              style={{
                height: "38px",
                padding: "0 20px",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  filterRole === "active"
                    ? "var(--color-primary)"
                    : "var(--bg-main)",
                color: filterRole === "active" ? "#fff" : "var(--text-muted)",
                border:
                  filterRole === "active"
                    ? "1px solid var(--color-primary)"
                    : "1px solid var(--border-color)",
              }}
              onClick={() => setFilterRole("active")}
            >
              🏢 재직자 명부 ({totalEmployeesCount}명)
            </button>
            <button
              style={{
                height: "38px",
                padding: "0 20px",
                borderRadius: "8px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  filterRole === "deleted"
                    ? "var(--color-danger)"
                    : "var(--bg-main)",
                color: filterRole === "deleted" ? "#fff" : "var(--text-muted)",
                border:
                  filterRole === "deleted"
                    ? "1px solid var(--color-danger)"
                    : "1px solid var(--border-color)",
              }}
              onClick={() => setFilterRole("deleted")}
            >
              🚪 퇴사자 명부 ({totalDeletedCount}명)
            </button>
          </div>

          <button
            onClick={exportToCSV}
            className="btn-primary"
            style={{
              height: "38px",
              padding: "0 20px",
              fontSize: "14px",
              fontWeight: "bold",
              backgroundColor: "#10b981",
              margin: 0,
              borderRadius: "8px",
            }}
          >
            📥 CSV 다운로드
          </button>
        </div>

        <div
          className="card-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <input
              type="text"
              className="custom-input search-input"
              style={{
                width: "240px",
                padding: "8px 12px",
                fontSize: "13px",
                height: "38px",
              }}
              placeholder="이름, 사번, 아이디 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                display: "flex",
                gap: "10px",
                padding: "0 14px",
                height: "38px",
                backgroundColor: "var(--bg-main)",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "bold",
                  color: "var(--text-title)",
                  whiteSpace: "nowrap",
                }}
              >
                표시 항목:
              </span>
              {COLUMNS.map((col) => (
                <label
                  key={col.id}
                  style={{
                    fontSize: "13px",
                    color: "var(--text-main)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedCols[col.id]}
                    onChange={() =>
                      setCheckedCols((p) => ({ ...p, [col.id]: !p[col.id] }))
                    }
                  />
                  {col.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setActiveCols(checkedCols);
                setCurrentPage(1);
              }}
              style={{
                height: "38px",
                padding: "0 18px",
                fontSize: "13px",
                margin: 0,
                fontWeight: "bold",
                whiteSpace: "nowrap",
              }}
            >
              항목 적용
            </button>
          </div>
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
              minWidth: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
              margin: 0,
              height: "100%",
            }}
          >
            <thead
              style={{
                backgroundColor: "var(--bg-main)",
                zIndex: 2,
                position: "sticky",
                top: 0,
              }}
            >
              <tr
                style={{
                  borderBottom: "2px solid var(--border-color)",
                  userSelect: "none",
                  height: "46px",
                }}
              >
                {activeCols.empNum && (
                  <ResizableTh
                    colKey="empNum"
                    label={`사번 ${sortOrder === "asc" ? "▲" : "▼"}`}
                    onClick={() =>
                      setSortOrder((p) => (p === "asc" ? "desc" : "asc"))
                    }
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                {activeCols.joinDate && (
                  <ResizableTh
                    colKey="joinDate"
                    label="입사일"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                {activeCols.name && (
                  <ResizableTh
                    colKey="name"
                    label="이름"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                {activeCols.userId && (
                  <ResizableTh
                    colKey="userId"
                    label="아이디"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                {activeCols.email && (
                  <ResizableTh
                    colKey="email"
                    label="이메일"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}

                {activeCols.phone && (
                  <ResizableTh
                    colKey="phone"
                    label="연락처"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                {activeCols.birth && (
                  <ResizableTh
                    colKey="birth"
                    label="생년월일"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                {activeCols.address && (
                  <ResizableTh
                    colKey="address"
                    label="주소"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}

                {activeCols.jumin && (
                  <ResizableTh
                    colKey="jumin"
                    label="주민등록번호"
                    colWidths={colWidths}
                    handleMouseDown={handleMouseDown}
                  />
                )}
                <th
                  style={{
                    width: colWidths.action,
                    padding: "8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    position: "sticky",
                    right: 0,
                    backgroundColor: "var(--bg-card)",
                    zIndex: 5,
                    borderLeft: "1px solid var(--border-color)",
                  }}
                >
                  관리
                </th>
              </tr>
            </thead>
            <tbody style={{ flex: 1 }}>
              {currentItems.map((emp, idx) => (
                <tr
                  key={emp.employee_id || `empty-${idx}`}
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    backgroundColor:
                      emp.is_deleted && !emp.isEmpty
                        ? "var(--bg-card-alt)"
                        : "transparent",
                    height: "10%",
                  }}
                >
                  {emp.isEmpty ? (
                    // 💡 [핵심 수정 부분] 고정값 10 대신 계산된 visibleColCount를 적용
                    <td colSpan={visibleColCount}>&nbsp;</td>
                  ) : (
                    <>
                      {activeCols.empNum && (
                        <td
                          style={{
                            ...tdCenter,
                            cursor: "pointer",
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--color-primary)",
                            fontWeight: "bold",
                            textDecoration: emp.is_deleted
                              ? "line-through"
                              : "underline",
                          }}
                          onClick={() => handleEmpCardClick(emp)}
                          title="클릭하여 상세 개인정보 보기"
                        >
                          {emp.emp_code || "-"}
                        </td>
                      )}

                      {activeCols.joinDate && (
                        <td
                          style={{
                            ...tdCenter,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--text-main)",
                          }}
                        >
                          {emp.hire_date || "-"}
                        </td>
                      )}

                      {activeCols.name && (
                        <td
                          style={{
                            ...tdCenter,
                            fontWeight: "600",
                            color: emp.is_deleted
                              ? "var(--color-danger)"
                              : "var(--text-title)",
                          }}
                        >
                          {emp.name}{" "}
                          {emp.is_deleted && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--color-danger)",
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                marginLeft: "4px",
                              }}
                            >
                              퇴사
                            </span>
                          )}
                        </td>
                      )}

                      {activeCols.userId && (
                        <td
                          style={{
                            ...tdCenter,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--text-main)",
                          }}
                        >
                          {emp.employee_id}
                        </td>
                      )}
                      {activeCols.email && (
                        <td
                          style={{
                            ...tdLeft,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--color-primary)",
                          }}
                        >
                          {emp.email}
                        </td>
                      )}

                      {activeCols.phone && (
                        <td
                          style={{
                            ...tdCenter,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--text-main)",
                          }}
                        >
                          <span>{formatPhone(emp.phone_number)}</span>
                        </td>
                      )}
                      {activeCols.birth && (
                        <td
                          style={{
                            ...tdCenter,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--text-main)",
                          }}
                        >
                          {emp.birth_date}
                        </td>
                      )}
                      {activeCols.address && (
                        <td
                          style={{
                            ...tdLeft,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--text-main)",
                          }}
                        >
                          <span>{emp.address}</span>
                        </td>
                      )}

                      {activeCols.jumin && (
                        <td
                          style={{
                            ...tdCenter,
                            color: emp.is_deleted
                              ? "var(--text-muted)"
                              : "var(--text-main)",
                          }}
                        >
                          {emp.jumin_no ? renderMaskedJumin(emp.jumin_no) : "-"}
                        </td>
                      )}

                      <td
                        style={{
                          width: colWidths.action,
                          padding: "4px 8px",
                          textAlign: "center",
                          position: "sticky",
                          right: 0,
                          backgroundColor: emp.is_deleted
                            ? "var(--bg-card-alt)"
                            : "var(--bg-card)",
                          zIndex: 2,
                          borderLeft: "1px solid var(--border-color)",
                        }}
                      >
                        {emp.is_deleted ? (
                          <button
                            type="button"
                            className="btn-action btn-action-reject"
                            style={{
                              ...btnStyle,
                              backgroundColor: "var(--color-danger)",
                              color: "#fff",
                              border: "none",
                            }}
                            onClick={() =>
                              handleHardDelete(emp.employee_id, emp.name)
                            }
                            disabled={loading}
                          >
                            완전 삭제
                          </button>
                        ) : (
                          <div
                            className="action-btn-group"
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              gap: "4px",
                            }}
                          >
                            <button
                              className="btn-action btn-action-edit"
                              style={btnStyle}
                              onClick={() => handleEditClick(emp)}
                            >
                              수정
                            </button>
                            <button
                              className="btn-action btn-action-reject"
                              style={{
                                ...btnStyle,
                                border: "1px solid var(--color-danger)",
                              }}
                              onClick={() =>
                                handleDelete(emp.employee_id, emp.name)
                              }
                            >
                              퇴사
                            </button>
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
        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {editModal.isOpen && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalBoxStyle, width: "400px" }}>
            <h3
              style={{
                margin: "0 0 20px 0",
                color: "var(--text-title)",
                fontSize: "18px",
              }}
            >
              ✏️ 사원 정보 수정
            </h3>
            <form
              onSubmit={handleUpdate}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  연락처
                </label>
                <input
                  type="text"
                  className="custom-input"
                  value={editModal.phone}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      phone: formatPhone(e.target.value),
                    })
                  }
                  placeholder="연락처 입력 (숫자만 입력)"
                  style={{ padding: "10px", width: "100%", fontSize: "14px" }}
                  maxLength={13}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  이메일
                </label>
                <input
                  type="email"
                  className="custom-input"
                  value={editModal.email}
                  onChange={(e) =>
                    setEditModal({ ...editModal, email: e.target.value })
                  }
                  placeholder="이메일 입력"
                  style={{ padding: "10px", width: "100%", fontSize: "14px" }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  주소
                </label>
                <input
                  type="text"
                  className="custom-input"
                  value={editModal.address}
                  onChange={(e) =>
                    setEditModal({ ...editModal, address: e.target.value })
                  }
                  placeholder="주소 입력"
                  style={{ padding: "10px", width: "100%", fontSize: "14px" }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  className="btn-action btn-action-reject"
                  onClick={() =>
                    setEditModal({
                      isOpen: false,
                      empId: null,
                      phone: "",
                      address: "",
                      email: "",
                    })
                  }
                  style={{
                    height: "36px",
                    padding: "0 20px",
                    fontWeight: "bold",
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{
                    height: "36px",
                    padding: "0 20px",
                    fontWeight: "bold",
                  }}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedEmpDetail && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <h3
              style={{
                margin: "0 0 20px 0",
                color: "var(--color-primary)",
                fontSize: "18px",
              }}
            >
              📋 사원 상세 개인정보 조회
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                fontSize: "14px",
                marginBottom: "24px",
              }}
            >
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  사번:
                </strong>{" "}
                {selectedEmpDetail.emp_code}
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  아이디(ID):
                </strong>{" "}
                {selectedEmpDetail.employee_id}
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  이름:
                </strong>{" "}
                <span
                  style={{ fontWeight: "bold", color: "var(--text-title)" }}
                >
                  {selectedEmpDetail.name}
                </span>
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  입사일:
                </strong>{" "}
                {selectedEmpDetail.hire_date}
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  생년월일:
                </strong>{" "}
                {selectedEmpDetail.birth_date || "-"}
              </div>
              <hr
                style={{ borderColor: "var(--border-color)", margin: "8px 0" }}
              />
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  이메일:
                </strong>{" "}
                {selectedEmpDetail.email}
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  연락처:
                </strong>{" "}
                {formatPhone(selectedEmpDetail.phone_number)}
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  주소:
                </strong>{" "}
                {selectedEmpDetail.address}
              </div>
              <div>
                <strong
                  style={{
                    color: "var(--text-muted)",
                    display: "inline-block",
                    width: "100px",
                  }}
                >
                  주민등록번호:
                </strong>{" "}
                <span style={{ color: "var(--color-warning)" }}>
                  {selectedEmpDetail.jumin_no}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsDetailModalOpen(false)}
                style={{
                  height: "36px",
                  padding: "0 24px",
                  fontWeight: "bold",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default EmployeeManage;
