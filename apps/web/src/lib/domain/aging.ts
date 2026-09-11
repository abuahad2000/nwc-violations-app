/**
 * Domain Aging and Numerical KPI Utilities
 * Strictly enforces Rule 14 & Tests W08-W10
 */

export interface AgingResult {
  age_days: number | null;
  bracket: string;
  is_critical: boolean; // age_days > 180 (strictly 181+)
  quality_issue: string | null;
}

export const AGING_BRACKETS = [
  { min: 0, max: 30, label: '0 - 30 يوم' },
  { min: 31, max: 60, label: '31 - 60 يوم' },
  { min: 61, max: 90, label: '61 - 90 يوم' },
  { min: 91, max: 180, label: '91 - 180 يوم' },
  { min: 181, max: Infinity, label: 'أكثر من 180 يوم' },
] as const;

/**
 * Calculates calendar day difference strictly numerically.
 */
export function calculateViolationAge(
  reportedDateStr: string | null | undefined,
  asOfDateStr?: string | null,
): AgingResult {
  if (!reportedDateStr || !reportedDateStr.trim()) {
    return {
      age_days: null,
      bracket: 'تاريخ غير محدد',
      is_critical: false,
      quality_issue: 'تاريخ البلاغ مفقود',
    };
  }

  const reportedDate = new Date(reportedDateStr);
  if (isNaN(reportedDate.getTime())) {
    return {
      age_days: null,
      bracket: 'تاريخ غير صالح',
      is_critical: false,
      quality_issue: 'صيغة التاريخ غير صالحة',
    };
  }

  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
  if (isNaN(asOfDate.getTime())) {
    return {
      age_days: null,
      bracket: 'تاريخ غير صالح',
      is_critical: false,
      quality_issue: 'تاريخ المقارنة غير صالح',
    };
  }

  // Normalize to UTC calendar dates to prevent timezone boundary jumps
  const reportedUtc = Date.UTC(
    reportedDate.getUTCFullYear(),
    reportedDate.getUTCMonth(),
    reportedDate.getUTCDate(),
  );
  const asOfUtc = Date.UTC(
    asOfDate.getUTCFullYear(),
    asOfDate.getUTCMonth(),
    asOfDate.getUTCDate(),
  );

  const diffTime = asOfUtc - reportedUtc;
  const age_days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Future dates detection (Test W10)
  if (age_days < 0) {
    return {
      age_days,
      bracket: 'تاريخ مستقبلي',
      is_critical: false,
      quality_issue: 'تاريخ البلاغ في المستقبل — يحتاج مراجعة جودة بيانات',
    };
  }

  // Strictly numerical condition > 180 (181+)
  const is_critical = age_days > 180;

  let bracket = 'أكثر من 180 يوم';
  for (const b of AGING_BRACKETS) {
    if (age_days >= b.min && age_days <= b.max) {
      bracket = b.label;
      break;
    }
  }

  return {
    age_days,
    bracket,
    is_critical,
    quality_issue: null,
  };
}

/**
 * Evaluates whether a violation counts as "Critical Aging" for open violations.
 * Rule: is_critical (age_days > 180) AND NOT closed/processed.
 */
export function isCriticalOpenViolation(ageResult: AgingResult, sourceStatus: string): boolean {
  if (!ageResult.is_critical || ageResult.age_days === null) {
    return false;
  }
  const status = sourceStatus.trim();
  const isProcessed = status === 'تمت المعالجة' || status === 'منجز' || status === 'مغلق';
  return !isProcessed;
}
