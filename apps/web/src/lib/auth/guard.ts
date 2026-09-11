import { isSameOrigin } from './origin';
import { NextResponse } from 'next/server';
import { getCurrentUser } from './session';
import { hasPermission, type Permission } from './rbac';

export async function authorize(permission: Permission, request?: Request) {
  const user = await getCurrentUser();
  if (!user)
    return {
      response: NextResponse.json({ message: 'يلزم تسجيل الدخول' }, { status: 401 }),
      user: null,
    };
  if (user.role === 'PROJECT_MANAGER')
    return {
      response: NextResponse.json(
        { message: 'يلزم إعداد نطاق مشاريع هذا المستخدم أولًا' },
        { status: 403 },
      ),
      user: null,
    };
  if (user.must_change_password)
    return {
      response: NextResponse.json(
        { message: 'يلزم تغيير كلمة المرور الأولية', code: 'PASSWORD_CHANGE_REQUIRED' },
        { status: 403 },
      ),
      user: null,
    };
  if (
    !hasPermission(user, permission) ||
    (user.role === 'CONTRACTOR_USER' && !user.contractor_id)
  ) {
    return {
      response: NextResponse.json({ message: 'غير مصرح بهذه العملية' }, { status: 403 }),
      user: null,
    };
  }
  if (request && !['GET', 'HEAD'].includes(request.method)) {
    if (!isSameOrigin(request)) {
      return {
        response: NextResponse.json({ message: 'مصدر الطلب غير مسموح' }, { status: 403 }),
        user: null,
      };
    }
  }
  return { user, response: null };
}
