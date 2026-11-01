import { useEffect, useRef, useState } from "react";
import PageHeader from "../../components/PageHeader";

// 이 화면은 DB와 연결하지 않는다. 판정은 아래 속성과 화면에 등록한 테스트 주소로만 이루어진다
const ADMIN_SERVER = "192.168.3.23";
const STORAGE_KEY = "testLabAddresses";

const TEST_KINDS = {
  system_allow: { label: "시스템 기본 허용", result: "정상 통과", tone: "success", blocked: false, message: "시스템에 고정된 사내 주소입니다." },
  protected_allow: { label: "보호 허용", result: "정상 통과", tone: "success", blocked: false, message: "관리자가 보호로 지정한 주소입니다." },
  manual_allow: { label: "수동 허용", result: "정상 통과", tone: "success", blocked: false, message: "허용 목록에 등록된 주소입니다." },
  ai_safe: { label: "AI 안전", result: "정상 통과", tone: "success", blocked: false, message: "AI가 안전으로 판별한 주소입니다." },
  white_suspect: { label: "화이트 의심", result: "AI 의심 통과", tone: "score-yellow", blocked: false, suspect: true, message: "AI가 화이트 의심으로 판별한 주소입니다. 표시 후 통과시킵니다." },
  black_suspect: { label: "블랙 의심", result: "AI 의심 통과", tone: "score-orange", blocked: false, suspect: true, message: "AI가 블랙 의심으로 판별한 주소입니다. 관리자 판단 전까지 표시 후 통과시킵니다." },
  manual_block: { label: "수동 차단", result: "차단", tone: "danger", blocked: true, message: "차단 목록에 등록된 주소입니다." },
  ai_danger: { label: "AI 위험", result: "차단", tone: "danger", blocked: true, message: "AI가 위험으로 판별한 주소입니다." },
  unregistered: { label: "미분류", result: "정상 통과", tone: "gray", blocked: false, message: "어느 정책에도 분류되지 않은 주소라 통과합니다." },
};

const DEFAULT_ADDRESSES = [
  { address: "test-system-allow.local", kind: "system_allow" },
  { address: "test-protected-allow.local", kind: "protected_allow" },
  { address: "test-manual-allow.local", kind: "manual_allow" },
  { address: "test-ai-safe.local", kind: "ai_safe" },
  { address: "test-white-suspect.local", kind: "white_suspect" },
  { address: "test-black-suspect.local", kind: "black_suspect" },
  { address: "test-manual-block.local", kind: "manual_block" },
  { address: "test-ai-danger.local", kind: "ai_danger" },
  { address: "test-unregistered.local", kind: "unregistered" },
];

const loadAddresses = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved.filter((a) => TEST_KINDS[a.kind]);
  } catch {
    // 저장값이 손상되면 기본 목록을 사용
  }
  return DEFAULT_ADDRESSES;
};

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
  const [testAddresses, setTestAddresses] = useState(loadAddresses);
  const [newAddress, setNewAddress] = useState("");
  const [newKind, setNewKind] = useState("manual_allow");
  const logsEndRef = useRef(null);
  const simTimer = useRef(null);

  // 시뮬레이션 도중 화면을 떠나면 예약된 작업을 취소
  useEffect(() => () => clearTimeout(simTimer.current), []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [virtualLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testAddresses));
  }, [testAddresses]);

  const handleAddAddress = (e) => {
    e.preventDefault();
    const address = cleanDomain(newAddress);
    if (!address) return;
    setTestAddresses((prev) => [
      { address, kind: newKind },
      ...prev.filter((a) => a.address !== address),
    ]);
    setNewAddress("");
  };

  const handleRemoveAddress = (address) =>
    setTestAddresses((prev) => prev.filter((a) => a.address !== address));

  const addLog = (message, type = "info") => {
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    setVirtualLogs((prev) => [...prev, { time, message, type }]);
  };

  const handleApplyIp = (e) => {
    e.preventDefault();
    clearTimeout(simTimer.current);
    setShowModal(false);
    const target = pcIp.trim() || "192.168.2.100";
    setActiveIp(target);
    setIsAlreadyAuthenticated(false);
    setSimState("idle");
    setReportData(null);
    addLog(`IP가 ${target} (으)로 재설정되었습니다. (세션 초기화)`, "info");
  };

  const showSimulationResult = (ip, domain, status, title, message, policy = "-", tone = status === "success" ? "success" : "danger") => {
    setSimState(status === "success" ? "success" : "blocked");
    setReportData({ ip, domain, status, title, message, policy, tone });
    simTimer.current = setTimeout(() => setShowModal(true), 600);
  };

  const executeSimulation = (ip, domain, hasAuth) => {
    const isInternalIp =
      ip.startsWith("192.168.2.") || ip.startsWith("192.168.3.");
    const isAccessingAdminServer = domain === ADMIN_SERVER;

    if (!isInternalIp) {
      if (isAccessingAdminServer) {
        addLog(`사외망에서 관제 서버 접근 차단 (망분리)`, "danger");
        showSimulationResult(
          ip,
          domain,
          "blocked",
          "차단",
          "사외망에서는 관제 서버에 접속할 수 없습니다.",
          "망분리",
        );
      } else {
        addLog(`사외망 단말 접속 (관제 대상 아님)`, "info");
        showSimulationResult(
          ip,
          domain,
          "success",
          "정상 통과",
          `IP(${ip})는 사내망이 아니므로 MAC 검사와 도메인 정책을 적용하지 않습니다.`,
          "관제 대상 아님",
        );
      }
      return;
    }

    if (isSpoofing) {
      addLog(`MAC 변조 탐지. 접속 차단 및 Discord 경보`, "danger");
      showSimulationResult(
        ip,
        domain,
        "blocked",
        "차단",
        "접속 기록의 MAC 주소와 달라 차단하고 관리자에게 Discord로 경보합니다.",
        "MAC 변조",
      );
      return;
    }

    // 규칙 A. 망분리: 사원 대역에서 보안 관제 서버(3.23) 접근 시 차단
    if (isAccessingAdminServer && !ip.startsWith("192.168.3.")) {
      addLog(`사원망에서 관제 서버 접근 차단 (망분리)`, "danger");
      showSimulationResult(
        ip,
        domain,
        "blocked",
        "차단",
        "사원망에서는 관제 서버에 접속할 수 없습니다.",
        "망분리",
      );
      return;
    }

    // 규칙 B. 관리자/사원 대역은 무조건 캡티브 포털 인증 요구
    if (!hasAuth) {
      addLog(`캡티브 포털 인증 요청`, "warning");
      setSimState("captive");
      return;
    }

    // 목록에 없는 주소는 미분류로 보고 통과시킨다
    const registered = testAddresses.find((a) => a.address === domain);
    const kind = TEST_KINDS[registered?.kind || "unregistered"];

    if (kind.blocked) {
      addLog(`[정책] ${kind.label}: [${domain}] 차단`, "danger");
      showSimulationResult(ip, domain, "blocked", kind.result, kind.message, kind.label);
    } else {
      addLog(
        `[정책] ${kind.label}: [${domain}] ${kind.result}`,
        kind.suspect ? "warning" : "success",
      );
      showSimulationResult(ip, domain, "success", kind.result, kind.message, kind.label, kind.tone);
    }
  };

  const handleNavigate = (e) => {
    e.preventDefault();
    if (!simUrl.trim()) return alert("도메인을 입력하세요.");
    const domain = cleanDomain(simUrl);
    const ip = activeIp.trim();

    setShowModal(false);
    setSimState("animating");
    addLog(`[${ip}] [${domain}] 접속 시도`, "warning");

    clearTimeout(simTimer.current);
    simTimer.current = setTimeout(() => {
      executeSimulation(ip, domain, isAlreadyAuthenticated);
    }, 1500);
  };

  // 실제 계정을 확인하지 않는 가상 인증
  const handleCaptiveLogin = (e) => {
    e.preventDefault();
    setIsAlreadyAuthenticated(true);
    addLog(`사용자(${empIdInput}) 가상 인증 완료. 접속 재시도`, "success");
    setSimState("animating");
    clearTimeout(simTimer.current);
    simTimer.current = setTimeout(() => executeSimulation(activeIp, cleanDomain(simUrl), true), 1500);
  };

  const resetTest = () => {
    clearTimeout(simTimer.current);
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
        title="보안 테스트실"
        subtitle="망 구분, MAC 검사, 인증, 도메인 정책 판단을 가상으로 확인합니다."
      >
        <span className="tag text-warning">
          DB와 연결되지 않은 가상 화면입니다.
        </span>
      </PageHeader>

      <div className="panel-row">
        <div className="card card-side">
          <h4 className="info-box-title text-primary">판정 순서</h4>
          <ol className="notice-list">
            <li>
              <strong>망 구분:</strong> 사외망은 관제 대상이 아니며 관제 서버 접속은 차단
            </li>
            <li>
              <strong>MAC 검사:</strong> 사내망에서 MAC이 변조되면 차단 및 Discord 경보
            </li>
            <li>
              <strong>망분리:</strong> 사원망(192.168.2.x)의 관제 서버 접속 차단
            </li>
            <li>
              <strong>캡티브 인증:</strong> 미인증 단말은 인증 요구 (웹 로그인과 별개)
            </li>
            <li>
              <strong>도메인 정책:</strong> 허용은 통과, 의심은 표시 후 통과, 차단은 차단
            </li>
          </ol>

          <div className="info-box-row test-address-head">
            <h4 className="info-box-title text-primary">테스트 주소</h4>
            <button
              type="button"
              className="btn-action btn-neutral btn-w-sm"
              onClick={() => setTestAddresses(DEFAULT_ADDRESSES)}
            >
              기본값
            </button>
          </div>
          <form onSubmit={handleAddAddress} className="test-address-form">
            <input
              type="text"
              className="custom-input"
              placeholder="임의의 IP 또는 도메인"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              required
            />
            <div className="toolbar-group">
              <select
                className="custom-input"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
              >
                {Object.entries(TEST_KINDS).map(([key, kind]) => (
                  <option key={key} value={key}>
                    {kind.label} ({kind.result})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn-action btn-primary btn-w-sm btn-form"
              >
                등록
              </button>
            </div>
          </form>
          <div className="list-stack">
            {testAddresses.length === 0 && (
              <div className="empty-state">등록된 테스트 주소가 없습니다.</div>
            )}
            {testAddresses.map(({ address, kind }) => (
              <div
                key={address}
                className="test-address-row"
                title={`${address} (${TEST_KINDS[kind].result})`}
                onClick={() => setSimUrl(address)}
              >
                <span className={`status-badge badge-${TEST_KINDS[kind].tone}`}>
                  {TEST_KINDS[kind].label}
                </span>
                <span className="test-address-name">{address}</span>
                <button
                  type="button"
                  className="test-address-remove"
                  aria-label={`${address} 삭제`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAddress(address);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
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
              <span className="form-label">도메인:</span>
              <input
                type="text"
                className="custom-input"
                value={simUrl}
                onChange={(e) => setSimUrl(e.target.value)}
                placeholder="왼쪽 테스트 주소를 누르거나 직접 입력"
              />
              <button
                type="submit"
                className="btn-action btn-primary btn-w-lg btn-form"
              >
                접속 시도
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
                      ENG
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
                      {cleanDomain(simUrl) || "-"}
                    </span>
                  </div>
                </div>
              )}

            {simState === "captive" && (
              <div className="info-box sim-captive">
                <h3 className="dialog-title text-primary">
                  캡티브 포털 인증 (가상)
                </h3>
                <form onSubmit={handleCaptiveLogin} className="dialog-form">
                  <input
                    type="text"
                    className="custom-input"
                    placeholder="임의의 아이디"
                    value={empIdInput}
                    onChange={(e) => setEmpIdInput(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    className="custom-input"
                    placeholder="임의의 비밀번호"
                    value={empPwInput}
                    onChange={(e) => setEmpPwInput(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn-action btn-primary btn-form"
                  >
                    인증
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
                <strong className="text-success">인증 완료</strong>
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
              지우기
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
            <h3 className="dialog-title">판정 결과</h3>
            <div>
              <div className="info-row is-compact">
                <span className="info-label">처리 결과</span>
                <span className={`status-badge badge-${reportData.tone}`}>{reportData.title}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">정책 판단</span>
                <span className="info-value">{reportData.policy}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">출발지 IP</span>
                <span className="info-value">{reportData.ip}</span>
              </div>
              <div className="info-row is-compact">
                <span className="info-label">도메인</span>
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
