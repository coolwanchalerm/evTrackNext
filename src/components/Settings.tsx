import React, { useState, useMemo, useEffect } from 'react';
import { deleteLogsByMonth, saveElectricRate, getLocalLogs } from '../lib/supabase';
import { type EvLog } from '../data/seedData';
import {
  Check, AlertTriangle, RefreshCw,
  Trash2, CalendarDays, Database, Zap, Save, AlertCircle,
} from 'lucide-react';

const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

interface SettingsProps {
  logs: EvLog[];
  onBulkDeleteSuccess: (newLogs: EvLog[]) => void;
  showConfirm: (title: string, message: React.ReactNode, onConfirm: () => void) => void;
  electricRate: number;
  onUpdateElectricRate: (rate: number) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  logs,
  onBulkDeleteSuccess,
  showConfirm,
  electricRate,
  onUpdateElectricRate,
}) => {
  const now = new Date();

  // Sub-tab state
  const [activeTab, setActiveTab] = useState<'rate' | 'data'>('rate');

  // Electricity rate state
  const [rateInput, setRateInput] = useState<string>(String(electricRate));
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateStatus, setRateStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setRateInput(String(electricRate));
  }, [electricRate]);

  useEffect(() => {
    if (!rateStatus) return;
    const t = setTimeout(() => setRateStatus(null), 4000);
    return () => clearTimeout(t);
  }, [rateStatus]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(rateInput);
    if (isNaN(parsed) || parsed <= 0) {
      setRateStatus({ ok: false, msg: 'กรุณากรอกอัตราค่าไฟที่มากกว่า 0' });
      return;
    }
    setIsSavingRate(true);
    setRateStatus(null);
    try {
      const res = await saveElectricRate(parsed);
      if (res.success) {
        onUpdateElectricRate(parsed);
        setRateStatus({ ok: true, msg: `บันทึกอัตราค่าไฟ ${parsed} บาท/หน่วย สำเร็จ` });
      } else {
        setRateStatus({ ok: false, msg: res.error || 'เกิดข้อผิดพลาดในการบันทึก' });
      }
    } catch (err: any) {
      setRateStatus({ ok: false, msg: err.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsSavingRate(false);
    }
  };

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

  const MAX_RECORDS = 5000;
  const usedRecords = logs.length;
  const percentUsed = Math.min((usedRecords / MAX_RECORDS) * 100, 100);

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">

      {/* ── Toggle Sub-tabs ── */}
      <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('rate')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'rate'
              ? 'bg-white shadow-sm text-sky-500'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Zap className="h-4 w-4" strokeWidth={1.5} /> อัตราค่าไฟฟ้า (ชาร์จบ้าน)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('data')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'data'
              ? 'bg-white shadow-sm text-red-500'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} /> ลบข้อมูลรายเดือน
        </button>
      </div>

      {/* ── TAB 1: อัตราค่าไฟฟ้า (ชาร์จบ้าน) ── */}
      {activeTab === 'rate' && (
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden border border-slate-100">
          <div className="px-4 py-3 border-b border-sky-50 flex items-center justify-between bg-sky-50/50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-sky-500" />
              </div>
              <span className="text-sm font-bold text-slate-800">อัตราค่าไฟฟ้า (ชาร์จบ้าน)</span>
            </div>
            <span className="text-[10px] font-bold text-sky-600 bg-sky-100/60 px-2 py-0.5 rounded-full">
              ปัจจุบัน {electricRate} บ./หน่วย
            </span>
          </div>

          <form onSubmit={handleSaveRate} className="p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">
                ค่าไฟต่อหน่วย (บาท / kWh)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  placeholder="4.2218"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  className="w-full p-3 pr-24 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  บาท / หน่วย
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                *ใช้อัตรานี้ในการคำนวณค่าไฟโดยประมาณเมื่อบันทึกการชาร์จบ้านใหม่
              </p>
            </div>

            {rateStatus && (
              <div className={`p-3 rounded-xl flex items-start gap-2 text-xs font-semibold border ${
                rateStatus.ok ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
              }`}>
                {rateStatus.ok ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                <span>{rateStatus.msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingRate}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-xl font-bold shadow-md shadow-sky-100 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isSavingRate ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Save className="h-4 w-4" /> บันทึกอัตราค่าไฟ</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 2: จัดการข้อมูล (พื้นที่จัดเก็บ + ลบข้อมูลรายเดือน) ── */}
      {activeTab === 'data' && (
        <>
          {/* STORAGE USAGE */}
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] space-y-3 border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-bold text-slate-600">พื้นที่จัดเก็บ (Supabase)</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                {usedRecords.toLocaleString()} / {MAX_RECORDS.toLocaleString()} รายการ
              </span>
            </div>
            
            <div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mb-1.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${percentUsed > 90 ? 'bg-red-500' : percentUsed > 75 ? 'bg-amber-500' : 'bg-sky-500'}`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-400 text-right">
                *อิงจากจำนวนรายการ (แนะนำไม่เกิน 5,000 รายการเพื่อความรวดเร็ว)
              </p>
            </div>
          </div>

          {/* BULK DELETE SECTION */}
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
        </>
      )}
    </div>
  );
};
