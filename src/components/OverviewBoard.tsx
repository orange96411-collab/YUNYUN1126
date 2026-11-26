import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileWarning,
  Users,
  Wallet,
} from 'lucide-react';
import {
  DeadlineAlert,
  Meeting,
  Member,
  Organization,
  SubsidyExpense,
  ViewTab,
} from '../types';
import {
  calculateMeetingAttendance,
  formatDday,
  formatKRW,
  formatKRWShort,
  getDaysRemaining,
  getMissingDocs,
  getOrganizationCoreMetrics,
  TERM_ALERT_WINDOW_DAYS,
} from '../utils/civicHelpers';

interface OverviewBoardProps {
  organizations: Organization[];
  members: Member[];
  meetings: Meeting[];
  expenses: SubsidyExpense[];
  alerts: DeadlineAlert[];
  selectedOrgId: string;
  onSelectOrg: (orgId: string) => void;
  onNavigate: (tab: ViewTab, orgId?: string) => void;
}

export const OverviewBoard: React.FC<OverviewBoardProps> = ({
  organizations,
  members,
  meetings,
  expenses,
  alerts,
  selectedOrgId,
  onSelectOrg,
  onNavigate,
}) => {
  const [alertFilter, setAlertFilter] = useState<'all' | 'term' | 'settlement' | 'meeting'>('all');

  const scopedOrgs = useMemo(
    () =>
      selectedOrgId === 'all'
        ? organizations
        : organizations.filter((o) => o.id === selectedOrgId),
    [organizations, selectedOrgId]
  );

  const scopedMembers = useMemo(
    () =>
      selectedOrgId === 'all'
        ? members
        : members.filter((m) => m.orgId === selectedOrgId),
    [members, selectedOrgId]
  );

  const scopedMeetings = useMemo(
    () =>
      selectedOrgId === 'all'
        ? meetings
        : meetings.filter((m) => m.orgId === selectedOrgId),
    [meetings, selectedOrgId]
  );

  const scopedExpenses = useMemo(
    () =>
      selectedOrgId === 'all'
        ? expenses
        : expenses.filter((e) => e.orgId === selectedOrgId),
    [expenses, selectedOrgId]
  );

  const scopedAlerts = useMemo(() => {
    const base =
      selectedOrgId === 'all'
        ? alerts
        : alerts.filter((a) => a.orgId === selectedOrgId);
    if (alertFilter === 'all') return base;
    return base.filter((a) => a.type === alertFilter);
  }, [alerts, selectedOrgId, alertFilter]);

  const kpi = useMemo(() => {
    const totalCapacity = scopedOrgs.reduce((acc, o) => acc + o.capacity, 0);
    const expiringCount = scopedMembers.filter(
      (m) => getDaysRemaining(m.termEnd) <= 30
    ).length;

    const completedMeetings = scopedMeetings.filter((m) => m.status === '완료');
    const upcomingMeetings = scopedMeetings.filter((m) => m.status === '예정');

    let avgAttendance = 0;
    if (completedMeetings.length > 0) {
      const sumRate = completedMeetings.reduce((acc, mt) => {
        const orgMembers = members.filter((m) => m.orgId === mt.orgId);
        return acc + calculateMeetingAttendance(mt, orgMembers).rate;
      }, 0);
      avgAttendance = Math.round((sumRate / completedMeetings.length) * 10) / 10;
    }

    const totalBudget = scopedOrgs.reduce((acc, o) => acc + o.annualSubsidy, 0);
    const totalSpent = scopedExpenses.reduce((acc, e) => acc + e.amount, 0);
    const executionRate =
      totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0;

    const missingExpenseCount = scopedExpenses.filter(
      (e) => getMissingDocs(e).length > 0
    ).length;

    const earliestSettlement = scopedOrgs
      .map((o) => ({
        name: o.shortName,
        days: getDaysRemaining(o.settlementDeadline),
      }))
      .sort((a, b) => a.days - b.days)[0];

    return {
      memberCount: scopedMembers.length,
      totalCapacity,
      expiringCount,
      upcomingCount: upcomingMeetings.length,
      avgAttendance,
      totalBudget,
      totalSpent,
      executionRate,
      missingExpenseCount,
      totalExpenses: scopedExpenses.length,
      earliestSettlement,
    };
  }, [scopedOrgs, scopedMembers, scopedMeetings, scopedExpenses, members]);

  const orgMatrixRows = useMemo(() => {
    return scopedOrgs.map((org) =>
      getOrganizationCoreMetrics(org, members, meetings, expenses)
    );
  }, [scopedOrgs, members, meetings, expenses]);

  const upcomingMeetingsList = useMemo(() => {
    return scopedMeetings
      .filter((m) => m.status === '예정')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [scopedMeetings]);

  return (
    <div className="space-y-6">
      {/* 1. 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('members')}
          className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>등록 회원 · 임기 관리</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {kpi.memberCount}명
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              / 정원 {kpi.totalCapacity}명
            </span>
          </div>
          <div className="mt-2 text-xs">
            {kpi.expiringCount > 0 ? (
              <span className="text-amber-700 font-medium">
                30일 내 임기만료 {kpi.expiringCount}명
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                임박 임기만료 없음
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('meetings')}
          className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>회의 일정 · 평균 참석률</span>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {kpi.avgAttendance}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              완료 회의 평균
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 tabular-nums">
            예정된 회의 {kpi.upcomingCount}건
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('subsidy')}
          className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>보조금 총 집행 현황</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {kpi.executionRate}%
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              {formatKRWShort(kpi.totalSpent)} / {formatKRWShort(kpi.totalBudget)}
            </span>
          </div>
          <div className="mt-2.5 w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden">
            <div
              className="h-full bg-blue-700"
              style={{ width: `${Math.min(kpi.executionRate, 100)}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('subsidy')}
          className="text-left bg-white border border-slate-200 rounded-lg p-5 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>정산 마감 · 증빙 서류 점검</span>
            <FileWarning className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tabular-nums ${
                kpi.missingExpenseCount > 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              누락 {kpi.missingExpenseCount}건
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              / 전체 {kpi.totalExpenses}건
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 tabular-nums">
            {kpi.earliestSettlement
              ? `최단 정산 마감: ${kpi.earliestSettlement.name} (${formatDday(
                  kpi.earliestSettlement.days
                )})`
              : '정산 일정 없음'}
          </div>
        </button>
      </div>

      {/* 2. Deadline & Expiration Alert Center */}
      <section className="bg-white border border-slate-200 rounded-lg">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              임기 만료 · 정산 마감 알림
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              오늘(2026-11-25) 기준 30일 이내 임기 만료 회원, 정산 마감 임박 단체 및 예정 회의입니다.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start sm:self-auto">
            {(
              [
                { id: 'all', label: '전체' },
                { id: 'settlement', label: '정산 마감' },
                { id: 'term', label: '임기 만료' },
                { id: 'meeting', label: '예정 회의' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAlertFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  alertFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {scopedAlerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>해당 조건의 임박한 마감 또는 알림이 없습니다.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {scopedAlerts.map((alert) => {
              const isUrgent = alert.severity === 'urgent';
              const isWarning = alert.severity === 'warning';
              return (
                <div
                  key={alert.id}
                  className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isUrgent
                          ? 'text-red-600'
                          : isWarning
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {alert.title}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span
                          className={`text-xs font-semibold tabular-nums whitespace-nowrap ${
                            isUrgent
                              ? 'text-red-600'
                              : isWarning
                              ? 'text-amber-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {formatDday(alert.daysLeft)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {alert.detail}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(alert.actionTab, alert.orgId)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>확인</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Unified Organization Core Metrics Matrix Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              자생단체별 핵심 지표 통합 현황
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              각 단체의 최단 임기 만료일({TERM_ALERT_WINDOW_DAYS}일 전 알림 기준), 보조금 잔액·집행률, 최근 회의일 및 차기 일정을 한눈에 조회합니다.
            </p>
          </div>
          {selectedOrgId !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectOrg('all')}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
            >
              전체 단체 보기
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-3 px-4 whitespace-nowrap">단체명 / 회장·총무</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">회원수</th>
                <th className="py-3 px-4 whitespace-nowrap">최단 임기 만료일</th>
                <th className="py-3 px-4 whitespace-nowrap">최근 회의일 / 차기 일정</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">평균 참석률</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">보조금 잔액</th>
                <th className="py-3 px-4 whitespace-nowrap">집행률 · 정산 마감</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {orgMatrixRows.map((m) => {
                const isTermUrgent =
                  m.earliestTermDaysLeft !== null && m.earliestTermDaysLeft <= 7;
                const isTermWarn =
                  m.earliestTermDaysLeft !== null &&
                  m.earliestTermDaysLeft > 7 &&
                  m.earliestTermDaysLeft <= TERM_ALERT_WINDOW_DAYS;

                return (
                  <tr
                    key={m.org.id}
                    onClick={() =>
                      onSelectOrg(m.org.id === selectedOrgId ? 'all' : m.org.id)
                    }
                    className={`cursor-pointer transition-colors ${
                      selectedOrgId === m.org.id
                        ? 'bg-blue-50/40'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {m.org.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {m.org.category} · 회장 {m.org.chairperson} ·{' '}
                        {m.org.secretaryContact}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <span className="font-medium text-slate-900">
                        {m.memberCount}명
                      </span>
                      <span className="text-xs text-slate-400">
                        {' '}
                        / {m.org.capacity}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {m.earliestTermEnd && m.earliestTermDaysLeft !== null ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('members', m.org.id);
                          }}
                          className="text-left group"
                        >
                          <div
                            className={`text-xs font-semibold tabular-nums group-hover:underline ${
                              isTermUrgent
                                ? 'text-red-600'
                                : isTermWarn
                                ? 'text-amber-700'
                                : 'text-slate-900'
                            }`}
                          >
                            {m.earliestTermEnd} ({formatDday(m.earliestTermDaysLeft)})
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            {m.earliestTermMemberName}
                            {m.expiringWithin30Count > 0 &&
                              ` · 30일 내 ${m.expiringWithin30Count}명`}
                          </div>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">미등록</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('meetings', m.org.id);
                        }}
                        className="text-left group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 tabular-nums">
                          최근: {m.latestMeetingDate ?? '기록 없음'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[190px] tabular-nums">
                          {m.nextMeetingDate
                            ? `예정: ${m.nextMeetingDate} (${m.nextMeetingTitle})`
                            : m.latestMeetingTitle ?? m.org.regularMeetingDay}
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <span className="font-medium text-slate-900">
                        {m.avgAttendanceRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      <div className="text-sm font-bold text-slate-900">
                        {formatKRW(m.subsidyRemaining)}
                      </div>
                      <div className="text-xs text-slate-500">
                        교부 {formatKRWShort(m.subsidyBudget)}
                      </div>
                    </td>
                    <td className="py-3 px-4 min-w-[180px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('subsidy', m.org.id);
                        }}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center justify-between text-xs tabular-nums mb-1">
                          <span className="font-semibold text-slate-900 group-hover:underline">
                            {m.executionRate}% 집행
                          </span>
                          <span
                            className={`font-medium ${
                              m.settlementDaysLeft <= 7
                                ? 'text-red-600'
                                : m.settlementDaysLeft <= 15
                                ? 'text-amber-700'
                                : 'text-slate-500'
                            }`}
                          >
                            마감 {formatDday(m.settlementDaysLeft)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className={`h-full ${
                              m.missingDocsItems > 0 ? 'bg-amber-600' : 'bg-blue-700'
                            }`}
                            style={{ width: `${Math.min(m.executionRate, 100)}%` }}
                          />
                        </div>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Lower 2-Column Operational Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Scheduled Meetings */}
        <section className="bg-white border border-slate-200 rounded-lg flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              다가오는 회의 일정
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('meetings')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              회의·참석률 관리
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {upcomingMeetingsList.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">
                예정된 회의 일정이 없습니다.
              </div>
            ) : (
              upcomingMeetingsList.map((mt) => {
                const org = organizations.find((o) => o.id === mt.orgId);
                const days = getDaysRemaining(mt.date);
                return (
                  <div
                    key={mt.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {org?.name}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {mt.date} {mt.time}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-blue-700 tabular-nums">
                          {formatDday(days)}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 mt-0.5 truncate">
                        {mt.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {mt.location}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('meetings', mt.orgId)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                    >
                      안내문 생성
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Quick Subsidy Balance Overview */}
        <section className="bg-white border border-slate-200 rounded-lg flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              단체별 보조금 집행 잔액 요약
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('subsidy')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              정산 체크리스트
            </button>
          </div>
          <div className="p-5 space-y-4 flex-1">
            {orgMatrixRows.map((m) => (
              <div key={m.org.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {m.org.name}
                    </span>
                    {m.missingDocsItems > 0 && (
                      <span className="text-red-600 font-medium tabular-nums">
                        · 증빙 누락 {m.missingDocsItems}건
                      </span>
                    )}
                  </div>
                  <div className="tabular-nums text-slate-600">
                    <span className="font-semibold text-slate-900">
                      잔액 {formatKRW(m.subsidyRemaining)}
                    </span>{' '}
                    / 집행 {formatKRWShort(m.subsidySpent)} ({m.executionRate}%)
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      m.missingDocsItems > 0 ? 'bg-amber-600' : 'bg-blue-700'
                    }`}
                    style={{ width: `${Math.min(m.executionRate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
