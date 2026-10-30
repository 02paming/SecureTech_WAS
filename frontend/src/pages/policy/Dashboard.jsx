import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const Dashboard = () => {
  const navigate = useNavigate();
  const chartWrapperRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [chartData, setChartData] = useState([]);
  const [topDomains, setTopDomains] = useState([]);
  const [topAiSuspicious, setTopAiSuspicious] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [panOffset, setPanOffset] = useState(0);
  const [timeInterval, setTimeInterval] = useState(
    () => Number(localStorage.getItem("dashboardInterval")) || 60,
  );

  const [showNormal, setShowNormal] = useState(true);
  const [showThreat, setShowThreat] = useState(true);
  const [showAi, setShowAi] = useState(true);

  const [eqpConfig, setEqpConfig] = useState({
    work_start_time: "07:00",
    work_end_time: "19:00",
  });
  const [idleMinutes, setIdleMinutes] = useState(30);

  const baseUrl = useMemo(
    () =>
      (
        import.meta.env.VITE_API_BASE_URL ||
        `http://${window.location.hostname}:8000`
      ).replace(/\/+$/, ""),
    [],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rS = await axios.get(
        `${baseUrl}/api/dashboard/traffic-stats/?interval=${timeInterval}`,
      );
      if (rS.data.status === "success") {
        setChartData(rS.data.data || []);
        setTopDomains(
          [...(rS.data.top_domains || [])].sort(
            (a, b) => (b.value || 0) - (a.value || 0),
          ),
        );
        setTopAiSuspicious(rS.data.top_ai_suspicious || []);
        setLastUpdated(
          new Date().toLocaleTimeString("ko-KR", { hour12: false }),
        );
      }
      const rC = await axios.get(`${baseUrl}/api/dashboard/eqp-run-time/`);
      if (rC.data.status === "success") {
        setEqpConfig({
          work_start_time: rC.data.data.work_start_time,
          work_end_time: rC.data.data.work_end_time,
        });
        if (rC.data.data.waiting_time) {
          const [h, m] = rC.data.data.waiting_time.split(":");
          setIdleMinutes(parseInt(h, 10) * 60 + parseInt(m, 10));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, timeInterval]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 600000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleIntervalChange = useCallback((e) => {
    const v = Number(e.target.value);
    setTimeInterval(v);
    localStorage.setItem("dashboardInterval", v);
    setPanOffset(0);
  }, []);

  const handleSaveConfig = useCallback(async () => {
    try {
      const waitTime = `${String(Math.floor(idleMinutes / 60)).padStart(2, "0")}:${String(idleMinutes % 60).padStart(2, "0")}`;
      const r = await axios.post(`${baseUrl}/api/dashboard/eqp-run-time/`, {
        ...eqpConfig,
        waiting_time: waitTime,
      });
      if (r.data.status === "success") {
        alert("근무 및 유휴 시간이 성공적으로 저장되었습니다.");
        setShowConfigModal(false);
      }
    } catch (err) {
      alert("설정 저장에 실패했습니다.");
    }
  }, [baseUrl, eqpConfig, idleMinutes]);

  useEffect(() => {
    const el = chartWrapperRef.current;
    if (!el) return;
    const currentLength = chartData.length;
    const preventScroll = (e) => {
      e.preventDefault();
      setPanOffset((p) =>
        Math.max(
          0,
          Math.min(
            p + (e.deltaY > 0 ? 1 : -1),
            Math.max(0, currentLength - 26),
          ),
        ),
      );
    };
    el.addEventListener("wheel", preventScroll, { passive: false });
    return () => el.removeEventListener("wheel", preventScroll);
  }, [chartData.length]);

  const visibleData = useMemo(
    () =>
      chartData.slice(
        Math.max(0, chartData.length - 26 - panOffset),
        chartData.length - panOffset,
      ),
    [chartData, panOffset],
  );

  const COLORS = useMemo(
    () => ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16"],
    [],
  );

  const { yMax, yTicks } = useMemo(() => {
    const maxVal = visibleData.length
      ? Math.max(
          ...visibleData.map((d) =>
            Math.max(
              showNormal ? d.정상접속 || 0 : 0,
              showThreat ? d.위협차단 || 0 : 0,
              showAi ? d.AI의심 || 0 : 0,
            ),
          ),
        )
      : 0;
    const max =
      maxVal === 0 ? 4 : maxVal + Math.max(1, Math.floor(maxVal * 0.1));
    const getYTicks = (m) => {
      if (m <= 6) return Array.from({ length: m + 1 }, (_, i) => i);
      const s = Math.ceil(m / 5);
      const t = [];
      for (let i = 0; i < m; i += s) t.push(i);
      if (t[t.length - 1] !== m) t.push(m);
      return t;
    };
    return { yMax: max, yTicks: getYTicks(max) };
  }, [visibleData, showNormal, showThreat, showAi]);

  return (
    <div className="page-container admin-page">
      <style>{`.dashboard-chart-wrapper * { outline: none !important; }`}</style>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div>
          <h2 className="page-title">📊 통합 보안 관제 대시보드</h2>
          <p className="page-subtitle">
            실시간 네트워크 세션 흐름 및 주요 위협 지표 모니터링
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              margin: "0 6px",
            }}
          >
            최종 갱신: {lastUpdated || "-"}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-action btn-action-edit"
            style={{
              margin: 0,
              padding: "0 16px",
              fontSize: "13px",
              height: "36px",
              fontWeight: "bold",
            }}
          >
            {loading ? "🔄 갱신 중..." : "🔄 데이터 동기화"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", flex: 1, minHeight: 0 }}>
        <div
          className="card dashboard-card"
          style={{
            flex: 2.2,
            display: "flex",
            flexDirection: "column",
            padding: "20px",
            margin: 0,
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3
                className="card-title"
                style={{ fontSize: "17px", margin: 0 }}
              >
                🌐 실시간 트래픽 흐름
              </h3>
              {panOffset > 0 && (
                <button
                  onClick={() => setPanOffset(0)}
                  style={{
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  ⏭️ 실시간 위치로
                </button>
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: "16px",
                fontSize: "12px",
                fontWeight: "bold",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => setShowConfigModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-color)",
                  padding: "0 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  height: "30px",
                  marginRight: "8px",
                }}
              >
                ⚙️ 인증 설정
              </button>
              <select
                value={timeInterval}
                onChange={handleIntervalChange}
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-color)",
                  padding: "0 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  height: "30px",
                  outline: "none",
                }}
              >
                <option value={60}>1시간 간격 집계</option>
                <option value={30}>30분 간격 집계</option>
                <option value={10}>10분 간격 집계</option>
                <option value={1}>1분 간격 집계</option>
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#38bdf8",
                  cursor: "pointer",
                  opacity: showNormal ? 1 : 0.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={showNormal}
                  onChange={(e) => setShowNormal(e.target.checked)}
                  style={{ accentColor: "#38bdf8", cursor: "pointer" }}
                />{" "}
                정상 통과
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#f87171",
                  cursor: "pointer",
                  opacity: showThreat ? 1 : 0.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={showThreat}
                  onChange={(e) => setShowThreat(e.target.checked)}
                  style={{ accentColor: "#f87171", cursor: "pointer" }}
                />{" "}
                위협 차단
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#f59e0b",
                  cursor: "pointer",
                  opacity: showAi ? 1 : 0.45,
                }}
              >
                <input
                  type="checkbox"
                  checked={showAi}
                  onChange={(e) => setShowAi(e.target.checked)}
                  style={{ accentColor: "#f59e0b", cursor: "pointer" }}
                />{" "}
                AI 의심
              </label>
            </div>
          </div>

          <div
            className="dashboard-chart-wrapper"
            ref={chartWrapperRef}
            style={{ flex: 1, minHeight: 0 }}
          >
            {visibleData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={visibleData}
                  margin={{ top: 10, right: 40, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorNormal"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#38bdf8"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorThreat"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#f87171"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#f59e0b"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148, 163, 184, 0.15)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    interval={0}
                    tickFormatter={(v, i) =>
                      v && (i === 25 || (i % 2 === 0 && i !== 24))
                        ? v.split(" ")[1]
                        : ""
                    }
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, yMax]}
                    ticks={yTicks}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                    }}
                    itemStyle={{ fontWeight: "bold" }}
                    labelFormatter={(l) =>
                      l ? (l.split(" ").length > 1 ? l.split(" ")[1] : l) : ""
                    }
                  />
                  {showNormal && (
                    <Area
                      type="monotone"
                      dataKey="정상접속"
                      stroke="#38bdf8"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorNormal)"
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {showAi && (
                    <Area
                      type="monotone"
                      dataKey="AI의심"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorAi)"
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {showThreat && (
                    <Area
                      type="monotone"
                      dataKey="위협차단"
                      stroke="#f87171"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorThreat)"
                      activeDot={{ r: 6 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "var(--text-muted)",
                }}
              >
                데이터가 없습니다.
              </div>
            )}
          </div>
          <div style={{ marginTop: "12px", padding: "0 10px" }}>
            <input
              type="range"
              min="0"
              max={Math.max(0, chartData.length - 26)}
              value={panOffset}
              onChange={(e) => setPanOffset(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "var(--color-primary)",
                cursor: "pointer",
              }}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            minHeight: 0,
          }}
        >
          {/* 💡 정식 위협 차단 도메인 타이틀 정리 */}
          <div
            className="card dashboard-card"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              margin: 0,
              minHeight: 0,
            }}
          >
            <div
              style={{
                marginBottom: "10px",
                flexShrink: 0,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  className="card-title"
                  style={{ fontSize: "17px", margin: 0, color: "#f87171" }}
                >
                  🎯 정식 위협 차단 현황
                </h3>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  차단 트래픽 누적 발생 기준 (Top 5)
                </p>
              </div>
              <button
                onClick={() => navigate("/policies")}
                style={{
                  fontSize: "11px",
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-color)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                관리 ➔
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {topDomains.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart style={{ outline: "none" }}>
                    <Pie
                      data={topDomains}
                      cx="50%"
                      cy="45%"
                      innerRadius="50%"
                      outerRadius="80%"
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {topDomains.map((e, i) => (
                        <Cell
                          key={`pie-cell-${i}`}
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(v) => [`${v}건`, "차단됨"]}
                      contentStyle={{
                        background: "var(--bg-card)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-main)",
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={100}
                      content={() => (
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            fontSize: "12px",
                            display: "grid",
                            gap: "6px",
                          }}
                        >
                          {topDomains.map((item, i) => (
                            <li
                              key={`leg-${i}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                color: "var(--text-main)",
                              }}
                            >
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    background: COLORS[i % COLORS.length],
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                  }}
                                />
                                {item.name}
                              </span>
                              <strong
                                style={{
                                  color: COLORS[i % COLORS.length],
                                  marginLeft: "10px",
                                }}
                              >
                                {item.value}건
                              </strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                  누적된 차단 내역이 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 💡 AI 탐지 기반 대기열 타이틀/렌더링 정리 */}
          <div
            className="card dashboard-card"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              margin: 0,
              minHeight: 0,
            }}
          >
            <div
              style={{
                marginBottom: "12px",
                flexShrink: 0,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  className="card-title"
                  style={{ fontSize: "16px", margin: 0, color: "#f59e0b" }}
                >
                  ⚠️ AI 탐지 기반 대기열 (위험/의심)
                </h3>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    margin: "4px 0 0",
                  }}
                >
                  엔진이 자동 수집한 판별 대기 도메인
                </p>
              </div>
              <button
                onClick={() => navigate("/ai-policies")}
                style={{
                  fontSize: "11px",
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-color)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                관리 ➔
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {topAiSuspicious.length > 0 ? (
                topAiSuspicious.map((item, idx) => (
                  <div
                    key={`ai-${item.domain}-${idx}`}
                    onClick={() => navigate("/ai-policies")}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      backgroundColor: "var(--bg-main)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        item.color || "#f59e0b")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "var(--border-color)")
                    }
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "bold",
                        color: "var(--text-main)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.domain}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: item.color || "#f59e0b",
                        backgroundColor:
                          item.bgColor || "rgba(245, 158, 11, 0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {item.status_text}
                    </span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "13px",
                    marginTop: "20px",
                  }}
                >
                  현재 탐지된 의심 도메인이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              padding: "30px",
              borderRadius: "12px",
              width: "400px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            <h3
              style={{
                margin: "0 0 20px",
                fontSize: "18px",
                color: "var(--text-title)",
              }}
            >
              ⚙️ 사내망 접근 인증 정책 설정
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                    display: "block",
                  }}
                >
                  🟢 정규 출근 시간{" "}
                  <span
                    style={{
                      fontWeight: "normal",
                      fontSize: "11px",
                      color: "var(--color-primary)",
                    }}
                  >
                    (최초 1회 인증)
                  </span>
                </label>
                <input
                  type="time"
                  className="custom-input"
                  value={eqpConfig.work_start_time}
                  onChange={(e) =>
                    setEqpConfig({
                      ...eqpConfig,
                      work_start_time: e.target.value,
                    })
                  }
                  style={{ padding: "10px", width: "100%", height: "36px" }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                    display: "block",
                  }}
                >
                  🔴 정규 퇴근 시간{" "}
                  <span
                    style={{
                      fontWeight: "normal",
                      fontSize: "11px",
                      color: "var(--color-danger)",
                    }}
                  >
                    (유휴 상태 감지 활성화)
                  </span>
                </label>
                <input
                  type="time"
                  className="custom-input"
                  value={eqpConfig.work_end_time}
                  onChange={(e) =>
                    setEqpConfig({
                      ...eqpConfig,
                      work_end_time: e.target.value,
                    })
                  }
                  style={{ padding: "10px", width: "100%", height: "36px" }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    color: "var(--text-muted)",
                    marginBottom: "6px",
                    display: "block",
                  }}
                >
                  ⏳ 유휴 대기 허용 시간 (분)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  className="custom-input"
                  value={idleMinutes}
                  onChange={(e) => setIdleMinutes(e.target.value)}
                  style={{ padding: "10px", width: "100%", height: "36px" }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setShowConfigModal(false)}
                className="btn-action btn-action-reject"
                style={{ height: "36px", padding: "0 16px" }}
              >
                취소
              </button>
              <button
                onClick={handleSaveConfig}
                className="btn-primary"
                style={{ height: "36px", padding: "0 16px" }}
              >
                설정 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
