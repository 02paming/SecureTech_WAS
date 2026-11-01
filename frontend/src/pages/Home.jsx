import { useState } from "react";

const FLOW_STEPS = [
  {
    name: "트래픽 감시",
    desc: "L3 스위치가 미러링한 패킷에서 C 기반 Libpcap 엔진이 HTTP 접속의 목적지를 확인합니다.",
  },
  {
    name: "정책 대조",
    desc: "허용·차단 정책과 비교합니다. 블랙 의심은 관리자 판단 전까지 통과시키고 따로 집계합니다.",
  },
  {
    name: "AI 위협 분석",
    desc: "미분류 도메인은 AI 엔진이 위협 점수를 매겨 안전, 의심, 위험으로 분류합니다.",
  },
  {
    name: "조치와 기록",
    desc: "차단 세션은 TCP RST로 끊고, MAC 변조는 Discord로 경보하며, 접속 로그는 5년간 보관합니다.",
  },
];

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
      tagTone: "primary",
      title: "2026년 하반기 사내망(192.168.2.x) 캡티브 포털 인증 의무화",
      date: "2026-10-18",
      writer: "네트워크보안팀",
      views: 518,
      content:
        "사내 모든 임직원 단말은 사원망 접속 시 최초 캡티브 포털 인증을 거쳐야 하며, 미인증 단말 및 인가되지 않은 MAC 주소(MAC Spoofing) 탐지 시 즉시 차단되고 관리자에게 경보가 전송됩니다.",
    },
    {
      id: 3,
      tag: "시스템",
      tagTone: "success",
      title:
        "DB 로그 5년 보관 정책 적용",
      date: "2026-10-15",
      writer: "시스템관리자",
      views: 289,
      content:
        "모든 위협 탐지 로그와 정책 이력은 사내 보안 규정에 따라 5년간 보관 후 자동 파기됩니다.",
    },
    {
      id: 4,
      tag: "안내",
      tagTone: "warning",
      title: "임직원 보안 건전성 점수 산정 기준 안내",
      date: "2026-10-10",
      writer: "보안관제팀",
      views: 410,
      content:
        "보안 건전성은 기본 100점 만점 기준으로 최근 30일 활동 중 차단·의심 통과 비율과 MAC 변조 여부를 종합하여 보안 어드바이저가 실시간 산출합니다.",
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
      category: "매뉴얼",
      title: "SecureTech 사내망 캡티브 포털 및 단말 인증 가이드.pdf",
      size: "2.4 MB",
      date: "2026-10-20",
      desc: "신규 입사자 및 임직원을 위한 사내망(192.168.2.x) 최초 접속 인증 및 IP/MAC 등록 절차 안내서입니다.",
    },
    {
      id: 2,
      category: "보안교안",
      title: "피싱 도메인 침해사고 예방 교육자료.pdf",
      size: "5.1 MB",
      date: "2026-10-15",
      desc: "악성코드 감염 시 발생하는 통신 원리와 사내 패킷 관제 시스템의 TCP RST 차단 메커니즘을 설명합니다.",
    },
    {
      id: 3,
      category: "에이전트",
      title: "SecureTech_Endpoint_Agent_v2.4_Setup.exe",
      size: "14.8 MB",
      date: "2026-10-12",
      desc: "사내 표준 단말 무결성 점검 및 실시간 네트워크 인터페이스 보호를 위한 필수 보안 에이전트입니다.",
    },
    {
      id: 4,
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
        date: new Date().toLocaleDateString("sv-SE"),
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
              <div className="st-hero-grid">
                <div className="st-hero-main">
                  <div className="st-badge">사내망 통합 보안 관제</div>
                  <h1 className="st-hero-title">
                    사내망 접속을 실시간으로 판단하고 차단하는
                    <br />
                    <span>SecureTech</span> 통합 보안 플랫폼
                  </h1>
                  <p className="st-hero-desc">
                    L3 스위치가 미러링한 사내망 HTTP 접속을 실시간으로 감시하고,
                    차단 정책에 걸린 세션은 TCP RST로 즉시 끊습니다. 미분류
                    도메인은 AI 엔진의 위협 점수로 판단해 정책에 자동으로
                    반영합니다.
                  </p>
                </div>

                <div className="st-metrics-grid">
                  <div className="st-metric-box">
                    <div className="st-metric-label">패킷 차단 응답속도</div>
                    <div className="st-metric-val text-primary">
                      &lt; 0.01 sec
                    </div>
                    <div className="st-metric-sub">
                      Raw Socket TCP RST 즉시 격리
                    </div>
                  </div>
                  <div className="st-metric-box">
                    <div className="st-metric-label">보안 관제 가동률</div>
                    <div className="st-metric-val text-success">99.98 %</div>
                    <div className="st-metric-sub">
                      24/365 무중단 Libpcap 스니핑
                    </div>
                  </div>
                  <div className="st-metric-box">
                    <div className="st-metric-label">평균 일일 패킷 분석량</div>
                    <div className="st-metric-val text-title">1.42 M+</div>
                    <div className="st-metric-sub">
                      HTTP 호스트 정밀 필터링
                    </div>
                  </div>
                  <div className="st-metric-box">
                    <div className="st-metric-label">
                      사내망 비인가 단말 통제
                    </div>
                    <div className="st-metric-val text-warning">100 %</div>
                    <div className="st-metric-sub">
                      Iptables &amp; 캡티브 포털 연동
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="st-section-title">접속 판정 흐름</div>
            <ol className="st-flow">
              {FLOW_STEPS.map((step, i) => (
                <li key={step.name} className="st-flow-step">
                  <div className="st-flow-no">{i + 1}단계</div>
                  <div className="st-arch-name">{step.name}</div>
                  <div className="st-arch-desc">{step.desc}</div>
                </li>
              ))}
            </ol>

            <div className="st-bottom-grid">
              <div className="st-panel">
                <div className="st-panel-header">
                  <div className="st-panel-title">최근 공지사항</div>
                  <button
                    type="button"
                    className="btn-action btn-neutral btn-w-sm"
                    onClick={() => setActiveTab("notice")}
                  >
                    전체보기
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
                    <div className="st-item-main">
                      <span className={`status-badge badge-${n.tagTone}`}>
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
                  <div className="st-panel-title">최근 게시글</div>
                  <button
                    type="button"
                    className="btn-action btn-neutral btn-w-sm"
                    onClick={() => setActiveTab("community")}
                  >
                    전체보기
                  </button>
                </div>
                {posts.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="st-list-item"
                    onClick={() => {
                      setSelectedPost(p);
                      setActiveTab("community");
                    }}
                  >
                    <div className="st-item-main">
                      <span className="status-badge badge-gray">{p.category}</span>
                      <span className="st-item-title">{p.title}</span>
                    </div>
                    <span className="cell-time">{p.date}</span>
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
                <h2 className="page-title">공지사항</h2>
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
                    <th className="th-main">제목</th>
                    <th style={{ width: "130px" }}>작성자</th>
                    <th style={{ width: "120px" }}>작성일</th>
                    <th style={{ width: "90px" }}>조회</th>
                  </tr>
                </thead>
                <tbody>
                  {notices.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedNotice(n)}
                      className="row-clickable"
                    >
                      <td>
                        <span className={`status-badge badge-${n.tagTone}`}>
                          {n.tag}
                        </span>
                      </td>
                      <td className="cell-main">{n.title}</td>
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
                <div className="info-box-row">
                  <strong className="info-box-title text-primary">
                    [{selectedNotice.tag}] {selectedNotice.title}
                  </strong>
                  <button
                    type="button"
                    className="btn-action btn-neutral btn-w-sm"
                    onClick={() => setSelectedNotice(null)}
                  >
                    닫기
                  </button>
                </div>
                <p className="st-detail-text">{selectedNotice.content}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "community" && (
          <div className="st-board-card">
            <div className="card-header">
              <div>
                <h2 className="page-title">사내 커뮤니티</h2>
                <p className="page-subtitle">
                  단말 인증 문의, 오탐 차단 해제 요청 및 보안 팁을 자유롭게
                  공유하세요.
                </p>
              </div>
              <button
                type="button"
                className="btn-action btn-primary btn-w-lg btn-header"
                onClick={() => setShowWriteModal(!showWriteModal)}
              >
                {showWriteModal ? "작성 취소" : "+ 게시글 작성"}
              </button>
            </div>
            {showWriteModal && (
              <form onSubmit={handleAddPost} className="st-detail-box dialog-form">
                <div className="toolbar-group">
                  <input
                    className="custom-input input-author"
                    placeholder="작성자 (예: 개발팀 홍길동)"
                    value={newPost.author}
                    onChange={(e) =>
                      setNewPost({ ...newPost, author: e.target.value })
                    }
                  />
                  <input
                    className="custom-input"
                    placeholder="제목을 입력하세요"
                    value={newPost.title}
                    onChange={(e) =>
                      setNewPost({ ...newPost, title: e.target.value })
                    }
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
                <div className="dialog-actions">
                  <button
                    type="submit"
                    className="btn-action btn-primary btn-w-md btn-header"
                  >
                    등록
                  </button>
                </div>
              </form>
            )}
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>구분</th>
                    <th className="th-main">제목</th>
                    <th style={{ width: "160px" }}>작성자</th>
                    <th style={{ width: "120px" }}>작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPost(p)}
                      className="row-clickable"
                    >
                      <td>
                        <span className="status-badge badge-gray">{p.category}</span>
                      </td>
                      <td className="cell-main">
                        {p.title}{" "}
                        <span className="text-primary">[{p.comments}]</span>
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
                <div className="info-box-row">
                  <strong className="info-box-title text-primary">
                    {selectedPost.title} ({selectedPost.author})
                  </strong>
                  <button
                    type="button"
                    className="btn-action btn-neutral btn-w-sm"
                    onClick={() => setSelectedPost(null)}
                  >
                    닫기
                  </button>
                </div>
                <p className="st-detail-text">{selectedPost.content}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "resources" && (
          <div className="st-board-card">
            <div className="card-header">
              <div>
                <h2 className="page-title">보안 자료실</h2>
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
                    <div className="st-res-meta">
                      {r.category} · {r.size}
                    </div>
                    <div className="st-res-title">{r.title}</div>
                    <div className="st-res-desc">{r.desc}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-action btn-primary btn-w-md btn-header"
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
