import { expect, it } from 'vitest';
import {
  classifyProjectService,
  serviceFromName,
  serviceFromReference,
} from '@/lib/domain/service-type';

it('recognizes explicit water, sewer and shared project names', () => {
  expect(serviceFromName('شبكات المياه')).toBe('WATER');
  expect(serviceFromName('مشروع الصرف الصحي')).toBe('SEWER');
  expect(serviceFromName('مياه وصرف صحي')).toBe('MIXED');
  expect(serviceFromName('Wastewater network')).toBe('SEWER');
  expect(serviceFromName('مشروع الحي')).toBe('UNKNOWN');
});
it('uses only approved blue and green service colors', () => {
  expect(serviceFromReference('#01579B', 'مشاريع المياه.kmz')).toBe('WATER');
  expect(serviceFromReference('#097138', 'مشاريع الصرف الصحي.kmz')).toBe('SEWER');
  expect(serviceFromReference('#ff0000', 'مشاريع المياه.kmz')).toBe('UNKNOWN');
  expect(serviceFromReference('#097138', 'مشاريع المياه.kmz')).toBe('UNKNOWN');
});
it('keeps conflicting names and boundary evidence for review', () => {
  expect(
    classifyProjectService('شبكات المياه', [{ color: '#097138', source_file: 'صرف.kmz' }])
      .service_type,
  ).toBe('UNKNOWN');
  expect(
    classifyProjectService('مشروع الحي', [{ color: '#097138', source_file: 'صرف.kmz' }])
      .service_type,
  ).toBe('SEWER');
  expect(classifyProjectService('شبكات المياه', []).service_type).toBe('WATER');
  expect(classifyProjectService('مشروع الحي', []).service_type).toBe('UNKNOWN');
});
