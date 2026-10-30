import { useState } from "react";

const Home = ({ user }) => {
  const [activeTab, setActiveTab] = useState("intro");
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [newPost, setNewPost] = useState({
    title: "",
    author: user?.name || "",
    content: "",
  });
  const [showWriteModal, setShowWriteModal] = useState(false);

  const notices = [
    {
      id: 2,
      tag: "정책",
      tagColor: "#0284c7",
      title: "2026년 하반기 사내망(192.168.2.x) 캡티브 포털 인증 의무화",
      date: "2026-10-18",
      writer: "네트워크보안팀",
      views: 518,
      content:
        "사내 모든 임직원 단말은 사원망 접속 시 최초 캡티브 포털 인증을 거쳐야 하며, 미인증 단말 및 인가되지 않은 MAC 주소(MAC Spoofing) 탐지 시 즉각 물리적 격리가 수행됩니다.",
    },
    {
      id: 3,
      tag: "시스템",
      tagColor: "#10b981",
      title:
        "VirusTotal CTI 위협 인텔리전스 연동 및 DB 로그 5년 보관 정책 적용",
      date: "2026-10-15",
      writer: "시스템관리자",
      views: 289,
      content:
        "글로벌 위협 인텔리전스(CTI) 연동을 통해 악성 평점 기반 자동 차단이 적용되었으며, 모든 위협 탐지 로그와 정책 이력은 사내 보안 규정에 따라 5년간 보관 후 자동 파기됩니다.",
    },
    {
      id: 4,
      tag: "안내",
      tagColor: "#f59e0b",
      title: "임직원 단말 보안 건전성 점수(Security Score) 산정 기준 안내",
      date: "2026-10-10",
      writer: "보안관제팀",
      views: 410,
      content:
        "단말 보안 건전성은 기본 100점 만점 기준으로 유해 사이트 차단 횟수, MAC 변조 여부를 종합하여 AI 보안 어드바이저가 실시간 산출합니다.",
    },
  ];

  const [posts, setPosts] = useState([
    {
      id: 1,
      category: "질문",
      title: "사내망 고정 IP 변경 신청은 어느 부서로 해야 하나요?",
      author: "개발1팀 김민수",
      date: "2026-10-22",
      comments: 2,
      content:
        "개발 테스트용 리눅스 워크스테이션을 추가 배정받았는데, IP-MAC 바인딩 등록 절차가 궁금합니다.",
    },
    {
      id: 2,
      category: "팁",
      title: "해외 기술 문서 사이트 접속 시 오탐 차단 해제 요청 방법",
      author: "인프라팀 박지훈",
      date: "2026-10-20",
      comments: 5,
      content:
        "업무상 필요한 도메인이 차단 정책에 걸릴 경우, 사번과 접속 사유를 적어 보안관제팀에 화이트리스트 등록을 요청하시면 빠르게 처리됩니다.",
    },
    {
      id: 3,
      category: "자유",
      title: "통합 보안 관제 대시보드 다크모드 UI 깔끔하네요!",
      author: "기획팀 이서연",
      date: "2026-10-17",
      comments: 8,
      content:
        "새로 개편된 플랫폼 반응 속도도 빠르고 실시간 차단 현황이 한눈에 보여서 훨씬 안심됩니다.",
    },
  ]);

  const resources = [
    {
      id: 1,
      icon: "📘",
      category: "매뉴얼",
      title: "SecureTech 사내망 캡티브 포털 및 단말 인증 가이드.pdf",
      size: "2.4 MB",
      date: "2026-10-20",
      desc: "신규 입사자 및 임직원을 위한 사내망(192.168.2.x) 최초 접속 인증 및 IP/MAC 등록 절차 안내서입니다.",
    },
    {
      id: 2,
      icon: "🛡️",
      category: "보안교안",
      title: "피싱 도메인 침해사고 예방 교육자료.pdf",
      size: "5.1 MB",
      date: "2026-10-15",
      desc: "악성코드 감염 시 발생하는 통신 원리와 사내 패킷 관제 시스템의 TCP RST 차단 메커니즘을 설명합니다.",
    },
    {
      id: 3,
      icon: "⚙️",
      category: "에이전트",
      title: "SecureTech_Endpoint_Agent_v2.4_Setup.exe",
      size: "14.8 MB",
      date: "2026-10-12",
      desc: "사내 표준 단말 무결성 점검 및 실시간 네트워크 인터페이스 보호를 위한 필수 보안 에이전트입니다.",
    },
    {
      id: 4,
      icon: "🔑",
      category: "정책문서",
      title: "정보보안 감사 로그 및 개인정보 5년 보관·파기 규정집.docx",
      size: "1.1 MB",
      date: "2026-10-05",
      desc: "차단 정책 이력 및 위협 탐지 로그의 5년 보존 주기와 안전한 자동 파기 절차에 관한 사내 규정 문서입니다.",
    },
  ];

  const handleAddPost = (e) => {
    e.preventDefault();
    if (!newPost.title || !newPost.author || !newPost.content) return;
    setPosts([
      {
        id: Date.now(),
        category: "일반",
        title: newPost.title,
        author: newPost.author,
        date: "2026-10-23",
        comments: 0,
        content: newPost.content,
      },
      ...posts,
    ]);
    setNewPost({ title: "", author: user?.name || "", content: "" });
    setShowWriteModal(false);
  };

  return (
    <div className="st-home-wrapper">
      <style>{`
        .st-home-wrapper { color: var(--text-main); padding-bottom: 60px; }
        .st-subnav { display: flex; justify-content: center; gap: 42px; background-color: var(--bg-card); border-bottom: 1px solid var(--border-color); margin: -20px -20px 28px -20px; padding: 0 20px; box-shadow: var(--shadow-sm); }
        .st-subnav-item { padding: 14px 4px; font-size: 14px; font-weight: 600; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .st-subnav-item:hover { color: var(--text-title); }
        .st-subnav-item.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
        .st-hero-card { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 48px 40px 36px; box-shadow: var(--shadow-md); text-align: center; }
        body.dark-mode .st-hero-card { background: linear-gradient(180deg, #162033 0%, #0f172a 100%); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35); }
        .st-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.3); color: var(--color-primary); font-size: 12px; font-weight: 600; margin-bottom: 20px; }
        .st-hero-title { font-size: 34px; font-weight: 800; color: var(--text-title); line-height: 1.35; margin: 0 0 18px; letter-spacing: -0.5px; }
        .st-hero-title span { color: var(--color-primary); }
        .st-hero-desc { font-size: 14.5px; color: var(--text-muted); max-width: 720px; margin: 0 auto 38px; line-height: 1.65; }
        .st-metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: left; }
        .st-metric-box { background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; transition: transform 0.2s, border-color 0.2s; }
        .st-metric-box:hover { transform: translateY(-2px); border-color: var(--color-primary); }
        .st-metric-label { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }
        .st-metric-val { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
        .st-metric-sub { font-size: 11.5px; color: var(--text-muted); opacity: 0.85; }
        .st-section-title { font-size: 18px; font-weight: 700; color: var(--text-title); margin: 36px 0 16px; display: flex; align-items: center; gap: 8px; }
        .st-arch-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .st-arch-card { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 22px; box-shadow: var(--shadow-sm); }
        .st-arch-icon { font-size: 24px; margin-bottom: 12px; }
        .st-arch-name { font-size: 15px; font-weight: 700; color: var(--text-title); margin-bottom: 8px; }
        .st-arch-desc { font-size: 12.5px; color: var(--text-muted); line-height: 1.55; }
        .st-bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 28px; }
        .st-panel { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 24px; box-shadow: var(--shadow-sm); }
        .st-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color); }
        .st-panel-title { font-size: 16px; font-weight: 700; color: var(--text-title); }
        .st-more-btn { font-size: 12px; color: var(--color-primary); background: none; border: none; cursor: pointer; font-weight: 600; }
        .st-list-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color); font-size: 13.5px; cursor: pointer; }
        .st-list-item:last-child { border-bottom: none; }
        .st-list-item:hover .st-item-title { color: var(--color-primary); }
        .st-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 10px; color: #fff; }
        .st-board-card { background-color: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 32px; box-shadow: var(--shadow-md); }
        .st-detail-box { background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-top: 16px; }
        .st-res-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px; }
        .st-res-card { background-color: var(--bg-main); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        @media (max-width: 900px) {
          .st-metrics-grid, .st-arch-grid, .st-bottom-grid, .st-res-grid { grid-template-columns: 1fr; }
          .st-subnav { gap: 16px; margin: -16px -12px 20px -12px; }
        }
      `}</style>

      <div className="st-subnav">
        <div
          className={`st-subnav-item ${activeTab === "intro" ? "active" : ""}`}
          onClick={() => setActiveTab("intro")}
        >
          플랫폼 소개
        </div>
        <div
          className={`st-subnav-item ${activeTab === "notice" ? "active" : ""}`}
          onClick={() => setActiveTab("notice")}
        >
          공지사항
        </div>
        <div
          className={`st-subnav-item ${activeTab === "community" ? "active" : ""}`}
          onClick={() => setActiveTab("community")}
        >
          사내 커뮤니티
        </div>
        <div
          className={`st-subnav-item ${activeTab === "resources" ? "active" : ""}`}
          onClick={() => setActiveTab("resources")}
        >
          보안 자료실
        </div>
      </div>

      <div className="page-container">
        {activeTab === "intro" && (
          <>
            <div className="st-hero-card">
              <div className="st-badge">
                ⚡ Enterprise Security &amp; Zero-Trust Architecture
              </div>
              <h1 className="st-hero-title">
                보안의 경계를 넘어서는 지능형 패킷 관제
                <br />
                <span>SecureTech</span> 통합 보안 플랫폼
              </h1>
              <p className="st-hero-desc">
                사내 임직원 단말의 네트워크 세션을 실시간으로 스니핑하고, 비인가
                접근 시 0.01초 이내에 TCP RST 패킷 인젝션 및 캡티브 포털
                리다이렉트를 수행하여 내부 정보 유출과 외부 해킹 위협을
                방어합니다.
              </p>

              <div className="st-metrics-grid">
                <div className="st-metric-box">
                  <div className="st-metric-label">패킷 차단 응답속도</div>
                  <div
                    className="st-metric-val"
                    style={{ color: "var(--color-primary)" }}
                  >
                    &lt; 0.01 sec
                  </div>
                  <div className="st-metric-sub">
                    Raw Socket TCP RST 즉시 격리
                  </div>
                </div>
                <div className="st-metric-box">
                  <div className="st-metric-label">보안 관제 가동률</div>
                  <div
                    className="st-metric-val"
                    style={{ color: "var(--color-success)" }}
                  >
                    99.98 %
                  </div>
                  <div className="st-metric-sub">
                    24/365 무중단 Libpcap 스니핑
                  </div>
                </div>
                <div className="st-metric-box">
                  <div className="st-metric-label">평균 일일 패킷 분석량</div>
                  <div
                    className="st-metric-val"
                    style={{ color: "var(--text-title)" }}
                  >
                    1.42 M+
                  </div>
                  <div className="st-metric-sub">
                    HTTP/DNS 호스트 정밀 필터링
                  </div>
                </div>
                <div className="st-metric-box">
                  <div className="st-metric-label">사내망 비인가 단말 통제</div>
                  <div className="st-metric-val" style={{ color: "#f59e0b" }}>
                    100 %
                  </div>
                  <div className="st-metric-sub">
                    Iptables &amp; 캡티브 포털 연동
                  </div>
                </div>
              </div>
            </div>

            <div className="st-section-title">🛡️ 핵심 보안 아키텍처</div>
            <div className="st-arch-grid">
              <div className="st-arch-card">
                <div className="st-arch-icon">📡</div>
                <div className="st-arch-name">
                  실시간 패킷 스니핑 &amp; 제어
                </div>
                <div className="st-arch-desc">
                  C 기반 Libpcap 엔진으로 사내망 트래픽을 감시하고 비인가 세션에
                  TCP RST 패킷을 즉각 인젝션합니다.
                </div>
              </div>
              <div className="st-arch-card">
                <div className="st-arch-icon">🔒</div>
                <div className="st-arch-name">L2 MAC 스푸핑 물리 격리</div>
                <div className="st-arch-desc">
                  인가된 IP와 실제 L2 MAC 주소의 바인딩을 대조하여 위변조 탐지
                  시 네트워크를 즉시 격리(Drop)합니다.
                </div>
              </div>
              <div className="st-arch-card">
                <div className="st-arch-icon">🌍</div>
                <div className="st-arch-name">CTI 위협 인텔리전스 연동</div>
                <div className="st-arch-desc">
                  VirusTotal CTI 평점 분석과 Discord 웹훅 연동을 통해 악성
                  도메인 자동 차단 및 실시간 경보를 수행합니다.
                </div>
              </div>
            </div>

            <div className="st-bottom-grid">
              <div className="st-panel">
                <div className="st-panel-header">
                  <div className="st-panel-title">📌 최근 보안 공지사항</div>
                  <button
                    className="st-more-btn"
                    onClick={() => setActiveTab("notice")}
                  >
                    전체보기 →
                  </button>
                </div>
                {notices.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    className="st-list-item"
                    onClick={() => {
                      setSelectedNotice(n);
                      setActiveTab("notice");
                    }}
                  >
                    <div>
                      <span
                        className="st-tag"
                        style={{ background: n.tagColor }}
                      >
                        {n.tag}
                      </span>
                      <span className="st-item-title">{n.title}</span>
                    </div>
                    <span className="cell-time">{n.date}</span>
                  </div>
                ))}
              </div>

              <div className="st-panel">
                <div className="st-panel-header">
                  <div className="st-panel-title">📂 필수 보안 자료실</div>
                  <button
                    className="st-more-btn"
                    onClick={() => setActiveTab("resources")}
                  >
                    전체보기 →
                  </button>
                </div>
                {resources.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="st-list-item"
                    onClick={() => setActiveTab("resources")}
                  >
                    <div>
                      <span style={{ marginRight: "8px" }}>{r.icon}</span>
                      <span className="st-item-title">{r.title}</span>
                    </div>
                    <span className="cell-time">{r.size}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "notice" && (
          <div className="st-board-card">
            <div className="card-header">
              <div>
                <h2 className="page-title">📌 보안 공지사항</h2>
                <p className="page-subtitle">
                  사내 네트워크 통제 정책 및 보안 관제 시스템 업데이트 소식을
                  안내합니다.
                </p>
              </div>
            </div>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>구분</th>
                    <th style={{ textAlign: "left" }}>제목</th>
                    <th style={{ width: "130px" }}>작성부서</th>
                    <th style={{ width: "120px" }}>등록일</th>
                    <th style={{ width: "90px" }}>조회</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedNotice(n)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <span
                          className="st-tag"
                          style={{ background: n.tagColor, marginRight: 0 }}
                        >
                          {n.tag}
                        </span>
                      </td>
                      <td style={{ textAlign: "left", fontWeight: 600 }}>
                        {n.title}
                      </td>
                      <td>{n.writer}</td>
                      <td className="cell-time">{n.date}</td>
                      <td className="cell-time">{n.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedNotice && (
              <div className="st-detail-box">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <strong
                    style={{ color: "var(--color-primary)", fontSize: "15px" }}
                  >
                    [{selectedNotice.tag}] {selectedNotice.title}
                  </strong>
                  <button
                    onClick={() => setSelectedNotice(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    ✕ 닫기
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "13.5px",
                    color: "var(--text-main)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {selectedNotice.content}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "community" && (
          <div className="st-board-card">
            <div className="card-header">
              <div>
                <h2 className="page-title">💬 사내 보안 커뮤니티</h2>
                <p className="page-subtitle">
                  단말 인증 문의, 오탐 차단 해제 요청 및 보안 팁을 자유롭게
                  공유하세요.
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => setShowWriteModal(!showWriteModal)}
              >
                {showWriteModal ? "작성 취소" : "+ 게시글 작성"}
              </button>
            </div>
            {showWriteModal && (
              <form
                onSubmit={handleAddPost}
                className="st-detail-box"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    className="custom-input"
                    placeholder="작성자 (예: 개발팀 홍길동)"
                    value={newPost.author}
                    onChange={(e) =>
                      setNewPost({ ...newPost, author: e.target.value })
                    }
                    style={{ width: "220px" }}
                  />
                  <input
                    className="custom-input"
                    placeholder="제목을 입력하세요"
                    value={newPost.title}
                    onChange={(e) =>
                      setNewPost({ ...newPost, title: e.target.value })
                    }
                    style={{ flex: 1 }}
                  />
                </div>
                <textarea
                  className="custom-input"
                  placeholder="내용을 입력하세요"
                  rows={3}
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({ ...newPost, content: e.target.value })
                  }
                />
                <div style={{ textAlign: "right" }}>
                  <button type="submit" className="btn-primary">
                    등록하기
                  </button>
                </div>
              </form>
            )}
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>분류</th>
                    <th style={{ textAlign: "left" }}>제목</th>
                    <th style={{ width: "160px" }}>작성자</th>
                    <th style={{ width: "120px" }}>작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPost(p)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <span className="badge badge-gray">{p.category}</span>
                      </td>
                      <td style={{ textAlign: "left", fontWeight: 600 }}>
                        {p.title}{" "}
                        <span
                          style={{
                            color: "var(--color-primary)",
                            fontSize: "12px",
                          }}
                        >
                          [{p.comments}]
                        </span>
                      </td>
                      <td>{p.author}</td>
                      <td className="cell-time">{p.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedPost && (
              <div className="st-detail-box">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <strong
                    style={{ color: "var(--color-primary)", fontSize: "15px" }}
                  >
                    {selectedPost.title} ({selectedPost.author})
                  </strong>
                  <button
                    onClick={() => setSelectedPost(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    ✕ 닫기
                  </button>
                </div>
                <p
                  style={{
                    fontSize: "13.5px",
                    color: "var(--text-main)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {selectedPost.content}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "resources" && (
          <div className="st-board-card">
            <div className="card-header">
              <div>
                <h2 className="page-title">📂 사내 보안 자료실</h2>
                <p className="page-subtitle">
                  사내망 접속 매뉴얼, 보안 에이전트 및 정보보안 규정 문서를
                  다운로드할 수 있습니다.
                </p>
              </div>
            </div>
            <div className="st-res-grid">
              {resources.map((r) => (
                <div key={r.id} className="st-res-card">
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--color-primary)",
                        fontWeight: 700,
                        marginBottom: "4px",
                      }}
                    >
                      {r.icon} {r.category} · {r.size}
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--text-title)",
                        marginBottom: "8px",
                      }}
                    >
                      {r.title}
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: "var(--text-muted)",
                        lineHeight: 1.5,
                      }}
                    >
                      {r.desc}
                    </div>
                  </div>
                  <button
                    className="btn-primary"
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                    onClick={() =>
                      alert(`[${r.title}] 파일 다운로드를 시작합니다.`)
                    }
                  >
                    다운로드
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
