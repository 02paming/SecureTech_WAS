import axios from "axios";
import { useState } from "react";
import { API_BASE_URL } from "../api";
import AdminAuthDialog from "./AdminAuthDialog";

// 차단된 사원 목록과 차단 해제. 해제는 관리자 인증을 거친다
function BlockedEmployeesDialog({ employees, onChanged, onClose }) {
  const [target, setTarget] = useState(null);

  const handleUnblock = async ({ employee_id, password }) => {
    try {
      await axios.post(`${API_BASE_URL}/api/dashboard/unblock-employee/`, {
        employee_id: target.emp_id,
        admin_id: employee_id,
        password,
      });
      alert(`${target.emp_name} 사원의 차단을 해제했습니다.`);
      setTarget(null);
      onChanged();
    } catch (err) {
      alert(err.response?.data?.error || "차단 해제에 실패했습니다.");
    }
  };

  return (
    <>
      <div className="dialog-overlay">
        <div className="dialog-box dialog-md">
          <div className="dialog-header">
            <h3 className="dialog-title">차단된 사원</h3>
            <div className="btn-group">
              <span className="tag tag-primary">{employees.length}명</span>
              <button
                type="button"
                className="btn-action btn-neutral btn-w-md btn-header"
                onClick={onClose}
              >
                닫기
              </button>
            </div>
          </div>

          {employees.length === 0 ? (
            <div className="empty-state">차단된 사원이 없습니다.</div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>사번</th>
                    <th>이름</th>
                    <th>아이디</th>
                    <th>조치</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.emp_id}>
                      <td>{emp.emp_no}</td>
                      <td className="cell-strong">{emp.emp_name}</td>
                      <td className="text-muted">{emp.emp_id}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-action btn-primary btn-w-sm"
                          onClick={() => setTarget(emp)}
                        >
                          해제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {target && (
        <AdminAuthDialog
          title="사원 차단 해제"
          target={`${target.emp_name} (${target.emp_id})`}
          onSubmit={handleUnblock}
          onCancel={() => setTarget(null)}
        />
      )}
    </>
  );
}

export default BlockedEmployeesDialog;
