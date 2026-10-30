import axios from "axios";
import { useEffect, useRef, useState } from "react";

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
  const logsEndRef = useRef(null);

  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ||
    `http://${window.location.hostname}:8000`
  ).replace(/\/+$/, "");

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [virtualLogs]);

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

  const showSimulationResult = (status, title, message) => {
    setSimState(status === "success" ? "success" : "blocked");
    setReportData({
      ip: activeIp,
      domain: cleanDomain(simUrl),
      status,
      title,
      message,
    });
    setTimeout(() => setShowModal(true), 600);
  };

  const executeSimulation = async (ip, domain, hasAuth) => {
    const isInternalIp =
      ip.startsWith("192.168.2.") || ip.startsWith("192.168.3.");
    const isAccessingAdminServer = domain === "192.168.3.23";

    if (!isInternalIp) {
      if (isAccessingAdminServer) {
        addLog(`🛑 사외망 IP에서 관제 서버(망분리) 접근 시도 차단됨`, "danger");
        showSimulationResult(
          "blocked",
          "망분리 접근 통제",
          "사외망(외부망) 대역에서는 보안 관제 서버로 접근할 수 없습니다.",
        );
      } else {
        addLog(`ℹ️ 사외망 단말 트래픽 (사내 방화벽 관제 예외)`, "info");
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
        `⚠️ MAC 주소 불일치 감지. 방화벽 스위치 포트(L2) 물리적 차단`,
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
      addLog(`🛑 사원망에서 관제 서버(망분리) 접근 시도 차단됨`, "danger");
      showSimulationResult(
        "blocked",
        "망분리 접근 통제",
        "해당 사내 대역에서는 보안 관제 서버로 접근할 수 없습니다.",
      );
      return;
    }

    // 규칙 B. 제로 트러스트: 관리자/사원 대역 무조건 캡티브 포털 인증 요구
    if (!hasAuth) {
      addLog(`🔒 내부망 접근 제어(NAC): 캡티브 포털 인증 요청`, "warning");
      setSimState("captive");
      return;
    }

    try {
      const res = await axios.post(`${baseUrl}/api/test/simulate-access/`, {
        source_ip: ip,
        target_url: domain,
        is_test: true,
      });
      if (res.data?.status === "BLOCKED") {
        addLog(`🛑 방화벽 룰킷 적용: [${domain}] 차단 완료`, "danger");
        showSimulationResult(
          "blocked",
          "차단 정책 위반",
          res.data?.message || "블랙리스트에 등록된 도메인입니다.",
        );
      } else {
        addLog(`🟢 접근 허용: [${domain}] 트래픽 통과`, "success");
        showSimulationResult(
          "success",
          "정상 접근 승인",
          "모든 보안 검사를 통과하여 통신이 허용되었습니다.",
        );
      }
    } catch {
      addLog(`❌ 서버 응답 오류`, "danger");
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
    addLog(`[${ip}] ➔ [${domain}] 패킷 전송 시작...`, "warning");

    setTimeout(() => {
      executeSimulation(ip, domain, isAlreadyAuthenticated);
    }, 1500);
  };

  const handleCaptiveLogin = async (e) => {
    e.preventDefault();
    addLog(`🔑 사용자(${empIdInput}) 캡티브 포털 인증 시도 중...`, "info");
    try {
      const res = await axios.post(`${baseUrl}/api/auth/captive-login/`, {
        employee_id: empIdInput.trim(),
        password: empPwInput,
        is_test: true,
      });
      if (res.data.status === "success") {
        setIsAlreadyAuthenticated(true);
        addLog(`🔓 인증 성공. 패킷 재전송...`, "success");
        setSimState("animating");
        setTimeout(
          () => executeSimulation(activeIp, cleanDomain(simUrl), true),
          1500,
        );
      }
    } catch (err) {
      addLog(`❌ 인증 실패: 아이디 또는 비밀번호 오류`, "danger");
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
      <style>{`
        .tl-wrapper { display: flex; flex: 1; gap: 24px; align-items: stretch; min-height: 0; }
        .tl-panel { display: flex; flex-direction: column; overflow: hidden; margin: 0; border-radius: 8px; }
        .tl-rules { width: 290px; padding: 20px; overflow-y: auto; background-color: var(--bg-card); border: 1px solid var(--border-color); }
        .tl-main { flex: 1; background-color: var(--bg-card); border: 1px solid var(--border-color); position: relative; }
        .tl-screen { flex: 1; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--bg-main); overflow: hidden; position: relative; }
        .tl-console { width: 350px; background-color: #0d1117; border: 1px solid #30363d; padding: 0; }
        
        .anim-container { display: flex; align-items: center; justify-content: space-between; width: 80%; max-width: 600px; position: relative; }
        .anim-node { display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 2; width: 120px; text-align: center; }
        .anim-icon { font-size: 40px; background: var(--bg-card); border-radius: 50%; padding: 15px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .anim-line-bg { position: absolute; top: 38px; left: 60px; right: 60px; height: 4px; background-color: #30363d; z-index: 0; }
        .anim-packet { position: absolute; top: 31px; left: 60px; width: 18px; height: 18px; background-color: #3fb950; border-radius: 50%; z-index: 3; box-shadow: 0 0 15px #3fb950; transition: all 0.3s ease; }
        
        @keyframes packetMove { 0% { left: 60px; opacity: 1; background-color: #3fb950; box-shadow: 0 0 15px #3fb950; } 40% { left: calc(50% - 9px); opacity: 1; background-color: #3fb950; box-shadow: 0 0 15px #3fb950; } 100% { left: calc(100% - 78px); opacity: 1; } }
        @keyframes packetBlock { 0% { left: 60px; opacity: 1; } 40% { left: calc(50% - 9px); opacity: 1; transform: scale(1); background-color: #f85149; box-shadow: 0 0 20px #f85149; } 60% { left: calc(50% - 9px); opacity: 0; transform: scale(3); } 100% { left: calc(50% - 9px); opacity: 0; } }
        .moving { animation: packetMove 1.5s ease-in-out forwards; }
        .blocked-anim { animation: packetBlock 1.5s ease-in-out forwards; }
        .fw-pulse { border-color: #8b5cf6; box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); animation: pulse 1s infinite alternate; }
        @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.05); } }

        .modal-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; animation: fadeIn 0.3s ease; }
        .modal-box { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 30px; width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #c9d1d9; text-align: center; }
        .m-title { font-size: 22px; margin-bottom: 20px; font-weight: bold; }
        .m-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
        .m-badge.success { background: rgba(63, 185, 80, 0.15); color: #3fb950; border: 1px solid #3fb950; }
        .m-badge.danger { background: rgba(248, 81, 73, 0.15); color: #f85149; border: 1px solid #f85149; }
        .m-detail { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px; text-align: left; font-size: 13px; line-height: 1.8; margin-bottom: 24px; }
        .m-row { display: flex; justify-content: space-between; border-bottom: 1px solid #30363d; padding-bottom: 6px; margin-bottom: 6px; }
        .m-row:last-child { border: none; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        className="page-header"
        style={{ marginBottom: "16px", flexShrink: 0 }}
      >
        <h2 className="page-title">🧪 통합 보안 및 패킷 관제 시뮬레이션</h2>
        <p
          className="page-subtitle"
          style={{ display: "flex", gap: "10px", alignItems: "center" }}
        >
          네트워크 대역별 접근 통제 검증
          <span
            style={{
              fontSize: "11px",
              backgroundColor: "rgba(250, 204, 21, 0.2)",
              color: "var(--color-warning)",
              padding: "2px 8px",
              borderRadius: "4px",
            }}
          >
            ※ 본 테스트는 운영 DB에 기록되지 않는 시뮬레이션입니다.
          </span>
        </p>
      </div>

      <div className="tl-wrapper">
        <div className="tl-panel tl-rules">
          <h4
            style={{
              color: "var(--color-primary)",
              margin: "0 0 10px 0",
              fontSize: "14px",
            }}
          >
            📌 제로 트러스트 보안 규칙
          </h4>
          <ul
            style={{
              paddingLeft: "16px",
              margin: "0 0 24px 0",
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: "1.7",
            }}
          >
            <li>
              <strong style={{ color: "var(--color-primary)" }}>
                192.168.3.x 보안망:
              </strong>{" "}
              접속 시 캡티브 유도
            </li>
            <li>
              <strong style={{ color: "var(--color-danger)" }}>
                192.168.2.x 사원망:
              </strong>{" "}
              접속 시 캡티브 유도
            </li>
            <li>
              <strong style={{ color: "var(--color-success)" }}>
                내부망(인증후):
              </strong>{" "}
              위협/블랙리스트 차단
            </li>
            <li>
              <strong style={{ color: "var(--color-warning)" }}>사외망:</strong>{" "}
              관제서버 접근 절대 차단
            </li>
          </ul>

          <h4
            style={{
              color: "var(--color-warning)",
              margin: "0 0 10px 0",
              fontSize: "14px",
            }}
          >
            ⚠️ MAC 스푸핑 탐지
          </h4>
          <div
            style={{
              padding: "14px",
              borderRadius: "8px",
              fontSize: "12px",
              lineHeight: "1.6",
              color: "var(--text-main)",
              backgroundColor: "rgba(250, 204, 21, 0.08)",
              border: "1px solid rgba(250, 204, 21, 0.3)",
            }}
          >
            <b>[MAC 변조]</b> 체크 시 L2 계층 변조로 판단하여 물리적으로
            차단(격리)합니다.
          </div>
        </div>

        <div className="tl-panel tl-main">
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "var(--bg-card-alt)",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <form
                onSubmit={handleApplyIp}
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    fontWeight: "600",
                  }}
                >
                  내 PC IP:
                </span>
                <input
                  type="text"
                  className="custom-input"
                  value={pcIp}
                  onChange={(e) => setPcIp(e.target.value)}
                  style={{ width: "160px", height: "32px", fontSize: "13px" }}
                  placeholder="192.168.2.100"
                />
                <button
                  type="submit"
                  className="btn-action"
                  style={{ height: "32px", padding: "0 12px" }}
                >
                  적용
                </button>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginLeft: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSpoofing}
                    onChange={(e) => setIsSpoofing(e.target.checked)}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      color: isSpoofing
                        ? "var(--color-warning)"
                        : "var(--text-muted)",
                      fontWeight: isSpoofing ? "bold" : "normal",
                    }}
                  >
                    MAC 변조
                  </span>
                </label>
              </form>
              <button
                type="button"
                onClick={resetTest}
                className="btn-action btn-action-reject"
                style={{ height: "32px", padding: "0 12px" }}
              >
                초기화
              </button>
            </div>
            <form
              onSubmit={handleNavigate}
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                }}
              >
                연결 도메인:
              </span>
              <input
                type="text"
                className="custom-input"
                value={simUrl}
                onChange={(e) => setSimUrl(e.target.value)}
                placeholder="예: google.com"
                style={{ flex: 1, height: "32px", fontSize: "13px" }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ height: "32px", padding: "0 20px" }}
              >
                시뮬레이션 시작
              </button>
            </form>
          </div>

          <div className="tl-screen">
            {(simState === "idle" ||
              simState === "animating" ||
              simState === "success" ||
              simState === "blocked") && (
                <div className="anim-container">
                  <div className="anim-node">
                    <div className="anim-icon">💻</div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        fontWeight: "bold",
                      }}
                    >
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
                    <div
                      className="anim-packet"
                      style={{ left: "calc(100% - 78px)" }}
                    ></div>
                  )}
                  <div className="anim-node">
                    <div
                      className={`anim-icon ${simState === "animating" ? "fw-pulse" : ""}`}
                      style={{
                        borderColor:
                          simState === "blocked"
                            ? "#f85149"
                            : simState === "success"
                              ? "#3fb950"
                              : "var(--border-color)",
                      }}
                    >
                      🛡️
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        fontWeight: "bold",
                      }}
                    >
                      보안 관제 엔진
                      <br />
                      SecureTech
                    </span>
                  </div>
                  <div className="anim-node">
                    <div
                      className="anim-icon"
                      style={{ opacity: simState === "blocked" ? 0.3 : 1 }}
                    >
                      🌐
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-muted)",
                        fontWeight: "bold",
                      }}
                    >
                      목적지
                      <br />
                      {cleanDomain(simUrl) || "Target"}
                    </span>
                  </div>
                </div>
              )}

            {simState === "captive" && (
              <div
                style={{
                  width: "340px",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  padding: "24px",
                  textAlign: "center",
                  zIndex: 10,
                }}
              >
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>🛡️</div>
                <h3
                  style={{
                    color: "var(--color-primary)",
                    fontSize: "18px",
                    margin: "0 0 16px 0",
                  }}
                >
                  내부망 캡티브 포털 인증
                </h3>
                <form
                  onSubmit={handleCaptiveLogin}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
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
                  <button type="submit" className="btn-primary">
                    인증 및 승인
                  </button>
                </form>
              </div>
            )}

            {showModal && reportData && (
              <div className="modal-overlay">
                <div className="modal-box">
                  <div className="m-title">분석 리포트</div>
                  <div
                    className={`m-badge ${reportData.status === "success" ? "success" : "danger"}`}
                  >
                    {reportData.status === "success"
                      ? "🟢 연결 허용됨"
                      : "🔴 연결 차단됨"}
                  </div>
                  <div className="m-detail">
                    <div className="m-row">
                      <span style={{ color: "#8b949e" }}>판별 결과</span>{" "}
                      <strong
                        style={{
                          color:
                            reportData.status === "success"
                              ? "#3fb950"
                              : "#f85149",
                        }}
                      >
                        {reportData.title}
                      </strong>
                    </div>
                    <div className="m-row">
                      <span style={{ color: "#8b949e" }}>출발지 (Source)</span>{" "}
                      <span>{reportData.ip}</span>
                    </div>
                    <div className="m-row">
                      <span style={{ color: "#8b949e" }}>목적지 (Target)</span>{" "}
                      <span>{reportData.domain}</span>
                    </div>
                    <div
                      className="m-row"
                      style={{
                        marginTop: "12px",
                        border: "none",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <span style={{ color: "#8b949e" }}>상세 내용</span>
                      <span style={{ color: "#c9d1d9", lineHeight: "1.4" }}>
                        {reportData.message}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      height: "40px",
                      fontSize: "14px",
                      borderRadius: "8px",
                    }}
                  >
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "var(--bg-card-alt)",
              borderTop: "1px solid var(--border-color)",
              fontSize: "12px",
              color: "var(--text-muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              적용된 IP:{" "}
              <strong style={{ color: "var(--color-primary)" }}>
                {activeIp}
              </strong>
            </span>
            <span>
              인증 상태:{" "}
              {isAlreadyAuthenticated
                ? "🟢 승인됨 (제로 트러스트)"
                : "🔴 미인증"}
            </span>
          </div>
        </div>

        <div className="tl-panel tl-console">
          <div className="tl-con-head">
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#3fb950" }}>▶</span> 시뮬레이션 로그
            </span>
            <button
              onClick={() => setVirtualLogs([])}
              style={{
                background: "transparent",
                border: "1px solid #30363d",
                color: "#8b949e",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              fontFamily: "'Courier New', monospace",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {virtualLogs.length === 0 ? (
              <div
                style={{
                  color: "#484f58",
                  fontStyle: "italic",
                  textAlign: "center",
                  marginTop: "50%",
                }}
              >
                대기 중...
              </div>
            ) : (
              virtualLogs.map((log, idx) => {
                const colors = {
                  danger: "#f85149",
                  success: "#3fb950",
                  warning: "#d29922",
                  info: "#c9d1d9",
                };
                return (
                  <div key={idx} style={{ lineHeight: "1.4" }}>
                    <span style={{ color: "#8b949e", marginRight: "6px" }}>
                      [{log.time}]
                    </span>
                    <span style={{ color: colors[log.type] || colors.info }}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
