import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  DocKey,
  ExpenseCategory,
  Organization,
  SubsidyExpense,
} from '../types';
import {
  DOC_DEFINITIONS,
  downloadCSV,
  formatDday,
  formatKRW,
  formatKRWShort,
  getDaysRemaining,
  getDocLabel,
  getMissingDocs,
} from '../utils/civicHelpers';

interface SubsidySettlementViewProps {
  organizations: Organization[];
  expenses: SubsidyExpense[];
  selectedOrgId: string;
  onSelectOrg: (orgId: string) => void;
  onToggleExpenseDoc: (expenseId: string, docKey: DocKey) => void;
  onAddExpense: (expense: Omit<SubsidyExpense, 'id'>) => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORIES: ExpenseCategory[] = [
  '행사운영비',
  '홍보인쇄비',
  '물품구입비',
  '강사수당',
  '회의다과비',
];

export const SubsidySettlementView: React.FC<SubsidySettlementViewProps> = ({
  organizations,
  expenses,
  selectedOrgId,
  onSelectOrg,
  onToggleExpenseDoc,
  onAddExpense,
  onDeleteExpense,
}) => {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newExpense, setNewExpense] = useState<Omit<SubsidyExpense, 'id'>>({
    orgId: selectedOrgId === 'all' ? organizations[0]?.id ?? '' : selectedOrgId,
    date: '2026-11-25',
    itemTitle: '',
    vendor: '',
    category: '행사운영비',
    amount: 0,
    receiptNumber: '',
    requiredDocs: ['resolution', 'receipt', 'statement', 'photo', 'transfer'],
    submittedDocs: {
      resolution: true,
      receipt: true,
      statement: false,
      photo: false,
      transfer: false,
    },
  });

  // Organization subsidy execution chart dataset
  const orgChartStats = useMemo(() => {
    return organizations.map((org) => {
      const orgExp = expenses.filter((e) => e.orgId === org.id);
      const spent = orgExp.reduce((acc, e) => acc + e.amount, 0);
      const rate =
        org.annualSubsidy > 0
          ? Math.round((spent / org.annualSubsidy) * 1000) / 10
          : 0;
      const missingItems = orgExp.filter((e) => getMissingDocs(e).length > 0).length;
      const totalRequiredDocs = orgExp.reduce(
        (acc, e) => acc + e.requiredDocs.length,
        0
      );
      const totalSubmittedDocs = orgExp.reduce(
        (acc, e) =>
          acc + e.requiredDocs.filter((d) => e.submittedDocs[d]).length,
        0
      );
      const docReadiness =
        totalRequiredDocs > 0
          ? Math.round((totalSubmittedDocs / totalRequiredDocs) * 100)
          : 100;

      return {
        org,
        spent,
        remaining: Math.max(org.annualSubsidy - spent, 0),
        rate,
        missingItems,
        totalCount: orgExp.length,
        docReadiness,
        daysLeft: getDaysRemaining(org.settlementDeadline),
      };
    });
  }, [organizations, expenses]);

  // Category spend breakdown for selected scope
  const categoryBreakdown = useMemo(() => {
    const scoped =
      selectedOrgId === 'all'
        ? expenses
        : expenses.filter((e) => e.orgId === selectedOrgId);
    const total = scoped.reduce((acc, e) => acc + e.amount, 0);

    return CATEGORIES.map((cat) => {
      const sum = scoped
        .filter((e) => e.category === cat)
        .reduce((acc, e) => acc + e.amount, 0);
      const pct = total > 0 ? Math.round((sum / total) * 1000) / 10 : 0;
      return { category: cat, sum, pct };
    }).sort((a, b) => b.sum - a.sum);
  }, [expenses, selectedOrgId]);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => (selectedOrgId === 'all' ? true : e.orgId === selectedOrgId))
      .filter((e) => (onlyMissing ? getMissingDocs(e).length > 0 : true))
      .filter((e) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          e.itemTitle.toLowerCase().includes(q) ||
          e.vendor.toLowerCase().includes(q) ||
          e.receiptNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedOrgId, onlyMissing, searchQuery]);

  const summaryTotals = useMemo(() => {
    const scopedOrgs =
      selectedOrgId === 'all'
        ? organizations
        : organizations.filter((o) => o.id === selectedOrgId);
    const scopedExp =
      selectedOrgId === 'all'
        ? expenses
        : expenses.filter((e) => e.orgId === selectedOrgId);

    const budget = scopedOrgs.reduce((acc, o) => acc + o.annualSubsidy, 0);
    const spent = scopedExp.reduce((acc, e) => acc + e.amount, 0);
    const missingItems = scopedExp.filter((e) => getMissingDocs(e).length > 0);
    const totalMissingDocCount = missingItems.reduce(
      (acc, e) => acc + getMissingDocs(e).length,
      0
    );

    return {
      budget,
      spent,
      rate: budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0,
      missingItemCount: missingItems.length,
      totalMissingDocCount,
      totalItems: scopedExp.length,
    };
  }, [organizations, expenses, selectedOrgId]);

  const maxBudget = useMemo(
    () => Math.max(...organizations.map((o) => o.annualSubsidy), 1),
    [organizations]
  );

  const handleOpenAdd = () => {
    setNewExpense({
      orgId: selectedOrgId === 'all' ? organizations[0]?.id ?? '' : selectedOrgId,
      date: '2026-11-25',
      itemTitle: '',
      vendor: '',
      category: '행사운영비',
      amount: 0,
      receiptNumber: `2026-SUB-${String(expenses.length + 101)}`,
      requiredDocs: ['resolution', 'receipt', 'statement', 'photo', 'transfer'],
      submittedDocs: {
        resolution: true,
        receipt: true,
        statement: false,
        photo: false,
        transfer: false,
      },
    });
    setIsAddOpen(true);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.itemTitle.trim() || newExpense.amount <= 0) return;
    onAddExpense(newExpense);
    setIsAddOpen(false);
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      [
        '단체명',
        '집행일자',
        '증빙번호',
        '비목',
        '지출적요',
        '거래처',
        '집행금액',
        '구비서류상태',
        '누락서류목록',
      ],
      ...filteredExpenses.map((exp) => {
        const org = organizations.find((o) => o.id === exp.orgId);
        const missing = getMissingDocs(exp);
        return [
          org?.name ?? '',
          exp.date,
          exp.receiptNumber,
          exp.category,
          exp.itemTitle,
          exp.vendor,
          String(exp.amount),
          missing.length === 0 ? '정산가능' : `누락 ${missing.length}건`,
          missing.map(getDocLabel).join(' / ') || '없음',
        ];
      }),
    ];
    downloadCSV('보조금_정산_체크리스트.csv', rows);
  };

  return (
    <div className="space-y-6">
      {/* 1. Charts Section: Execution Rate Graph & Category Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left 8 cols: Organization Execution Rate Bar Chart */}
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                단체별 보조금 집행률 · 교부액 대비 실적 그래프
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                전체 교부액 {formatKRW(summaryTotals.budget)} 중{' '}
                {formatKRW(summaryTotals.spent)} 집행 ({summaryTotals.rate}%)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 bg-slate-200 inline-block rounded-xs" />
                교부액(예산)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 bg-blue-700 inline-block rounded-xs" />
                집행액(정상)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-2.5 bg-amber-600 inline-block rounded-xs" />
                집행액(서류누락 포함)
              </span>
            </div>
          </div>

          <div className="space-y-4 flex-1 justify-center flex flex-col">
            {orgChartStats.map((item) => {
              const budgetWidthPct = Math.round(
                (item.org.annualSubsidy / maxBudget) * 100
              );
              const spentWidthPct =
                item.org.annualSubsidy > 0
                  ? Math.min((item.spent / item.org.annualSubsidy) * 100, 100)
                  : 0;
              const isSelected = selectedOrgId === item.org.id;

              return (
                <button
                  key={item.org.id}
                  type="button"
                  onClick={() =>
                    onSelectOrg(isSelected ? 'all' : item.org.id)
                  }
                  className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/30'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {item.org.name}
                      </span>
                      <span
                        className={`tabular-nums font-medium ${
                          item.daysLeft <= 7 ? 'text-red-600' : 'text-slate-500'
                        }`}
                      >
                        정산 {formatDday(item.daysLeft)}
                      </span>
                      {item.missingItems > 0 ? (
                        <span className="text-red-600 font-medium tabular-nums">
                          · 누락 {item.missingItems}건
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          · 서류 100%
                        </span>
                      )}
                    </div>
                    <div className="tabular-nums text-slate-600">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.rate}%
                      </span>{' '}
                      <span className="text-slate-400">|</span>{' '}
                      <span>{formatKRWShort(item.spent)}</span> /{' '}
                      <span>{formatKRWShort(item.org.annualSubsidy)}</span>
                    </div>
                  </div>

                  {/* Proportional Budget Bar with Nested Execution Fill */}
                  <div className="w-full">
                    <div
                      className="h-5 bg-slate-100 border border-slate-200 rounded-sm overflow-hidden relative"
                      style={{ width: `${Math.max(budgetWidthPct, 28)}%` }}
                    >
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.missingItems > 0 ? 'bg-amber-600' : 'bg-blue-700'
                        }`}
                        style={{ width: `${spentWidthPct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right 4 cols: Category Breakdown & Settlement Readiness */}
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              비목별 집행 비중 · 정산 점검 요약
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedOrgId === 'all'
                ? '전체 단체 지출 합계 기준'
                : `${
                    organizations.find((o) => o.id === selectedOrgId)?.name ?? ''
                  } 지출 기준`}
            </p>

            <div className="mt-5 space-y-3.5">
              {categoryBreakdown.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {cat.category}
                    </span>
                    <span className="tabular-nums text-slate-900 font-semibold">
                      {formatKRW(cat.sum)}{' '}
                      <span className="text-slate-400 font-normal">
                        ({cat.pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-slate-700"
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">전체 영수증 건수</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                {summaryTotals.totalItems}건
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">증빙 서류 누락</div>
              <div
                className={`text-lg font-bold tabular-nums mt-0.5 ${
                  summaryTotals.missingItemCount > 0
                    ? 'text-red-600'
                    : 'text-emerald-700'
                }`}
              >
                {summaryTotals.missingItemCount}건 ({summaryTotals.totalMissingDocCount}종)
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 2. Receipt Document Checklist Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="단체 필터"
            value={selectedOrgId}
            onChange={(e) => onSelectOrg(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">전체 자생단체</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium border rounded-md transition-colors whitespace-nowrap shrink-0 ${
              onlyMissing
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>누락 서류 있는 건만 보기</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="적요, 거래처, 증빙번호 검색"
              className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-md w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>정산표 CSV</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>영수증 지출 등록</span>
          </button>
        </div>
      </div>

      {/* 3. Receipt-by-Receipt Document Checklist Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              영수증 항목별 증빙 서류 체크리스트
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              각 서류 버튼을 클릭하여 제출 여부를 즉시 점검할 수 있습니다. (붉은색 표시는 필수 증빙 누락 항목)
            </p>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-slate-500">
              {onlyMissing
                ? '증빙 서류가 누락된 항목이 없습니다.'
                : '등록된 보조금 지출 내역이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4 whitespace-nowrap">일자 / 증빙번호</th>
                  <th className="py-3 px-4 whitespace-nowrap">단체 · 비목</th>
                  <th className="py-3 px-4 whitespace-nowrap">지출 적요 · 거래처</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">집행 금액</th>
                  {DOC_DEFINITIONS.map((doc) => (
                    <th
                      key={doc.key}
                      title={doc.description}
                      className="py-3 px-2.5 whitespace-nowrap text-center"
                    >
                      {doc.shortLabel}
                    </th>
                  ))}
                  <th className="py-3 px-4 whitespace-nowrap text-right">점검 결과</th>
                  <th className="py-3 px-3 whitespace-nowrap text-right">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredExpenses.map((expense) => {
                  const org = organizations.find((o) => o.id === expense.orgId);
                  const missing = getMissingDocs(expense);
                  const isComplete = missing.length === 0;

                  return (
                    <tr
                      key={expense.id}
                      className={`transition-colors ${
                        isComplete
                          ? 'hover:bg-slate-50'
                          : 'bg-red-50/20 hover:bg-red-50/40'
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-900 tabular-nums">
                          {expense.date}
                        </div>
                        <div className="text-xs font-mono text-slate-400 tabular-nums">
                          {expense.receiptNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-800">
                          {org?.shortName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {expense.category}
                        </div>
                      </td>
                      <td className="py-3 px-4 min-w-[210px]">
                        <div className="text-sm font-medium text-slate-900">
                          {expense.itemTitle}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          거래처: {expense.vendor}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right font-semibold text-slate-900 tabular-nums">
                        {formatKRW(expense.amount)}
                      </td>
                      {DOC_DEFINITIONS.map((doc) => {
                        const isRequired = expense.requiredDocs.includes(doc.key);
                        const isSubmitted = !!expense.submittedDocs[doc.key];
                        if (!isRequired) {
                          return (
                            <td
                              key={doc.key}
                              className="py-3 px-2.5 text-center text-xs text-slate-300"
                            >
                              -
                            </td>
                          );
                        }
                        return (
                          <td key={doc.key} className="py-3 px-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => onToggleExpenseDoc(expense.id, doc.key)}
                              title={`${doc.label}: ${
                                isSubmitted ? '구비 완료 (클릭하여 해제)' : '미제출 (클릭하여 완료 체크)'
                              }`}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded border text-xs font-medium transition-colors ${
                                isSubmitted
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {isSubmitted ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <span className="text-[11px] font-bold">누락</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>정산 가능</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 tabular-nums">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{missing.length}건 누락</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(expense.id)}
                          aria-label={`${expense.itemTitle} 삭제`}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Receipt Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                보조금 영수증 지출 등록
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    소속 단체
                  </label>
                  <select
                    value={newExpense.orgId}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, orgId: e.target.value })
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
                    지출 비목
                  </label>
                  <select
                    value={newExpense.category}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        category: e.target.value as ExpenseCategory,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    지출 적요 (항목명)
                  </label>
                  <input
                    type="text"
                    required
                    value={newExpense.itemTitle}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, itemTitle: e.target.value })
                    }
                    placeholder="예: 연말 불우이웃 김장 자재 구입"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    거래처
                  </label>
                  <input
                    type="text"
                    required
                    value={newExpense.vendor}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, vendor: e.target.value })
                    }
                    placeholder="예: 중앙농산물"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    집행 금액 (원)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={100}
                    required
                    value={newExpense.amount || ''}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        amount: Number(e.target.value),
                      })
                    }
                    placeholder="500000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    집행 일자
                  </label>
                  <input
                    type="date"
                    required
                    value={newExpense.date}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, date: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    증빙 번호
                  </label>
                  <input
                    type="text"
                    value={newExpense.receiptNumber}
                    onChange={(e) =>
                      setNewExpense({
                        ...newExpense,
                        receiptNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  제출 완료된 증빙 서류 체크
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DOC_DEFINITIONS.map((doc) => {
                    const checked = newExpense.submittedDocs[doc.key];
                    return (
                      <label
                        key={doc.key}
                        className="flex items-center gap-2 p-2 border border-slate-200 rounded text-xs cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setNewExpense({
                              ...newExpense,
                              submittedDocs: {
                                ...newExpense.submittedDocs,
                                [doc.key]: e.target.checked,
                              },
                            })
                          }
                          className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        <span className="text-slate-700">{doc.shortLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800"
                >
                  영수증 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
