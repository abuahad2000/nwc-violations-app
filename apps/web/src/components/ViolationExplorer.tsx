'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StatusCount } from '@/lib/domain/manager';

const SpatialMap = dynamic(() => import('./SpatialMap'), { ssr: false });

type Row = {
  id: string;
  source_reference: string;
  reported_contractor_name: string | null;
  source_status: string;
  is_closed: number;
  age_days: number | null;
  classification: string;
  district_raw: string | null;
};

type Stats = {
  total: number;
  closed: number;
  statuses: StatusCount[];
  last_batch: { created_at: string } | null;
};

const initial = {
  search: '',
  classification: '',
  date_from: '',
  date_to: '',
  district: '',
  open: '',
};

export default function ViolationExplorer({
  mode = 'dashboard',
}: {
  mode?: 'dashboard' | 'list' | 'map';
}) {
  const [filters, setFilters] = useState(initial);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);

  const query = useMemo(
    () => new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString(),
    [filters],
  );

  useEffect(() => {
    setBusy(true);
    Promise.all([
      fetch(`/api/violations?${query}&page=${page}&limit=25`).then((r) => r.json()),
      fetch(`/api/dashboard/stats?${query}`).then((r) => r.json()),
    ])
      .then(([list, summary]) => {
        setRows(list.data);
        setTotal(list.pagination.total);
        setStats(summary.data);
        setBusy(false);
      })
      .catch(() => setBusy(false));
  }, [query, page]);

  const statsCards = stats
    ? [
        { label: 'إجمالي البلاغات', value: stats.total, color: 'bg-blue-500' },
        {
          label: 'تحت معالجة المقاول',
          value: stats.statuses.find((s) => s.status === 'تحت معالجة المقاول')?.count || 0,
          color: 'bg-amber-500',
        },
        {
          label: 'تحت معالجة الجهة',
          value: stats.statuses.find((s) => s.status === 'تحت معالجة الجهة المتعدية')?.count || 0,
          color: 'bg-purple-500',
        },
        { label: 'تمت المعالجة', value: stats.closed, color: 'bg-emerald-500' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">لوحة المتابعة</h2>
          <p className="text-sm text-muted-foreground">
            {stats?.last_batch
              ? `آخر تحديث: ${new Date(stats.last_batch.created_at).toLocaleString('ar-SA')}`
              : 'متابعة التعديات والمشاريع'}
          </p>
        </div>
        <Button variant="outline">
          <Download className="ml-2 h-4 w-4" />
          تصدير
        </Button>
      </div>

      {/* بطاقات الإحصائيات */}
      {mode === 'dashboard' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div className={`h-2 w-2 rounded-full ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value.toLocaleString('ar-SA')}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* نموذج الفلترة */}
      <Card>
        <CardContent className="p-6">
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
            }}
          >
            <div className="md:col-span-2">
              <Input
                placeholder="رقم البلاغ، المقاول، الحي..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            />
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            />
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit">
                <Search className="ml-2 h-4 w-4" />
                بحث
              </Button>
              <Button type="button" variant="outline" onClick={() => setFilters(initial)}>
                مسح
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* الخريطة */}
      {mode !== 'list' && (
        <Card>
          <CardContent className="p-0">
            <SpatialMap query={query} onSelect={() => {}} />
          </CardContent>
        </Card>
      )}

      {/* الجدول */}
      <Card>
        <CardHeader>
          <CardTitle>النتائج ({total.toLocaleString('ar-SA')})</CardTitle>
        </CardHeader>
        <CardContent>
          {busy ? (
            <div className="flex justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم البلاغ</TableHead>
                    <TableHead>الحي</TableHead>
                    <TableHead>المقاول</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>العمر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-primary">
                        {row.source_reference}
                      </TableCell>
                      <TableCell>{row.district_raw || 'غير محدد'}</TableCell>
                      <TableCell>{row.reported_contractor_name || 'غير محدد'}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_closed ? 'secondary' : 'default'}>
                          {row.source_status}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.is_closed ? 'مغلق' : `${row.age_days || 0} يوم`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">لا توجد نتائج</p>
              )}
            </>
          )}
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ArrowRight className="ml-2 h-4 w-4" />
              السابق
            </Button>
            <span className="text-sm text-muted-foreground">صفحة {page}</span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 25 >= total}
            >
              التالي
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
