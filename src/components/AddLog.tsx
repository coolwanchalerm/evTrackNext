import React, { useState, useMemo, useEffect } from 'react';
import type { EvLog } from '../data/seedData';
import { createLog } from '../lib/supabase';
import { Home, MapPin, Calendar, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface AddLogProps {
  type: 'home' | 'station';
  onSuccess: (newLog: EvLog) => void;
  historicalStations: string[];
}

export const AddLog: React.FC<AddLogProps> = ({ type, onSuccess, historicalStations }) => {
  const BATTERY_KWH = 60.48;
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startSoc, setStartSoc] = useState(20);
  const [endSoc, setEndSoc] = useState(80);
  const [rateType, setRateType] = useState<'database' | 'tou' | 'custom'>('database');
  const [customRate, setCustomRate] = useState(4.2218);
  const [touFt, setTouFt] = useState(0.3972);
  const [isOffPeak, setIsOffPeak] = useState(true);
  const [stationName, setStationName] = useState('');
  const [stationCost, setStationCost] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const units = useMemo(() => {
    if (endSoc <= startSoc) return 0;
    return parseFloat(((endSoc - startSoc) / 100 * BATTERY_KWH).toFixed(4));
  }, [startSoc, endSoc]);

  const cost = useMemo(() => {
    if (units <= 0) return 0;
    if (rateType === 'database') return parseFloat((units * 4.2218).toFixed(4));
    if (rateType === 'custom') return parseFloat((units * customRate).toFixed(4));
    const base = isOffPeak ? 2.6369 : 5.7982;
    return parseFloat((units * (base + touFt) * 1.07).toFixed(4));
  }, [units, rateType, customRate, touFt, isOffPeak]);

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
    try {
      if (type === 'home') {
        if (endSoc <= startSoc) throw new Error('% แบตสิ้นสุดต้องมากกว่าเริ่มต้น');
        const newLog = await createLog({ type: 'home', date, start_soc: startSoc, end_soc: endSoc, units, cost, station_name: null });
        onSuccess(newLog);
        setStatus({ ok: true, msg: 'บันทึกสำเร็จ! กำลังพาไปดูประวัติ...' });
        setStartSoc(20); setEndSoc(80);
      } else {
        if (!stationName.trim()) throw new Error('กรุณาระบุชื่อสถานีชาร์จ');
        if (!stationCost || parseFloat(stationCost) <= 0) throw new Error('กรุณาระบุราคาที่จ่ายจริง');
        const newLog = await createLog({ type: 'station', date, start_soc: null, end_soc: null, units: null, cost: parseFloat(stationCost), station_name: stationName.trim() });
        onSuccess(newLog);
        setStatus({ ok: true, msg: `บันทึกสำเร็จ! ที่สถานี ${stationName}` });
        setStationName(''); setStationCost('');
      }
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHome = type === 'home';
  const accent = isHome ? 'bg-sky-500' : 'bg-teal-500';
  const accentLight = isHome ? 'bg-sky-50 text-sky-700 border-sky-100' : 'bg-teal-50 text-teal-700 border-teal-100';
  const accentFocus = isHome ? 'focus:border-sky-400' : 'focus:border-teal-400';
  const accentBtn = isHome ? 'bg-sky-500 hover:bg-sky-600' : 'bg-teal-500 hover:bg-teal-600';

  return (
    <div className="pt-5 pb-12">
      {/* Status Alert */}
      {status && (
        <div className={`mx-4 mb-4 p-3.5 rounded-2xl flex items-center gap-2.5 border text-sm font-medium ${status.ok ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {status.ok ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span>{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 px-4">

        {/* ── Date Picker ── */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">วันที่ชาร์จไฟ</span>
          </div>
          <div className="px-4 py-3">
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:bg-white ${accentFocus} transition-all`}
            />
          </div>
        </div>

        {/* ── HOME FORM ── */}
        {isHome && (
          <>
            {/* SOC Sliders */}
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b border-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">ระดับแบตเตอรี่ (%)</span>
                <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">BYD 60.48 kWh</span>
              </div>
              <div className="px-4 py-4 space-y-5">
                {/* Start */}
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-500 font-medium">แบตเตอรี่เริ่มต้น</span>
                    <span className={`font-bold px-2 py-0.5 rounded-lg border text-xs ${accentLight}`}>{startSoc}%</span>
                  </div>
                  <input type="range" min="0" max="99" value={startSoc}
                    onChange={e => { const v = +e.target.value; setStartSoc(v); if (v >= endSoc) setEndSoc(Math.min(v + 1, 100)); }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-500 bg-slate-100"
                  />
                </div>
                {/* End */}
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-500 font-medium">แบตเตอรี่เสร็จแล้ว</span>
                    <span className={`font-bold px-2 py-0.5 rounded-lg border text-xs ${accentLight}`}>{endSoc}%</span>
                  </div>
                  <input type="range" min={Math.min(startSoc + 1, 100)} max="100" value={endSoc}
                    onChange={e => setEndSoc(+e.target.value)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-500 bg-slate-100"
                  />
                </div>
                {/* Delta result */}
                <div className="bg-sky-50 rounded-xl p-3 flex items-center justify-between border border-sky-100">
                  <div className="text-xs text-sky-600 font-medium">ไฟที่ชาร์จเข้าแบต</div>
                  <div className="text-right">
                    <span className="text-lg font-black text-sky-700">{units.toFixed(2)}</span>
                    <span className="text-xs text-sky-500 ml-1">kWh</span>
                    <div className="text-[10px] text-sky-400">จาก {startSoc}% ถึง {endSoc}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rate Selector */}
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-4 py-3.5 flex items-center justify-between border-b border-slate-50"
              >
                <span className="text-xs font-semibold text-slate-500">คำนวณค่าไฟฟ้า</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-sky-500 font-bold">
                    {rateType === 'database' ? '4.22 บ./หน่วย' : rateType === 'tou' ? (isOffPeak ? 'Off-Peak' : 'On-Peak') : `${customRate} บ./หน่วย`}
                  </span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {showAdvanced && (
                <div className="px-4 py-4 space-y-4">
                  {/* Rate type pills */}
                  <div className="flex gap-2 flex-wrap">
                    {(['database', 'tou', 'custom'] as const).map(rt => (
                      <button key={rt} type="button" onClick={() => setRateType(rt)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${rateType === rt ? 'bg-sky-500 text-white border-sky-500' : 'text-slate-500 border-slate-200 hover:border-sky-300'}`}
                      >
                        {rt === 'database' ? 'ตามประวัติ (4.22)' : rt === 'tou' ? 'TOU (PEA)' : 'กำหนดเอง'}
                      </button>
                    ))}
                  </div>

                  {rateType === 'custom' && (
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">อัตราค่าไฟต่อหน่วย (บาท)</label>
                      <input type="number" step="0.0001" value={customRate}
                        onChange={e => setCustomRate(parseFloat(e.target.value) || 0)}
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:bg-white ${accentFocus} transition-all`}
                      />
                    </div>
                  )}

                  {rateType === 'tou' && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setIsOffPeak(true)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${isOffPeak ? 'bg-sky-500 text-white border-sky-500' : 'text-slate-500 border-slate-200'}`}
                        >
                          🌙 Off-Peak (2.63 บ.)
                        </button>
                        <button type="button" onClick={() => setIsOffPeak(false)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${!isOffPeak ? 'bg-amber-500 text-white border-amber-500' : 'text-slate-500 border-slate-200'}`}
                        >
                          ☀️ On-Peak (5.79 บ.)
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-400 font-bold shrink-0">ค่า Ft:</label>
                        <input type="number" step="0.0001" value={touFt}
                          onChange={e => setTouFt(parseFloat(e.target.value) || 0)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400">+ VAT 7%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cost Result Banner */}
            <div className={`${accent} rounded-2xl p-5 shadow-lg flex justify-between items-center`}>
              <div>
                <div className="text-xs text-white/70 font-medium mb-1">ค่าไฟฟ้าประมาณ</div>
                <div className="text-3xl font-black text-white">
                  {cost.toFixed(2)} <span className="text-base font-medium text-white/70">บาท</span>
                </div>
              </div>
              <div className="text-right text-white/80">
                <div className="text-sm font-bold">{units.toFixed(1)} kWh</div>
                <div className="text-xs">{(cost / (units || 1)).toFixed(2)} บ./หน่วย</div>
              </div>
            </div>
          </>
        )}

        {/* ── STATION FORM ── */}
        {!isHome && (
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <span className="text-xs font-semibold text-slate-500">ข้อมูลการชาร์จสถานี</span>
            </div>
            <div className="px-4 py-4 space-y-4">
              {/* Station name */}
              <div className="relative">
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5">ชื่อสถานีบริการชาร์จ</label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="เช่น Rever, PTT EV, Elex"
                    value={stationName}
                    onFocus={() => setShowAutocomplete(true)}
                    onChange={e => { setStationName(e.target.value); setShowAutocomplete(true); }}
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:bg-white ${accentFocus} transition-all`}
                  />
                </div>
                {showAutocomplete && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                    <div className="px-3 py-2 text-[10px] text-slate-400 bg-slate-50 font-bold border-b border-slate-100">สถานีที่เคยชาร์จ</div>
                    {suggestions.map(s => (
                      <button key={s} type="button" onClick={() => { setStationName(s); setShowAutocomplete(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {showAutocomplete && <div className="fixed inset-0 z-20" onClick={() => setShowAutocomplete(false)} />}
              </div>

              {/* Price */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5">ค่าบริการที่จ่ายจริง</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm text-slate-400 font-bold">฿</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="0.00"
                    value={stationCost}
                    onChange={e => setStationCost(e.target.value)}
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-12 py-3 text-xl font-black text-slate-800 focus:outline-none focus:bg-white ${accentFocus} transition-all`}
                  />
                  <span className="absolute right-3 text-sm text-slate-400 font-medium">บาท</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${accentBtn} text-white font-bold py-4 rounded-2xl shadow-lg text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60`}
        >
          {isSubmitting ? (
            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> กำลังบันทึก...</>
          ) : (
            <><Check className="h-5 w-5 stroke-[2.5px]" /> บันทึกการชาร์จไฟ</>
          )}
        </button>

      </form>
    </div>
  );
};
