import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  AttendanceStatus,
  Meeting,
  Member,
  Organization,
} from '../types';
import {
  calculateMeetingAttendance,
  formatDday,
  generateMeetingNotice,
  generateMeetingReportDraft,
  getDaysRemaining,
  parseAttendeeNamesInput,
} from '../utils/civicHelpers';

interface MeetingsAttendanceViewProps {
  organizations: Organization[];
  members: Member[];
  meetings: Meeting[];
  selectedOrgId: string;
  onSelectOrg: (orgId: string) => void;
  onAddMeeting: (meeting: Omit<Meeting, 'id'>) => string;
  onUpdateMeeting: (meeting: Meeting) => void;
  onDeleteMeeting: (meetingId: string) => void;
}

export const MeetingsAttendanceView: React.FC<MeetingsAttendanceViewProps> = ({
  organizations,
  members,
  meetings,
  selectedOrgId,
  onSelectOrg,
  onAddMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | '예정' | '완료'>('all');
  const [activeMeetingId, setActiveMeetingId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Draft form state for creating a new meeting or editing the selected meeting
  const defaultOrgId =
    selectedOrgId === 'all' ? organizations[0]?.id ?? 'org-jumin' : selectedOrgId;

  const [draft, setDraft] = useState<Omit<Meeting, 'id'>>(() => {
    const org = organizations.find((o) => o.id === defaultOrgId) ?? organizations[0];
    const orgMembers = members.filter((m) => m.orgId === org?.id);
    const initialAttendance: Record<string, AttendanceStatus> = {};
    orgMembers.forEach((m) => {
      initialAttendance[m.id] = 'attend';
    });
    return {
      orgId: org?.id ?? '',
      title: '12월 정기회의',
      date: '2026-12-10',
      time: '18:00',
      location: org?.defaultLocation ?? '',
      agenda: '연말 보조금 정산 결과 보고\n2027년도 주요 사업계획 심의',
      status: '예정',
      attendance: initialAttendance,
      summaryNotes: '',
      noticeNotes: '',
    };
  });

  const [docMode, setDocMode] = useState<'notice' | 'minutes'>('notice');
  const [customText, setCustomText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkNameInput, setBulkNameInput] = useState('');
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Filtered list of meetings
  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((m) => (selectedOrgId === 'all' ? true : m.orgId === selectedOrgId))
      .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [meetings, selectedOrgId, statusFilter]);

  // Keep activeMeetingId synchronized when filter or list changes
  useEffect(() => {
    if (isCreatingNew) return;
    if (
      !activeMeetingId ||
      !filteredMeetings.some((m) => m.id === activeMeetingId)
    ) {
      if (filteredMeetings.length > 0) {
        setActiveMeetingId(filteredMeetings[0].id);
      } else {
        setActiveMeetingId('');
      }
    }
  }, [filteredMeetings, activeMeetingId, isCreatingNew]);

  const activeMeeting = useMemo(
    () => meetings.find((m) => m.id === activeMeetingId) ?? null,
    [meetings, activeMeetingId]
  );

  // Sync draft when switching active meeting
  useEffect(() => {
    if (!isCreatingNew && activeMeeting) {
      setDraft({
        orgId: activeMeeting.orgId,
        title: activeMeeting.title,
        date: activeMeeting.date,
        time: activeMeeting.time,
        location: activeMeeting.location,
        agenda: activeMeeting.agenda,
        status: activeMeeting.status,
        attendance: { ...activeMeeting.attendance },
        summaryNotes: activeMeeting.summaryNotes,
        noticeNotes: activeMeeting.noticeNotes ?? '',
      });
      setCustomText(null);
    }
  }, [activeMeeting, isCreatingNew]);

  // Organization-level attendance statistics (completed meetings)
  const orgAttendanceStats = useMemo(() => {
    return organizations.map((org) => {
      const orgMembers = members.filter((m) => m.orgId === org.id);
      const orgCompleted = meetings.filter(
        (m) => m.orgId === org.id && m.status === '완료'
      );
      const orgUpcoming = meetings.filter(
        (m) => m.orgId === org.id && m.status === '예정'
      );

      let avgRate = 0;
      if (orgCompleted.length > 0) {
        const totalRate = orgCompleted.reduce(
          (acc, mt) => acc + calculateMeetingAttendance(mt, orgMembers).rate,
          0
        );
        avgRate = Math.round((totalRate / orgCompleted.length) * 10) / 10;
      }

      return {
        org,
        completedCount: orgCompleted.length,
        upcomingCount: orgUpcoming.length,
        memberCount: orgMembers.length,
        avgRate,
      };
    });
  }, [organizations, members, meetings]);

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === draft.orgId) ?? organizations[0],
    [organizations, draft.orgId]
  );

  const currentOrgMembers = useMemo(
    () => members.filter((m) => m.orgId === draft.orgId),
    [members, draft.orgId]
  );

  const liveAttendanceStats = useMemo(() => {
    const tempMeeting: Meeting = {
      id: activeMeetingId || 'draft',
      ...draft,
    };
    return calculateMeetingAttendance(tempMeeting, currentOrgMembers);
  }, [draft, currentOrgMembers, activeMeetingId]);

  const generatedDocumentText = useMemo(() => {
    if (!currentOrg) return '';
    if (docMode === 'notice') {
      return generateMeetingNotice(currentOrg, draft, currentOrgMembers);
    }
    return generateMeetingReportDraft(
      currentOrg,
      { id: activeMeetingId || 'draft', ...draft },
      currentOrgMembers
    );
  }, [currentOrg, draft, currentOrgMembers, docMode, activeMeetingId]);

  const displayedText = customText ?? generatedDocumentText;

  const startNewMeeting = () => {
    const targetOrgId =
      selectedOrgId === 'all' ? organizations[0]?.id ?? 'org-jumin' : selectedOrgId;
    const org = organizations.find((o) => o.id === targetOrgId) ?? organizations[0];
    const orgMembers = members.filter((m) => m.orgId === targetOrgId);
    const att: Record<string, AttendanceStatus> = {};
    orgMembers.forEach((m) => {
      att[m.id] = 'attend';
    });
    setIsCreatingNew(true);
    setActiveMeetingId('');
    setDraft({
      orgId: targetOrgId,
      title: '',
      date: '2026-12-05',
      time: '18:00',
      location: org?.defaultLocation ?? '',
      agenda: '',
      status: '예정',
      attendance: att,
      summaryNotes: '',
      noticeNotes: '',
    });
    setCustomText(null);
  };

  const handleDraftChange = <K extends keyof Omit<Meeting, 'id'>>(
    key: K,
    value: Omit<Meeting, 'id'>[K]
  ) => {
    const updated = { ...draft, [key]: value };
    // If orgId changed during creation, reset location and member attendance map
    if (key === 'orgId') {
      const nextOrg = organizations.find((o) => o.id === value);
      const nextMembers = members.filter((m) => m.orgId === value);
      const att: Record<string, AttendanceStatus> = {};
      nextMembers.forEach((m) => {
        att[m.id] = 'attend';
      });
      updated.location = nextOrg?.defaultLocation ?? updated.location;
      updated.attendance = att;
    }

    setDraft(updated);
    setCustomText(null);

    if (!isCreatingNew && activeMeeting) {
      onUpdateMeeting({ id: activeMeeting.id, ...updated });
    }
  };

  const handleSetAttendance = (memberId: string, status: AttendanceStatus) => {
    const nextAttendance = { ...draft.attendance, [memberId]: status };
    handleDraftChange('attendance', nextAttendance);
  };

  const handleSetAllAttendance = (status: AttendanceStatus) => {
    const nextAttendance: Record<string, AttendanceStatus> = {};
    currentOrgMembers.forEach((m) => {
      nextAttendance[m.id] = status;
    });
    setBulkFeedback(null);
    handleDraftChange('attendance', nextAttendance);
  };

  const handleApplyBulkNames = () => {
    if (!bulkNameInput.trim()) return;
    const { attendanceMap, matchedNames, unmatchedTokens } =
      parseAttendeeNamesInput(bulkNameInput, currentOrgMembers);
    handleDraftChange('attendance', attendanceMap);
    const unmatchedMsg =
      unmatchedTokens.length > 0
        ? ` · 미일치(${unmatchedTokens.join(', ')})`
        : '';
    setBulkFeedback(
      `${matchedNames.length}명 참석 반영 완료${unmatchedMsg}`
    );
  };

  const handleSaveNewMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.date) return;
    const newId = onAddMeeting(draft);
    setIsCreatingNew(false);
    setActiveMeetingId(newId);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(displayedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback copy
      const textarea = document.createElement('textarea');
      textarea.value = displayedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Organization Attendance Rate Analytics */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              단체별 회의 참석률 통계
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              완료된 회의의 출석 체크 결과를 바탕으로 단체별 평균 실참석률을 자동 집계합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="단체 필터"
              value={selectedOrgId}
              onChange={(e) => onSelectOrg(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">전체 단체 보기</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={startNewMeeting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 회의 등록</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {orgAttendanceStats.map((stat) => {
            const isSelected = selectedOrgId === stat.org.id;
            return (
              <button
                key={stat.org.id}
                type="button"
                onClick={() =>
                  onSelectOrg(isSelected ? 'all' : stat.org.id)
                }
                className={`text-left p-3.5 border rounded-md transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-medium text-slate-600 truncate">
                  {stat.org.name}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 tabular-nums">
                    {stat.avgRate}%
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    완료 {stat.completedCount} · 예정 {stat.upcomingCount}
                  </span>
                </div>
                <div className="mt-2 w-full h-1.5 bg-slate-200 rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${
                      stat.avgRate >= 80
                        ? 'bg-emerald-600'
                        : stat.avgRate >= 65
                        ? 'bg-blue-700'
                        : 'bg-amber-600'
                    }`}
                    style={{ width: `${Math.min(stat.avgRate, 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Meeting Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">회의 목록</h3>
            <span className="text-xs text-slate-500 tabular-nums">
              총 {filteredMeetings.length}건
            </span>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start sm:self-auto">
            {(['all', '예정', '완료'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? '전체' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredMeetings.map((mt) => {
            const org = organizations.find((o) => o.id === mt.orgId);
            const orgMembers = members.filter((m) => m.orgId === mt.orgId);
            const stats = calculateMeetingAttendance(mt, orgMembers);
            const isActive = !isCreatingNew && mt.id === activeMeetingId;
            const days = getDaysRemaining(mt.date);

            return (
              <button
                key={mt.id}
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setActiveMeetingId(mt.id);
                }}
                className={`text-left p-3 border rounded-md transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-600 truncate">
                    {org?.shortName}
                  </span>
                  <span
                    className={`font-semibold tabular-nums whitespace-nowrap ${
                      mt.status === '예정' ? 'text-blue-700' : 'text-emerald-700'
                    }`}
                  >
                    {mt.status === '예정'
                      ? `예정 (${formatDday(days)})`
                      : `참석 ${stats.rate}%`}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                  {mt.title}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                  {mt.date} {mt.time}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Workspace: Left (Date/Agenda + Attendance Input) & Right (Auto-Generated Notice & Minutes) */}
      {(isCreatingNew || activeMeeting) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 cols: Meeting Input & Attendance Checklist */}
          <form
            onSubmit={handleSaveNewMeeting}
            className="lg:col-span-7 bg-white border border-slate-200 rounded-lg divide-y divide-slate-200"
          >
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {isCreatingNew
                    ? '새 회의 등록 및 참석자 입력'
                    : `${currentOrg?.name ?? ''} · ${draft.title}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  날짜·안건 및 참석 여부를 입력하면 참석률과 안내문 문구가 실시간으로 정리됩니다.
                </p>
              </div>
              {!isCreatingNew && activeMeeting && (
                <button
                  type="button"
                  onClick={() => onDeleteMeeting(activeMeeting.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              )}
            </div>

            {/* Meeting Metadata Fields */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    소속 단체
                  </label>
                  <select
                    value={draft.orgId}
                    onChange={(e) => handleDraftChange('orgId', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    회의 구분 / 상태
                  </label>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                    {(['예정', '완료'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleDraftChange('status', st)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                          draft.status === st
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st === '예정' ? '개최 예정' : '회의 완료'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    회의명
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.title}
                    onChange={(e) => handleDraftChange('title', e.target.value)}
                    placeholder="예: 12월 정기회의 및 보조금 정산 심의"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    회의 날짜
                  </label>
                  <input
                    type="date"
                    required
                    value={draft.date}
                    onChange={(e) => handleDraftChange('date', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => handleDraftChange('time', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    회의 장소
                  </label>
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(e) => handleDraftChange('location', e.target.value)}
                    placeholder="예: 행정복지센터 3층 대회의실"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    주요 안건 (줄바꿈으로 번호 자동 정리)
                  </label>
                  <textarea
                    rows={3}
                    value={draft.agenda}
                    onChange={(e) => handleDraftChange('agenda', e.target.value)}
                    placeholder="안건 1&#10;안건 2"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {draft.status === '예정'
                      ? '안내문 전달사항 (지참물·준비사항)'
                      : '회의 결과 및 의결 사항 요약'}
                  </label>
                  <textarea
                    rows={2}
                    value={
                      draft.status === '예정'
                        ? draft.noticeNotes ?? ''
                        : draft.summaryNotes
                    }
                    onChange={(e) =>
                      handleDraftChange(
                        draft.status === '예정' ? 'noticeNotes' : 'summaryNotes',
                        e.target.value
                      )
                    }
                    placeholder={
                      draft.status === '예정'
                        ? '예: 정산 영수증 원본 및 도장 지참 요청'
                        : '예: 2026년 보조금 집행 결산안 원안 가결'
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Attendance Input Section */}
            <div className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <UserCheck className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-900">
                    참석자 명단 입력
                  </h4>
                  <span className="text-xs font-semibold text-blue-700 tabular-nums">
                    실참석률 {liveAttendanceStats.rate}% ({liveAttendanceStats.attendCount}/
                    {liveAttendanceStats.total}명 · 위임 {liveAttendanceStats.delegateCount}명 · 불참{' '}
                    {liveAttendanceStats.absentCount}명)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetAllAttendance('attend')}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap"
                  >
                    전원 참석
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllAttendance('absent')}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap"
                  >
                    초기화
                  </button>
                </div>
              </div>

              {/* Bulk Name Roster Input */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={bulkNameInput}
                    onChange={(e) => setBulkNameInput(e.target.value)}
                    placeholder="참석자 성명 일괄 입력 (예: 김성호, 오현주, 박지영)"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBulkNames}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
                  >
                    명단 일괄 반영
                  </button>
                </div>
                {bulkFeedback && (
                  <p className="text-xs text-blue-700 font-medium">
                    {bulkFeedback}
                  </p>
                )}
              </div>

              <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {currentOrgMembers.map((member) => {
                  const status = draft.attendance[member.id] ?? 'absent';
                  return (
                    <div
                      key={member.id}
                      className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-900">
                          {member.name}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          {member.role} · {member.districtOrUnit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded shrink-0">
                        {(
                          [
                            { val: 'attend', label: '참석' },
                            { val: 'delegate', label: '위임' },
                            { val: 'absent', label: '불참' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => handleSetAttendance(member.id, opt.val)}
                            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                              status === opt.val
                                ? opt.val === 'attend'
                                  ? 'bg-emerald-600 text-white'
                                  : opt.val === 'delegate'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-700 text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isCreatingNew && (
                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                  >
                    회의 등록 및 저장
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* Right 5 cols: Auto-generated Notice & Report Draft Composer */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <h3 className="text-base font-semibold text-slate-900">
                  공지문 · 결과 보고서 자동 생성
                </h3>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('notice');
                    setCustomText(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    docMode === 'notice'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  안내 공지문
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocMode('minutes');
                    setCustomText(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    docMode === 'minutes'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  결과 보고서 초안
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3 flex-1 flex flex-col">
              <p className="text-xs text-slate-500">
                {docMode === 'notice'
                  ? '문자·단체 메신저 공지용으로 바로 발송할 수 있는 회의 안내 공지문입니다. 필요 시 내용을 직접 수정해 복사할 수 있습니다.'
                  : '재적·참석·위임 인원, 성원 충족 여부, 상정 안건 및 의결 결과가 반영된 회의 결과 보고서 초안입니다.'}
              </p>

              <textarea
                rows={16}
                value={displayedText}
                onChange={(e) => setCustomText(e.target.value)}
                aria-label="자동 생성된 문구"
                className="w-full flex-1 p-3.5 text-sm leading-relaxed text-slate-800 bg-slate-50 border border-slate-200 rounded-md font-sans focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCustomText(null)}
                  disabled={customText === null}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>자동 생성 초기화</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>복사 완료</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>문구 복사하기</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
