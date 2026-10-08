import React, { useState, useMemo, useEffect } from 'react';
import { createLog, updateLog } from '../lib/supabase';
import type { EvLog } from '../data/seedData';
import { Home, MapPin, Calendar, Check, AlertCircle, X, Gauge } from 'lucide-react';

interface RecordProps {
  editingLog: EvLog | null;
  onSuccess: (log: EvLog, isEdit: boolean) => void;
  onCancelEdit: () => void;
  historicalStations: string[];
  electricRate?: number;
  logs?: EvLog[];
}

const BATTERY_KWH = 60.48;

export const Record: React.FC<RecordProps> = ({
  editingLog, onSuccess, onCancelEdit, historicalStations, electricRate = 4.2218, logs = [],
}) => {
  const [chargeType, setChargeType] = useState<'home' | 'station'>(editingLog?.type ?? 'home');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startSoc, setStartSoc] = useState('');
  const [endSoc, setEndSoc] = useState('');
  const [stationName, setStationName] = useState('');
  const [stationCost, setStationCost] = useState('');
  const [socBefore, setSocBefore] = useState(''); // % แบตก่อนชาร์จสถานี
  const [odometer, setOdometer] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Find previous odometer recorded in history
  const previousOdometer = useMemo(() => {
    const validLogs = logs
      .filter(l => l.id !== editingLog?.id && l.odometer != null && !isNaN(Number(l.odometer)))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
    return validLogs[0]?.odometer ?? null;
  }, [logs, editingLog]);

  // Pre-fill form when editingLog changes
  useEffect(() => {
    if (editingLog) {
      setChargeType(editingLog.type);
      setDate(editingLog.date);
      setOdometer(editingLog.odometer != null ? String(editingLog.odometer) : '');
      if (editingLog.type === 'home') {
        setStartSoc(String(editingLog.start_soc ?? ''));
        setEndSoc(String(editingLog.end_soc ?? ''));
        setStationName('');
        setStationCost('');
        setSocBefore('');
      } else {
        setStationName(editingLog.station_name ?? '');
        setStationCost(String(editingLog.cost));
        setSocBefore(editingLog.soc_before != null ? String(editingLog.soc_before) : '');
        setStartSoc('');
        setEndSoc('');
      }
    } else {
      // Reset form when not editing
      const today = new Date().toISOString().split('T')[0];
      setChargeType('home');
      setDate(today);
      setStartSoc('');
      setEndSoc('');
      setStationName('');
      setStationCost('');
      setSocBefore('');
      setOdometer('');
    }
    setStatus(null);
  }, [editingLog]);

  const clampSoc = (val: string) => {
    if (val === '') return '';
    const num = parseFloat(val);
    if (num > 100) return '100';
    if (num < 0) return '0';
    return val;
  };

  const { units, cost } = useMemo(() => {
    const s = parseFloat(startSoc) || 0;
    const e = parseFloat(endSoc) || 0;
    if (e > s) {
      const u = (e - s) / 100 * BATTERY_KWH;
      return { units: parseFloat(u.toFixed(4)), cost: parseFloat((u * electricRate).toFixed(4)) };
    }
    return { units: 0, cost: 0 };
  }, [startSoc, endSoc, electricRate]);

  // Calculate distance for this trip
  const calculatedDistance = useMemo(() => {
    const cur = parseFloat(odometer);
    if (!isNaN(cur) && previousOdometer != null && cur > previousOdometer) {
      return cur - previousOdometer;
    }
    return editingLog?.distance ?? null;
  }, [odometer, previousOdometer, editingLog]);

  const currentTripCost = chargeType === 'home' ? cost : (parseFloat(stationCost) || 0);

  const suggestions = useMemo(() => {
    if (!stationName) return historicalStations.slice(0, 5);
    return historicalStations.filter(s => s.toLowerCase().includes(stationName.toLowerCase())).slice(0, 5);
  }, [stationName, historicalStations]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    const odoVal = odometer.trim() !== '' && !isNaN(parseFloat(odometer)) ? parseFloat(odometer) : null;
    const distVal = calculatedDistance !== null && calculatedDistance > 0 ? calculatedDistance : null;

    const socBeforeVal = socBefore.trim() !== '' && !isNaN(parseFloat(socBefore)) ? parseFloat(socBefore) : null;

    try {
      if (chargeType === 'home') {
        const s = parseFloat(startSoc);
        const en = parseFloat(endSoc);
        if (isNaN(s) || isNaN(en)) throw new Error('กรุณากรอกเปอร์เซ็นต์แบตเตอรี่');
        if (s < 0 || s > 100 || en < 0 || en > 100) throw new Error('เปอร์เซ็นต์ต้องไม่เกิน 100');
        if (s >= en) throw new Error('% เริ่มต้น ต้องน้อยกว่า % สิ้นสุด');

        const payload = {
          type: 'home' as const,
          date,
          start_soc: s,
          end_soc: en,
          units,
          cost,
          station_name: null,
          odometer: odoVal,
          distance: distVal,
          soc_before: null,
        };

        if (editingLog) {
          const updated = await updateLog(editingLog.id, payload);
          if (updated) onSuccess(updated, true);
          else throw new Error('อัปเดตข้อมูลไม่สำเร็จ');
        } else {
          const newLog = await createLog(payload);
          onSuccess(newLog, false);
        }

      } else {
        if (!stationName.trim()) throw new Error('กรุณาระบุชื่อสถานีชาร์จ');
        const c = parseFloat(stationCost);
        if (isNaN(c) || c <= 0) throw new Error('กรุณาระบุค่าชาร์จที่จ่ายจริง');

        const payload = {
          type: 'station' as const,
          date,
          start_soc: null,
          end_soc: null,
          units: null,
          cost: c,
          station_name: stationName.trim(),
          odometer: odoVal,
          distance: distVal,
          soc_before: socBeforeVal,
        };

        if (editingLog) {
          const updated = await updateLog(editingLog.id, payload);
          if (updated) onSuccess(updated, true);
          else throw new Error('อัปเดตข้อมูลไม่สำเร็จ');
        } else {
          const newLog = await createLog(payload);
          onSuccess(newLog, false);
        }
      }
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = editingLog !== null;

  return (
    <div className="pt-4 pb-12">

      {/* ── Edit Mode Banner ── */}
      {isEditing && (
        <div className="mx-4 mb-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-3.5 rounded-xl flex justify-between items-center">
          <div>
            <p className="font-bold text-sm">กำลังแก้ไขรายการ</p>
            <p className="text-xs opacity-70 mt-0.5">กดบันทึกเพื่ออัปเดต หรือยกเลิก</p>
          </div>
          <button
            onClick={onCancelEdit}
            className="bg-white rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm flex items-center gap-1 hover:bg-amber-100 transition-all"
          >
            <X className="h-3.5 w-3.5" /> ยกเลิก
          </button>
        </div>
      )}

      {/* ── Status Alert ── */}
      {status && (
        <div className={`mx-4 mb-4 p-3.5 rounded-xl flex items-center gap-2.5 border text-sm font-medium ${
          status.ok ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {status.ok ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span>{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 px-4">

        {/* ── Toggle: บ้าน / สถานี ── */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setChargeType('home')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              chargeType === 'home'
                ? 'bg-white shadow-sm text-sky-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Home className="h-4 w-4" strokeWidth={1.5} /> ชาร์จบ้าน
          </button>
          <button
            type="button"
            onClick={() => setChargeType('station')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
              chargeType === 'station'
                ? 'bg-white shadow-sm text-sky-500'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MapPin className="h-4 w-4" strokeWidth={1.5} /> สถานี
          </button>
        </div>

        {/* ── Date Picker ── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-50 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">วันที่ชาร์จ</span>
          </div>
          <div className="px-4 py-3">
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white transition-all ${
                chargeType === 'home' ? 'focus:border-sky-400' : 'focus:border-sky-400'
              }`}
            />
          </div>
        </div>

        {/* ── Odometer / Distance Card (Optional) ── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-sky-500" />
              <span className="text-xs font-semibold text-slate-700">เลขไมล์รถปัจจุบัน (กม.)</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">ไม่บังคับ</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                placeholder={previousOdometer ? `เช่น ${previousOdometer + 300}` : 'เช่น 15200'}
                value={odometer}
                onChange={e => setOdometer(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">กม.</span>
            </div>

            {/* Previous Odometer & Calculated Distance */}
            {previousOdometer !== null && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <span>ไมล์ครั้งก่อน: <b className="text-slate-700">{previousOdometer.toLocaleString()} กม.</b></span>
                {calculatedDistance !== null && calculatedDistance > 0 ? (
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg">
                    +{calculatedDistance.toLocaleString()} กม.
                  </span>
                ) : (
                  <span className="text-slate-400">คำนวณอัตโนมัติเมื่อกรอก</span>
                )}
              </div>
            )}

            {/* Live Cost per km preview */}
            {calculatedDistance !== null && calculatedDistance > 0 && currentTripCost > 0 && (
              <div className="flex items-center justify-between text-xs font-medium text-emerald-700 bg-emerald-50/80 border border-emerald-100 px-3 py-2 rounded-xl">
                <span>⚡ ต้นทุนวิ่งรอบนี้:</span>
                <span className="font-bold text-emerald-600">
                  ~{(currentTripCost / calculatedDistance).toFixed(2)} บาท/กม.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── HOME FORM ── */}
        {chargeType === 'home' && (
          <>
            {/* SOC Inputs */}
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">ระดับแบตเตอรี่ (%)</span>
                <span className="text-[10px] font-bold text-sky-500 bg-sky-50 px-2 py-0.5 rounded-full">60.48 kWh</span>
              </div>
              <div className="px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">เริ่มต้น (%)</label>
                    <input
                      type="number"
                      min="0" max="100"
                      placeholder="0"
                      value={startSoc}
                      onChange={e => setStartSoc(clampSoc(e.target.value))}
                      className="w-full p-3 border border-slate-200 rounded-xl text-center font-black text-2xl text-slate-800 bg-slate-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">สิ้นสุด (%)</label>
                    <input
                      type="number"
                      min="0" max="100"
                      placeholder="100"
                      value={endSoc}
                      onChange={e => setEndSoc(clampSoc(e.target.value))}
                      className="w-full p-3 border border-slate-200 rounded-xl text-center font-black text-2xl text-slate-800 bg-slate-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Live Preview */}
                <div className="mt-3 bg-sky-50 p-4 rounded-xl border border-sky-100">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-600">พลังงาน (kWh)</span>
                    <span className="font-bold text-slate-800">{units.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-slate-600 text-sm">ค่าไฟโดยประมาณ</span>
                    <span className="text-2xl font-black text-sky-500">{cost.toFixed(2)} ฿</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-right">*แบต 60.48 kWh | {electricRate} บ./หน่วย</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-sky-100 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> กำลังบันทึก...</>
              ) : isEditing ? (
                <><Check className="h-5 w-5" /> อัปเดตข้อมูล (แก้ไข)</>
              ) : (
                <><Check className="h-5 w-5" /> บันทึกการชาร์จบ้าน</>
              )}
            </button>
          </>
        )}

        {/* ── STATION FORM ── */}
        {chargeType === 'station' && (
          <>
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-50">
                <span className="text-xs font-semibold text-slate-500">ข้อมูลสถานีชาร์จ</span>
              </div>
              <div className="px-4 py-4 space-y-4">
                {/* Station Name */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">ชื่อสถานี</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น PTT, EA Anywhere, Rever"
                    value={stationName}
                    onFocus={() => setShowAutocomplete(true)}
                    onChange={e => { setStationName(e.target.value); setShowAutocomplete(true); }}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-slate-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
                  />
                  {showAutocomplete && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                      <div className="px-3 py-2 text-[10px] text-slate-400 bg-slate-50 font-bold border-b border-slate-100">ประวัติสถานี</div>
                      {suggestions.map(s => (
                        <button key={s} type="button"
                          onClick={() => { setStationName(s); setShowAutocomplete(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-500 transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {showAutocomplete && <div className="fixed inset-0 z-20" onClick={() => setShowAutocomplete(false)} />}
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">ค่าชาร์จ (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={stationCost}
                    onChange={e => setStationCost(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-center font-black text-2xl text-slate-800 bg-slate-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
                  />
                </div>

                {/* SOC Before — optional, for accurate cost/km */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-500">% แบตก่อนชาร์จ</label>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">ไม่บังคับ</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="เช่น 30"
                      value={socBefore}
                      onChange={e => setSocBefore(clampSoc(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sky-400 focus:bg-white transition-all"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">กรอกเพื่อคำนวณ บาท/กม. ที่แม่นยำขึ้น</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-sky-100 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> กำลังบันทึก...</>
              ) : isEditing ? (
                <><Check className="h-5 w-5" /> อัปเดตข้อมูล (แก้ไข)</>
              ) : (
                <><Check className="h-5 w-5" /> บันทึกการชาร์จสถานี</>
              )}
            </button>
          </>
        )}

      </form>
    </div>
  );
};
