// 사원 목록 조회, 상태 변경, 정보 수정, 검색 및 CSV 다운로드를 제공하는 사원 관리 UI 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../api";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { appAlert, appConfirm } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { padRows, useResetPage } from "../../utils/table";
import useDebounce from "../../utils/useDebounce";

const ResizableTh = ({
  colKey,
  label,
  onClick,
  colWidths,
  handleMouseDown,
}) => (
  <th className="th-resizable" style={{ width: colWidths[colKey] }}>
    <div
      onClick={onClick}
      className={`th-inner ${onClick ? "th-sortable" : ""}`}
    >
      {label}
    </div>
    <div
      className="col-resizer"
      onMouseDown={(e) => {
        e.stopPropagation();
        handleMouseDown(e, colKey);
      }}
      title="드래그하여 너비 조절"
    />
  </th>
);

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

// 네이티브 select 팝업은 다크모드와 무관하게 항상 밝은 배경으로 뜨므로,
// 옵션 글자색은 테마 변수 대신 밝은 배경에서도 또렷한 고정값을 쓴다.
const COLOR_CLASS_VAR = {
  "text-success": "#10b981",
  "text-warning": "#f59e0b",
  "text-danger": "#ef4444",
  "text-muted": "#64748b",
};

const STATUS_OPTIONS = [
  {
    code: 10,
    label: "정상",
    colorClass: "text-success",
    bgClass: "btn-success",
  },
  {
    code: 20,
    label: "휴가중",
    colorClass: "text-warning",
    bgClass: "btn-warning",
  },
  {
    code: 30,
    label: "이용정지",
    colorClass: "text-danger",
    bgClass: "btn-danger",
  },
  { code: 40, label: "휴직", colorClass: "text-muted", bgClass: "btn-neutral" },
  { code: 90, label: "퇴사", colorClass: "text-danger", bgClass: "btn-danger" },
];

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

  // 💡 기존 탭을 대체하는 '상태 필터' ("all" 또는 숫자 문자열)
  const [filterRole, setFilterRole] = useState(
    () => sessionStorage.getItem("empFilterRole") || "all",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState("asc");
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const [colWidths, setColWidths] = useState({
    empNum: 100,
    joinDate: 90,
    name: 110,
    userId: 100,
    email: 150,
    phone: 100,
    birth: 120,
    address: 170,
    jumin: 120,
    action: 180,
  });

  const baseUrl = API_BASE_URL;

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

  const fetchEmployees = useCallback(
    async (signal) => {
      try {
        const res = await axios.get(`${baseUrl}/api/employees/`, { signal });
        if (res?.data) setEmployees(res.data);
        setLastUpdated(formatTimeKR());
      } catch (err) {
        if (err.name !== "CanceledError") console.error(err);
      }
    },
    [baseUrl],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchEmployees(controller.signal);
    return () => controller.abort();
  }, [fetchEmployees]);

  useEffect(() => {
    sessionStorage.setItem("empFilterRole", filterRole);
  }, [filterRole]);

  useResetPage([filterRole, debouncedSearch, activeCols, sortOrder], () =>
    setCurrentPage(1),
  );

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
    } catch (err) {
      console.error("사원 상세 정보 조회 실패:", err);
    }
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
      status_code: emp.status_code,
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
        await appAlert("수정되었습니다.");
        setEditModal({
          isOpen: false,
          empId: null,
          phone: "",
          address: "",
          email: "",
        });
        fetchEmployees();
      }
    } catch {
      await appAlert("수정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 💡 상태(Status) 변경 함수
  const handleStatusChange = async (empId, newStatusCode, empName) => {
    const selectedOption = STATUS_OPTIONS.find(
      (opt) => opt.code === Number(newStatusCode),
    );
    if (!selectedOption) return;

    if (
      !(await appConfirm(
        `'${empName}' 사원의 상태를 [${selectedOption.label}]으(로) 변경하시겠습니까?`,
      ))
    ) {
      // 취소하면 화면 새로고침하여 원래 select 값 복구
      fetchEmployees();
      return;
    }

    try {
      // 💡 백엔드(update-status) 하나만 호출하면 백엔드가 알아서 DB 세션도 지우고 엔진에 차단 신호도 보냅니다!
      await axios.post(`${baseUrl}/api/employees/update-status/`, {
        employee_id: empId,
        status_code: newStatusCode,
      });
      fetchEmployees();
    } catch (err) {
      await appAlert("상태 변경에 실패했습니다.");
      console.error(err);
    }
  };

  const handleHardDelete = async (empId, empName) => {
    if (
      !(await appConfirm(
        `'${empName}' 데이터를 완전히 파기하시겠습니까? (보안 로그 제외)`,
      ))
    )
      return;
    try {
      await axios.post(`${baseUrl}/api/employees/hard-delete/`, {
        employee_id: empId,
      });
      await appAlert("삭제되었습니다.");
      fetchEmployees();
    } catch {
      await appAlert("처리 중 오류가 발생했습니다.");
    }
  };

  // 💡 드롭다운 필터 적용
  const roleFiltered = useMemo(() => {
    if (filterRole === "all") return employees;
    return employees.filter(
      (emp) => String(emp.status_code) === String(filterRole),
    );
  }, [employees, filterRole]);

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
        let val;
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
    link.download = `SecureTech_Employees_${filterRole}_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedEmployees, activeCols, filterRole]);

  const getStatusDisplay = (code) => {
    const st = STATUS_OPTIONS.find((o) => o.code === Number(code));
    return st || STATUS_OPTIONS[0];
  };

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="사원 관리"
        subtitle="사원 상태를 변경하고 상세 정보를 관리합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchEmployees}
      />

      <div className="card dashboard-card card-fill">
        <div className="card-toolbar">
          <div className="btn-group">
            {/* 💡 새로운 드롭다운 상태 필터 */}
            <span className="fw-bold text-title">상태 필터:{" "}</span>
            <select
              className={`custom-input select-status ${filterRole === "all" ? "text-title" : getStatusDisplay(filterRole).colorClass}`}
              style={{ width: "auto", minWidth: "150px" }}
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all">전체 ({employees.length}명)</option>
              {STATUS_OPTIONS.map((opt) => {
                const count = employees.filter(
                  (emp) => emp.status_code === opt.code,
                ).length;
                return (
                  <option
                    key={opt.code}
                    value={opt.code}
                    style={{ color: COLOR_CLASS_VAR[opt.colorClass] }}
                  >
                    {opt.label} ({count}명)
                  </option>
                );
              })}
            </select>
          </div>
          <button
            type="button"
            onClick={exportToCSV}
            className="btn-action btn-neutral btn-w-lg btn-form"
          >
            CSV 다운로드
          </button>
        </div>

        <div className="card-toolbar">
          <input
            type="text"
            className="custom-input search-input"
            placeholder="이름, 사번, 아이디 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <div className="toolbar-group">
            <div className="column-picker">
              <span className="fw-bold text-title">표시 항목:</span>
              {COLUMNS.map((col) => (
                <label key={col.id} className="check-label">
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
              className="btn-action btn-primary btn-w-md btn-form"
              onClick={() => {
                setActiveCols(checkedCols);
                setCurrentPage(1);
              }}
            >
              항목 적용
            </button>
          </div>
        </div>

        <div className="table-responsive table-fill">
          <table className="custom-table">
            <thead>
              <tr>
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
                  className="col-sticky-right"
                  style={{ width: colWidths.action }}
                >
                  조치
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((emp, idx) => {
                const currentStatus = getStatusDisplay(emp.status_code);
                const subText = emp.status_code === 90 ? "text-muted" : "";

                return (
                  <tr
                    key={emp.employee_id || `empty-${idx}`}
                    className={
                      emp.status_code === 90 && !emp.isEmpty ? "row-muted" : ""
                    }
                  >
                    {emp.isEmpty ? (
                      <td colSpan={visibleColCount}>&nbsp;</td>
                    ) : (
                      <>
                        {activeCols.empNum && (
                          <td
                            className={`cell-ellipsis ${emp.status_code === 90 ? "cell-link-off" : "cell-link"}`}
                            onClick={() => handleEmpCardClick(emp)}
                          >
                            {emp.emp_code || "-"}
                          </td>
                        )}
                        {activeCols.joinDate && (
                          <td className={`cell-ellipsis ${subText}`}>
                            {emp.hire_date || "-"}
                          </td>
                        )}

                        {activeCols.name && (
                          <td
                            className={`cell-strong cell-ellipsis ${currentStatus.colorClass}`}
                          >
                            {emp.name}
                          </td>
                        )}

                        {activeCols.userId && (
                          <td className={`cell-ellipsis ${subText}`}>
                            {emp.employee_id}
                          </td>
                        )}
                        {activeCols.email && (
                          <td className={`cell-left cell-ellipsis ${subText}`}>
                            {emp.email}
                          </td>
                        )}
                        {activeCols.phone && (
                          <td className={`cell-ellipsis ${subText}`}>
                            {formatPhone(emp.phone_number)}
                          </td>
                        )}
                        {activeCols.birth && (
                          <td className={`cell-ellipsis ${subText}`}>
                            {emp.birth_date}
                          </td>
                        )}
                        {activeCols.address && (
                          <td className={`cell-left cell-ellipsis ${subText}`}>
                            {emp.address}
                          </td>
                        )}
                        {activeCols.jumin && (
                          <td className={`cell-ellipsis ${subText}`}>
                            {emp.jumin_no
                              ? renderMaskedJumin(emp.jumin_no)
                              : "-"}
                          </td>
                        )}

                        <td
                          className="col-sticky-right"
                          style={{ width: colWidths.action }}
                        >
                          {emp.employee_id.startsWith("ANON") ? (
                            <button
                              type="button"
                              className="btn-action btn-neutral btn-w-sm"
                              disabled
                            >
                              파기됨
                            </button>
                          ) : (
                            <div className="action-btn-group">
                              <button
                                type="button"
                                className="btn-action btn-neutral btn-w-sm"
                                onClick={() => handleEditClick(emp)}
                              >
                                수정
                              </button>
                              <select
                                className={`btn-action btn-neutral btn-w-md select-status ${currentStatus.colorClass}`}
                                value={emp.status_code || 10}
                                onChange={(e) =>
                                  handleStatusChange(
                                    emp.employee_id,
                                    e.target.value,
                                    emp.name,
                                  )
                                }
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option
                                    key={opt.code}
                                    value={opt.code}
                                    style={{ color: COLOR_CLASS_VAR[opt.colorClass] }}
                                  >
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
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
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3 className="dialog-title">사원 정보 수정</h3>
            <form onSubmit={handleUpdate} className="auth-form">
              <div className="form-group">
                <label className="form-label">연락처</label>
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
                  maxLength={13}
                />
              </div>
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  className="custom-input"
                  value={editModal.email}
                  onChange={(e) =>
                    setEditModal({ ...editModal, email: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">주소</label>
                <input
                  type="text"
                  className="custom-input"
                  value={editModal.address}
                  onChange={(e) =>
                    setEditModal({ ...editModal, address: e.target.value })
                  }
                />
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn-action btn-neutral btn-w-md btn-header"
                  onClick={() =>
                    setEditModal({
                      isOpen: false,
                      empId: null,
                      phone: "",
                      address: "",
                      email: "",
                    })
                  }
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-action btn-primary btn-w-md btn-header"
                  disabled={loading}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailModalOpen && selectedEmpDetail && (
        <div className="dialog-overlay">
          <div className="dialog-box dialog-md">
            <h3 className="dialog-title">사원 상세 정보</h3>
            <div>
              <div className="info-row is-compact">
                <span className="info-label">사번</span>
                <span className="info-value">{selectedEmpDetail.emp_code}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">아이디</span>
                <span className="info-value">
                  {selectedEmpDetail.employee_id}
                </span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">이름</span>
                <span className="info-value fw-bold text-title">
                  {selectedEmpDetail.name}
                </span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">상태</span>
                <span
                  className={`info-value ${getStatusDisplay(selectedEmpDetail.status_code).colorClass}`}
                >
                  {getStatusDisplay(selectedEmpDetail.status_code).label}
                </span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">입사일</span>
                <span className="info-value">
                  {selectedEmpDetail.hire_date}
                </span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">생년월일</span>
                <span className="info-value">
                  {selectedEmpDetail.birth_date || "-"}
                </span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">이메일</span>
                <span className="info-value">{selectedEmpDetail.email}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">연락처</span>
                <span className="info-value">
                  {formatPhone(selectedEmpDetail.phone_number)}
                </span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">주소</span>
                <span className="info-value">{selectedEmpDetail.address}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">주민등록번호</span>
                <span className="info-value text-warning">
                  {selectedEmpDetail.jumin_no}
                </span>
              </div>
            </div>
            <div className="dialog-actions">
              {/* 퇴사(90) 상태일 때만 '완전 삭제' 버튼 노출 */}
              {selectedEmpDetail.status_code === 90 &&
                !selectedEmpDetail.employee_id.startsWith("ANON") && (
                  <button
                    type="button"
                    className="btn-action btn-danger btn-w-md btn-header"
                    onClick={() => {
                      handleHardDelete(
                        selectedEmpDetail.employee_id,
                        selectedEmpDetail.name,
                      );
                      setIsDetailModalOpen(false);
                    }}
                    style={{ marginRight: "auto" }}
                  >
                    완전 삭제 파기
                  </button>
                )}
              <button
                type="button"
                className="btn-action btn-neutral btn-w-md btn-header"
                onClick={() => setIsDetailModalOpen(false)}
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
