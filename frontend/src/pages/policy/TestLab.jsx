import { useEffect, useRef, useState } from "react";
import PageHeader from "../../components/PageHeader";

// 이 화면은 DB와 연결하지 않는다. 판정은 아래 속성과 화면에 등록한 테스트 주소로만 이루어진다
const ADMIN_SERVER = "192.168.3.23";
const STORAGE_KEY = "testLabAddresses";

const TEST_KINDS = {
  manual_allow: { label: "수동 허용", result: "통과", tone: "success", blocked: false, message: "허용 목록에 등록된 주소입니다." },
  ai_safe: { label: "AI 안전", result: "통과", tone: "success", blocked: false, message: "AI가 안전으로 판별한 주소입니다." },
  white_suspect: { label: "화이트 의심", result: "통과 (경고)", tone: "warning", blocked: false, message: "허용 목록의 의심 주소입니다. 통과시키고 AI 의심으로 집계합니다." },
  black_suspect: { label: "블랙 의심", result: "통과 (경고)", tone: "warning", blocked: false, message: "차단 후보인 의심 주소입니다. 관리자 판단 전까지 통과시키고 AI 의심으로 집계합니다." },
  manual_block: { label: "수동 차단", result: "차단", tone: "danger", blocked: true, message: "차단 목록에 등록된 주소입니다." },
  ai_danger: { label: "AI 위험", result: "차단", tone: "danger", blocked: true, message: "AI가 위험으로 판별한 주소입니다." },
  cti_threat: { label: "CTI 위협", result: "차단", tone: "danger", blocked: true, message: "미등록 주소이며 위협 점수가 50점 이상이라 자동 차단합니다." },
  cti_clean: { label: "CTI 정상", result: "통과", tone: "gray", blocked: false, message: "미등록 주소이며 위협 점수가 낮아 통과합니다." },
};

const DEFAULT_ADDRESSES = [
  { address: "test-manual-allow.local", kind: "manual_allow" },
  { address: "test-ai-safe.local", kind: "ai_safe" },
  { address: "test-white-suspect.local", kind: "white_suspect" },
  { address: "test-black-suspect.local", kind: "black_suspect" },
  { address: "test-manual-block.local", kind: "manual_block" },
  { address: "test-ai-danger.local", kind: "ai_danger" },
  { address: "test-cti-threat.local", kind: "cti_threat" },
  { address: "test-cti-clean.local", kind: "cti_clean" },
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
    simTimer.current = setTimeout(() => setShowModal(true), 600);
  };

  const executeSimulation = (ip, domain, hasAuth) => {
    const isInternalIp =
      ip.startsWith("192.168.2.") || ip.startsWith("192.168.3.");
    const isAccessingAdminServer = domain === ADMIN_SERVER;

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

    // 목록에 없는 주소는 미등록 주소로 보고 위협이 낮은 경우(CTI 정상)로 판정
    const registered = testAddresses.find((a) => a.address === domain);
    const kind = TEST_KINDS[registered?.kind || "cti_clean"];
    const isSuspicious = kind.tone === "warning";

    if (kind.blocked) {
      addLog(`[정책] ${kind.label}: [${domain}] 차단 완료`, "danger");
      showSimulationResult("blocked", "차단 정책 위반", kind.message, kind.label);
    } else {
      addLog(
        `[정책] ${kind.label}: [${domain}] 트래픽 통과`,
        isSuspicious ? "warning" : "success",
      );
      showSimulationResult(
        "success",
        isSuspicious ? "AI 의심 통과" : "정상 접근 승인",
        kind.message,
        kind.label,
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

    clearTimeout(simTimer.current);
    simTimer.current = setTimeout(() => {
      executeSimulation(ip, domain, isAlreadyAuthenticated);
    }, 1500);
  };

  // 실제 계정을 확인하지 않는 가상 인증
  const handleCaptiveLogin = (e) => {
    e.preventDefault();
    setIsAlreadyAuthenticated(true);
    addLog(`사용자(${empIdInput}) 가상 인증 성공. 패킷 재전송...`, "success");
    setSimState("animating");
    clearTimeout(simTimer.current);
    simTimer.current = setTimeout(() => executeSimulation(activeIp, cleanDomain(simUrl), true), 1500);
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
          ※ DB와 연결되지 않은 가상 시뮬레이션입니다.
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
              <span className="form-label">연결 도메인:</span>
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
                  가상 캡티브 포털 인증
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
