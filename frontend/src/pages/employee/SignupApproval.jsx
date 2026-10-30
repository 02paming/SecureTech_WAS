import axios from "axios";
import { useCallback, useEffect, useState } from "react";

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

const ResizableTh = ({ colKey, label, colWidths, handleMouseDown }) => (
  <th
    style={{
      width: colWidths[colKey],
      padding: "12px",
      borderRight: "1px solid var(--border-color)",
      whiteSpace: "nowrap",
      textAlign: "center",
      position: "relative",
    }}
  >
    {label}
    <div
      onMouseDown={(e) => handleMouseDown(e, colKey)}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "8px",
        cursor: "col-resize",
        zIndex: 1,
      }}
    />
  </th>
);

const SignupApproval = () => {
  const [pendingList, setPendingList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [colWidths, setColWidths] = useState({
    date: 110,
    id: 140,
    name: 110,
    email: 200,
    phone: 140,
    birth: 140,
    action: 180,
  });
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`
  ).replace(/\/+$/, "");

  const formatPhone = (phone) => {
    if (!phone) return "-";
    const clean = String(phone).replace(/[^0-9]/g, "");
    if (clean.length === 11)
      return clean.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (clean.length === 10)
      return clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    return phone;
  };

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/approvals/pending/`);
      setPendingList(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {}
  }, [baseUrl]);
  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (memberId, name) => {
    if (!window.confirm(`${name}(${memberId}) 님을 승인할까요?`)) return;
    setLoading(true);
    try {
      await axios.post(`${baseUrl}/api/approvals/approve/`, {
        member_id: memberId,
      });
      fetchPending();
    } catch (err) {
      alert("승인 오류");
    } finally {
      setLoading(false);
    }
  };
  const handleReject = async (memberId, name) => {
    if (!window.confirm(`${name} 요청을 반려(삭제)할까요?`)) return;
    try {
      await axios.post(`${baseUrl}/api/approvals/reject/`, {
        member_id: memberId,
      });
      fetchPending();
    } catch (err) {
      alert("반려 오류");
    }
  };

  const filteredList = pendingList.filter(
    (m) =>
      !searchTerm ||
      (m.member_id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.phone_number || "").includes(searchTerm) ||
      (m.email || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const currentItems = padRows(
    filteredList.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
    itemsPerPage,
  );

  const handleMouseDown = useCallback(
    (e, colKey) => {
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
    },
    [colWidths],
  );

  return (
    <div className="page-container admin-page">
      <div
        className="page-header"
        style={{ marginBottom: "16px", flexShrink: 0 }}
      >
        <h2 className="page-title">📝 신규 회원 가입 승인 관리</h2>
        <p className="page-subtitle">
          가입 대기자를 검토하고 정규 사원으로 승인합니다.
        </p>
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
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            className="custom-input search-input"
            style={{
              width: "240px",
              padding: "8px 12px",
              fontSize: "13px",
              height: "36px",
            }}
            placeholder="아이디, 이름, 연락처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div style={{ fontSize: "13px", fontWeight: "bold" }}>
            대기 신청:{" "}
            <strong style={{ color: "var(--color-danger)", fontSize: "15px" }}>
              {filteredList.length}
            </strong>{" "}
            건
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
                <ResizableTh
                  colKey="date"
                  label="신청 일자"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="id"
                  label="신청 ID"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="name"
                  label="이름"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="email"
                  label="개인 이메일"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="phone"
                  label="연락처"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="birth"
                  label="생년월일"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="action"
                  label="승인 / 반려"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
              </tr>
            </thead>
            <tbody style={{ flex: 1 }}>
              {currentItems.map((m, idx) => (
                <tr
                  key={m.member_id || `empty-${idx}`}
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                    height: "9%",
                  }}
                >
                  {m.isEmpty ? (
                    <td colSpan="7">&nbsp;</td>
                  ) : (
                    <>
                      <td style={{ textAlign: "center", fontSize: "13px" }}>
                        {m.created_at || "최근"}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        {m.member_id}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: "bold",
                          color: "var(--text-title)",
                          fontSize: "14px",
                        }}
                      >
                        {m.name}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "var(--color-primary)",
                        }}
                      >
                        {m.email}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {formatPhone(m.phone_number)}
                      </td>
                      <td style={{ textAlign: "center", fontSize: "13px" }}>
                        {m.birth_date || "-"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <button
                            className="btn-primary"
                            onClick={() => handleApprove(m.member_id, m.name)}
                            disabled={loading}
                            style={{
                              height: "30px",
                              padding: "0 16px",
                              fontSize: "12px",
                              fontWeight: "bold",
                            }}
                          >
                            승인
                          </button>
                          <button
                            className="btn-action btn-action-reject"
                            onClick={() => handleReject(m.member_id, m.name)}
                            disabled={loading}
                            style={{
                              height: "30px",
                              padding: "0 16px",
                              fontSize: "12px",
                              fontWeight: "bold",
                              border: "1px solid var(--color-danger)",
                            }}
                          >
                            반려
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
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};
export default SignupApproval;
