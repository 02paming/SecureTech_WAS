import { useState } from "react";
import { appAlert } from "../utils/appDialog";

const FLOW_STEPS = [
  {
    name: "트래픽 감시",
    desc: "L3 스위치가 미러링한 패킷에서 C 기반 Libpcap 엔진이 HTTP 접속의 목적지를 확인합니다.",
  },
  {
    name: "정책 대조",
    desc: "관리자가 등록한 허용·차단 정책과 먼저 비교합니다. 의심 등급은 AI 의심으로 따로 집계합니다.",
  },
  {
    name: "AI 위협 분석",
    desc: "수동 정책에 없는 도메인은 접속할 때 AI 엔진이 위협 점수로 안전, 의심, 위험을 판정합니다.",
  },
  {
    name: "조치와 기록",
    desc: "차단 세션은 TCP RST로 끊고, MAC 스푸핑은 Discord와 Slack으로 경보하며, 접속 로그는 5년간 보관합니다.",
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
        "보안 건전성은 기본 100점 만점 기준으로 최근 30일 활동 중 차단·의심 통과 비율과 MAC 스푸핑 여부를 종합하여 보안 어드바이저가 실시간 산출합니다.",
    },
    {
      id: 5,
      tag: "정책",
      tagTone: "primary",
      title: "AI 판정 기준 분기별 재조정 완료 안내",
      date: "2026-10-05",
      writer: "보안관제팀",
      views: 342,
      content:
        "최근 3개월간 오탐·미탐 통계를 반영하여 화이트 의심·블랙 의심 임계점수를 재조정했습니다. 세부 기준은 AI 모델 성능 화면에서 확인할 수 있습니다.",
    },
    {
      id: 6,
      tag: "시스템",
      tagTone: "success",
      title: "관제 대시보드 실시간 집계 주기 1분 단위로 개선",
      date: "2026-09-28",
      writer: "개발팀",
      views: 276,
      content:
        "기존 5분 단위로 갱신되던 대시보드 집계 주기를 1분 단위로 단축하여 위협 탐지 대응 속도를 높였습니다.",
    },
    {
      id: 7,
      tag: "안내",
      tagTone: "warning",
      title: "연휴 기간 보안관제 비상연락망 안내",
      date: "2026-09-20",
      writer: "총무팀",
      views: 195,
      content:
        "연휴 기간 중 긴급 차단 해제나 오탐 신고가 필요한 경우 사내 비상연락망을 통해 보안관제팀 당직자에게 연락해 주시기 바랍니다.",
    },
    {
      id: 8,
      tag: "정책",
      tagTone: "primary",
      title: "화이트리스트 등록 신청 절차 간소화 안내",
      date: "2026-09-15",
      writer: "네트워크보안팀",
      views: 301,
      content:
        "사번과 접속 사유만으로 신청 가능하도록 화이트리스트 등록 절차를 간소화했습니다. 처리 기한도 영업일 2일 이내로 단축됩니다.",
    },
    {
      id: 9,
      tag: "시스템",
      tagTone: "success",
      title: "OTP 2단계 인증 전사 의무화 적용",
      date: "2026-09-08",
      writer: "보안관제팀",
      views: 458,
      content:
        "관리자 포털뿐 아니라 전 임직원 로그인에 구글 OTP 2단계 인증이 의무 적용됩니다. 최초 로그인 시 QR 코드로 간편하게 등록할 수 있습니다.",
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
    {
      id: 4,
      category: "질문",
      title: "재택근무 시 VPN 접속도 동일하게 관제되나요?",
      author: "인사팀 최유라",
      date: "2026-10-12",
      comments: 3,
      content:
        "재택 전환 인원이 늘면서 VPN 구간도 사내망과 동일하게 AI 판정이 적용되는지 궁금합니다.",
    },
    {
      id: 5,
      category: "팁",
      title: "MAC 주소 변경 경고 메시지 받았을 때 대처법",
      author: "IT지원팀 정우성",
      date: "2026-10-08",
      comments: 6,
      content:
        "단말 교체나 네트워크 카드 드라이버 재설치 후에도 뜰 수 있으니, 먼저 IT지원팀에 자산 변경 등록부터 요청해 주세요.",
    },
    {
      id: 6,
      category: "자유",
      title: "AI 모델 성능 꾸준히 올라가는거 보기 좋네요",
      author: "보안관제팀 한지민",
      date: "2026-10-03",
      comments: 4,
      content:
        "버전 올라갈 때마다 정밀도·재현율이 같이 개선되고 있어서 오탐 신고도 눈에 띄게 줄었습니다.",
    },
    {
      id: 7,
      category: "질문",
      title: "신규 입사자 사번 부여까지 얼마나 걸리나요?",
      author: "인사팀 김도윤",
      date: "2026-09-25",
      comments: 2,
      content:
        "가입 승인 완료 후 바로 사번이 자동 부여된다고 들었는데 실제로는 언제부터 사내망 접속이 가능한가요?",
    },
    {
      id: 8,
      category: "팁",
      title: "해외 출장 중 접속 차단될 때 임시 허용 요청 방법",
      author: "해외영업팀 서준혁",
      date: "2026-09-18",
      comments: 7,
      content:
        "출장지 IP가 블랙 의심으로 잡히는 경우가 종종 있는데, 출장 일정과 함께 사전 신고하면 임시로 화이트 처리해 줍니다.",
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
    {
      id: 5,
      category: "가이드",
      title: "AI 탐지 도메인 오탐 신고 및 처리 절차 안내서.pdf",
      size: "1.8 MB",
      date: "2026-09-28",
      desc: "AI 엔진이 정상 도메인을 의심으로 오판정했을 때 신고하고 화이트리스트로 전환하는 절차를 설명합니다.",
    },
    {
      id: 6,
      category: "정책문서",
      title: "비인가 단말 네트워크 접근 통제(NAC) 운영 지침.docx",
      size: "890 KB",
      date: "2026-09-20",
      desc: "사내망 MAC 바인딩 및 캡티브 포털 인증 미완료 단말에 대한 접근 통제 운영 기준을 정리한 문서입니다.",
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
                    차단 정책에 걸린 세션은 TCP RST로 즉시 끊습니다. 수동 정책에 없는
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
                    <th className="col-cat" style={{ width: "90px" }}>구분</th>
                    <th className="th-main">제목</th>
                    <th className="col-hide-mobile" style={{ width: "130px" }}>작성자</th>
                    <th className="col-date" style={{ width: "120px" }}>작성일</th>
                    <th className="col-hide-mobile" style={{ width: "90px" }}>조회</th>
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
                      <td className="col-hide-mobile">{n.writer}</td>
                      <td className="cell-time">{n.date}</td>
                      <td className="cell-time col-hide-mobile">{n.views}</td>
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
                    <th className="col-cat" style={{ width: "90px" }}>구분</th>
                    <th className="th-main">제목</th>
                    <th className="col-hide-mobile" style={{ width: "160px" }}>작성자</th>
                    <th className="col-date" style={{ width: "120px" }}>작성일</th>
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
                      <td className="col-hide-mobile">{p.author}</td>
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
                      appAlert(`[${r.title}] 파일 다운로드를 시작합니다.`)
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
