// 실시간 접속 흐름, 트래픽 통계, 차단 현황 및 AI 모델 성능을 시각화하여 보여주는 관제 대시보드 컴포넌트

import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
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
import { API_BASE_URL, MONITOR_REFRESH_MS } from "../../api";
import PageHeader from "../../components/PageHeader";
import { appAlert } from "../../utils/appDialog";
import { formatTimeKR } from "../../utils/formatTime";

const LOG_DELAY_WARNING_MINUTES = 30;

const Dashboard = () => {
  const navigate = useNavigate();
  const chartWrapperRef = useRef(null);
  const fetchSeq = useRef(0);

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [chartData, setChartData] = useState([]);
  const [topDomains, setTopDomains] = useState([]);
  const [topAiSuspicious, setTopAiSuspicious] = useState([]);
  const [policyBreakdownManual, setPolicyBreakdownManual] = useState([]);
  const [policyBreakdownAi, setPolicyBreakdownAi] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [panOffset, setPanOffset] = useState(0);
  const [timeInterval, setTimeInterval] = useState(
    () => Number(localStorage.getItem("dashboardInterval")) || 60,
  );
  const [rangeDays, setRangeDays] = useState(
    () => Number(localStorage.getItem("dashboardRangeDays")) || 3,
  );

  const [showNormal, setShowNormal] = useState(true);
  const [showThreat, setShowThreat] = useState(true);
  const [showAi, setShowAi] = useState(true);

  const [eqpConfig, setEqpConfig] = useState({
    work_start_time: "07:00",
    work_end_time: "19:00",
  });
  const [idleMinutes, setIdleMinutes] = useState(30);

  const baseUrl = API_BASE_URL;

  const fetchData = useCallback(async () => {
    // 시간 간격을 빠르게 바꿔도 늦게 온 이전 응답이 최신 값을 덮어쓰지 않게 한다
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const rS = await axios.get(
        `${baseUrl}/api/dashboard/traffic-stats/?interval=${timeInterval}&days=${rangeDays}`,
      );
      if (seq !== fetchSeq.current) return;
      if (rS.data.status === "success") {
        setChartData(rS.data.data || []);
        setTopDomains(
          [...(rS.data.top_domains || [])].sort(
            (a, b) => (b.value || 0) - (a.value || 0),
          ),
        );
        setTopAiSuspicious(rS.data.top_ai_suspicious || []);
        setPolicyBreakdownManual(rS.data.policy_breakdown_manual || []);
        setPolicyBreakdownAi(rS.data.policy_breakdown_ai || []);
        setMonitoring(rS.data.monitoring || null);
        setLastUpdated(formatTimeKR());
      }
      const rM = await axios.get(`${baseUrl}/api/policies/ai/metrics/`);
      if (rM.data.status === "success") {
        setActiveModel(
          (rM.data.metrics || []).find((m) => m.is_active) || null,
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
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [baseUrl, timeInterval, rangeDays]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, MONITOR_REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleIntervalChange = useCallback((e) => {
    const v = Number(e.target.value);
    setTimeInterval(v);
    localStorage.setItem("dashboardInterval", v);
    setPanOffset(0);
  }, []);

  const handleRangeChange = useCallback((e) => {
    const v = Number(e.target.value);
    setRangeDays(v);
    localStorage.setItem("dashboardRangeDays", v);
    setPanOffset(0);
  }, []);

  const exportChartCSV = useCallback(() => {
    const headers = ["시간", "정상 통과", "차단", "AI 의심"];
    const rows = [headers.join(",")];
    [...chartData].reverse().forEach((d) => {
      rows.push(
        `"${d.time}",${d.정상접속 || 0},${d.위협차단 || 0},${d.AI의심 || 0}`,
      );
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SecureTech_Dashboard_Traffic_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [chartData]);

  const handleSaveConfig = useCallback(async () => {
    try {
      const waitTime = `${String(Math.floor(idleMinutes / 60)).padStart(2, "0")}:${String(idleMinutes % 60).padStart(2, "0")}`;
      const r = await axios.post(`${baseUrl}/api/dashboard/eqp-run-time/`, {
        ...eqpConfig,
        waiting_time: waitTime,
      });
      if (r.data.status === "success") {
        await appAlert("근무 및 유휴 시간이 성공적으로 저장되었습니다.");
        setShowConfigModal(false);
      }
    } catch {
      await appAlert("설정 저장에 실패했습니다.");
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

  const manualTotal = policyBreakdownManual.reduce((sum, i) => sum + i.value, 0);
  const aiTotal = policyBreakdownAi.reduce((sum, i) => sum + i.value, 0);

  const visibleData = useMemo(
    () =>
      chartData.slice(
        Math.max(0, chartData.length - 26 - panOffset),
        chartData.length - panOffset,
      ),
    [chartData, panOffset],
  );

  const COLORS = useMemo(
    () => [
      "var(--color-danger)",
      "var(--color-orange-light)",
      "var(--color-warning)",
      "var(--color-warning-light)",
      "var(--color-success)",
    ],
    [],
  );

  // 패닝(스크롤)해도 축 범위가 바뀌지 않도록 전체 기간(chartData) 기준으로 Y축 최댓값을 고정한다
  const { yMax, yTicks } = useMemo(() => {
    const maxVal = chartData.length
      ? Math.max(
        ...chartData.map((d) =>
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
  }, [chartData, showNormal, showThreat, showAi]);

  return (
    <div className="page-container admin-page">
      <PageHeader
        title="관제 대시보드"
        subtitle="실시간 접속 흐름과 주요 위협 현황을 확인합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={loading}
      >
        {monitoring && (
          <>
            <span
              className={`tag ${monitoring.minutes_since_log === null || monitoring.minutes_since_log > LOG_DELAY_WARNING_MINUTES ? "text-warning" : "text-success"}`}
            >
              엔진 로그: {monitoring.last_log_time || "없음"}
              {monitoring.minutes_since_log !== null &&
                ` (${monitoring.minutes_since_log}분 전)`}
            </span>
            <span
              className={`tag ${monitoring.watcher_alive ? "text-success" : "text-danger"}`}
            >
              MAC 스푸핑 감시 프로그램: {monitoring.watcher_alive ? "정상" : "중단"}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="btn-action btn-neutral btn-w-lg btn-header"
        >
          인증 정책 설정
        </button>
      </PageHeader>

      <div className="panel-row">
        <div className="card dashboard-card card-fill card-fill-wide">
          <div className="card-header">
            <div className="card-title-group">
              <h3 className="card-title">실시간 접속 흐름</h3>
              {panOffset > 0 && (
                <button
                  type="button"
                  onClick={() => setPanOffset(0)}
                  className="btn-action btn-outline btn-w-lg btn-header"
                >
                  실시간 위치로
                </button>
              )}
            </div>
            <div className="toolbar-group">
              <label
                className={`check-label text-primary ${showNormal ? "" : "is-off"}`}
                title="수동/AI 판정으로 정상 허용된 접속만 집계 (AI 의심으로 분류된 건은 제외)"
              >
                <input
                  type="checkbox"
                  checked={showNormal}
                  onChange={(e) => setShowNormal(e.target.checked)}
                />
                정상 통과
              </label>
              <label
                className={`check-label text-danger ${showThreat ? "" : "is-off"}`}
                title="수동/AI 판정으로 차단된 접속만 집계 (AI 의심으로 분류된 건은 제외)"
              >
                <input
                  type="checkbox"
                  checked={showThreat}
                  onChange={(e) => setShowThreat(e.target.checked)}
                />
                차단
              </label>
              <label
                className={`check-label text-warning ${showAi ? "" : "is-off"}`}
                title="AI가 블랙/화이트 의심으로 분류한 접속. 통과·차단 여부와 무관하게 별도 집계되며 위 두 항목과 겹치지 않음"
              >
                <input
                  type="checkbox"
                  checked={showAi}
                  onChange={(e) => setShowAi(e.target.checked)}
                />
                AI 의심
              </label>
              <select
                value={rangeDays}
                onChange={handleRangeChange}
                className="custom-input select-input"
              >
                <option value={3}>최근 3일</option>
                <option value={7}>최근 7일</option>
                <option value={30}>최근 30일</option>
              </select>
              <select
                value={timeInterval}
                onChange={handleIntervalChange}
                className="custom-input select-input"
              >
                <option value={60}>1시간 간격 집계</option>
                <option value={30}>30분 간격 집계</option>
                <option value={10}>10분 간격 집계</option>
                <option value={1}>1분 간격 집계</option>
              </select>
              <button
                type="button"
                onClick={exportChartCSV}
                className="btn-action btn-neutral btn-w-lg btn-form"
              >
                CSV 다운로드
              </button>
            </div>
          </div>

          <div className="chart-area" ref={chartWrapperRef}>
            {loading && chartData.length === 0 ? (
              <div className="empty-state">데이터를 불러오는 중입니다...</div>
            ) : visibleData.length > 0 ? (
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
                        stopColor="var(--chart-normal)"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--chart-normal)"
                        stopOpacity={0}
                      />
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
                        stopColor="var(--chart-threat)"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--chart-threat)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--chart-ai)"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--chart-ai)"
                        stopOpacity={0}
                      />
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
                    tick={{ fontSize: 11, fontFamily: "var(--font-sans)", fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    interval={0}
                    tickFormatter={(v, i) => {
                      const step = window.innerWidth < 768 ? 5 : 2;
                      return v && (i === 25 || (i % step === 0 && i !== 24))
                        ? v.split(" ")[1]
                        : "";
                    }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 11, fontFamily: "var(--font-sans)", fill: "var(--text-muted)" }}
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
                      fontSize: "13px",
                    }}
                    labelStyle={{ fontSize: "13px", fontWeight: "bold" }}
                    itemStyle={{ fontWeight: "bold", fontSize: "13px" }}
                    labelFormatter={(l) =>
                      l ? (l.split(" ").length > 1 ? l.split(" ")[1] : l) : ""
                    }
                  />
                  {showNormal && (
                    <Area
                      type="linear"
                      dataKey="정상접속"
                      name="정상 통과"
                      stroke="var(--chart-normal)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorNormal)"
                      activeDot={{ r: 6 }}
                      isAnimationActive={false} // 애니메이션 끄기
                    />
                  )}
                  {showAi && (
                    <Area
                      type="linear"
                      dataKey="AI의심"
                      name="AI 의심"
                      stroke="var(--chart-ai)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorAi)"
                      activeDot={{ r: 6 }}
                      isAnimationActive={false} // 애니메이션 끄기
                    />
                  )}
                  {showThreat && (
                    <Area
                      type="linear"
                      dataKey="위협차단"
                      name="차단"
                      stroke="var(--chart-threat)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorThreat)"
                      activeDot={{ r: 6 }}
                      isAnimationActive={false} // 애니메이션 끄기
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">데이터가 없습니다.</div>
            )}
          </div>
          <input
            type="range"
            className="chart-slider"
            min="0"
            max={Math.max(0, chartData.length - 26)}
            value={panOffset}
            onChange={(e) => setPanOffset(Number(e.target.value))}
          />
          {chartData.length > 26 && (
            <div className="text-muted chart-slider-hint">
              <span>과거 구간 탐색 슬라이더 — 좌우로 움직여 지난 시간대를 확인합니다.</span>
              <span>
                표시 구간: {visibleData[0]?.time || "-"} ~{" "}
                {visibleData[visibleData.length - 1]?.time || "-"}
              </span>
            </div>
          )}
        </div>

        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <div>
              <h3 className="card-title">AI 모델 성능</h3>
              <p className="card-subtitle">
                {activeModel
                  ? `현재 활성 모델: ${activeModel.version_name}`
                  : "현재 활성 모델 기준"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/ai-metrics")}
              className="btn-action btn-neutral btn-w-lg"
            >
              AI 모델 성능
            </button>
          </div>
          <div className="chart-area">
            {activeModel ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: `정확도 (${(activeModel.accuracy ?? 0).toFixed(1)}%)`,
                      value: activeModel.accuracy ?? 0,
                    },
                    {
                      name: `정밀도 (${(activeModel.precision ?? 0).toFixed(1)}%)`,
                      value: activeModel.precision ?? 0,
                    },
                    {
                      name: `F1 (${(activeModel.f1_score ?? 0).toFixed(1)}%)`,
                      value: activeModel.f1_score ?? 0,
                    },
                  ]}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148, 163, 184, 0.15)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-main)"
                    tick={{ fontSize: 11, fontFamily: "var(--font-sans)", fill: "var(--text-main)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-main)"
                    tick={{ fontSize: 11, fontFamily: "var(--font-sans)", fill: "var(--text-main)" }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive={false}
                    barSize={60}
                  >
                    {["var(--series-1)", "var(--series-2)", "var(--series-3)"].map((color, i) => (
                      <Cell key={`model-bar-${i}`} fill={color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">가동 중인 AI 모델이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel-row">
        <div className="card dashboard-card card-fill card-fill-wide">
          <div className="card-header">
            <div>
              <h3 className="card-title">판정·차단 현황</h3>
              <p className="card-subtitle">
                최근 {rangeDays}일 기준 · 수동 정책 판정과 AI 판정의 합이 전체 접속 건수입니다
              </p>
            </div>
          </div>
          <div className="chart-split">
            <div className="chart-split-item">
              <div className="chart-split-header">
                <span className="chart-split-title">차단 도메인 Top 5</span>
                <button
                  type="button"
                  onClick={() => navigate("/log-analysis")}
                  className="btn-action btn-neutral btn-w-lg"
                >
                  로그분석실
                </button>
              </div>
              <div className="chart-area">
                {topDomains.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topDomains}
                        cx="50%"
                        cy="45%"
                        innerRadius="50%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {topDomains.map((_, i) => (
                          <Cell
                            key={`domain-cell-${i}`}
                            fill={COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(v) => [`${v}건`, "차단"]}
                        contentStyle={{
                          background: "var(--bg-card)",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-main)",
                          fontSize: "13px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={80}
                        content={() => (
                          <ul className="legend-list">
                            {topDomains.map((item, i) => (
                              <li
                                key={`domain-leg-${i}`}
                                className="legend-item is-clickable"
                                onClick={() =>
                                  navigate(
                                    `/log-analysis?domain=${encodeURIComponent(item.name)}`,
                                  )
                                }
                              >
                                <span className="legend-name">
                                  <span
                                    className="legend-dot"
                                    style={{ background: COLORS[i % COLORS.length] }}
                                  />
                                  {item.name}
                                </span>
                                <strong style={{ color: COLORS[i % COLORS.length] }}>
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
                  <div className="empty-state">차단 기록이 없습니다.</div>
                )}
              </div>
            </div>

            <div className="chart-split-item">
              <div className="chart-split-header">
                <span className="chart-split-title">
                  수동 정책 판정 (총 {manualTotal}건)
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/policies")}
                  className="btn-action btn-neutral btn-w-lg"
                >
                  도메인 정책
                </button>
              </div>
              <div className="chart-area">
                {policyBreakdownManual.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={policyBreakdownManual}
                        cx="50%"
                        cy="45%"
                        innerRadius="50%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {policyBreakdownManual.map((item, i) => (
                          <Cell key={`main-cell-${i}`} fill={item.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(v) => [`${v}건`, "판정"]}
                        contentStyle={{
                          background: "var(--bg-card)",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-main)",
                          fontSize: "13px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={80}
                        content={() => (
                          <ul className="legend-list">
                            {policyBreakdownManual.map((item) => (
                              <li key={`main-leg-${item.name}`} className="legend-item">
                                <span className="legend-name">
                                  <span
                                    className="legend-dot"
                                    style={{ background: item.color }}
                                  />
                                  {item.name}
                                </span>
                                <strong style={{ color: item.color }}>
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
                  <div className="empty-state">판정 기록이 없습니다.</div>
                )}
              </div>
            </div>

            <div className="chart-split-item">
              <div className="chart-split-header">
                <span className="chart-split-title">
                  AI 판정 (총 {aiTotal}건)
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/ai-policies")}
                  className="btn-action btn-neutral btn-w-lg"
                >
                  AI 탐지 도메인
                </button>
              </div>
              <div className="chart-area">
                {policyBreakdownAi.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={policyBreakdownAi}
                        cx="50%"
                        cy="45%"
                        innerRadius="50%"
                        outerRadius="80%"
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {policyBreakdownAi.map((item, i) => (
                          <Cell key={`ai-cell-${i}`} fill={item.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(v) => [`${v}건`, "판정"]}
                        contentStyle={{
                          background: "var(--bg-card)",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-main)",
                          fontSize: "13px",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={80}
                        content={() => (
                          <ul className="legend-list">
                            {policyBreakdownAi.map((item) => (
                              <li key={`ai-leg-${item.name}`} className="legend-item">
                                <span className="legend-name">
                                  <span
                                    className="legend-dot"
                                    style={{ background: item.color }}
                                  />
                                  {item.name}
                                </span>
                                <strong style={{ color: item.color }}>
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
                  <div className="empty-state">판정 기록이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card dashboard-card card-fill">
          <div className="card-header">
            <div>
              <h3 className="card-title text-warning">
                AI 탐지 도메인 (위험/의심)
              </h3>
              <p className="card-subtitle">AI 엔진이 판별한 도메인</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/ai-policies")}
              className="btn-action btn-neutral btn-w-lg"
            >
              AI 탐지 도메인
            </button>
          </div>
          <div className="list-stack">
            {topAiSuspicious.length > 0 ? (
              topAiSuspicious.map((item, idx) => (
                <div
                  key={`ai-${item.domain}-${idx}`}
                  onClick={() =>
                    navigate(
                      `/ai-policies?domain=${encodeURIComponent(item.domain)}`,
                    )
                  }
                  className="list-row is-clickable"
                >
                  <span className="list-row-title">{item.domain}</span>
                  <span
                    className="status-badge badge-warning"
                    style={
                      item.color
                        ? { color: item.color, backgroundColor: item.bgColor }
                        : undefined
                    }
                  >
                    {item.status_text}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-state">탐지된 도메인이 없습니다.</div>
            )}
          </div>
        </div>
      </div>

      {showConfigModal && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3 className="dialog-title">인증 정책 설정</h3>
            <div className="auth-form">
              <div className="form-group">
                <label className="form-label">
                  정규 출근 시간
                  <span className="form-hint">(최초 1회 인증)</span>
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
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  정규 퇴근 시간
                  <span className="form-hint">(유휴 상태 감지 활성화)</span>
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
                />
              </div>
              <div className="form-group">
                <label className="form-label">유휴 대기 허용 시간 (분)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  className="custom-input"
                  value={idleMinutes}
                  onChange={(e) => setIdleMinutes(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="btn-action btn-neutral btn-w-md btn-header"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="btn-action btn-primary btn-w-md btn-header"
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
