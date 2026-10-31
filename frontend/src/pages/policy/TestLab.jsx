import axios from "axios";
import { useEffect, useRef, useState } from "react";
import PageHeader from "../../components/PageHeader";

const WHITE_LABELS = { AI: "AI 안전", 의심: "화이트 의심" };
const BLACK_LABELS = { AI: "AI 위험", 의심: "블랙 의심" };

const cleanDomain = (url) => {
  if (!url) return "";
  return url.trim().toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split("/")[0].split(":")[0];
};

export default function TestLab() {
  const [pcIp, setPcIp] = useState("");
  const [activeIp, setActiveIp] = useState("192.168.2.100");
  const [simUrl, setSimUrl] = useState("");
  const [isAlreadyAuthenticated, setIsAlreadyAuthenticated] = useState(false);
  const [isSpoofing, setIsSpoofing] = useState(false);
  const [empIdInput, setEmpIdInput] = useState("");
  const [empPwInput, setEmpPwInput] = useState("");

  const [simState, setSimState] = useState("idle");
  const [reportData, setReportData] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [virtualLogs, setVirtualLogs] = useState([]);
  const [domainOptions, setDomainOptions] = useState([]);
  const logsEndRef = useRef(null);

  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`
  ).replace(/\/+$/, "");

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [virtualLogs]);

  // 등록된 정책 도메인을 종류별로 골라 시험할 수 있게 불러옴
  useEffect(() => {
    Promise.all([
      axios.get(`${baseUrl}/api/policies/whitelist/`),
      axios.get(`${baseUrl}/api/policies/blocklist/`),
      axios.get(`${baseUrl}/api/policies/ai/`),
    ])
      .then(([white, black, ai]) => {
        setDomainOptions([
          ...white.data.map((d) => ({ domain: d.domain, label: "수동 허용" })),
          ...black.data.map((d) => ({ domain: d.blacklist_domain, label: "수동 차단" })),
          ...(ai.data.ai_data || []).map((d) => ({
            domain: d.domain,
            label: (d.source === "white" ? WHITE_LABELS : BLACK_LABELS)[d.ai_status] || d.ai_status,
          })),
        ]);
      })
      .catch(() => {});
  }, [baseUrl]);

  const addLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setVirtualLogs((prev) => [...prev, { time, message, type }]);
  };

  const handleApplyIp = (e) => {
    e.preventDefault();
    const target = pcIp.trim() || "192.168.2.100";
    setActiveIp(target);
    setIsAlreadyAuthenticated(false);
    setSimState("idle");
    setReportData(null);
    addLog(`IP가 ${target} (으)로 재설정되었습니다. (세션 초기화)`, "info");
  };

  const showSimulationResult = (status, title, message, policy = "-") => {
    setSimState(status === "success" ? "success" : "blocked");
    setReportData({
      ip: activeIp,
      domain: cleanDomain(simUrl),
      status,
      title,
      message,
      policy,
    });
    setTimeout(() => setShowModal(true), 600);
  };

  const executeSimulation = async (ip, domain, hasAuth) => {
    const isInternalIp =
      ip.startsWith("192.168.2.") || ip.startsWith("192.168.3.");
    const isAccessingAdminServer = domain === "192.168.3.23";

    if (!isInternalIp) {
      if (isAccessingAdminServer) {
        addLog(`사외망 IP에서 관제 서버(망분리) 접근 시도 차단됨`, "danger");
        showSimulationResult(
          "blocked",
          "망분리 접근 통제",
          "사외망(외부망) 대역에서는 보안 관제 서버로 접근할 수 없습니다.",
        );
      } else {
        addLog(`사외망 단말 트래픽 (사내 방화벽 관제 예외)`, "info");
        showSimulationResult(
          "success",
          "관제 대상 아님 (사외망)",
          `IP(${ip})는 사내망이 아니므로 NAC(MAC 검사) 및 사내 보안 정책이 적용되지 않습니다.`,
        );
      }
      return;
    }

    if (isSpoofing) {
      addLog(
        `MAC 주소 불일치 감지. 방화벽 스위치 포트(L2) 물리적 차단`,
        "warning",
      );
      axios
        .post(`${baseUrl}/api/test/mac-spoofing/`, {
          mock_ip: ip,
          is_test: true,
        })
        .catch(() => { });
      showSimulationResult(
        "blocked",
        "MAC 스푸핑 탐지 (격리)",
        "인가된 내부 IP이나 MAC 주소가 변조되어 물리적 통신이 차단되었습니다.",
      );
      return;
    }

    // 규칙 A. 망분리: 사원 대역에서 보안 관제 서버(3.23) 접근 시 차단
    if (isAccessingAdminServer && !ip.startsWith("192.168.3.")) {
      addLog(`사원망에서 관제 서버(망분리) 접근 시도 차단됨`, "danger");
      showSimulationResult(
        "blocked",
        "망분리 접근 통제",
        "해당 사내 대역에서는 보안 관제 서버로 접근할 수 없습니다.",
      );
      return;
    }

    // 규칙 B. 제로 트러스트: 관리자/사원 대역 무조건 캡티브 포털 인증 요구
    if (!hasAuth) {
      addLog(`내부망 접근 제어(NAC): 캡티브 포털 인증 요청`, "warning");
      setSimState("captive");
      return;
    }

    try {
      const res = await axios.post(`${baseUrl}/api/test/simulate-access/`, {
        source_ip: ip,
        target_url: domain,
        is_test: true,
      });
      const policy = res.data?.policy || "-";
      const isSuspicious = policy.includes("의심");
      if (res.data?.status === "BLOCKED") {
        addLog(`[정책] ${policy}: [${domain}] 차단 완료`, "danger");
        showSimulationResult(
          "blocked",
          isSuspicious ? "AI 의심 차단" : "차단 정책 위반",
          res.data?.message || "블랙리스트에 등록된 도메인입니다.",
          policy,
        );
      } else {
        addLog(
          `[정책] ${policy}: [${domain}] 트래픽 통과`,
          isSuspicious ? "warning" : "success",
        );
        showSimulationResult(
          "success",
          isSuspicious ? "AI 의심 통과" : "정상 접근 승인",
          res.data?.message || "모든 보안 검사를 통과하여 통신이 허용되었습니다.",
          policy,
        );
      }
    } catch {
      addLog(`서버 응답 오류`, "danger");
      showSimulationResult(
        "blocked",
        "통신 실패",
        "관제 서버와 통신할 수 없습니다.",
      );
    }
  };

  const handleNavigate = (e) => {
    e.preventDefault();
    if (!simUrl.trim()) return alert("도메인을 입력하세요.");
    const domain = cleanDomain(simUrl);
    const ip = activeIp.trim();

    setShowModal(false);
    setSimState("animating");
    addLog(`[${ip}] [${domain}] 패킷 전송 시작...`, "warning");

    setTimeout(() => {
      executeSimulation(ip, domain, isAlreadyAuthenticated);
    }, 1500);
  };

  const handleCaptiveLogin = async (e) => {
    e.preventDefault();
    addLog(`사용자(${empIdInput}) 캡티브 포털 인증 시도 중...`, "info");
    try {
      const res = await axios.post(`${baseUrl}/api/auth/captive-login/`, {
        employee_id: empIdInput.trim(),
        password: empPwInput,
        is_test: true,
      });
      if (res.data.status === "success") {
        setIsAlreadyAuthenticated(true);
        addLog(`인증 성공. 패킷 재전송...`, "success");
        setSimState("animating");
        setTimeout(
          () => executeSimulation(activeIp, cleanDomain(simUrl), true),
          1500,
        );
      }
    } catch (err) {
      addLog(`인증 실패: 아이디 또는 비밀번호 오류`, "danger");
      alert("인증에 실패했습니다.");
    }
  };

  const resetTest = () => {
    setPcIp("");
    setActiveIp("192.168.2.100");
    setSimUrl("");
    setIsAlreadyAuthenticated(false);
    setIsSpoofing(false);
    setShowModal(false);
    setSimState("idle");
    setEmpIdInput("");
    setEmpPwInput("");
    setVirtualLogs([]);
  };

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="통합 보안 및 패킷 관제 시뮬레이션"
        subtitle="네트워크 대역별 접근 통제 검증"
      >
        <span className="tag text-warning">
          ※ 본 테스트는 운영 DB에 기록되지 않는 시뮬레이션입니다.
        </span>
      </PageHeader>

      <div className="panel-row">
        <div className="card card-side">
          <h4 className="info-box-title text-primary">판정 순서</h4>
          <ol className="notice-list">
            <li>
              <strong>망 구분:</strong> 사외망은 관제 대상이 아니며 관제 서버 접근은 차단
            </li>
            <li>
              <strong>MAC 검사:</strong> 사내망에서 MAC이 변조되면 물리 격리
            </li>
            <li>
              <strong>망분리:</strong> 사원망(192.168.2.x)의 관제 서버 접근 차단
            </li>
            <li>
              <strong>캡티브 인증:</strong> 미인증 단말은 인증 요구. 웹 로그인과 별개
            </li>
            <li>
              <strong>등록 정책:</strong> 허용·차단 목록과 AI 판별 결과 적용
            </li>
            <li>
              <strong>CTI 조회:</strong> 미등록 도메인은 위협 점수 50점 이상이면 자동 차단
            </li>
          </ol>

          <h4 className="info-box-title text-primary">정책별 결과</h4>
          <div className="policy-legend">
            <div className="policy-legend-row">
              <div className="action-btn-group">
                <span className="status-badge badge-success">수동 허용</span>
                <span className="status-badge badge-success">AI 안전</span>
              </div>
              <span className="policy-result">통과</span>
            </div>
            <div className="policy-legend-row">
              <span className="status-badge badge-warning">화이트 의심</span>
              <span className="policy-result">통과 (경고)</span>
            </div>
            <div className="policy-legend-row">
              <div className="action-btn-group">
                <span className="status-badge badge-danger">수동 차단</span>
                <span className="status-badge badge-danger">AI 위험</span>
              </div>
              <span className="policy-result">차단</span>
            </div>
            <div className="policy-legend-row">
              <span className="status-badge badge-warning">블랙 의심</span>
              <span className="policy-result">차단 (경고)</span>
            </div>
          </div>
        </div>

        <div className="card card-fill card-flush">
          <div className="sim-controls">
            <div className="info-box-row">
              <form onSubmit={handleApplyIp} className="toolbar-group">
                <span className="form-label">내 PC IP:</span>
                <input
                  type="text"
                  className="custom-input input-ip"
                  value={pcIp}
                  onChange={(e) => setPcIp(e.target.value)}
                  placeholder="192.168.2.100"
                />
                <button
                  type="submit"
                  className="btn-action btn-neutral btn-w-sm btn-form"
                >
                  적용
                </button>
                <label className={`check-label ${isSpoofing ? "text-warning" : "text-muted"}`}>
                  <input
                    type="checkbox"
                    checked={isSpoofing}
                    onChange={(e) => setIsSpoofing(e.target.checked)}
                  />
                  MAC 변조
                </label>
              </form>
              <button
                type="button"
                onClick={resetTest}
                className="btn-action btn-neutral btn-w-sm btn-form"
              >
                초기화
              </button>
            </div>
            <form onSubmit={handleNavigate} className="toolbar-group">
              <span className="form-label">연결 도메인:</span>
              <input
                type="text"
                className="custom-input"
                value={simUrl}
                onChange={(e) => setSimUrl(e.target.value)}
                placeholder="예: google.com 또는 등록된 도메인 선택"
                list="testlab-domains"
              />
              <datalist id="testlab-domains">
                {domainOptions.map((o) => (
                  <option key={`${o.label}-${o.domain}`} value={o.domain}>
                    {o.label}
                  </option>
                ))}
              </datalist>
              <button
                type="submit"
                className="btn-action btn-primary btn-w-lg btn-form"
              >
                시뮬레이션 시작
              </button>
            </form>
          </div>

          <div className="sim-screen">
            {(simState === "idle" ||
              simState === "animating" ||
              simState === "success" ||
              simState === "blocked") && (
                <div className="anim-container">
                  <div className="anim-node">
                    <div className="anim-icon">PC</div>
                    <span className="anim-label">
                      내 단말
                      <br />
                      {activeIp}
                    </span>
                  </div>
                  <div className="anim-line-bg"></div>
                  {simState === "animating" && (
                    <div className="anim-packet moving"></div>
                  )}
                  {simState === "blocked" && (
                    <div className="anim-packet blocked-anim"></div>
                  )}
                  {simState === "success" && (
                    <div className="anim-packet is-arrived"></div>
                  )}
                  <div className="anim-node">
                    <div
                      className={`anim-icon ${simState === "animating" ? "fw-pulse" : ""} ${simState === "blocked" ? "is-blocked" : ""} ${simState === "success" ? "is-passed" : ""}`}
                    >
                      FW
                    </div>
                    <span className="anim-label">
                      보안 관제 엔진
                      <br />
                      SecureTech
                    </span>
                  </div>
                  <div className="anim-node">
                    <div className={`anim-icon ${simState === "blocked" ? "is-dim" : ""}`}>
                      WEB
                    </div>
                    <span className="anim-label">
                      목적지
                      <br />
                      {cleanDomain(simUrl) || "Target"}
                    </span>
                  </div>
                </div>
              )}

            {simState === "captive" && (
              <div className="info-box sim-captive">
                <h3 className="dialog-title text-primary">
                  내부망 캡티브 포털 인증
                </h3>
                <form onSubmit={handleCaptiveLogin} className="dialog-form">
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="사번 / 아이디"
                    value={empIdInput}
                    onChange={(e) => setEmpIdInput(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    className="custom-input"
                    placeholder="비밀번호"
                    value={empPwInput}
                    onChange={(e) => setEmpPwInput(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn-action btn-primary btn-form"
                  >
                    인증 및 승인
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="sim-status">
            <span>
              적용된 IP: <strong className="text-primary">{activeIp}</strong>
            </span>
            <span>
              인증 상태:{" "}
              {isAlreadyAuthenticated ? (
                <strong className="text-success">승인됨 (제로 트러스트)</strong>
              ) : (
                <strong className="text-danger">미인증</strong>
              )}
            </span>
          </div>
        </div>

        <div className="console-panel">
          <div className="console-header">
            <span>시뮬레이션 로그</span>
            <button
              type="button"
              onClick={() => setVirtualLogs([])}
              className="console-clear"
            >
              Clear
            </button>
          </div>
          <div className="console-body">
            {virtualLogs.length === 0 ? (
              <div className="console-empty">대기 중...</div>
            ) : (
              virtualLogs.map((log, idx) => (
                <div key={idx} className="console-line">
                  <span className="console-time">[{log.time}]</span>
                  <span className={`console-${log.type}`}>{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {showModal && reportData && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3 className="dialog-title">분석 리포트</h3>
            <span
              className={`status-badge ${reportData.policy.includes("의심") ? "badge-warning" : reportData.status === "success" ? "badge-success" : "badge-danger"}`}
            >
              {reportData.status === "success" ? "연결 허용됨" : "연결 차단됨"}
            </span>
            <div>
              <div className="info-row is-compact">
                <span className="info-label">판별 결과</span>
                <strong className={`info-value ${reportData.policy.includes("의심") ? "text-warning" : reportData.status === "success" ? "text-success" : "text-danger"}`}>
                  {reportData.title}
                </strong>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">적용 정책</span>
                <span className="info-value">{reportData.policy}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">출발지 (Source)</span>
                <span className="info-value">{reportData.ip}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">목적지 (Target)</span>
                <span className="info-value">{reportData.domain}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">상세 내용</span>
                <span className="info-value">{reportData.message}</span>
              </div>
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-action btn-primary btn-w-md btn-header"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
