import { getCurrentUser } from '@/lib/auth/session';
import TestExportClient from './TestExportClient';

export default async function TestExportPage() {
  const user = await getCurrentUser();
  return <TestExportClient canExport={user?.role === 'SUPER_ADMIN' || user?.role === 'PROGRAM_MANAGER' || user?.role === 'PROJECT_MANAGER'} />;
}
