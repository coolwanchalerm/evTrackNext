import React, { useState, useMemo } from 'react';
import { setLocalLogs, deleteLogsByMonth } from '../lib/supabase';
import { seedLogs, type EvLog } from '../data/seedData';
import {
  Check, AlertTriangle, RefreshCw,
  Trash2, ShieldAlert, Sparkles, CalendarDays,
} from 'lucide-react';

const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

interface SettingsProps {
  logs: EvLog[];
  onBulkDeleteSuccess: (newLogs: EvLog[]) => void;
  onConfigChange: () => void;
  showConfirm: (title: string, message: React.ReactNode, onConfirm: () => void) => void;
}

export const Settings: React.FC<SettingsProps> = ({ logs, onBulkDeleteSuccess, onConfigChange, showConfirm }) => {
  const now = new Date();

  const [localMsg, setLocalMsg] = useState<string | null>(null);

  // Bulk delete state
  const [delMonth, setDelMonth] = useState<number>(now.getMonth() + 1); // 1-indexed
  const [delYear, setDelYear] = useState<number>(now.getFullYear());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Available years for bulk delete
  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    logs.forEach(l => { try { years.add(new Date(l.date).getFullYear()); } catch {} });
    return Array.from(years).sort((a, b) => b - a);
  }, [logs]);

  // Lifecycle effect removed since we don't display status here anymore.

  const handleBulkDelete = () => {
    const monthName = MONTH_FULL[delMonth - 1];
    const yearBE = delYear + 543;
    
    showConfirm(
      'ลบข้อมูลรายเดือน?',
      `ยืนยันลบข้อมูลทั้งหมดของเดือน${monthName} ปี ${yearBE}?\n\nข้อมูลจะหายถาวรและไม่สามารถกู้คืนได้`,
      async () => {
        setIsDeleting(true); setDeleteResult(null);
        try {
          const result = await deleteLogsByMonth(delYear, delMonth);
          if (result.success) {
            setDeleteResult({ ok: true, msg: `ลบข้อมูล ${result.count} รายการของเดือน${monthName} ปี ${yearBE} สำเร็จ` });
            // Update parent's logs state
            const { getLocalLogs } = await import('../lib/supabase');
            onBulkDeleteSuccess(getLocalLogs());
          } else {
            setDeleteResult({ ok: false, msg: `เกิดข้อผิดพลาด: ${result.error}` });
          }
        } catch (e: any) {
          setDeleteResult({ ok: false, msg: e.message });
        } finally {
          setIsDeleting(false);
        }
      }
    );
  };

  const handleResetSeed = () => {
    showConfirm(
      'โหลดข้อมูลตั้งต้น?',
      'โหลดข้อมูลตั้งต้น 91 รายการ (ข้อมูลที่คุณเพิ่มจะหายไป)',
      () => {
        setLocalLogs(seedLogs); setLocalMsg('โหลดข้อมูลตั้งต้นสำเร็จ'); onConfigChange();
        setTimeout(() => setLocalMsg(null), 3000);
      }
    );
  };

  const handleClearAll = () => {
    showConfirm(
      'ล้างข้อมูลทั้งหมด?',
      'ลบข้อมูลทั้งหมดในเครื่อง?\nข้อมูลจะหายถาวรและไม่สามารถกู้คืนได้',
      () => {
        setLocalLogs([]); setLocalMsg('ล้างข้อมูลเรียบร้อย'); onConfigChange();
        setTimeout(() => setLocalMsg(null), 3000);
      }
    );
  };

  return (
    <div className="px-4 pt-5 pb-4 space-y-4">

      {/* ── BULK DELETE SECTION ── */}
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-4 py-3 border-b border-red-50 flex items-center gap-2 bg-red-50/50">
          <Trash2 className="h-4 w-4 text-red-500" />
          <span className="text-sm font-bold text-red-700">ลบข้อมูลรายเดือน</span>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-500 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <span>เลือกเดือนและปีที่ต้องการลบ <strong>ข้อมูลทั้งหมด</strong> ในช่วงนั้นจะหายและไม่สามารถกู้คืนได้</span>
          </p>

          {/* Month Select */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> เลือกเดือน
            </label>
            <select
              value={delMonth}
              onChange={e => setDelMonth(parseInt(e.target.value))}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:outline-none focus:border-red-400 appearance-none"
            >
              {MONTH_FULL.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Select */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" /> เลือกปี
            </label>
            <select
              value={delYear}
              onChange={e => setDelYear(parseInt(e.target.value))}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:outline-none focus:border-red-400 appearance-none"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>ปี {y + 543}</option>
              ))}
            </select>
          </div>

          {/* Preview count */}
          <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
            พบ <strong className="text-red-600">
              {logs.filter(l => {
                const d = new Date(l.date);
                return d.getFullYear() === delYear && d.getMonth() + 1 === delMonth;
              }).length}
            </strong> รายการ ที่จะถูกลบ ({MONTH_FULL[delMonth - 1]} {delYear + 543})
          </div>

          {deleteResult && (
            <div className={`p-3 rounded-xl flex items-start gap-2 text-xs font-semibold border ${
              deleteResult.ok ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              {deleteResult.ok ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{deleteResult.msg}</span>
            </div>
          )}

          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-xl font-bold shadow-md shadow-red-100 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isDeleting ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> กำลังลบ...</>
            ) : (
              <><AlertTriangle className="h-4 w-4" /> ยืนยันการลบข้อมูล</>
            )}
          </button>
        </div>
      </div>

      {/* Reset / Clear */}
      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] space-y-3 border border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-600">จัดการข้อมูลในเครื่อง</span>
        </div>
        {localMsg && (
          <div className="p-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-xs flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4 shrink-0" /> {localMsg}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleResetSeed}
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-slate-100 transition-all">
            <Sparkles className="h-3 w-3 text-sky-500" /> โหลดข้อมูลตัวอย่าง
          </button>
          <button onClick={handleClearAll}
            className="flex-1 bg-red-50 border border-red-100 text-red-600 py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-red-100 transition-all">
            <Trash2 className="h-3 w-3" /> ล้างข้อมูลทั้งหมด
          </button>
        </div>
      </div>

    </div>
  );
};
