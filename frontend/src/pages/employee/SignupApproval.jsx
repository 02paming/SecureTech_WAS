import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { appAlert, appConfirm } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { padRows } from "../../utils/table";
import { API_BASE_URL } from "../../api";

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
  const baseUrl = API_BASE_URL;

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
      setLastUpdated(formatTimeKR());
    } catch (err) {
      console.error("가입 대기 목록 조회 실패:", err);
    }
  }, [baseUrl]);
  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (memberId, name) => {
    if (!(await appConfirm(`${name}(${memberId}) 님을 승인할까요?`))) return;
    setLoading(true);
    try {
      await axios.post(`${baseUrl}/api/approvals/approve/`, {
        member_id: memberId,
      });
      fetchPending();
    } catch (err) {
      console.error("가입 승인 실패:", err);
      await appAlert(err.response?.data?.error || "승인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };
  const handleReject = async (memberId, name) => {
    if (!(await appConfirm(`${name} 요청을 반려할까요? 신청 내용은 삭제됩니다.`))) return;
    try {
      await axios.post(`${baseUrl}/api/approvals/reject/`, {
        member_id: memberId,
      });
      fetchPending();
    } catch (err) {
      console.error("가입 반려 실패:", err);
      await appAlert(err.response?.data?.error || "반려에 실패했습니다.");
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
        title="가입 승인"
        subtitle="가입 대기자를 검토하고 사원으로 승인합니다."
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
                  label="신청일"
                  colWidths={colWidths}
                  handleMouseDown={handleMouseDown}
                />
                <ResizableTh
                  colKey="id"
                  label="아이디"
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
                  label="이메일"
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
                  label="조치"
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
