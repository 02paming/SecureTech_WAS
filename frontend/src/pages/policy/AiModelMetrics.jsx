import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { API_BASE_URL } from "../../api";
import AdminAuthDialog from "../../components/AdminAuthDialog";
import PageHeader from "../../components/PageHeader";
import PaginationBar from "../../components/PaginationBar";
import { padRows } from "../../utils/table";

const SERIES = [
  { key: "accuracy", label: "정확도", color: "var(--series-1)" },
  { key: "precision", label: "정밀도", color: "var(--series-2)" },
  { key: "f1_score", label: "F1 스코어", color: "var(--series-3)" },
];

const formatPercent = (value) =>
  value === null || value === undefined ? "-" : `${Number(value).toFixed(2)}%`;

const getRecall = (m) => {
  const total = m.tp_count + m.fn_count;
  return total > 0 ? (m.tp_count / total) * 100 : null;
};

function MatrixCell({ code, label, value, total }) {
  const share = total > 0 ? value / total : 0;
  return (
    <div
      className="matrix-cell"
      style={{ backgroundColor: `rgba(14, 165, 233, ${0.06 + share * 0.5})` }}
    >
      <span className="matrix-code">{code}</span>
      <strong className="matrix-value">{value.toLocaleString()}</strong>
      <span className="matrix-label">{label}</span>
    </div>
  );
}

const AiModelMetrics = () => {
  const [metrics, setMetrics] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  const [whiteStart, setWhiteStart] = useState(31);
  const [blackStart, setBlackStart] = useState(51);
  const [blockStart, setBlockStart] = useState(71);
  const [authRequest, setAuthRequest] = useState(null);

  const baseUrl = API_BASE_URL;

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${baseUrl}/api/policies/ai/metrics/`);
      setMetrics(res.data.metrics || []);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    } catch (err) {
      console.error("AI 모델 성능 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const fetchThresholds = useCallback(async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/policies/ai/thresholds/`);
      if (res.data.status === "success") {
        setWhiteStart(res.data.white_start);
        setBlackStart(res.data.black_start);
        setBlockStart(res.data.block_start);
      }
    } catch (err) {
      console.error("기준 점수 로드 실패:", err);
    }
  }, [baseUrl]);

  const openThresholdAuth = () => {
    const white = Number(whiteStart);
    const black = Number(blackStart);
    const block = Number(blockStart);
    if (!(white > 0 && white < black && black < block && block <= 100)) {
      alert("화이트 의심 < 블랙 의심 < 차단 순서로, 1~100 사이에서 입력해 주세요.");
      return;
    }
    setAuthRequest({ type: "thresholds" });
  };

  const handleActivateModel = (e, versionName) => {
    e.stopPropagation(); // 행 선택 이벤트 버블링 방지
    setAuthRequest({ type: "model", versionName });
  };

  const submitAuth = async (credentials) => {
    const isModel = authRequest.type === "model";
    try {
      const res = isModel
        ? await axios.post(`${baseUrl}/api/policies/ai/activate/`, {
            version_name: authRequest.versionName,
            ...credentials,
          })
        : await axios.post(`${baseUrl}/api/policies/ai/thresholds/`, {
            white_start: Number(whiteStart),
            black_start: Number(blackStart),
            block_start: Number(blockStart),
            ...credentials,
          });
      alert(res.data.message);
      setAuthRequest(null);
      if (isModel) fetchMetrics();
      else fetchThresholds();
    } catch (err) {
      alert(err.response?.data?.message || "처리에 실패했습니다.");
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchThresholds();
  }, [fetchMetrics, fetchThresholds]);

  const current =
    metrics.find((m) => m.version_name === selectedVersion) ||
    metrics.find((m) => m.is_active) ||
    metrics[metrics.length - 1];

  const yMin = useMemo(() => {
    const values = metrics.flatMap((m) => SERIES.map((s) => m[s.key]));
    return values.length ? Math.max(0, Math.floor(Math.min(...values)) - 2) : 0;
  }, [metrics]);

  const newestFirst = useMemo(() => [...metrics].reverse(), [metrics]);
  const totalPages = Math.ceil(newestFirst.length / itemsPerPage) || 1;
  const tableRows = padRows(
    newestFirst.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    ),
    itemsPerPage,
  );

  const matrixTotal = current
    ? current.tp_count + current.tn_count + current.fp_count + current.fn_count
    : 0;
  const hyperparameters = Object.entries(current?.hyperparameters || {});

  return (
    <div className="page-container admin-page">
      {authRequest && (
        <AdminAuthDialog
          title={authRequest.type === "model" ? "AI 모델 가동 전환 인증" : "AI 판별 기준 변경 인증"}
          target={authRequest.type === "model" ? authRequest.versionName : "AI 판별 기준"}
          onSubmit={submitAuth}
          onCancel={() => setAuthRequest(null)}
        />
      )}

      <PageHeader
        title="AI 모델 성능 현황"
        subtitle="학습된 탐지 모델의 버전별 성능 지표와 판별 결과를 확인합니다."
        lastUpdated={lastUpdated}
        onRefresh={fetchMetrics}
        refreshing={loading}
      >
        <div className="threshold-form">
          <label className="text-score-yellow">
            화이트 의심 (이상)
            <input type="number" min="1" max="100" className="custom-input" value={whiteStart} onChange={(e) => setWhiteStart(e.target.value)} />
          </label>
          <label className="text-score-orange">
            블랙 의심 (이상)
            <input type="number" min="1" max="100" className="custom-input" value={blackStart} onChange={(e) => setBlackStart(e.target.value)} />
          </label>
          <label className="text-danger">
            차단 (이상)
            <input type="number" min="1" max="100" className="custom-input" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
          </label>
          <button type="button" onClick={openThresholdAuth} className="btn-action btn-success btn-w-sm btn-header">적용</button>
        </div>
      </PageHeader>

      <div className="stat-row">
        <div className="stat-card is-static">
          <div className="stat-label">정확도</div>
          <div className="stat-value">{formatPercent(current?.accuracy)}</div>
        </div>
        <div className="stat-card is-static">
          <div className="stat-label">정밀도</div>
          <div className="stat-value">{formatPercent(current?.precision)}</div>
        </div>
        <div className="stat-card is-static">
          <div className="stat-label">재현율 (계산값)</div>
          <div className="stat-value">
            {formatPercent(current ? getRecall(current) : null)}
          </div>
        </div>
        <div className="stat-card is-static">
          <div className="stat-label">F1 스코어</div>
          <div className="stat-value">{formatPercent(current?.f1_score)}</div>
        </div>
      </div>

      <div className="panel-row">
        <div className="panel-col card-fill-wide">
          <div className="card dashboard-card card-fill">
            <div className="card-header">
              <h3 className="card-title">버전별 성능 추이</h3>
            </div>
            <div className="chart-area">
              {metrics.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={metrics}
                    margin={{ top: 8, right: 24, left: -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
                    <XAxis dataKey="version_name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[yMin, 100]} unit="%" />
                    <RechartsTooltip
                      formatter={(value) => formatPercent(value)}
                      contentStyle={{ background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border-color)", color: "var(--text-main)" }}
                      itemStyle={{ color: "var(--text-main)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} formatter={(value) => <span className="text-main">{value}</span>} />
                    {SERIES.map((s) => (
                      <Line
                        key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                        dot={{ r: 4, fill: s.color, stroke: "var(--bg-card)", strokeWidth: 2 }}
                        activeDot={{ r: 6, stroke: "var(--bg-card)", strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">등록된 모델 성능 자료가 없습니다.</div>
              )}
            </div>
          </div>

          <div className="card dashboard-card card-fill card-auto">
            <div className="card-header">
              <h3 className="card-title">모델 버전 목록</h3>
              <span className="count-badge badge-primary">총 {metrics.length}건</span>
            </div>
            <div className="table-responsive table-fill">
              <table className="custom-table table-sm">
                <thead>
                  <tr>
                    <th>버전</th>
                    <th style={{ width: "170px" }}>학습 일시</th>
                    <th>정확도</th>
                    <th>정밀도</th>
                    <th>F1</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((m, idx) =>
                    m.isEmpty ? (
                      <tr key={`empty-${idx}`}><td colSpan="6">&nbsp;</td></tr>
                    ) : (
                      <tr
                        key={m.version_name}
                        onClick={() => setSelectedVersion(m.version_name)}
                        className={`row-clickable ${current?.version_name === m.version_name ? "row-selected" : ""}`}
                      >
                        <td className="fw-bold text-title">{m.version_name}</td>
                        <td>{m.trained_at}</td>
                        <td>{formatPercent(m.accuracy)}</td>
                        <td>{formatPercent(m.precision)}</td>
                        <td>{formatPercent(m.f1_score)}</td>
                        <td>
                          {m.is_active ? (
                            <span className="status-badge badge-success">가동 중</span>
                          ) : (
                            // 미가동 버튼 클릭 시 handleActivateModel 호출
                            <button
                              onClick={(e) => handleActivateModel(e, m.version_name)}
                              className="status-badge badge-gray"
                              style={{ border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "4px" }}
                              title="클릭하여 해당 모델 가동"
                            >
                              미가동
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>

        <div className="panel-col">
          <div className="card dashboard-card card-fill">
            <div className="card-header">
              <h3 className="card-title">판별 결과 (혼동 행렬)</h3>
              <span className="tag tag-primary">{current?.version_name || "-"}</span>
            </div>
            {current ? (
              <div className="matrix-grid">
                <span /><span className="matrix-head">예측: 성공</span><span className="matrix-head">예측: 실패</span>
                <span className="matrix-head">실제: 성공</span>
                <MatrixCell code="TP" label="정답" value={current.tp_count} total={matrixTotal} />
                <MatrixCell code="FN" label="오답" value={current.fn_count} total={matrixTotal} />
                <span className="matrix-head">실제: 실패</span>
                <MatrixCell code="FP" label="오답" value={current.fp_count} total={matrixTotal} />
                <MatrixCell code="TN" label="정답" value={current.tn_count} total={matrixTotal} />
              </div>
            ) : (
              <div className="empty-state">표시할 자료가 없습니다.</div>
            )}
          </div>

          <div className="card dashboard-card card-fill">
            <div className="card-header has-divider">
              <h3 className="card-title">모델 정보</h3>
              {current && (
                <span className={`status-badge ${current.is_active ? "badge-success" : "badge-gray"}`}>
                  {current.is_active ? "실서버 가동 중" : "실서버 미가동"}
                </span>
              )}
            </div>
            <div className="card-body-scroll">
              <div className="info-row is-compact"><span className="info-label">알고리즘</span><span className="info-value">{current?.model_algorithm || "-"}</span></div>
              <div className="info-row is-compact"><span className="info-label">학습 일시</span><span className="info-value">{current?.trained_at || "-"}</span></div>
              <div className="info-row is-compact"><span className="info-label">검증 건수</span><span className="info-value">{matrixTotal.toLocaleString()}건</span></div>
              <div className="info-row is-compact">
                <span className="info-label">튜닝 설정값</span>
                <div className="tag-list">
                  {hyperparameters.length > 0 ? hyperparameters.map(([key, value]) => (<span key={key} className="tag tag-mono">{key}: {String(value)}</span>)) : "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiModelMetrics;