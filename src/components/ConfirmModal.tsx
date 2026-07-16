import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
      <div className="bg-white rounded-3xl w-full max-w-[320px] shadow-2xl overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
          <div className="text-sm text-slate-500 whitespace-pre-wrap">{message}</div>
        </div>
        <div className="flex border-t border-slate-100">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            ยกเลิก
          </button>
          <div className="w-[1px] bg-slate-100" />
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
          >
            ยืนยันการลบ
          </button>
        </div>
      </div>
    </div>
  );
};
