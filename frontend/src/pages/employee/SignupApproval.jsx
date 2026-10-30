import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";

const padRows = (arr, length) => {
  const padded = [...arr];
  while (padded.length < length) {
    padded.push({ isEmpty: true });
  }
  return padded;
};

const ResizableTh = ({ colKey, label, colWidths, handleMouseDown }) => (
  <th className="th-resizable" style={{ width: colWidths[colKey] }}>
    {label}
    <div
      className="col-resizer"
      onMouseDown={(e) => handleMouseDown(e, colKey)}
    />
  </th>
);

const SignupApproval = () => {
  const [pendingList, setPendingList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
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
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
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
      <PageHeader
        title="신규 회원 가입 승인 관리"
        subtitle="가입 대기자를 검토하고 정규 사원으로 승인합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchPending}
      />
      <div className="card dashboard-card card-fill">
        <div className="card-toolbar">
          <input
            type="text"
            className="custom-input search-input"
            placeholder="아이디, 이름, 연락처 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="count-badge badge-danger">
            대기 신청 {filteredList.length}건
          </span>
        </div>
        <div className="table-responsive table-fill">
          <table className="custom-table">
            <thead>
              <tr>
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
            <tbody>
              {currentItems.map((m, idx) => (
                <tr key={m.member_id || `empty-${idx}`}>
                  {m.isEmpty ? (
                    <td colSpan="7">&nbsp;</td>
                  ) : (
                    <>
                      <td className="cell-time">{m.created_at || "최근"}</td>
                      <td className="cell-strong">{m.member_id}</td>
                      <td className="cell-strong">{m.name}</td>
                      <td className="cell-ellipsis text-primary">{m.email}</td>
                      <td>{formatPhone(m.phone_number)}</td>
                      <td className="cell-time">{m.birth_date || "-"}</td>
                      <td>
                        <div className="action-btn-group">
                          <button
                            type="button"
                            className="btn-action btn-success btn-w-sm"
                            onClick={() => handleApprove(m.member_id, m.name)}
                            disabled={loading}
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-danger btn-w-sm"
                            onClick={() => handleReject(m.member_id, m.name)}
                            disabled={loading}
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
