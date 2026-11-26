import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarCheck2,
  ClipboardList,
  Download,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import {
  INITIAL_EXPENSES,
  INITIAL_MEETINGS,
  INITIAL_MEMBERS,
  INITIAL_ORGANIZATIONS,
} from './data/initialData';
import {
  DocKey,
  Meeting,
  Member,
  Organization,
  SubsidyExpense,
  ViewTab,
} from './types';
import {
  buildDeadlineAlerts,
  calculateMeetingAttendance,
  downloadCSV,
  formatDday,
  getDaysRemaining,
  getMissingDocs,
  REFERENCE_TODAY,
} from './utils/civicHelpers';
import { OverviewBoard } from './components/OverviewBoard';
import { MemberRosterView } from './components/MemberRosterView';
import { MeetingsAttendanceView } from './components/MeetingsAttendanceView';
import { SubsidySettlementView } from './components/SubsidySettlementView';

const STORAGE_KEY = 'civic_org_mgmt_v1';

interface StoredState {
  organizations: Organization[];
  members: Member[];
  meetings: Meeting[];
  expenses: SubsidyExpense[];
}

function loadInitialState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      if (
        Array.isArray(parsed.organizations) &&
        Array.isArray(parsed.members) &&
        Array.isArray(parsed.meetings) &&
        Array.isArray(parsed.expenses)
      ) {
        return parsed;
      }
    }
  } catch {
    // Fallback to default dataset
  }
  return {
    organizations: INITIAL_ORGANIZATIONS,
    members: INITIAL_MEMBERS,
    meetings: INITIAL_MEETINGS,
    expenses: INITIAL_EXPENSES,
  };
}

const NAV_ITEMS: { id: ViewTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: '통합 관리판', icon: LayoutDashboard },
  { id: 'members', label: '회원 · 임기 관리', icon: Users },
  { id: 'meetings', label: '회의록 · 참석률', icon: CalendarCheck2 },
  { id: 'subsidy', label: '보조금 정산', icon: ClipboardList },
];

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [organizations, setOrganizations] = useState<Organization[]>(
    initial.organizations
  );
  const [members, setMembers] = useState<Member[]>(initial.members);
  const [meetings, setMeetings] = useState<Meeting[]>(initial.meetings);
  const [expenses, setExpenses] = useState<SubsidyExpense[]>(initial.expenses);

  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const payload: StoredState = {
        organizations,
        members,
        meetings,
        expenses,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [organizations, members, meetings, expenses]);

  const alerts = useMemo(
    () => buildDeadlineAlerts(organizations, members, expenses, meetings),
    [organizations, members, expenses, meetings]
  );

  const urgentAlertCount = useMemo(
    () => alerts.filter((a) => a.severity === 'urgent').length,
    [alerts]
  );

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? '통합 관리판';
  const activeOrgName =
    selectedOrgId === 'all'
      ? '전체 단체'
      : organizations.find((o) => o.id === selectedOrgId)?.name ?? '전체 단체';

  // Handlers
  const handleNavigate = (tab: ViewTab, orgId?: string) => {
    setActiveTab(tab);
    if (orgId) setSelectedOrgId(orgId);
    setMobileMenuOpen(false);
  };

  const handleAddMember = (memberInput: Omit<Member, 'id'>) => {
    const newMember: Member = {
      ...memberInput,
      id: `m-${Date.now()}`,
    };
    setMembers((prev) => [newMember, ...prev]);
  };

  const handleUpdateMember = (updated: Member) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleDeleteMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleAddMeeting = (meetingInput: Omit<Meeting, 'id'>): string => {
    const id = `mt-${Date.now()}`;
    const newMeeting: Meeting = { ...meetingInput, id };
    setMeetings((prev) => [newMeeting, ...prev]);
    return id;
  };

  const handleUpdateMeeting = (updated: Meeting) => {
    setMeetings((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
  };

  const handleDeleteMeeting = (meetingId: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
  };

  const handleToggleExpenseDoc = (expenseId: string, docKey: DocKey) => {
    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.id !== expenseId) return exp;
        return {
          ...exp,
          submittedDocs: {
            ...exp.submittedDocs,
            [docKey]: !exp.submittedDocs[docKey],
          },
        };
      })
    );
  };

  const handleAddExpense = (expenseInput: Omit<SubsidyExpense, 'id'>) => {
    const newExp: SubsidyExpense = {
      ...expenseInput,
      id: `ex-${Date.now()}`,
    };
    setExpenses((prev) => [newExp, ...prev]);
  };

  const handleDeleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  };

  const handleResetDemoData = () => {
    setOrganizations(INITIAL_ORGANIZATIONS);
    setMembers(INITIAL_MEMBERS);
    setMeetings(INITIAL_MEETINGS);
    setExpenses(INITIAL_EXPENSES);
    setSelectedOrgId('all');
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleExportIntegratedReport = () => {
    const rows: string[][] = [
      [
        '단체명',
        '분류',
        '회장',
        '등록회원수',
        '정원',
        '30일내임기만료',
        '평균참석률(%)',
        '보조금교부액',
        '보조금집행액',
        '집행률(%)',
        '정산마감일',
        '정산잔여일',
        '증빙누락건수',
      ],
      ...organizations.map((org) => {
        const orgMembers = members.filter((m) => m.orgId === org.id);
        const expiring = orgMembers.filter(
          (m) => getDaysRemaining(m.termEnd) <= 30
        ).length;
        const completedMt = meetings.filter(
          (m) => m.orgId === org.id && m.status === '완료'
        );
        const avgAtt =
          completedMt.length > 0
            ? Math.round(
                (completedMt.reduce(
                  (acc, mt) =>
                    acc + calculateMeetingAttendance(mt, orgMembers).rate,
                  0
                ) /
                  completedMt.length) *
                  10
              ) / 10
            : 0;
        const orgExp = expenses.filter((e) => e.orgId === org.id);
        const spent = orgExp.reduce((acc, e) => acc + e.amount, 0);
        const execRate =
          org.annualSubsidy > 0
            ? Math.round((spent / org.annualSubsidy) * 1000) / 10
            : 0;
        const missingCount = orgExp.filter(
          (e) => getMissingDocs(e).length > 0
        ).length;

        return [
          org.name,
          org.category,
          org.chairperson,
          String(orgMembers.length),
          String(org.capacity),
          String(expiring),
          String(avgAtt),
          String(org.annualSubsidy),
          String(spent),
          String(execRate),
          org.settlementDeadline,
          formatDday(getDaysRemaining(org.settlementDeadline)),
          String(missingCount),
        ];
      }),
    ];
    downloadCSV(`자생단체_통합현황_${REFERENCE_TODAY}.csv`, rows);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-rose-50/80 border-r border-rose-200/80">
      {/* Brand Title */}
      <div className="h-14 px-5 border-b border-rose-200/70 flex items-center justify-between shrink-0">
        <span className="text-base font-bold tracking-tight text-rose-950 whitespace-nowrap">
          자생단체 통합관리
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-rose-700 hover:text-rose-950"
          aria-label="메뉴 닫기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Views */}
      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-rose-600 text-white'
                  : 'text-rose-900/85 hover:bg-rose-100/80 hover:text-rose-950'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Organization Filter List */}
      <div className="px-3 pt-4 pb-3 border-t border-rose-200/70 flex-1 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-semibold text-rose-700/85">
          소속 단체별 보기
        </div>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedOrgId('all')}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              selectedOrgId === 'all'
                ? 'bg-rose-200/75 text-rose-950 font-semibold'
                : 'text-rose-900/80 hover:bg-rose-100/80 hover:text-rose-950'
            }`}
          >
            <span className="truncate">전체 자생단체</span>
            <span className="tabular-nums text-rose-600/80">
              {organizations.length}
            </span>
          </button>

          {organizations.map((org) => {
            const isSelected = selectedOrgId === org.id;
            const orgAlerts = alerts.filter(
              (a) => a.orgId === org.id && a.severity === 'urgent'
            ).length;
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => setSelectedOrgId(org.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  isSelected
                    ? 'bg-rose-200/75 text-rose-950 font-semibold'
                    : 'text-rose-900/80 hover:bg-rose-100/80 hover:text-rose-950'
                }`}
              >
                <span className="truncate">{org.name}</span>
                {orgAlerts > 0 && (
                  <span className="text-[11px] font-semibold text-red-600 tabular-nums shrink-0 ml-2">
                    긴급 {orgAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info & Reset */}
      <div className="p-3 border-t border-rose-200/70 space-y-2">
        <div className="px-3 text-xs text-rose-700/80 tabular-nums">
          기준일: {REFERENCE_TODAY}
        </div>
        <button
          type="button"
          onClick={handleResetDemoData}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-800 hover:text-rose-950 hover:bg-rose-100/80 rounded-md transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>기본 데이터로 초기화</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left + 1-2 single-line actions on right */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              aria-label="메뉴 열기"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                자생단체 관리
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 whitespace-nowrap">
                {activeNavLabel}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 truncate">{activeOrgName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {urgentAlertCount > 0 && (
              <button
                type="button"
                onClick={() => handleNavigate('overview')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100/70 transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>긴급 알림 {urgentAlertCount}건</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportIntegratedReport}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>통합 현황 내보내기</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewBoard
              organizations={organizations}
              members={members}
              meetings={meetings}
              expenses={expenses}
              alerts={alerts}
              selectedOrgId={selectedOrgId}
              onSelectOrg={setSelectedOrgId}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'members' && (
            <MemberRosterView
              organizations={organizations}
              members={members}
              selectedOrgId={selectedOrgId}
              onSelectOrg={setSelectedOrgId}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
            />
          )}

          {activeTab === 'meetings' && (
            <MeetingsAttendanceView
              organizations={organizations}
              members={members}
              meetings={meetings}
              selectedOrgId={selectedOrgId}
              onSelectOrg={setSelectedOrgId}
              onAddMeeting={handleAddMeeting}
              onUpdateMeeting={handleUpdateMeeting}
              onDeleteMeeting={handleDeleteMeeting}
            />
          )}

          {activeTab === 'subsidy' && (
            <SubsidySettlementView
              organizations={organizations}
              expenses={expenses}
              selectedOrgId={selectedOrgId}
              onSelectOrg={setSelectedOrgId}
              onToggleExpenseDoc={handleToggleExpenseDoc}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          )}
        </main>
      </div>
    </div>
  );
}
