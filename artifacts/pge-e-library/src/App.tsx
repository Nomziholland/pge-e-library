import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetCurrentUserQueryKey,
  getListUsersQueryKey,
  useGetCurrentUser,
  useListUsers,
  useLoginUser,
  useLogoutUser,
  useRegisterUser,
  useUpdateUserRole,
  type User as ApiUser,
} from '@workspace/api-client-react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  Link as LinkIcon,
  LogOut,
  Menu,
  Plus,
  Search,
  Shield,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';

const LEVELS = ['100L', '200L', '300L', '400L', '500L'] as const;
type Level = (typeof LEVELS)[number];
type LibraryKey = 'materials' | 'pastQuestions';

type User = ApiUser;
type LibraryItem = { id: string; title: string; url: string; addedAt: number };
type Course = {
  id: string;
  code: string;
  name: string;
  semester: 1 | 2;
  materials: LibraryItem[];
  pastQuestions: LibraryItem[];
};
type Courses = Record<Level, Course[]>;
type Notice = { message: string; type: 'success' | 'error' };
type AppView = 'library' | 'settings';

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
const matricPattern = /^20\d{2}\/1\/\d{5}IP$/i;
const isValidMatric = (value: string) => matricPattern.test(value.trim());
const normalizeUrl = (raw: string) => {
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};
const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PGE';

const seedRows: Record<Level, Array<[string, string, 1 | 2]>> = {
  '100L': [
    ['GST 111', 'Communication in English', 1], ['CHM 101', 'General Chemistry I', 1], ['CHM 107', 'General Practical Chemistry I', 1],
    ['MTH 101', 'Elementary Mathematics I', 1], ['PHY 101', 'General Physics I', 1], ['PHY 107', 'General Practical Physics I', 1],
    ['GET 101', 'Engineer in Society', 1], ['GET 102', 'Engineering Graphics and Solid Modelling I', 1], ['FUTM-COS 111', 'Introduction to Computing Sciences', 1],
    ['PGE 101', 'Introduction to Petroleum and Gas Industry with Field Trip', 1], ['GST 112', 'Nigerian Peoples and Cultures', 2], ['CHM 102', 'General Chemistry II', 2],
    ['CHM 108', 'General Practical Chemistry II', 2], ['MTH 102', 'Elementary Mathematics II', 2], ['MTH 103', 'Elementary Mathematics III', 2],
    ['PHY 103', 'General Physics III', 2], ['PHY 108', 'General Practical Physics II', 2], ['FUTM-STA 122', 'Probability I', 2],
    ['FUTM-PHY 122', 'General Physics II (Electricity and Magnetism)', 2], ['FUTM-PHY 124', 'General Physics IV (Vibration, Waves and Optics)', 2],
  ],
  '200L': [
    ['ENT 211', 'Entrepreneurship and Innovation', 1], ['GET 201', 'Applied Electricity I', 1], ['GET 205', 'Fundamentals of Fluid Mechanics', 1],
    ['GET 209', 'Engineering Mathematics I', 1], ['GET 211', 'Computing and Software Engineering', 1], ['FUTM-GET 213', 'Engineering Graphics and Solid Modelling II', 1],
    ['FUTM-GET 217', 'Applied Mechanics', 1], ['FUTM-PGE 211', 'Fundamentals of Petroleum Engineering', 1], ['GET 202', 'Engineering Materials', 2],
    ['GET 204', "Students' Workshop Practice", 2], ['GET 206', 'Fundamentals of Thermodynamics', 2], ['GET 210', 'Engineering Mathematics II', 2],
    ['GST 212', 'Philosophy, Logic and Human Existence', 2], ['FUTM-GET 218', 'Strength of Materials', 2], ['FUTM-PGE 221', 'Petroleum Geology', 2],
    ['GET 299', 'SIWES I: Students Work Experience Scheme', 2],
  ],
  '300L': [
    ['GET 305', 'Engineering Statistics and Data Analytics', 1], ['GET 307', 'Introduction to Artificial Intelligence, Machine Learning and Convergent Technologies', 1],
    ['GET 301', 'Engineering Mathematics III', 1], ['PGE 301', 'Rock and Fluid Properties', 1], ['PGE 303', 'Drilling and Well Design I', 1],
    ['FUTM-GET 311', 'Engineering Economics', 1], ['FUTM-PGE 311', 'Chemical Thermodynamics', 1], ['GST 312', 'Peace and Conflict Resolution', 2],
    ['ENT 312', 'Venture Creation', 2], ['GET 304', 'Engineering Communication, Technical Writing and Presentation', 2],
    ['GET 306', 'Renewable Energy Systems and Technologies', 2], ['PGE 302', 'Petroleum Engineering Lab 1', 2], ['PGE 304', 'Fundamentals of Reservoir Engineering', 2],
    ['PGE 305', 'Oil and Gas Production Engineering I', 2], ['PGE 306', 'Gas Instrumentation Laboratory', 2], ['GET 399', 'SIWES II: Students Work Experience Scheme', 2],
  ],
  '400L': [
    ['GET 404', 'Engineering Valuation and Costing', 1], ['PGE 403', 'Natural Gas Engineering', 1], ['FUTM-PGE 411', 'Introduction to Well Logging and Interpretation', 1],
    ['FUTM-PGE 412', 'Instrumentation and Process Control in Petrochemical Plant', 1], ['FUTM-PGE 413', 'Natural Gas Reservoir Engineering', 1],
    ['FUTM-PGE 415', 'Natural Gas Process Plant Design', 1], ['FUTM-PGE 416', 'Petroleum Engineering Laboratory III', 1], ['FUTM-PGE 417', 'Transfer Processes', 1],
    ['PGE 401', 'Entrepreneurship and Startup/Oil and Gas Business Project (Elective)', 1], ['FUTM-PGE 414', 'Gas to Power Generation and Emission Management (Elective)', 1],
    ['GET 402', 'Engineering Project I', 2], ['GET 499', 'SIWES III', 2],
  ],
  '500L': [
    ['GET 501', 'Project Management', 1], ['PGE 501', 'Natural Gas Handling, Processing and Safety', 1], ['PGE 504', 'Natural Gas Utilisation and Monetisation Concepts', 1],
    ['FUTM-GET 511', 'Engineering Management', 1], ['FUTM-PGE 511', 'Natural Gas Reservoir Modelling and Simulation', 1],
    ['FUTM-PGE 512', 'Offshore Gas Production and Flow Assurances', 1], ['FUTM-PGE 531', 'Environmental Pollution and Control (Elective)', 1],
    ['FUTM-PGE 532', 'Polymer Science and Engineering (Elective)', 1], ['GET 502', 'Engineering Law', 2], ['PGE 502', 'Transportation and Pipeline Technology', 2],
    ['FUTM-PGE 521', 'Project', 2], ['FUTM-PGE 522', 'Multiphase Flow in Pipes', 2], ['FUTM-PGE 523', 'Fundamentals of Enhanced Oil Recovery Techniques', 2],
    ['FUTM-PGE 541', 'Petroleum Refining (Elective)', 2], ['FUTM-PGE 542', 'Drilling Fluid Technology (Elective)', 2],
  ],
};

const emptyCourses = (): Courses =>
  LEVELS.reduce((courses, level) => {
    courses[level] = [];
    return courses;
  }, {} as Courses);
const buildSeed = (): Courses => {
  const seeded = emptyCourses();
  LEVELS.forEach((level) => {
    seeded[level] = seedRows[level].map(([code, name, semester]) => ({
      id: uid('crs'), code, name, semester, materials: [], pastQuestions: [],
    }));
  });
  return seeded;
};
const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};
const writeStorage = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  }
  return fallback;
};

export default function App() {
  const queryClient = useQueryClient();
  const [booted, setBooted] = useState(false);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [courses, setCourses] = useState<Courses>(emptyCourses());
  const [session, setSession] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeLevel, setActiveLevel] = useState<Level>('100L');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>('library');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const currentUserQuery = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const usersQuery = useListUsers({ query: { queryKey: getListUsersQueryKey(), enabled: Boolean(session?.isAdmin), retry: false } });
  const registerMutation = useRegisterUser();
  const loginMutation = useLoginUser();
  const logoutMutation = useLogoutUser();
  const updateRoleMutation = useUpdateUserRole();

  const showNotice = useCallback((message: string, type: Notice['type'] = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3400);
  }, []);

  useEffect(() => {
    const storedCourses = readStorage<Courses | null>('pge-courses', null);
    const nextCourses = storedCourses ?? buildSeed();
    if (!storedCourses) writeStorage('pge-courses', nextCourses);
    const normalized = { ...emptyCourses(), ...nextCourses };
    setCourses(normalized);
    setBooted(true);
  }, []);

  useEffect(() => {
    if (currentUserQuery.data) {
      setSession(currentUserQuery.data);
      setActiveLevel(currentUserQuery.data.level);
    } else if (currentUserQuery.isFetched && currentUserQuery.isError) {
      setSession(null);
    }
  }, [currentUserQuery.data, currentUserQuery.isError, currentUserQuery.isFetched]);

  useEffect(() => {
    if (usersQuery.data) {
      setUsers(Object.fromEntries(usersQuery.data.map((user) => [user.id, user])));
    }
  }, [usersQuery.data]);

  useEffect(() => {
    if (!session?.isAdmin && activeView === 'settings') setActiveView('library');
  }, [activeView, session?.isAdmin]);

  const persistCourses = (next: Courses) => { setCourses(next); writeStorage('pge-courses', next); };

  const handleRegister = (data: { name: string; matric: string; level: Level }) => {
    const name = data.name.trim();
    const matric = data.matric.trim().toUpperCase();
    if (!name) { showNotice('Please add your full name.', 'error'); return; }
    if (!isValidMatric(matric)) { showNotice('Use the format 20XX/1/XXXXXIP, for example 2021/1/72315IP.', 'error'); return; }
    registerMutation.mutate(
      { data: { name, matric, level: data.level } },
      {
        onSuccess: (user) => {
          setSession(user);
          setActiveLevel(user.level);
          setAuthMode('login');
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          showNotice(user.isAdmin ? 'Account created. You are the first archive administrator.' : 'Account created. Welcome to the archive.');
        },
        onError: (error) => showNotice(getApiErrorMessage(error, 'Unable to create the account.'), 'error'),
      },
    );
  };

  const handleLogin = (rawMatric: string) => {
    const matric = rawMatric.trim().toUpperCase();
    if (!isValidMatric(matric)) { showNotice('Use the format 20XX/1/XXXXXIP, for example 2021/1/72315IP.', 'error'); return; }
    loginMutation.mutate(
      { data: { matric } },
      {
        onSuccess: (user) => {
          setSession(user);
          setActiveLevel(user.level);
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          showNotice(`Welcome back, ${user.name.split(' ')[0]}.`);
        },
        onError: (error) => showNotice(getApiErrorMessage(error, 'Unable to sign in.'), 'error'),
      },
    );
  };

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
        setSession(null);
        setUsers({});
        setActiveCourseId(null);
        setMobileMenu(false);
        setAuthMode('login');
      },
      onError: () => showNotice('Unable to sign out. Please try again.', 'error'),
    });
  };
  const toggleAdmin = (userId: string) => {
    if (!session?.isAdmin || userId === session.id) return;
    const target = users[userId];
    if (!target) return;
    updateRoleMutation.mutate(
      { userId, data: { isAdmin: !target.isAdmin } },
      {
        onSuccess: (updated) => {
          setUsers((current) => ({ ...current, [updated.id]: updated }));
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          showNotice(`${updated.name} is ${updated.isAdmin ? 'now' : 'no longer'} an administrator.`);
        },
        onError: (error) => showNotice(getApiErrorMessage(error, 'Unable to update administrator access.'), 'error'),
      },
    );
  };
  const addCourse = async (level: Level, raw: { code: string; name: string; semester: 1 | 2 }) => {
    if (!session?.isAdmin) { showNotice('Only an administrator can edit the curriculum.', 'error'); return false; }
    const code = raw.code.trim().toUpperCase();
    const name = raw.name.trim();
    if (!code || !name) { showNotice('Enter both a course code and a course name.', 'error'); return false; }
    if (LEVELS.some((item) => courses[item].some((course) => course.code === code))) {
      showNotice(`${code} already exists in the curriculum.`, 'error'); return false;
    }
    const course: Course = { id: uid('crs'), code, name, semester: raw.semester, materials: [], pastQuestions: [] };
    persistCourses({ ...courses, [level]: [...courses[level], course] });
    showNotice(`${code} added to ${level}.`);
    return true;
  };
  const deleteCourse = (level: Level, courseId: string) => {
    if (!session?.isAdmin) { showNotice('Only an administrator can remove courses.', 'error'); return; }
    const course = courses[level].find((item) => item.id === courseId);
    if (!course || !window.confirm(`Delete ${course.code} and its saved links?`)) return;
    persistCourses({ ...courses, [level]: courses[level].filter((item) => item.id !== courseId) });
    setActiveCourseId(null); showNotice(`${course.code} removed from the curriculum.`);
  };
  const addItem = async (level: Level, courseId: string, key: LibraryKey, raw: { title: string; url: string }) => {
    if (!session?.isAdmin) { showNotice('Only an administrator can add archive links.', 'error'); return false; }
    const title = raw.title.trim();
    const url = normalizeUrl(raw.url);
    if (!title) { showNotice('Give this link a useful title.', 'error'); return false; }
    if (!url) { showNotice('Paste a valid web link, such as drive.google.com/...', 'error'); return false; }
    const current = courses[level].find((course) => course.id === courseId);
    if (!current) return false;
    if (current[key].some((item) => item.url === url)) { showNotice('That link is already saved here.', 'error'); return false; }
    const item: LibraryItem = { id: uid(key === 'materials' ? 'mat' : 'pq'), title, url, addedAt: Date.now() };
    const next = { ...courses, [level]: courses[level].map((course) => course.id === courseId ? { ...course, [key]: [...course[key], item] } : course) };
    persistCourses(next); showNotice(key === 'materials' ? 'Course material added.' : 'Past question added.');
    return true;
  };
  const removeItem = (level: Level, courseId: string, key: LibraryKey, itemId: string) => {
    if (!session?.isAdmin) { showNotice('Only an administrator can remove archive links.', 'error'); return; }
    const next = { ...courses, [level]: courses[level].map((course) => course.id === courseId ? { ...course, [key]: course[key].filter((item) => item.id !== itemId) } : course) };
    persistCourses(next); showNotice('Link removed from the archive.');
  };

  if (!booted || currentUserQuery.isLoading) return <LoadingScreen />;
  if (!session) return <AuthScreen mode={authMode} onModeChange={setAuthMode} onLogin={handleLogin} onRegister={handleRegister} notice={notice} />;

  const activeCourse = courses[activeLevel].find((course) => course.id === activeCourseId) ?? null;
  const chooseLevel = (level: Level) => { setActiveLevel(level); setActiveCourseId(null); setActiveView('library'); setMobileMenu(false); };
  const openSettings = () => {
    if (!session.isAdmin) return;
    setActiveCourseId(null);
    setActiveView('settings');
    setMobileMenu(false);
  };
  const openLibrary = () => { setActiveView('library'); setMobileMenu(false); };
  return (
    <div className="app-root">
      <div className="noise" />
      <div className="shell">
        <Sidebar session={session} activeLevel={activeLevel} courses={courses} activeView={activeView} onLevel={chooseLevel} onSettings={openSettings} onLogout={logout} />
        <div className="main">
          <MobileNav session={session} activeLevel={activeLevel} courses={courses} activeView={activeView} open={mobileMenu} onToggle={() => setMobileMenu((value) => !value)} onLevel={chooseLevel} onSettings={openSettings} />
          <main className="content fade-in">
            {activeView === 'settings' && session.isAdmin ? (
              <SettingsView session={session} users={users} onBack={openLibrary} />
            ) : activeCourse ? (
              <CourseView
                level={activeLevel} course={activeCourse} isAdmin={session.isAdmin} onBack={() => setActiveCourseId(null)}
                onAdd={(key, payload) => addItem(activeLevel, activeCourse.id, key, payload)}
                onRemove={(key, itemId) => removeItem(activeLevel, activeCourse.id, key, itemId)}
              />
            ) : (
              <LevelView
                level={activeLevel} courses={courses[activeLevel]} isAdmin={session.isAdmin} users={users} currentUserId={session.id}
                onOpen={setActiveCourseId} onAddCourse={(payload) => addCourse(activeLevel, payload)} onDelete={(id) => deleteCourse(activeLevel, id)} onToggleAdmin={toggleAdmin}
              />
            )}
          </main>
        </div>
      </div>
      {notice && <Notice notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-shell"><div><div className="loading-mark">PGE / E-LIBRARY</div><div className="loading-line" /></div></div>;
}

function AuthScreen({ mode, onModeChange, onLogin, onRegister, notice }: {
  mode: 'login' | 'register'; onModeChange: (mode: 'login' | 'register') => void; onLogin: (matric: string) => void;
  onRegister: (data: { name: string; matric: string; level: Level }) => void; notice: Notice | null;
}) {
  return (
    <div className="auth-page app-root">
      <section className="auth-archive">
        <div className="archive-top"><div className="mark">PGE</div><div className="brand-copy">E-Library<small>Petroleum &amp; Gas Engineering</small></div></div>
        <div className="archive-hero">
          <div className="archive-kicker">Departmental archive / 01</div>
          <h1>The notes you need, kept close.</h1>
          <p>A considered home for the PGE curriculum, course materials, and the questions that have shaped generations of engineers.</p>
        </div>
        <div>
          <div className="strata">{LEVELS.map((level) => <div key={level}>{level}</div>)}</div>
          <div className="archive-footer">Faculty of Engineering · Petroleum &amp; Gas Engineering</div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><div className="mark">PGE</div><div className="brand-copy">E-Library<small>Petroleum &amp; Gas Engineering</small></div></div>
          {mode === 'login' ? <LoginForm onLogin={onLogin} onSwitch={() => onModeChange('register')} /> : <RegisterForm onRegister={onRegister} onSwitch={() => onModeChange('login')} />}
        </div>
      </section>
      {notice && <Notice notice={notice} onDismiss={() => undefined} />}
    </div>
  );
}

function LoginForm({ onLogin, onSwitch }: { onLogin: (matric: string) => void; onSwitch: () => void }) {
  const [matric, setMatric] = useState('');
  const touched = matric.length > 0;
  return (
    <form className="rise-in" onSubmit={(event) => { event.preventDefault(); onLogin(matric); }}>
      <div className="eyebrow">Student access</div>
      <h1 className="form-title">Sign in to the archive</h1>
      <p className="form-lede">Your curriculum is waiting. Use the matric number attached to your department record.</p>
      <div className="field"><label htmlFor="login-matric">Matric number</label><input id="login-matric" data-testid="input-login-matric" value={matric} onChange={(event) => setMatric(event.target.value)} placeholder="2021/1/72315IP" autoComplete="username" /></div>
      <div className="hint">Format: 20XX/1/XXXXXIP</div>
      {touched && !isValidMatric(matric) && <div className="hint" style={{ color: 'hsl(var(--destructive))', marginTop: 7 }}>That number is not in the department format yet.</div>}
      <button className="button-primary form-action" data-testid="button-login" type="submit">Open library <ChevronRight size={15} /></button>
      <p className="auth-switch">New to the archive? <button className="text-button" data-testid="button-switch-register" type="button" onClick={onSwitch}>Create an account</button></p>
    </form>
  );
}

function RegisterForm({ onRegister, onSwitch }: { onRegister: (data: { name: string; matric: string; level: Level }) => void; onSwitch: () => void }) {
  const [name, setName] = useState('');
  const [matric, setMatric] = useState('');
  const [level, setLevel] = useState<Level>('100L');
  const touched = matric.length > 0;
  return (
    <form className="rise-in" onSubmit={(event) => { event.preventDefault(); onRegister({ name, matric, level }); }}>
      <div className="eyebrow">First visit</div>
      <h1 className="form-title">Make the archive yours</h1>
      <p className="form-lede">Create a department account to browse every level and return to the links you trust.</p>
      <div className="field"><label htmlFor="register-name">Full name</label><input id="register-name" data-testid="input-register-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Okafor" autoComplete="name" /></div>
      <div className="field"><label htmlFor="register-matric">Matric number</label><input id="register-matric" data-testid="input-register-matric" value={matric} onChange={(event) => setMatric(event.target.value)} placeholder="2021/1/72315IP" autoComplete="username" /></div>
      <div className="hint">Format: 20XX/1/XXXXXIP</div>
      {touched && !isValidMatric(matric) && <div className="hint" style={{ color: 'hsl(var(--destructive))', marginTop: 7 }}>Use four digits, /1/, five digits, and IP.</div>}
      <div className="field"><label htmlFor="register-level">Current level</label><select id="register-level" data-testid="select-register-level" value={level} onChange={(event) => setLevel(event.target.value as Level)}>{LEVELS.map((item) => <option key={item}>{item}</option>)}</select></div>
      <button className="button-primary form-action" data-testid="button-register" type="submit">Create account <ChevronRight size={15} /></button>
      <p className="auth-switch">Already registered? <button className="text-button" data-testid="button-switch-login" type="button" onClick={onSwitch}>Sign in</button></p>
    </form>
  );
}

function Brand() {
  return <div className="archive-top"><div className="mark">PGE</div><div className="brand-copy">E-Library<small>Petroleum &amp; Gas Engineering</small></div></div>;
}
function LevelNav({ activeLevel, courses, onLevel }: { activeLevel: Level; courses: Courses; onLevel: (level: Level) => void }) {
  return <nav className="level-nav" aria-label="Curriculum levels">{LEVELS.map((level) => <button className={`level-button ${activeLevel === level ? 'active' : ''}`} data-testid={`button-level-${level}`} key={level} onClick={() => onLevel(level)}><Layers size={15} /><span>{level}</span><span className="count">{courses[level].length}</span></button>)}</nav>;
}
function Sidebar({ session, activeLevel, courses, activeView, onLevel, onSettings, onLogout }: {
  session: User; activeLevel: Level; courses: Courses; activeView: AppView; onLevel: (level: Level) => void; onSettings: () => void; onLogout: () => void;
}) {
  return <aside className="sidebar"><Brand /><div className="nav-heading">Curriculum levels</div><LevelNav activeLevel={activeLevel} courses={courses} onLevel={onLevel} />{session.isAdmin && <div className="admin-nav"><div className="nav-heading">Administration</div><button className={`admin-nav-button ${activeView === 'settings' ? 'active' : ''}`} data-testid="button-admin-settings" onClick={onSettings}><Settings size={15} /><span>Admin settings</span></button></div>}<div className="sidebar-bottom"><div className="profile"><div className="avatar">{getInitials(session.name)}</div><div><div className="profile-name">{session.name}</div><div className="profile-meta">{session.matric} · {session.isAdmin ? 'Administrator' : 'Student'}</div></div></div><button className="button-quiet" data-testid="button-logout" onClick={onLogout}><LogOut size={14} /> Sign out</button></div></aside>;
}
function MobileNav({ session, activeLevel, courses, activeView, open, onToggle, onLevel, onSettings }: {
  session: User; activeLevel: Level; courses: Courses; activeView: AppView; open: boolean; onToggle: () => void; onLevel: (level: Level) => void; onSettings: () => void;
}) {
  return <><div className="mobile-bar"><Brand /><button className="menu-button" data-testid="button-mobile-levels" aria-label="Open level navigation" aria-expanded={open} onClick={onToggle}>{open ? <X size={18} /> : <Menu size={18} />}</button></div>{open && <div className="mobile-menu"><div className="nav-heading">Browse levels · {session.name.split(' ')[0]}</div><LevelNav activeLevel={activeLevel} courses={courses} onLevel={onLevel} />{session.isAdmin && <><div className="nav-heading mobile-admin-heading">Administration</div><button className={`mobile-admin-button ${activeView === 'settings' ? 'active' : ''}`} data-testid="button-mobile-admin-settings" onClick={onSettings}><Settings size={15} /> Admin settings</button></>}</div>}</>;
}

function SettingsView({ session, users, onBack }: { session: User; users: Record<string, User>; onBack: () => void }) {
  const adminCount = Object.values(users).filter((user) => user.isAdmin).length;
  return <div className="rise-in">
    <button className="course-back" data-testid="button-back-settings" onClick={onBack}><ChevronLeft size={15} /> Back to library</button>
    <div className="settings-hero">
      <div className="eyebrow">Administration / settings</div>
      <h1 className="page-title">Archive settings</h1>
      <p className="page-description">Restricted controls for trusted department administrators.</p>
    </div>
    <section className="settings-card">
      <div className="settings-card-heading"><div><div className="panel-title">Administrator access</div><div className="panel-subtitle">Only administrators can see or change these controls.</div></div><div className="settings-icon"><Shield size={18} /></div></div>
      <div className="settings-list">
        <div className="settings-row"><span>Signed in as</span><strong>{session.name}</strong></div>
        <div className="settings-row"><span>Archive role</span><strong>Administrator</strong></div>
        <div className="settings-row"><span>Active administrators</span><strong>{adminCount}</strong></div>
      </div>
    </section>
    <section className="settings-card settings-card-muted">
      <div className="panel-title">What administrators can do</div>
      <div className="panel-subtitle">Use the curriculum views to manage the shared archive.</div>
      <div className="permission-list"><div><CheckCircle2 size={15} /> Add or remove courses</div><div><CheckCircle2 size={15} /> Add or remove course links</div><div><CheckCircle2 size={15} /> Assign administration to trusted members</div></div>
    </section>
  </div>;
}

function LevelView({ level, courses, isAdmin, users, currentUserId, onOpen, onAddCourse, onDelete, onToggleAdmin }: {
  level: Level; courses: Course[]; isAdmin: boolean; users: Record<string, User>; currentUserId: string;
  onOpen: (id: string) => void; onAddCourse: (data: { code: string; name: string; semester: 1 | 2 }) => Promise<boolean>; onDelete: (id: string) => void; onToggleAdmin: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [semester, setSemester] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? courses.filter((course) => `${course.code} ${course.name}`.toLowerCase().includes(needle)) : courses;
  }, [courses, query]);
  const submitCourse = async (event: FormEvent) => {
    event.preventDefault();
    const success = await onAddCourse({ code, name, semester });
    if (success) { setCode(''); setName(''); setSemester(1); setShowAdd(false); }
  };
  return <div className="rise-in">
    <div className="page-top"><div><div className="eyebrow">Curriculum / level</div><h1 className="page-title">{level}</h1><p className="page-description">{courses.length} courses · arranged by teaching semester</p></div><div className="top-actions">{isAdmin && <><button className="button-secondary" data-testid="button-manage-users" onClick={() => setShowUsers((value) => !value)}><Users size={14} /> Manage admins</button><button className="button-primary" data-testid="button-show-add-course" onClick={() => setShowAdd((value) => !value)}>{showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Close' : 'Add course'}</button></>}</div></div>
    <div className="search-wrap"><Search size={16} /><input className="search-input" data-testid="input-course-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${level} by code or course name`} /></div>
    {showUsers && isAdmin && <AdminPanel users={users} currentUserId={currentUserId} onToggle={onToggleAdmin} />}
    {showAdd && isAdmin && <form className="admin-panel" onSubmit={submitCourse}><div className="panel-title">Add to the {level} record</div><div className="panel-subtitle">Keep codes consistent with the departmental handbook.</div><div className="inline-fields"><input data-testid="input-course-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="PGE 405" aria-label="Course code" /><input data-testid="input-course-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Course name" aria-label="Course name" /><select data-testid="select-course-semester" value={semester} onChange={(event) => setSemester(Number(event.target.value) as 1 | 2)} aria-label="Semester"><option value={1}>First semester</option><option value={2}>Second semester</option></select><button className="button-primary button-small" data-testid="button-save-course" type="submit">Save course</button></div></form>}
    {courses.length === 0 ? <EmptyState icon={<BookOpen size={22} />} title={`No courses in ${level} yet`} detail={isAdmin ? 'Use Add course to start building this level.' : 'The department has not published this level yet.'} /> : filtered.length === 0 ? <EmptyState icon={<Search size={22} />} title="No matching courses" detail={`Nothing in ${level} matches "${query}".`} /> : <><CourseSection title="First semester" courses={filtered.filter((course) => course.semester === 1)} isAdmin={isAdmin} onOpen={onOpen} onDelete={onDelete} /><CourseSection title="Second semester" courses={filtered.filter((course) => course.semester === 2)} isAdmin={isAdmin} onOpen={onOpen} onDelete={onDelete} /></>}
  </div>;
}
function AdminPanel({ users, currentUserId, onToggle }: { users: Record<string, User>; currentUserId: string; onToggle: (id: string) => void }) {
  const roster = Object.values(users);
  return <section className="admin-panel"><div className="panel-title"><span>Registered users</span><Shield size={17} /></div><div className="panel-subtitle">Assign archive administration to trusted department members.</div><div className="user-list">{roster.length === 0 ? <div className="hint">No registered users.</div> : roster.map((user) => <div className="user-row" key={user.id}><div className="user-details"><strong>{user.name}</strong><span>{user.matric} · {user.level}</span></div><button className={user.isAdmin ? 'button-danger button-small' : 'button-secondary button-small'} data-testid={`button-toggle-admin-${user.id}`} disabled={user.id === currentUserId} onClick={() => onToggle(user.id)}>{user.isAdmin ? 'Remove admin' : 'Make admin'}</button></div>)}</div></section>;
}
function CourseSection({ title, courses, isAdmin, onOpen, onDelete }: { title: string; courses: Course[]; isAdmin: boolean; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  if (courses.length === 0) return null;
  return <section className="section"><div className="section-heading">{title}<span>{courses.length}</span></div><div className="course-grid">{courses.map((course, index) => <article className={`course-card rise-in delay-${Math.min(index % 4 + 1, 3)}`} data-testid={`card-course-${course.id}`} key={course.id} onClick={() => onOpen(course.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(course.id); }}><div className="course-code">{course.code}</div><div className="course-name">{course.name}</div><div className="course-meta"><FileText size={13} /> {course.materials.length} materials <span>·</span> {course.pastQuestions.length} past questions</div>{isAdmin && <button className="card-delete" data-testid={`button-delete-course-${course.id}`} aria-label={`Delete ${course.code}`} onClick={(event) => { event.stopPropagation(); onDelete(course.id); }}><Trash2 size={14} /></button>}<ChevronRight className="card-arrow" size={16} /></article>)}</div></section>;
}

function CourseView({ level, course, isAdmin, onBack, onAdd, onRemove }: {
  level: Level; course: Course; isAdmin: boolean; onBack: () => void; onAdd: (key: LibraryKey, data: { title: string; url: string }) => Promise<boolean>; onRemove: (key: LibraryKey, id: string) => void;
}) {
  const [tab, setTab] = useState<LibraryKey>('materials');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const key = tab;
  const list = course[key];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const success = await onAdd(key, { title, url });
    if (success) { setTitle(''); setUrl(''); setShowAdd(false); }
  };
  return <div className="rise-in"><button className="course-back" data-testid="button-back-level" onClick={onBack}><ChevronLeft size={15} /> {level} / all courses</button><div className="course-hero"><div className="eyebrow">{course.code} · {course.semester === 1 ? 'First semester' : 'Second semester'}</div><h1>{course.name}</h1><p>Departmental record · {course.materials.length + course.pastQuestions.length} saved links in this course</p></div><div className="tabs" role="tablist"><button className={`tab ${tab === 'materials' ? 'active' : ''}`} data-testid="tab-materials" role="tab" aria-selected={tab === 'materials'} onClick={() => { setTab('materials'); setShowAdd(false); }}><FileText size={14} /> Course materials</button><button className={`tab ${tab === 'pastQuestions' ? 'active' : ''}`} data-testid="tab-past-questions" role="tab" aria-selected={tab === 'pastQuestions'} onClick={() => { setTab('pastQuestions'); setShowAdd(false); }}><BookOpen size={14} /> Past questions</button></div>{isAdmin && (!showAdd ? <button className="button-secondary button-small" data-testid="button-show-add-item" onClick={() => setShowAdd(true)}><Plus size={14} /> Add {tab === 'materials' ? 'material' : 'past question'}</button> : <form className="add-item" onSubmit={submit}><input data-testid="input-item-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tab === 'materials' ? 'Lecture 03 slides' : '2023 first semester paper'} aria-label="Link title" /><input data-testid="input-item-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="drive.google.com/..." aria-label="Link URL" /><button className="button-primary button-small" data-testid="button-save-item" type="submit">Save link</button><button className="button-quiet button-small" data-testid="button-cancel-item" type="button" onClick={() => setShowAdd(false)}><X size={14} /></button></form>)}<div style={{ marginTop: 18 }}>{list.length === 0 ? <EmptyState icon={tab === 'materials' ? <LinkIcon size={22} /> : <BookOpen size={22} />} title={tab === 'materials' ? 'No materials saved yet' : 'No past questions saved yet'} detail={isAdmin ? `Add the first ${tab === 'materials' ? 'course material' : 'past question'} above.` : 'Links added by an administrator will appear here.'} /> : <div className="item-list">{list.slice().sort((a, b) => b.addedAt - a.addedAt).map((item) => <LibraryItemRow key={item.id} item={item} isAdmin={isAdmin} onRemove={() => onRemove(key, item.id)} />)}</div>}</div></div>;
}
function LibraryItemRow({ item, isAdmin, onRemove }: { item: LibraryItem; isAdmin: boolean; onRemove: () => void }) {
  return <div className="library-item" data-testid={`row-library-item-${item.id}`}><div className="item-icon"><ExternalLink size={16} /></div><div className="item-copy"><a data-testid={`link-library-item-${item.id}`} href={item.url} target="_blank" rel="noreferrer">{item.title}</a><span>Added {formatDate(item.addedAt)} · opens in a new tab</span></div>{isAdmin && <button className="item-remove" data-testid={`button-remove-item-${item.id}`} aria-label={`Remove ${item.title}`} onClick={onRemove}><Trash2 size={14} /></button>}</div>;
}
function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="empty-state fade-in" data-testid="state-empty"><div style={{ color: 'hsl(var(--primary))' }}>{icon}</div><strong>{title}</strong><p>{detail}</p></div>;
}
function Notice({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return <div className={`notice ${notice.type === 'error' ? 'error' : ''}`} data-testid={`status-${notice.type}`} role="status">{notice.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}<span>{notice.message}</span><button data-testid="button-dismiss-notice" aria-label="Dismiss notification" onClick={onDismiss}><X size={14} /></button></div>;
}