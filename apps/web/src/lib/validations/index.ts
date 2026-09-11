import { z } from 'zod';

export const CoordinatesSchema = z.object({
  latitude: z.number().refine((lat) => lat >= -90 && lat <= 90, {
    message: 'خط العرض يجب أن يكون بين -90 و 90',
  }),
  longitude: z.number().refine((lng) => lng >= -180 && lng <= 180, {
    message: 'خط الطول يجب أن يكون بين -180 و 180',
  }),
});

export const RiyadhCoordinatesSchema = z.object({
  latitude: z.number().refine((lat) => lat >= 20.0 && lat <= 28.5, {
    message: 'خط العرض خارج النطاق الجغرافي لمنطقة الرياض',
  }),
  longitude: z.number().refine((lng) => lng >= 43.0 && lng <= 49.5, {
    message: 'خط الطول خارج النطاق الجغرافي لمنطقة الرياض',
  }),
});

export const ProjectSchema = z.object({
  operational_number: z.string().min(1, 'الرقم التشغيلي مطلوب'),
  name: z.string().min(2, 'اسم المشروع مطلوب'),
  status: z.enum(['ACTIVE', 'PRELIMINARY_HANDOVER', 'WITHDRAWN']),
  contractor_id: z.string().min(1, 'مقاول المشروع مطلوب'),
  program_manager_id: z.string().optional().nullable(),
  project_manager_id: z.string().optional().nullable(),
});

export const ViolationInputSchema = z.object({
  source_reference: z.string().min(1, 'رقم بلاغ التعدي مطلوب'),
  reported_contractor_name: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  reported_date: z.string().optional().nullable(),
  source_status: z.string().default('جديد'),
  description_raw: z.string().optional().nullable(),
  district_raw: z.string().optional().nullable(),
});

export const AgeCalculationSchema = z.object({
  reported_date: z.string(),
  as_of: z.string().optional(),
});
