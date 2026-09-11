import { describe, it, expect } from 'vitest';
import { calculateViolationAge, isCriticalOpenViolation } from '@/lib/domain/aging';

describe('Aging Rules & Numerical Invariants (Acceptance Tests W08 - W10)', () => {
  const asOfDate = '2026-09-11';

  it('W08: Strictly numerical calculation for >180 days (181 only from 90, 91, 179, 180, 181)', () => {
    // 90 days ago: 2026-06-13
    const age90 = calculateViolationAge('2026-06-13', asOfDate);
    expect(age90.age_days).toBe(90);
    expect(age90.is_critical).toBe(false);
    expect(age90.bracket).toBe('61 - 90 يوم');

    // 91 days ago: 2026-06-12
    const age91 = calculateViolationAge('2026-06-12', asOfDate);
    expect(age91.age_days).toBe(91);
    expect(age91.is_critical).toBe(false);
    expect(age91.bracket).toBe('91 - 180 يوم');

    // 179 days ago: 2026-03-16
    const age179 = calculateViolationAge('2026-03-16', asOfDate);
    expect(age179.age_days).toBe(179);
    expect(age179.is_critical).toBe(false);
    expect(age179.bracket).toBe('91 - 180 يوم');

    // 180 days ago: 2026-03-15
    const age180 = calculateViolationAge('2026-03-15', asOfDate);
    expect(age180.age_days).toBe(180);
    // Crucial: 180 days is NOT > 180!
    expect(age180.is_critical).toBe(false);
    expect(age180.bracket).toBe('91 - 180 يوم');

    // 181 days ago: 2026-03-14
    const age181 = calculateViolationAge('2026-03-14', asOfDate);
    expect(age181.age_days).toBe(181);
    // 181 days IS > 180!
    expect(age181.is_critical).toBe(true);
    expect(age181.bracket).toBe('أكثر من 180 يوم');
  });

  it('W09: Processed/closed violation with age 181 does NOT count as critical open violation', () => {
    const age181 = calculateViolationAge('2026-03-14', asOfDate);
    expect(age181.is_critical).toBe(true);

    // If source_status is processed ("تمت المعالجة"), it MUST NOT enter critical open KPI!
    const isOpenCritical = isCriticalOpenViolation(age181, 'تمت المعالجة');
    expect(isOpenCritical).toBe(false);

    // If source_status is under contractor ("تحت معالجة المقاول"), it counts as critical open
    const isContractorCritical = isCriticalOpenViolation(age181, 'تحت معالجة المقاول');
    expect(isContractorCritical).toBe(true);
  });

  it('W10: Future dates and missing dates are flagged as quality issues and not zeroed out silently', () => {
    // Future date: 2026-10-01
    const futureAge = calculateViolationAge('2026-10-01', asOfDate);
    expect(futureAge.quality_issue).toContain('المستقبل');
    expect(futureAge.is_critical).toBe(false);

    // Missing date: null
    const nullAge = calculateViolationAge(null, asOfDate);
    expect(nullAge.quality_issue).toContain('مفقود');
    expect(nullAge.age_days).toBeNull();
  });
});
