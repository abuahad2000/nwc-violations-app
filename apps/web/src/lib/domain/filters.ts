import { z } from 'zod';
import type { SessionUser } from '@/types';
import { managerKeySQL, programKeySQL } from './manager';

export const FilterSchema = z.object({
  executive: z.string().trim().max(200).default(''),
  search: z.string().trim().max(200).default(''),
  classification: z
    .enum(['', 'INSIDE_PROJECT_BOUNDARY', 'OUTSIDE_PROJECT_BOUNDARY', 'UNDER_REVIEW'])
    .default(''),
  aging: z.enum(['', '0-30', '31-90', '91-180', '181+']).default(''),
  reported_contractor: z.string().trim().max(200).default(''),
  project_contractor: z.string().trim().max(200).default(''),
  action_owner: z.string().trim().max(100).default(''),
  project_id: z.string().trim().max(100).default(''),
  manager: z.string().trim().max(200).default(''),
  program_manager: z.string().trim().max(200).default(''),
  source_status: z.string().trim().max(200).default(''),
  open: z.enum(['', '1', '0']).default(''),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type Filters = z.infer<typeof FilterSchema>;
export function parseFilters(params: URLSearchParams) {
  return FilterSchema.parse(Object.fromEntries(params));
}
export function violationScope(user: SessionUser): { sql: string; params: string[] } {
  if (user.role !== 'CONTRACTOR_USER') return { sql: '1=1', params: [] };
  if (!user.contractor_id) return { sql: '0=1', params: [] };
  // Explicit current assignment grants access; a reported name or spatial match does not.
  return { sql: 'v.current_action_owner_id = ?', params: [user.contractor_id] };
}
export function buildViolationFilter(f: Filters, user: SessionUser) {
  const scope = violationScope(user);
  const clauses = [scope.sql];
  const params: string[] = [...scope.params];
  if (f.executive) {
    clauses.push("COALESCE(p.executive_director_name,'') = ?");
    params.push(f.executive === '__unassigned__' ? '' : f.executive);
  }
  if (f.program_manager) {
    clauses.push(
      f.program_manager === '__unassigned__' ? `${programKeySQL} = ''` : `${programKeySQL} = ?`,
    );
    if (f.program_manager !== '__unassigned__') params.push(f.program_manager);
  }
  if (f.manager) {
    clauses.push(f.manager === '__unassigned__' ? `${managerKeySQL} = ''` : `${managerKeySQL} = ?`);
    if (f.manager !== '__unassigned__') params.push(f.manager);
  }
  if (f.source_status) {
    clauses.push('v.source_status = ?');
    params.push(f.source_status);
  }
  if (f.search) {
    clauses.push(
      '(v.source_reference LIKE ? OR v.description_raw LIKE ? OR v.district_raw LIKE ? OR v.street_raw LIKE ? OR v.reported_contractor_name LIKE ? OR p.name LIKE ? OR EXISTS(SELECT 1 FROM contractors c_name WHERE c_name.id=v.reported_contractor_id AND c_name.name LIKE ?))',
    );
    params.push(...Array<string>(7).fill(`%${f.search}%`));
  }
  if (f.classification) {
    clauses.push('v.classification = ?');
    params.push(f.classification);
  }
  if (f.aging) {
    clauses.push('v.is_closed = 0');
    clauses.push(
      {
        '0-30': 'v.age_days BETWEEN 0 AND 30',
        '31-90': 'v.age_days BETWEEN 31 AND 90',
        '91-180': 'v.age_days BETWEEN 91 AND 180',
        '181+': 'v.age_days > 180',
      }[f.aging],
    );
  }
  if (f.open) clauses.push(f.open === '1' ? 'v.is_closed = 0' : 'v.is_closed = 1');
  if (f.reported_contractor) {
    clauses.push('(v.reported_contractor_id = ? OR v.reported_contractor_name LIKE ?)');
    params.push(f.reported_contractor, `%${f.reported_contractor}%`);
  }
  if (f.project_contractor) {
    clauses.push('(c_proj.id = ? OR c_proj.name LIKE ?)');
    params.push(f.project_contractor, `%${f.project_contractor}%`);
  }
  if (f.action_owner) {
    clauses.push('v.current_action_owner_id = ?');
    params.push(f.action_owner);
  }
  if (f.project_id) {
    clauses.push('v.project_id = ?');
    params.push(f.project_id);
  }
  return { whereSQL: clauses.join(' AND '), params };
}
