import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Member, Organization } from '../types';
import {
  downloadCSV,
  formatDday,
  getDaysRemaining,
} from '../utils/civicHelpers';

interface MemberRosterViewProps {
  organizations: Organization[];
  members: Member[];
  selectedOrgId: string;
  onSelectOrg: (orgId: string) => void;
  onAddMember: (member: Omit<Member, 'id'>) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
}

const ROLES: Member['role'][] = [
  '회장',
  '부회장',
  '총무',
  '감사',
  '위원',
  '통장',
  '회원',
];

export const MemberRosterView: React.FC<MemberRosterViewProps> = ({
  organizations,
  members,
  selectedOrgId,
  onSelectOrg,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [termFilter, setTermFilter] = useState<'all' | 'expiring30' | 'urgent7'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [formState, setFormState] = useState<Omit<Member, 'id'>>({
    orgId: selectedOrgId === 'all' ? organizations[0]?.id ?? '' : selectedOrgId,
    name: '',
    role: '위원',
    phone: '',
    districtOrUnit: '',
    appointedAt: '2026-11-25',
    termEnd: '2028-11-24',
    notes: '',
  });

  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => (selectedOrgId === 'all' ? true : m.orgId === selectedOrgId))
      .filter((m) => {
        const days = getDaysRemaining(m.termEnd);
        if (termFilter === 'expiring30') return days <= 30;
        if (termFilter === 'urgent7') return days <= 7;
        return true;
      })
      .filter((m) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.districtOrUnit.toLowerCase().includes(q) ||
          m.phone.includes(q)
        );
      })
      .sort((a, b) => a.termEnd.localeCompare(b.termEnd));
  }, [members, selectedOrgId, termFilter, searchQuery]);

  const expiringCounts = useMemo(() => {
    const scoped = members.filter((m) =>
      selectedOrgId === 'all' ? true : m.orgId === selectedOrgId
    );
    return {
      total: scoped.length,
      within30: scoped.filter((m) => getDaysRemaining(m.termEnd) <= 30).length,
      within7: scoped.filter((m) => getDaysRemaining(m.termEnd) <= 7).length,
    };
  }, [members, selectedOrgId]);

  const openAddModal = () => {
    setEditingMember(null);
    setFormState({
      orgId: selectedOrgId === 'all' ? organizations[0]?.id ?? '' : selectedOrgId,
      name: '',
      role: '위원',
      phone: '',
      districtOrUnit: '',
      appointedAt: '2026-11-25',
      termEnd: '2028-11-24',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setFormState({
      orgId: member.orgId,
      name: member.name,
      role: member.role,
      phone: member.phone,
      districtOrUnit: member.districtOrUnit,
      appointedAt: member.appointedAt,
      termEnd: member.termEnd,
      notes: member.notes ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.orgId) return;
    if (editingMember) {
      onUpdateMember({ ...editingMember, ...formState });
    } else {
      onAddMember(formState);
    }
    setIsModalOpen(false);
  };

  const handleExtendTerm = (member: Member) => {
    const [y, m, d] = member.termEnd.split('-').map(Number);
    const nextEnd = `${y + 2}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onUpdateMember({
      ...member,
      termEnd: nextEnd,
      notes: member.notes
        ? `${member.notes} (2년 연임 처리)`
        : '2년 연임 처리',
    });
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['단체명', '성명', '직책', '소속분과/통', '연락처', '위촉일', '임기만료일', '잔여일', '비고'],
      ...filteredMembers.map((m) => {
        const org = organizations.find((o) => o.id === m.orgId);
        return [
          org?.name ?? '',
          m.name,
          m.role,
          m.districtOrUnit,
          m.phone,
          m.appointedAt,
          m.termEnd,
          formatDday(getDaysRemaining(m.termEnd)),
          m.notes ?? '',
        ];
      }),
    ];
    downloadCSV('자생단체_회원명부.csv', rows);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar & Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="단체 선택"
            value={selectedOrgId}
            onChange={(e) => onSelectOrg(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">전체 자생단체 ({members.length}명)</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setTermFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                termFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 ({expiringCounts.total})
            </button>
            <button
              type="button"
              onClick={() => setTermFilter('expiring30')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                termFilter === 'expiring30'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30일 내 만료 ({expiringCounts.within30})
            </button>
            <button
              type="button"
              onClick={() => setTermFilter('urgent7')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                termFilter === 'urgent7'
                  ? 'bg-white text-red-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              긴급 7일 내 ({expiringCounts.within7})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 직책, 분과·통 검색"
              className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-md w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV 내보내기</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>회원 등록</span>
          </button>
        </div>
      </div>

      {/* Member Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              조건에 해당하는 회원이 없습니다.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>신규 회원 등록</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">성명 / 직책</th>
                  <th className="py-3 px-4 whitespace-nowrap">소속 단체</th>
                  <th className="py-3 px-4 whitespace-nowrap">분과 · 관할통</th>
                  <th className="py-3 px-4 whitespace-nowrap">연락처</th>
                  <th className="py-3 px-4 whitespace-nowrap">위촉일</th>
                  <th className="py-3 px-4 whitespace-nowrap">임기 만료일</th>
                  <th className="py-3 px-4 whitespace-nowrap">상태</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredMembers.map((member) => {
                  const org = organizations.find((o) => o.id === member.orgId);
                  const daysLeft = getDaysRemaining(member.termEnd);
                  const isUrgent = daysLeft <= 7;
                  const isWarning = daysLeft > 7 && daysLeft <= 30;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {member.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            · {member.role}
                          </span>
                        </div>
                        {member.notes && (
                          <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                            {member.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs font-medium text-slate-700">
                        {org?.name}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs text-slate-600">
                        {member.districtOrUnit || '-'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs font-mono tabular-nums text-slate-700">
                        {member.phone}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs tabular-nums text-slate-500">
                        {member.appointedAt}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs font-medium tabular-nums text-slate-900">
                        {member.termEnd}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isUrgent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 tabular-nums">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>만료 임박 ({formatDday(daysLeft)})</span>
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 tabular-nums">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>교체 준비 ({formatDday(daysLeft)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 tabular-nums">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>정상 재임 ({formatDday(daysLeft)})</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {(isUrgent || isWarning) && (
                            <button
                              type="button"
                              onClick={() => handleExtendTerm(member)}
                              title="임기 2년 연임 연장"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 rounded hover:bg-blue-100/70 transition-colors"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>2년 연임</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            aria-label={`${member.name} 수정`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMember(member.id)}
                            aria-label={`${member.name} 삭제`}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingMember ? '회원 정보 수정' : '신규 회원 등록'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    소속 자생단체
                  </label>
                  <select
                    required
                    value={formState.orgId}
                    onChange={(e) =>
                      setFormState({ ...formState, orgId: e.target.value })
                    }
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
                    직책
                  </label>
                  <select
                    value={formState.role}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        role: e.target.value as Member['role'],
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    성명
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) =>
                      setFormState({ ...formState, name: e.target.value })
                    }
                    placeholder="예: 홍길동"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    분과 · 관할통
                  </label>
                  <input
                    type="text"
                    value={formState.districtOrUnit}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        districtOrUnit: e.target.value,
                      })
                    }
                    placeholder="예: 3통, 문화복지분과"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    연락처
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.phone}
                    onChange={(e) =>
                      setFormState({ ...formState, phone: e.target.value })
                    }
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      위촉일
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.appointedAt}
                      onChange={(e) =>
                        setFormState({ ...formState, appointedAt: e.target.value })
                      }
                      className="w-full px-2 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      임기 만료일
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.termEnd}
                      onChange={(e) =>
                        setFormState({ ...formState, termEnd: e.target.value })
                      }
                      className="w-full px-2 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  비고 / 특이사항
                </label>
                <input
                  type="text"
                  value={formState.notes ?? ''}
                  onChange={(e) =>
                    setFormState({ ...formState, notes: e.target.value })
                  }
                  placeholder="예: 연임 1회, 재위촉 대상 등"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                >
                  {editingMember ? '변경사항 저장' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
