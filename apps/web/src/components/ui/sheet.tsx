'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content
          dir="rtl"
          aria-describedby={undefined}
          className="fixed inset-y-0 end-0 z-[80] w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl"
        >
          <div className="mb-6 flex items-center justify-between gap-4">
            <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
            <Dialog.Close aria-label="إغلاق" className="btn secondary">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
