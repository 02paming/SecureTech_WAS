// 임직원의 네트워크 접속 기록, 위협 로그 및 MAC 스푸핑 이력을 통합 조회하고 필터링하는 로그 분석실 UI 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL, MONITOR_REFRESH_MS } from "../../api";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import DomainDetailDialog from "../../components/DomainDetailDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import SecurityDetailDialog from "../../components/SecurityDetailDialog";
import { hasAiScore } from "../../utils/aiScore";
import { appAlert } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";
import { LEVEL_TONES } from "../../utils/levelTone";
import { POLICY_TONES, getResultTone } from "../../utils/policyTone";
import { padRows, usePagination, useResetPage } from "../../utils/table";
import useDebounce from "../../utils/useDebounce";

const THREAT_LABELS = {
  DGA_NXDOMAIN: { text: "미존재 도메인 (DGA)", title: "존재하지 않는 도메인 접속 시도 (NXDOMAIN)" },
  MAC_SPOOFING: { text: "MAC 스푸핑", title: "인증된 IP와 MAC 주소 불일치" },
};

const ACTION_LABELS = {
  BLOCKED: "세션 차단",
  DETECTED: "위협 탐지",
  RST_SENT: "연결 강제 종료",
};

const LogAnalysis = () => {
  const [searchParams] = useSearchParams();
  const [detailDomain, setDetailDomain] = useState(null);

  // 💡 [수술 1] 탭 상태 (normal | threat)
  const [activeTab, setActiveTab] = useState("normal");

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, allowed: 0, blocked: 0, ai_suspicious: 0, suspicious_blocked: 0, dga: 0, });
  const [loadingAction, setLoadingAction] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const [search, setSearch] = useState(() => searchParams.get("domain") || "");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState("all");
  const [subFilter, setSubFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // 오늘 이후 날짜와, 시작일이 종료일보다 늦은 역전된 범위를 선택하지 못하게 막는 기준값
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { page: currentPage, setPage: setCurrentPage, perPage: itemsPerPage, setPerPage: setItemsPerPage } = usePagination(10);
  const [totalPages, setTotalPages] = useState(1);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [releaseRequest, setReleaseRequest] = useState(null);

  const baseUrl = API_BASE_URL;
  // const isFetchingRef = useRef(false);

  const requestSeqRef = useRef(0);
  const fetchTimeoutRef = useRef(null);

  // 💡 [수술 2] 탭에 따라 백엔드 API 호출 분기
  const fetchData = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoadingAction(true);
    try {
      const endpoint = activeTab === "normal"
        ? "/api/dashboard/integrated-logs/"
        : "/api/dashboard/unauth-threat-logs/";

      const res = await axios.get(`${baseUrl}${endpoint}`, {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearch,
          statusFilter,
          subFilter,
          startDate,
          endDate,
        },
      });
      if (seq !== requestSeqRef.current) return;
      if (res.data?.status === "success") {
        setLogs(res.data.general_logs || []);
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.total_pages) setTotalPages(res.data.total_pages);
        setLastUpdated(formatTimeKR());
      }
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      console.error("로그 데이터 갱신 오류:", err);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoadingAction(false);
      }
    }
  }, [baseUrl, activeTab, currentPage, itemsPerPage, debouncedSearch, statusFilter, subFilter, startDate, endDate]);

  useResetPage([activeTab, debouncedSearch, statusFilter, subFilter, startDate, endDate, itemsPerPage], () => setCurrentPage(1));

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return undefined;
    const loopFetch = () => {
      fetchTimeoutRef.current = setTimeout(async () => {
        await fetchData();
        loopFetch();
      }, MONITOR_REFRESH_MS);
    };
    loopFetch();
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchData, autoRefresh]);

  const selectStatusFilter = useCallback((value) => {
    setStatusFilter(value);
    setSubFilter("all");
  }, []);

  const handleTabChange = useCallback((nextTab) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    setLogs([]);
    setStats({ total: 0, allowed: 0, blocked: 0, ai_suspicious: 0, suspicious_blocked: 0, dga_count: 0, mac_count: 0, dga: 0, });
    setTotalPages(1);
    setStatusFilter("all");
    setSubFilter("all");
  }, [activeTab]);

  const handleEmpClick = useCallback(async (violatorStr) => {
    if (violatorStr === "내부 단말" || !violatorStr) return; // 미인증 단말은 클릭 무시
    const match = violatorStr.match(/\((.*?)\)/);
    if (!match) return;
    const empId = match[1];

    setDetailLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/employee-security/${empId}/`);
      if (res.data?.status === "success") {
        setSelectedSecurity(res.data.data);
        setIsModalOpen(true);
      }
    } catch {
      await appAlert("해당 사원의 상세 보안 정보를 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  }, [baseUrl]);

  const handleRefreshDetail = useCallback(async () => {
    if (!selectedSecurity) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/dashboard/employee-security/${selectedSecurity.employee_id}/`);
      if (res.data?.status === "success") setSelectedSecurity(res.data.data);
    } catch {
      await appAlert("상세 보안 정보를 새로 불러올 수 없습니다.");
    } finally {
      setDetailLoading(false);
    }
  }, [baseUrl, selectedSecurity]);

  const submitReleaseMismatch = useCallback(async (credentials) => {
    try {
      const res = await axios.post(`${baseUrl}/api/dashboard/mac-mismatch/release/`, {
        mismatch_id: releaseRequest.mismatchId,
        ...credentials,
      });
      await appAlert(res.data.message);
      setReleaseRequest(null);
      fetchData();
    } catch (err) {
      await appAlert(err.response?.data?.message || "해제 처리에 실패했습니다.");
    }
  }, [baseUrl, releaseRequest, fetchData]);

  const exportToCSV = useCallback(async () => {
    try {
      const isThreat = activeTab === "threat";
      const endpoint = isThreat
        ? "/api/dashboard/unauth-threat-logs/"
        : "/api/dashboard/integrated-logs/";

      const res = await axios.get(`${baseUrl}${endpoint}`, {
        params: {
          limit: 100000,
          export: 1,
          search,
          statusFilter,
          subFilter,
          startDate,
          endDate,
        },
      });
      const allData = res.data?.general_logs || [];
      let csvRows = [];

      if (isThreat) {
        const headers = ["탐지 시간", "위협 종류", "출발지 IP", "출발지 MAC", "세부 내용", "대응 조치"];
        csvRows = [headers.join(",")];

        allData.forEach((r) => {
          const threatText = THREAT_LABELS[r.threat_type]?.text || r.threat_type || "-";
          const actionText = ACTION_LABELS[r.action_taken] || r.action_taken || "-";
          csvRows.push(
            `"${r.time}","${threatText}","${r.ip_address || "-"}","${r.mac_address || "-"}","${r.target_info || "-"}","${actionText}"`
          );
        });
      } else {
        const headers = ["접속 시간", "이름(아이디)", "출발지 IP", "MAC 주소", "도메인", "AI 레벨", "정책 판단", "AI 위협 점수", "처리 결과"];
        csvRows = [headers.join(",")];

        allData.forEach((r) => {
          let resultText = "정상 통과";
          if (r.is_mismatch) {
            resultText = "MAC 스푸핑 차단";
          } else if (r.status === "의심") {
            resultText = r.type === "차단" ? "AI 의심 차단" : "AI 의심 통과";
          } else if (r.type === "차단") {
            resultText = "차단";
          } else if (r.status === "미지") {
            resultText = "미지 도메인 대기";
          } else if (r.status === "DGA의심") {
            resultText = "DGA 의심 (NXDOMAIN)";
          }

          csvRows.push(
            `"${r.time}","${r.violator}","${r.ip || "-"}","${r.mac || "-"}","${r.domain}","${r.ai_level || "-"}","${r.policy || "-"}","${hasAiScore(r.ai_score) ? r.ai_score : "-"}","${resultText}"`
          );
        });
      }

      const bom = "\uFEFF";
      const blob = new Blob([bom + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = isThreat
        ? `SecureTech_Threat_Logs_${new Date().getTime()}.csv`
        : `SecureTech_Access_Logs_${new Date().getTime()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      await appAlert("CSV 다운로드에 실패했습니다.");
    }
  }, [baseUrl, activeTab, search, statusFilter, subFilter, startDate, endDate]);

  const displayLogs = useMemo(() => padRows(logs, itemsPerPage), [logs, itemsPerPage]);

  const subFilterOptions = useMemo(() => {
    if (statusFilter === "DGA의심") return [];
    if (statusFilter === "의심") return ["화이트 추정", "블랙 의심"];
    return ["수동", "AI"];
  }, [statusFilter]);

  return (
    <div className="page-container admin-page">
      {releaseRequest && (
        <AdminAuthDialog
          title="MAC 스푸핑 해제 인증"
          target="MAC 스푸핑 건"
          onSubmit={submitReleaseMismatch}
          onCancel={() => setReleaseRequest(null)}
        />
      )}

      <PageHeader
        title="로그 분석실"
        subtitle="임직원의 네트워크 접속 기록을 조회하고 추적합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={loadingAction}
      >
        <label className="check-label">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          자동 갱신
        </label>
      </PageHeader>

      {/* 💡 [수술 3] 탭 토글 UI 추가 (디자인은 인라인 스타일 적용, 원하시면 css 클래스로 뺄 수 있습니다) */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => handleTabChange("normal")}
          className={`btn-action btn-form ${activeTab === "normal" ? "btn-primary" : "btn-neutral"}`}
          style={{ padding: "10px 20px", fontWeight: "700" }}
        >
          🟢 인증 단말 접속 로그
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("threat")}
          className={`btn-action btn-form ${activeTab === "threat" ? "btn-danger" : "btn-neutral"}`}
          style={{ padding: "10px 20px", fontWeight: "700" }}
        >
          🚨 사내 위협 탐지 로그
        </button>
      </div>

      {/* 💡 [수술 4] 통계 카드 분기 */}
      <div className="stat-row">
        {activeTab === "normal" ? (
          <>
            <div onClick={() => selectStatusFilter("all")} className={`stat-card tone-primary ${statusFilter === "all" ? "is-active" : ""}`}>
              <div className="stat-label">전체 접속</div>
              <div className="stat-value">{(stats.total || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
            <div onClick={() => selectStatusFilter("허용")} className={`stat-card tone-success ${statusFilter === "허용" ? "is-active" : ""}`}>
              <div className="stat-label">정상 통과</div>
              <div className="stat-value">{(stats.allowed || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
            <div onClick={() => selectStatusFilter("의심")} className={`stat-card tone-warning ${statusFilter === "의심" ? "is-active" : ""}`}>
              <div>
                <div className="stat-label">AI 의심</div>
                <div className="stat-sub">통과 {(stats.ai_suspicious - stats.suspicious_blocked).toLocaleString()} / 차단 {(stats.suspicious_blocked || 0).toLocaleString()}</div>
              </div>
              <div className="stat-value">{(stats.ai_suspicious || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
            <div onClick={() => selectStatusFilter("차단")} className={`stat-card tone-danger ${statusFilter === "차단" ? "is-active" : ""}`}>
              <div className="stat-label">차단</div>
              <div className="stat-value">{(stats.blocked || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
            <div onClick={() => selectStatusFilter("DGA의심")} className={`stat-card tone-danger ${statusFilter === "DGA의심" ? "is-active" : ""}`}>
              <div>
                <div className="stat-label">미존재 도메인</div>
                <div className="stat-sub">존재하지 않는 도메인 (DGA)</div>
              </div>
              <div className="stat-value">{(stats.dga || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
          </>
        ) : (
          <>
            <div onClick={() => setStatusFilter("all")} className={`stat-card tone-danger ${statusFilter === "all" ? "is-active" : ""}`}>
              <div>
                <div className="stat-label">총 위협 탐지</div>
                <div className="stat-sub">미인증·위조 단말 탐지 및 차단 이력</div>
              </div>
              <div className="stat-value">{(stats.total || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
            <div onClick={() => setStatusFilter("DGA_NXDOMAIN")} className={`stat-card tone-warning ${statusFilter === "DGA_NXDOMAIN" ? "is-active" : ""}`}>
              <div>
                <div className="stat-label">미존재 도메인 (DGA)</div>
                <div className="stat-sub">존재하지 않는 도메인 접속 시도</div>
              </div>
              <div className="stat-value">{(stats.dga_count || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
            <div onClick={() => setStatusFilter("MAC_SPOOFING")} className={`stat-card tone-warning ${statusFilter === "MAC_SPOOFING" ? "is-active" : ""}`}>
              <div>
                <div className="stat-label">MAC 스푸핑</div>
                <div className="stat-sub">인증 IP와 MAC 주소 불일치</div>
              </div>
              <div className="stat-value">{(stats.mac_count || 0).toLocaleString()}<span className="stat-unit">건</span></div>
            </div>
          </>
        )}
      </div>

      <div className="panel-row">
        <div className="card dashboard-card card-fill">
          <div className="card-toolbar">
            <div className="toolbar-group">
              <input
                type="text"
                className="custom-input search-input"
                placeholder={activeTab === "normal" ? "이름, 아이디, IP, 도메인 검색..." : "IP, MAC, 위협 종류, 세부 내용 검색..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                type="date"
                value={startDate}
                max={endDate || todayStr}
                onChange={(e) => {
                  const v = e.target.value > todayStr ? todayStr : e.target.value;
                  setStartDate(v);
                  if (endDate && v > endDate) setEndDate(v);
                }}
                className="custom-input date-input"
              />
              <span className="text-muted fw-bold">~</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={todayStr}
                onChange={(e) => {
                  const v = e.target.value > todayStr ? todayStr : e.target.value;
                  setEndDate(v);
                  if (startDate && v < startDate) setStartDate(v);
                }}
                className="custom-input date-input"
              />
              <button type="button" onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); selectStatusFilter("all"); }} className="btn-action btn-neutral btn-w-sm btn-form">
                초기화
              </button>
            </div>
            <div className="toolbar-group">
              {activeTab === "normal" ? (
                subFilterOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSubFilter(subFilter === opt ? "all" : opt)}
                    className={`btn-action btn-w-md btn-form ${subFilter === opt ? "btn-primary" : "btn-neutral"}`}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === "DGA_NXDOMAIN" ? "all" : "DGA_NXDOMAIN")}
                    className={`btn-action btn-w-md btn-form ${statusFilter === "DGA_NXDOMAIN" ? "btn-primary" : "btn-neutral"}`}
                    title="존재하지 않는 도메인 접속 시도"
                  >
                    미존재 도메인
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === "MAC_SPOOFING" ? "all" : "MAC_SPOOFING")}
                    className={`btn-action btn-w-md btn-form ${statusFilter === "MAC_SPOOFING" ? "btn-primary" : "btn-neutral"}`}
                    title="인증 IP와 MAC 주소 불일치"
                  >
                    MAC 스푸핑
                  </button>
                </>
              )}
              <button type="button" onClick={exportToCSV} className="btn-action btn-neutral btn-w-lg btn-form">CSV 다운로드</button>
            </div>
          </div>

          <div className="table-responsive table-fill">
            <table className="custom-table">
              {/* 💡 [수술 5] 테이블 헤더 분기 */}
              <thead>
                {activeTab === 'normal' ? (
                  <tr>
                    <th style={{ width: "13%" }}>접속 시간</th>
                    <th style={{ width: "13%" }}>이름(아이디)</th>
                    <th style={{ width: "9%" }}>출발지 IP</th>
                    <th style={{ width: "12%" }}>MAC 주소</th>
                    <th style={{ width: "15%" }}>도메인</th>
                    <th style={{ width: "9%" }}>AI 레벨</th>
                    <th style={{ width: "10%" }}>정책 판단</th>
                    <th style={{ width: "8%" }}>AI 위협 점수</th>
                    <th style={{ width: "11%" }}>처리 결과</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: "15%" }}>탐지 시간</th>
                    <th style={{ width: "15%" }}>위협 종류</th>
                    <th style={{ width: "15%" }}>출발지 IP</th>
                    <th style={{ width: "15%" }}>출발지 MAC</th>
                    <th style={{ width: "25%" }}>세부 내용</th>
                    <th style={{ width: "15%" }}>대응 조치</th>
                  </tr>
                )}
              </thead>
              {/* 💡 [수술 6] 테이블 바디 분기 */}
              <tbody>
                {displayLogs.map((log, idx) => {
                  if (log.isEmpty) return <tr key={`empty-${idx}`}><td colSpan={activeTab === 'normal' ? 9 : 6}>&nbsp;</td></tr>;

                  if (activeTab === 'normal') {
                    // --- 정상 탭 렌더링 ---
                    let resultText = "정상 통과";
                    if (log.status === "미지") resultText = "미지 도메인 대기";
                    else if (log.status === "DGA의심") resultText = "DGA 의심 (NXDOMAIN)";
                    else if (log.type === "차단") resultText = "차단";
                    const isBlockedResult = resultText.includes("차단");
                    const isDgaInfected = log.status === "DGA의심";

                    return (
                      <tr key={`normal-${log.log_id ?? idx}`} style={{ backgroundColor: isDgaInfected ? "rgba(239, 68, 68, 0.14)" : "transparent" }}>
                        <td className="cell-time">{log.time}</td>
                        <td className={log.violator !== "내부 단말" ? "cell-link" : ""} onClick={() => handleEmpClick(log.violator)}>{log.violator}</td>
                        <td className="cell-mono">{log.ip || "-"}</td>
                        <td className="cell-mono">{log.mac || "-"}</td>

                        {/* 💡 도메인 출력부 (수술 완료) */}
                        {isDgaInfected ? (
                          <td className="text-danger fw-bold">{log.domain}</td>
                        ) : (
                          <td className={`cell-main cell-clickable text-${getResultTone(log.status, log.policy)}`} onClick={() => setDetailDomain(log.domain)}>
                            {log.domain}
                          </td>
                        )}

                        <td className={`fw-bold text-${LEVEL_TONES[log.ai_level] || "muted"}`}>{log.ai_level || "-"}</td>
                        <td className={`fw-bold text-${POLICY_TONES[log.policy] || "muted"}`}>{log.policy || "-"}</td>
                        <td className={`fw-bold text-${POLICY_TONES[log.policy] || "muted"}`}>{hasAiScore(log.ai_score) ? `${log.ai_score}점` : "-"}</td>
                        <td>
                          {isDgaInfected ? (
                            <span title="존재하지 않는 도메인 접속 시도 (DGA 악성코드 감염 가능성)" style={{ backgroundColor: "#ef4444", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold", whiteSpace: "nowrap" }}>🚨 미존재 도메인</span>
                          ) : (
                            <span className={`status-badge ${isBlockedResult ? "badge-danger" : "badge-success"}`}>{resultText}</span>
                          )}
                        </td>
                      </tr>
                    );
                  } else {
                    // --- 위협 탭 렌더링 ---
                    const threatInfo = THREAT_LABELS[log.threat_type] || { text: log.threat_type, title: "" };
                    const actionText = ACTION_LABELS[log.action_taken] || log.action_taken;
                    const actionBg = log.action_taken === "DETECTED" ? "#d97706" : "#ef4444";
                    return (
                      <tr key={`threat-${log.id ?? idx}`}>
                        <td className="cell-time">{log.time}</td>
                        <td>
                          <span
                            title={threatInfo.title}
                            style={{ backgroundColor: "#374151", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}
                          >
                            {threatInfo.text}
                          </span>
                        </td>
                        <td className="cell-mono">{log.ip_address || "-"}</td>
                        <td className="cell-mono">{log.mac_address || "-"}</td>
                        <td className="fw-bold">{log.target_info}</td>
                        <td>
                          <span style={{ backgroundColor: actionBg, color: "#fff", padding: "4px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                            {actionText}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} pageSize={itemsPerPage} onPageSizeChange={setItemsPerPage} />
        </div>
      </div>

      {detailDomain && <DomainDetailDialog domain={detailDomain} onClose={() => setDetailDomain(null)} />}
      {isModalOpen && selectedSecurity && <SecurityDetailDialog security={selectedSecurity} onClose={() => setIsModalOpen(false)} onRefresh={handleRefreshDetail} refreshing={detailLoading} />}
    </div>
  );
};

export default LogAnalysis;