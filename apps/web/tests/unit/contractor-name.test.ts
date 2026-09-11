import { it, expect } from 'vitest';
import { contractorNameKey } from '@/lib/domain/contractor-name';
it('normalizes typography without discarding meaningful identity words', () => {
  expect(contractorNameKey('شركة النمال للمقاولات مساهمة مقفلة')).toBe(
    contractorNameKey('شركه النمال للمقاولات مساهمه مقفله'),
  );
  expect(contractorNameKey('شركةاليمامة')).toBe(contractorNameKey('شركة اليمامة'));
  expect(contractorNameKey('شركة بلر السعودية')).not.toBe(contractorNameKey('شركة بلر العربية'));
  expect(contractorNameKey('مؤسسة ربوة التعمير')).not.toBe(contractorNameKey('شركة ربوة التعمير'));
});
