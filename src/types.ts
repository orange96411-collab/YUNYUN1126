export type DocKey =
  | 'resolution'
  | 'receipt'
  | 'statement'
  | 'photo'
  | 'transfer';

export interface DocMeta {
  key: DocKey;
  label: string;
  shortLabel: string;
  description: string;
}

export interface Organization {
  id: string;
  name: string;
  shortName: string;
  category: string;
  chairperson: string;
  secretaryContact: string;
  capacity: number;
  annualSubsidy: number;
  settlementDeadline: string; // YYYY-MM-DD
  regularMeetingDay: string; // e.g., "매월 둘째 주 화요일 18:00"
  defaultLocation: string;
}

export interface Member {
  id: string;
  orgId: string;
  name: string;
  role: '회장' | '부회장' | '총무' | '감사' | '위원' | '통장' | '회원';
  phone: string;
  districtOrUnit: string; // 예: "1분과", "3통", "자치분과"
  appointedAt: string; // YYYY-MM-DD
  termEnd: string; // YYYY-MM-DD
  notes?: string;
}

export type AttendanceStatus = 'attend' | 'delegate' | 'absent';

export interface Meeting {
  id: string;
  orgId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  agenda: string;
  status: '완료' | '예정';
  attendance: Record<string, AttendanceStatus>;
  summaryNotes: string;
  noticeNotes?: string;
}

export type ExpenseCategory =
  | '행사운영비'
  | '홍보인쇄비'
  | '회의다과비'
  | '물품구입비'
  | '강사수당';

export interface SubsidyExpense {
  id: string;
  orgId: string;
  date: string; // YYYY-MM-DD
  itemTitle: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  receiptNumber: string;
  requiredDocs: DocKey[];
  submittedDocs: Record<DocKey, boolean>;
}

export type ViewTab = 'overview' | 'members' | 'meetings' | 'subsidy';

export interface DeadlineAlert {
  id: string;
  type: 'term' | 'settlement' | 'meeting';
  severity: 'urgent' | 'warning' | 'info';
  daysLeft: number;
  orgId: string;
  orgName: string;
  title: string;
  detail: string;
  targetDate: string;
  actionTab: ViewTab;
}

export interface TermExpiryAlert {
  memberId: string;
  memberName: string;
  role: Member['role'];
  orgId: string;
  orgName: string;
  termEnd: string;
  daysLeft: number;
  severity: 'expired' | 'urgent_7d' | 'warning_30d';
}

export interface OrganizationCoreMetrics {
  org: Organization;
  memberCount: number;
  earliestTermEnd: string | null;
  earliestTermDaysLeft: number | null;
  earliestTermMemberName: string | null;
  expiringWithin30Count: number;
  subsidyBudget: number;
  subsidySpent: number;
  subsidyRemaining: number;
  executionRate: number;
  missingDocsItems: number;
  settlementDaysLeft: number;
  latestMeetingDate: string | null;
  latestMeetingTitle: string | null;
  nextMeetingDate: string | null;
  nextMeetingTitle: string | null;
  avgAttendanceRate: number;
}
