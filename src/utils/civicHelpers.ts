import {
  AttendanceStatus,
  DeadlineAlert,
  DocKey,
  DocMeta,
  Meeting,
  Member,
  Organization,
  OrganizationCoreMetrics,
  SubsidyExpense,
  TermExpiryAlert,
} from '../types';

export const REFERENCE_TODAY = '2026-11-25';
export const TERM_ALERT_WINDOW_DAYS = 30;

export const DOC_DEFINITIONS: DocMeta[] = [
  {
    key: 'resolution',
    label: '지출결의서',
    shortLabel: '결의서',
    description: '보조금 집행 사전 품의 및 지출결의 서명본',
  },
  {
    key: 'receipt',
    label: '카드전표·세금계산서',
    shortLabel: '영수증',
    description: '보조금 전용카드 매출전표 또는 전자세금계산서',
  },
  {
    key: 'statement',
    label: '견적서·거래명세서',
    shortLabel: '명세서',
    description: '품목·단가·수량이 명시된 거래명세서 및 견적서',
  },
  {
    key: 'photo',
    label: '행사·물품 증빙사진',
    shortLabel: '사진',
    description: '활동 현장 사진 또는 납품 검수 사진',
  },
  {
    key: 'transfer',
    label: '이체확인증·통장사본',
    shortLabel: '이체증',
    description: '계좌이체 확인증 및 거래처 통장사본',
  },
];

export function getDocLabel(key: DocKey): string {
  return DOC_DEFINITIONS.find((d) => d.key === key)?.label ?? key;
}

export function getDaysRemaining(
  targetDateStr: string,
  baseDateStr: string = REFERENCE_TODAY
): number {
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const [by, bm, bd] = baseDateStr.split('-').map(Number);
  const target = Date.UTC(ty, tm - 1, td);
  const base = Date.UTC(by, bm - 1, bd);
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
}

export function formatDday(days: number): string {
  if (days === 0) return 'D-Day';
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)} 경과`;
}

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatKRWShort(amount: number): string {
  if (amount >= 10000) {
    const man = Math.round(amount / 10000);
    return `${man.toLocaleString('ko-KR')}만원`;
  }
  return formatKRW(amount);
}

export function formatKoreanDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${m}월 ${d}일 (${weekdays[dt.getDay()]})`;
}

export function getMissingDocs(expense: SubsidyExpense): DocKey[] {
  return expense.requiredDocs.filter((docKey) => !expense.submittedDocs[docKey]);
}

export function calculateMeetingAttendance(
  meeting: Meeting,
  orgMembers: Member[]
): {
  total: number;
  attendCount: number;
  delegateCount: number;
  absentCount: number;
  rate: number;
} {
  const memberIds =
    orgMembers.length > 0
      ? orgMembers.map((m) => m.id)
      : Object.keys(meeting.attendance);
  const total = memberIds.length;
  if (total === 0) {
    return { total: 0, attendCount: 0, delegateCount: 0, absentCount: 0, rate: 0 };
  }

  let attendCount = 0;
  let delegateCount = 0;
  let absentCount = 0;

  memberIds.forEach((id) => {
    const status: AttendanceStatus = meeting.attendance[id] ?? 'absent';
    if (status === 'attend') attendCount += 1;
    else if (status === 'delegate') delegateCount += 1;
    else absentCount += 1;
  });

  // 위임(delegate)도 의결 정족수에 반영하되, 실참석률과 구분 표시 가능. 여기서는 실참석+위임 또는 실참석 기준:
  // 행정 실무 기준: 실참석(직접 참석) 기준 참석률 계산
  const rate = Math.round((attendCount / total) * 1000) / 10;
  return { total, attendCount, delegateCount, absentCount, rate };
}

export function generateMeetingNotice(
  org: Organization,
  meeting: {
    title: string;
    date: string;
    time: string;
    location: string;
    agenda: string;
    noticeNotes?: string;
  },
  members: Member[]
): string {
  const formattedDate = meeting.date ? formatKoreanDate(meeting.date) : '미정';
  const chair = members.find((m) => m.role === '회장')?.name ?? org.chairperson;
  const secretary = members.find((m) => m.role === '총무');
  const contactText = secretary
    ? `${secretary.name} 총무 (${secretary.phone})`
    : org.secretaryContact;

  const agendaLines = meeting.agenda
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => `   ${idx + 1}. ${line.replace(/^\d+[.)]\s*/, '')}`)
    .join('\n');

  return `[${org.name} ${meeting.title} 개최 안내]

안녕하십니까, ${org.name} 회원 여러분.
다가오는 주요 현안 논의 및 원활한 단체 운영을 위하여 아래와 같이 회의를 개최하오니 바쁘시더라도 꼭 참석해 주시기 바랍니다.

■ 일    시: ${formattedDate} ${meeting.time || ''}
■ 장    소: ${meeting.location || org.defaultLocation}
■ 참 석 자: ${org.name} 회원 전원 (${members.length}명)
■ 주요 안건:
${agendaLines || '   1. 당면 현안 보고 및 기타 토의'}
${meeting.noticeNotes ? `\n■ 안내 사항: ${meeting.noticeNotes}\n` : ''}
※ 회의 자료 준비 및 정족수 확인을 위해 참석 여부를 회신해 주시기 바랍니다. (불참 시 위임장 제출 또는 사전 연락 요망)

문의: ${contactText}
${org.name} 회장 ${chair} 올림`;
}

export function generateMeetingReportDraft(
  org: Organization,
  meeting: Meeting,
  members: Member[]
): string {
  const stats = calculateMeetingAttendance(meeting, members);
  const attendeeNames = members
    .filter((m) => meeting.attendance[m.id] === 'attend')
    .map((m) => `${m.name}(${m.role})`);
  const delegateNames = members
    .filter((m) => meeting.attendance[m.id] === 'delegate')
    .map((m) => `${m.name}(${m.role})`);
  const absentNames = members
    .filter((m) => !meeting.attendance[m.id] || meeting.attendance[m.id] === 'absent')
    .map((m) => `${m.name}(${m.role})`);

  const quorumMet = stats.attendCount + stats.delegateCount >= Math.ceil(stats.total / 2);
  const chair = members.find((m) => m.role === '회장')?.name ?? org.chairperson;
  const secretary = members.find((m) => m.role === '총무')?.name ?? '총무';

  const agendaLines = meeting.agenda
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, idx) => `  ${idx + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`)
    .join('\n');

  return `[${org.name} 회의 결과 보고서 (초안)]

1. 회의 개요
  - 회 의 명: ${meeting.title || '정기회의'}
  - 일    시: ${meeting.date ? formatKoreanDate(meeting.date) : '미정'} ${meeting.time || ''}
  - 장    소: ${meeting.location || org.defaultLocation}
  - 주    관: ${org.name} (회장 ${chair})

2. 참석 현황 및 정족수
  - 재적 인원: ${stats.total}명
  - 참석 현황: 직접 참석 ${stats.attendCount}명 (실참석률 ${stats.rate}%) / 위임 ${stats.delegateCount}명 / 불참 ${stats.absentCount}명
  - 성원 여부: ${quorumMet ? '재적 과반수 이상 출석(위임 포함)으로 성원 충족' : '정족수 미달 (추가 확인 필요)'}
  - 참 석 자: ${attendeeNames.join(', ') || '없음'}
  - 위 임 자: ${delegateNames.join(', ') || '없음'}
  - 불 참 자: ${absentNames.join(', ') || '없음'}

3. 상정 안건
${agendaLines || '  1. 당면 현안 보고 및 기타 토의'}

4. 주요 논의 및 의결 결과
  - ${meeting.summaryNotes?.trim() || '(회의 결과 및 의결 사항을 입력하면 본 항목에 자동 반영됩니다.)'}

5. 향후 조치 계획
  - 회의 결과 단체 회원 공유 및 관련 증빙(회의록·서명부) 보관
  - 작성일: ${REFERENCE_TODAY} / 작성자: ${secretary} / 확인: 회장 ${chair}`;
}

export function getTermExpiryAlerts(
  orgs: Organization[],
  members: Member[],
  windowDays: number = TERM_ALERT_WINDOW_DAYS
): TermExpiryAlert[] {
  return members
    .map((member) => {
      const daysLeft = getDaysRemaining(member.termEnd);
      if (daysLeft > windowDays) return null;
      const org = orgs.find((o) => o.id === member.orgId);
      const severity: TermExpiryAlert['severity'] =
        daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'urgent_7d' : 'warning_30d';
      return {
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        orgId: member.orgId,
        orgName: org?.name ?? '',
        termEnd: member.termEnd,
        daysLeft,
        severity,
      };
    })
    .filter((item): item is TermExpiryAlert => item !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getOrganizationCoreMetrics(
  org: Organization,
  members: Member[],
  meetings: Meeting[],
  expenses: SubsidyExpense[]
): OrganizationCoreMetrics {
  const orgMembers = members.filter((m) => m.orgId === org.id);
  const sortedByTerm = [...orgMembers].sort((a, b) =>
    a.termEnd.localeCompare(b.termEnd)
  );
  const earliestMember = sortedByTerm[0] ?? null;
  const expiringWithin30Count = orgMembers.filter(
    (m) => getDaysRemaining(m.termEnd) <= TERM_ALERT_WINDOW_DAYS
  ).length;

  const orgExpenses = expenses.filter((e) => e.orgId === org.id);
  const subsidySpent = orgExpenses.reduce((acc, e) => acc + e.amount, 0);
  const subsidyRemaining = Math.max(org.annualSubsidy - subsidySpent, 0);
  const executionRate =
    org.annualSubsidy > 0
      ? Math.round((subsidySpent / org.annualSubsidy) * 1000) / 10
      : 0;
  const missingDocsItems = orgExpenses.filter(
    (e) => getMissingDocs(e).length > 0
  ).length;

  const completedMeetings = meetings
    .filter((m) => m.orgId === org.id && m.status === '완료')
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestMeeting = completedMeetings[0] ?? null;

  const upcomingMeetings = meetings
    .filter((m) => m.orgId === org.id && m.status === '예정')
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextMeeting = upcomingMeetings[0] ?? null;

  const avgAttendanceRate =
    completedMeetings.length > 0
      ? Math.round(
          (completedMeetings.reduce(
            (acc, mt) => acc + calculateMeetingAttendance(mt, orgMembers).rate,
            0
          ) /
            completedMeetings.length) *
            10
        ) / 10
      : 0;

  return {
    org,
    memberCount: orgMembers.length,
    earliestTermEnd: earliestMember?.termEnd ?? null,
    earliestTermDaysLeft: earliestMember
      ? getDaysRemaining(earliestMember.termEnd)
      : null,
    earliestTermMemberName: earliestMember
      ? `${earliestMember.name}(${earliestMember.role})`
      : null,
    expiringWithin30Count,
    subsidyBudget: org.annualSubsidy,
    subsidySpent,
    subsidyRemaining,
    executionRate,
    missingDocsItems,
    settlementDaysLeft: getDaysRemaining(org.settlementDeadline),
    latestMeetingDate: latestMeeting?.date ?? null,
    latestMeetingTitle: latestMeeting?.title ?? null,
    nextMeetingDate: nextMeeting?.date ?? null,
    nextMeetingTitle: nextMeeting?.title ?? null,
    avgAttendanceRate,
  };
}

export function parseAttendeeNamesInput(
  rawText: string,
  orgMembers: Member[]
): {
  attendanceMap: Record<string, AttendanceStatus>;
  matchedNames: string[];
  unmatchedTokens: string[];
} {
  const tokens = rawText
    .split(/[\n,;·\s]+/)
    .map((t) => t.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);

  const attendanceMap: Record<string, AttendanceStatus> = {};
  orgMembers.forEach((m) => {
    attendanceMap[m.id] = 'absent';
  });

  const matchedNames: string[] = [];
  const unmatchedTokens: string[] = [];

  tokens.forEach((token) => {
    const matched = orgMembers.find((m) => m.name === token);
    if (matched) {
      attendanceMap[matched.id] = 'attend';
      if (!matchedNames.includes(matched.name)) {
        matchedNames.push(matched.name);
      }
    } else {
      unmatchedTokens.push(token);
    }
  });

  return { attendanceMap, matchedNames, unmatchedTokens };
}

export function buildDeadlineAlerts(
  orgs: Organization[],
  members: Member[],
  expenses: SubsidyExpense[],
  meetings: Meeting[]
): DeadlineAlert[] {
  const alerts: DeadlineAlert[] = [];

  // 1. 임기 만료 30일 전 알림 (만료 경과 포함)
  getTermExpiryAlerts(orgs, members, TERM_ALERT_WINDOW_DAYS).forEach((tAlert) => {
    alerts.push({
      id: `term-${tAlert.memberId}`,
      type: 'term',
      severity: tAlert.daysLeft <= 7 ? 'urgent' : 'warning',
      daysLeft: tAlert.daysLeft,
      orgId: tAlert.orgId,
      orgName: tAlert.orgName,
      title: `${tAlert.memberName} (${tAlert.role}) 임기 만료 ${
        tAlert.daysLeft < 0 ? '경과' : '임박'
      }`,
      detail: `${tAlert.orgName} · 만료일 ${tAlert.termEnd} (${formatDday(
        tAlert.daysLeft
      )})`,
      targetDate: tAlert.termEnd,
      actionTab: 'members',
    });
  });

  // 2. 보조금 정산 마감 임박 (30일 이내) 또는 증빙 서류 누락 점검
  orgs.forEach((org) => {
    const days = getDaysRemaining(org.settlementDeadline);
    const orgExpenses = expenses.filter((e) => e.orgId === org.id);
    const missingItems = orgExpenses.filter((e) => getMissingDocs(e).length > 0);

    if (days <= TERM_ALERT_WINDOW_DAYS) {
      alerts.push({
        id: `settlement-${org.id}`,
        type: 'settlement',
        severity: days <= 10 || missingItems.length > 0 ? 'urgent' : 'warning',
        daysLeft: days,
        orgId: org.id,
        orgName: org.shortName,
        title: `${org.name} 보조금 정산 마감 ${formatDday(days)}`,
        detail: `정산 마감일 ${org.settlementDeadline} · 증빙 미비 ${missingItems.length}건`,
        targetDate: org.settlementDeadline,
        actionTab: 'subsidy',
      });
    }
  });

  // 3. 10일 이내 예정된 회의 일정
  meetings
    .filter((m) => m.status === '예정')
    .forEach((meeting) => {
      const days = getDaysRemaining(meeting.date);
      if (days >= 0 && days <= 10) {
        const org = orgs.find((o) => o.id === meeting.orgId);
        alerts.push({
          id: `meeting-${meeting.id}`,
          type: 'meeting',
          severity: days <= 3 ? 'warning' : 'info',
          daysLeft: days,
          orgId: meeting.orgId,
          orgName: org?.shortName ?? '',
          title: `${org?.shortName ?? ''} ${meeting.title} 예정`,
          detail: `${meeting.date} ${meeting.time} · ${meeting.location} (${formatDday(days)})`,
          targetDate: meeting.date,
          actionTab: 'meetings',
        });
      }
    });

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function downloadCSV(filename: string, rows: string[][]): void {
  const csvContent =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
