import { lazy, memo, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/600.css";
import "@fontsource/pretendard/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./App.css";
import api from "./api";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const CaptiveAuth = lazy(() => import("./pages/auth/CaptiveAuth"));
const EmployeeManage = lazy(() => import("./pages/employee/EmployeeManage"));
const EmployeeAuth = lazy(() => import("./pages/employee/EmployeeAuth"));
const SignupApproval = lazy(() => import("./pages/employee/SignupApproval"));
const MyPage = lazy(() => import("./pages/employee/MyPage"));
const Dashboard = lazy(() => import("./pages/policy/Dashboard"));
const PolicyManage = lazy(() => import("./pages/policy/PolicyManage"));
const AiPolicyManage = lazy(() => import("./pages/policy/AiPolicyManage"));
const LogAnalysis = lazy(() => import("./pages/policy/LogAnalysis"));
const TestLab = lazy(() => import("./pages/policy/TestLab"));

const DEV_MODE = true;

const checkIsManager = (u) => {
  if (!u) return false;
  return (
    u.is_manager === true ||
    String(u.is_manager) === "1" ||
    String(u.is_manager).toLowerCase() === "true" ||
    u.employee_id === "admin" ||
    u.emp_id === "admin"
  );
};

const NavigationBar = memo(function NavigationBar({
  user,
  setUser,
  isAdminPortal,
  toggleTheme,
  isDarkMode,
  layoutWidth,
  setLayoutWidth,
  isInternalAdminNetwork,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (["/login", "/admin-login", "/user-login"].includes(location.pathname))
    return null;

  const handleLogout = async () => {
    if (!window.confirm("로그아웃 하시겠습니까?")) return;
    try {
      if (user && (user.employee_id || user.emp_id))
        await api.post(`/api/auth/logout/`, {
          employee_id: user.employee_id || user.emp_id,
        });
    } catch (err) {
      console.error("로그아웃 실패:", err);
    } finally {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("adminPortalMode");
      setUser(null);
      alert("로그아웃되었습니다.");
      navigate(isInternalAdminNetwork ? "/admin-login" : "/", {
        replace: true,
      });
    }
  };

  const showAdminMenu = Boolean(
    DEV_MODE ||
    (user && checkIsManager(user) && (isInternalAdminNetwork || isAdminPortal)),
  );

  return (
    <div className="navbar">
      <div className="mobile-header-bar">
        <Link to="/" className="m-logo">
          SecureTech
        </Link>
        <button
          className="m-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? "닫기" : "메뉴"}
        </button>
      </div>

      <div className="desktop-header-bar">
        <div className="nav-left-group">
          <Link to="/" className="nav-logo">
            SecureTech
          </Link>
        </div>

        {/* 메뉴 영역만 중앙으로 강제 분리 */}
        <nav className="nav-links">
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            홈
          </NavLink>
          {showAdminMenu && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                관제 대시보드
              </NavLink>
              <NavLink
                to="/log-analysis"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                로그 분석실
              </NavLink>
              <NavLink
                to="/employee-auth"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                사원 인증 현황
              </NavLink>
              <NavLink
                to="/policies"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                차단 정책 관리
              </NavLink>
              <NavLink
                to="/ai-policies"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                AI 차단 현황 관리
              </NavLink>
              <NavLink
                to="/approvals"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                가입 승인
              </NavLink>
              <NavLink
                to="/employees"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                사원 관리
              </NavLink>
              <NavLink
                to="/test-lab"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                보안 테스트실
              </NavLink>
            </>
          )}
          {user && (
            <NavLink
              to="/mypage"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              마이페이지
            </NavLink>
          )}
        </nav>

        <div className="nav-right">
          <div className="settings-wrap">
            <button
              type="button"
              className="btn-action btn-neutral btn-w-md btn-header"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="화면 설정"
            >
              설정
            </button>
            {isSettingsOpen && (
              <div className="settings-dropdown">
                <div className="settings-section">
                  <span className="settings-label">화면 테마</span>
                  <div className="settings-btn-group">
                    <button
                      className={`settings-btn ${!isDarkMode ? "active" : ""}`}
                      onClick={() => toggleTheme(false)}
                    >
                      라이트
                    </button>
                    <button
                      className={`settings-btn ${isDarkMode ? "active" : ""}`}
                      onClick={() => toggleTheme(true)}
                    >
                      다크
                    </button>
                  </div>
                </div>
                <div className="settings-section">
                  <span className="settings-label">해상도 너비</span>
                  <div className="settings-btn-group">
                    <button
                      className={`settings-btn ${layoutWidth === "standard" ? "active" : ""}`}
                      onClick={() => setLayoutWidth("standard")}
                    >
                      표준 (집중형)
                    </button>
                    <button
                      className={`settings-btn ${layoutWidth === "wide" ? "active" : ""}`}
                      onClick={() => setLayoutWidth("wide")}
                    >
                      넓게 (전체형)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="user-info">
            {user ? (
              <>
                <span className="user-greeting">
                  <strong>{user.name}</strong> 님
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-action btn-danger btn-w-md btn-header"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/user-login"
                  className="btn-action btn-neutral btn-w-md btn-header"
                >
                  로그인
                </Link>
                <Link
                  to="/signup"
                  className="btn-action btn-primary btn-w-md btn-header"
                >
                  가입 신청
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-user">
            <span className={user ? "mobile-user-name" : "mobile-user-guest"}>
              {user ? `${user.name} 님` : "로그인이 필요합니다."}
            </span>
          </div>
          <Link
            to="/"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            홈
          </Link>
          {showAdminMenu && (
            <>
              <Link
                to="/dashboard"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                관제 대시보드
              </Link>
              <Link
                to="/log-analysis"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                로그 분석실
              </Link>
              <Link
                to="/employee-auth"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                사원 인증 현황
              </Link>
              <Link
                to="/policies"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                차단 정책 관리
              </Link>
              <Link
                to="/ai-policies"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                AI 차단 현황 관리
              </Link>
              <Link
                to="/approvals"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                가입 승인
              </Link>
              <Link
                to="/employees"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                사원 관리
              </Link>
              <Link
                to="/test-lab"
                className="mobile-nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                보안 테스트실
              </Link>
            </>
          )}
          {user && (
            <Link
              to="/mypage"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              마이페이지
            </Link>
          )}
        </div>
      )}
    </div>
  );
});

function RootRedirector({ user, isAdminPortal }) {
  if (user && checkIsManager(user) && isAdminPortal) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Home user={user} />;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [isAdminPortal, setIsAdminPortal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  const [layoutWidth, setLayoutWidth] = useState(
    () => localStorage.getItem("layoutWidth") || "standard",
  );

  const toggleTheme = (forceDark) => setIsDarkMode(forceDark);

  const currentHost = window.location.hostname;
  const isInternalAdminNetwork = DEV_MODE || currentHost.includes("192.168.3.");
  const fallbackRoute = isInternalAdminNetwork ? "/admin-login" : "/user-login";

  useEffect(() => {
    const syncUserFromStorage = () => {
      localStorage.removeItem("user");
      const saved = sessionStorage.getItem("user");
      const adminMode = sessionStorage.getItem("adminPortalMode") === "true";

      if (saved) {
        try {
          const parsedUser = JSON.parse(saved);
          if (isInternalAdminNetwork) {
            if (checkIsManager(parsedUser) && adminMode) {
              setUser(parsedUser);
              setIsAdminPortal(true);
              return;
            }
          } else {
            setUser(parsedUser);
            setIsAdminPortal(Boolean(adminMode && checkIsManager(parsedUser)));
            return;
          }
        } catch {}
      }
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("adminPortalMode");
      setUser(null);
      setIsAdminPortal(false);
    };

    const timer = setTimeout(() => {
      syncUserFromStorage();
      setAuthLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [isInternalAdminNetwork]);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("layoutWidth", layoutWidth);
  }, [layoutWidth]);

  if (!authLoaded) return null;

  const canAccessAdmin = Boolean(
    DEV_MODE ||
    (isInternalAdminNetwork && user && checkIsManager(user) && isAdminPortal),
  );

  return (
    <BrowserRouter>
      <div className={`app-container layout-${layoutWidth}`}>
        <NavigationBar
          user={user}
          setUser={setUser}
          isAdminPortal={isAdminPortal}
          toggleTheme={toggleTheme}
          isDarkMode={isDarkMode}
          layoutWidth={layoutWidth}
          setLayoutWidth={setLayoutWidth}
          isInternalAdminNetwork={isInternalAdminNetwork}
        />
        <main className="main-content">
          <Suspense
            fallback={
              <div className="empty-state">페이지를 불러오는 중입니다...</div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  <RootRedirector
                    user={user}
                    isAdminPortal={isAdminPortal}
                    isInternalAdminNetwork={isInternalAdminNetwork}
                  />
                }
              />
              <Route path="/home" element={<Home user={user} />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/user-login"
                element={
                  user ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Login setUser={setUser} isAdminMode={false} />
                  )
                }
              />
              <Route
                path="/admin-login"
                element={
                  !isInternalAdminNetwork ? (
                    <Navigate to="/user-login" replace />
                  ) : canAccessAdmin ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <Login setUser={setUser} isAdminMode={true} />
                  )
                }
              />
              <Route
                path="/login"
                element={<Navigate to={fallbackRoute} replace />}
              />
              <Route
                path="/dashboard"
                element={
                  canAccessAdmin ? (
                    <Dashboard />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/log-analysis"
                element={
                  canAccessAdmin ? (
                    <LogAnalysis />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/employee-auth"
                element={
                  canAccessAdmin ? (
                    <EmployeeAuth />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/policies"
                element={
                  canAccessAdmin ? (
                    <PolicyManage />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/ai-policies"
                element={
                  canAccessAdmin ? (
                    <AiPolicyManage />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/approvals"
                element={
                  canAccessAdmin ? (
                    <SignupApproval />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/employees"
                element={
                  canAccessAdmin ? (
                    <EmployeeManage />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/test-lab"
                element={
                  canAccessAdmin ? (
                    <TestLab />
                  ) : (
                    <Navigate to={fallbackRoute} replace />
                  )
                }
              />
              <Route
                path="/mypage"
                element={
                  user ? <MyPage /> : <Navigate to={fallbackRoute} replace />
                }
              />
              <Route path="/captive" element={<CaptiveAuth />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
