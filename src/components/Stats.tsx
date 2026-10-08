import React, { useState, useMemo } from 'react';
import type { EvLog } from '../data/seedData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Home, MapPin, Trash2, Edit2, Zap, FolderOpen, TrendingUp, BarChart2, PieChartIcon, Gauge } from 'lucide-react';

interface StatsProps {
  logs: EvLog[];
  onEdit: (log: EvLog) => void;
  onDelete: (id: number) => void;
  deletingId?: number | null;
}

const MONTH_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const YEAR_COLORS = ['#0EA5E9', '#1D4ED8', '#f59e0b', '#8b5cf6', '#ef4444'];

/**
 * คำนวณ บาท/กม. แบบแม่นยำโดยอ้างอิงจาก "source charge" (การชาร์จก่อนหน้าที่ใกล้สุด)
 *
 * สูตร:
 *   - ชาร์จบ้าน (home): soc_used = end_soc - start_soc (SOC ที่ชาร์จครั้งนี้)
 *     → ต้นทุน = (soc_used / soc_available_prev) × cost_prev
 *   - ชาร์จสถานี (station): soc_used = end_soc_prev - soc_before (SOC ที่วิ่งมาจาก source)
 *     → ต้นทุน = (soc_used / soc_available_prev) × cost_prev
 */
function computeAttributedCostPerKm(log: EvLog, allLogs: EvLog[]): number | null {
  if (!log.odometer || !log.distance || log.distance <= 0) return null;

  // หา source charge = log ก่อนหน้าที่ใกล้ที่สุด (sort by date desc, then id desc)
  const prev = allLogs
    .filter(l => l.id !== log.id && (l.date < log.date || (l.date === log.date && l.id < log.id)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id)[0];

  if (!prev) return null;

  const socAvailPrev = (prev.end_soc ?? 0) - (prev.start_soc ?? 0); // % ที่ source charge ให้มา
  if (socAvailPrev <= 0) return null;

  let socUsed: number | null = null;

  if (log.type === 'home' && log.start_soc != null && log.end_soc != null) {
    // ชาร์จบ้าน: ใช้ SOC ของตัวเอง (ไฟที่ชาร์จครั้งนี้ = ไฟที่ใช้วิ่งมาก่อนชาร์จ)
    socUsed = log.end_soc - log.start_soc;
  } else if (log.type === 'station') {
    // ชาร์จสถานี: เริ่มชาร์จที่ start_soc (หรือ soc_before ถ้าเป็นข้อมูลเก่า)
    const socBeforeCharge = log.start_soc ?? log.soc_before;
    if (socBeforeCharge != null && prev.end_soc != null) {
      // วิ่งมาจาก end_soc_prev ลงมาถึง socBeforeCharge
      socUsed = prev.end_soc - socBeforeCharge;
    }
  }

  if (socUsed == null || socUsed <= 0) return null;

  const attributedCost = (socUsed / socAvailPrev) * prev.cost;
  return attributedCost / log.distance;
}



export const Stats: React.FC<StatsProps> = ({ logs, onEdit, onDelete, deletingId }) => {
  const now = new Date();
  const [filterType, setFilterType] = useState<'all' | 'home' | 'station'>('all');

  // Determine initial month: if current month has records use it, otherwise default to 'all' (every month)
  const defaultMonth = useMemo(() => {
    const currentM = now.getMonth() + 1;
    const currentY = now.getFullYear();
    const hasCurrentMonthLogs = logs.some(l => {
      const d = new Date(l.date);
      return d.getFullYear() === currentY && d.getMonth() + 1 === currentM;
    });
    return hasCurrentMonthLogs ? String(currentM).padStart(2, '0') : 'all';
  }, [logs]);

  const [filterMonth, setFilterMonth] = useState<string>(defaultMonth);
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());

  // Update filterMonth when defaultMonth is computed after initial load
  React.useEffect(() => {
    setFilterMonth(defaultMonth);
  }, [defaultMonth]);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);
    logs.forEach(l => { try { years.add(new Date(l.date).getFullYear()); } catch {} });
    return Array.from(years).sort((a, b) => b - a);
  }, [logs]);

  // Filtered logs for list & summary
  const filteredData = useMemo(() => {
    return logs.filter(log => {
      try {
        const d = new Date(log.date);
        if (d.getFullYear() !== filterYear) return false;
        if (filterMonth !== 'all' && d.getMonth() + 1 !== parseInt(filterMonth)) return false;
        if (filterType !== 'all' && log.type !== filterType) return false;
        return true;
      } catch { return false; }
    });
  }, [logs, filterType, filterMonth, filterYear]);

  const totalCost = filteredData.reduce((s, l) => s + l.cost, 0);
  const totalCount = filteredData.length;

  // Distance and Savings calculations
  const totalDistance = useMemo(() => {
    return filteredData.reduce((sum, log) => {
      const dist = log.distance != null && !isNaN(Number(log.distance)) ? Number(log.distance) : 0;
      return sum + dist;
    }, 0);
  }, [filteredData]);

  const { costWithDistance, recordedDistance } = useMemo(() => {
    let costSum = 0;
    let distSum = 0;
    filteredData.forEach(log => {
      const dist = log.distance != null && !isNaN(Number(log.distance)) ? Number(log.distance) : 0;
      if (dist > 0) {
        costSum += log.cost;
        distSum += dist;
      }
    });
    return { costWithDistance: costSum, recordedDistance: distSum };
  }, [filteredData]);

  const avgCostPerKm = recordedDistance > 0 ? (costWithDistance / recordedDistance) : null;

  // ── Chart 1: Stacked bar (monthly when 'all', daily for specific month) ──
  const chart1Data = useMemo(() => {
    if (filterMonth === 'all') {
      return MONTH_SHORT.map((name, i) => {
        const ml = logs.filter(l => {
          const d = new Date(l.date);
          return d.getFullYear() === filterYear && d.getMonth() === i;
        });
        return {
          name,
          บ้าน: filterType !== 'station' ? Math.round(ml.filter(l => l.type === 'home').reduce((s, l) => s + l.cost, 0)) : 0,
          สถานี: filterType !== 'home' ? Math.round(ml.filter(l => l.type === 'station').reduce((s, l) => s + l.cost, 0)) : 0,
        };
      });
    } else {
      const month = parseInt(filterMonth);
      const days = new Date(filterYear, month, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const dl = logs.filter(l => {
          const d = new Date(l.date);
          return d.getFullYear() === filterYear && d.getMonth() + 1 === month && d.getDate() === day;
        });
        return {
          name: String(day),
          บ้าน: filterType !== 'station' ? Math.round(dl.filter(l => l.type === 'home').reduce((s, l) => s + l.cost, 0)) : 0,
          สถานี: filterType !== 'home' ? Math.round(dl.filter(l => l.type === 'station').reduce((s, l) => s + l.cost, 0)) : 0,
        };
      });
    }
  }, [logs, filterType, filterMonth, filterYear]);

  // ── Chart 2: Doughnut proportion ──
  const pieData = useMemo(() => {
    const base = logs.filter(l => {
      const d = new Date(l.date);
      return d.getFullYear() === filterYear &&
        (filterMonth === 'all' || d.getMonth() + 1 === parseInt(filterMonth));
    });
    const home = base.filter(l => l.type === 'home' && filterType !== 'station').reduce((s, l) => s + l.cost, 0);
    const station = base.filter(l => l.type === 'station' && filterType !== 'home').reduce((s, l) => s + l.cost, 0);
    return [
      { name: 'ชาร์จบ้าน', value: Math.round(home) },
      { name: 'ชาร์จสถานี', value: Math.round(station) },
    ];
  }, [logs, filterType, filterMonth, filterYear]);

  const PIE_COLORS = ['#1D4ED8', '#38BDF8'];

  // ── Chart 3: Yearly comparison ──
  const yearlyData = useMemo(() => {
    return MONTH_SHORT.map((name, i) => {
      const point: Record<string, number | string> = { name };
      availableYears.forEach(year => {
        const ml = logs.filter(l => {
          const d = new Date(l.date);
          return d.getFullYear() === year && d.getMonth() === i &&
            (filterType === 'all' || l.type === filterType);
        });
        point[String(year + 543)] = Math.round(ml.reduce((s, l) => s + l.cost, 0));
      });
      return point;
    });
  }, [logs, availableYears, filterType]);

  // Date helpers (BE)
  const fmtDay = (d: string) => { try { return new Date(d).getDate(); } catch { return '?'; } };
  const fmtMonthS = (d: string) => { try { return MONTH_SHORT[new Date(d).getMonth()]; } catch { return ''; } };
  const fmtYearBE = (d: string) => { try { return new Date(d).getFullYear() + 543; } catch { return ''; } };

  const chart1Title = filterMonth === 'all'
    ? `เปรียบเทียบรายเดือน (ปี ${filterYear + 543})`
    : `ค่าชาร์จรายวัน (${MONTH_SHORT[parseInt(filterMonth) - 1]} ${filterYear + 543})`;

  return (
    <div className="pb-4">

      {/* ── Filter Section ── */}
      <div className="px-4 pt-5 mb-4 space-y-3">
        {/* Type Pills */}
        <div className="flex gap-2">
          {(['all', 'home', 'station'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                filterType === t ? 'bg-sky-500 text-white border-sky-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {t === 'all' && <Zap className="h-3.5 w-3.5" />}
              {t === 'home' && <Home className="h-3.5 w-3.5" />}
              {t === 'station' && <MapPin className="h-3.5 w-3.5" />}
              {t === 'all' ? 'ทั้งหมด' : t === 'home' ? 'บ้าน' : 'สถานี'}
            </button>
          ))}
        </div>

        {/* Month + Year */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-400 shadow-sm"
          >
            <option value="all">ทุกเดือน (รายปี)</option>
            {MONTH_FULL.map((m, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(parseInt(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-400 shadow-sm"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>ปี {y + 543}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="px-4 mb-4 grid grid-cols-2 gap-2.5">
        {/* Card 1: Total Cost */}
        <div className="bg-gradient-to-br from-sky-500 to-indigo-700 p-3.5 rounded-2xl text-white shadow-md shadow-sky-100 flex flex-col justify-between">
          <div>
            <p className="text-[10px] opacity-75 font-medium tracking-wider uppercase">รวมค่าชาร์จ</p>
            <p className="text-2xl font-bold leading-tight mt-1">
              {Math.round(totalCost).toLocaleString()}
            </p>
          </div>
          <p className="text-xs opacity-75 mt-2 pt-1.5 border-t border-white/10 text-right">บาท</p>
        </div>

        {/* Card 2: Total Times */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">จำนวนครั้ง</p>
            <div className="flex items-end gap-1 mt-1">
              <p className="text-2xl font-bold text-slate-800 leading-tight">{totalCount}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 pt-1.5 border-t border-slate-50 text-right">ครั้ง</p>
        </div>

        {/* Card 3: Total Distance */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase flex items-center gap-1">
              <Gauge className="h-3 w-3 text-sky-500" /> ระยะทางรวม
            </p>
            <p className="text-2xl font-bold text-slate-800 leading-tight mt-1">
              {totalDistance > 0 ? totalDistance.toLocaleString() : '-'}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-1.5 border-t border-slate-50">
            <span>{totalDistance > 0 ? 'จากการบันทึก' : 'ยังไม่มีเลขไมล์'}</span>
            <span>กม.</span>
          </div>
        </div>

        {/* Card 4: Avg Cost per km */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" /> ต้นทุนเฉลี่ย
            </p>
            <p className="text-2xl font-bold text-slate-800 leading-tight mt-1">
              {avgCostPerKm !== null ? avgCostPerKm.toFixed(2) : '-'}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-1.5 border-t border-slate-50">
            <span>ประสิทธิภาพ</span>
            <span>บาท/กม.</span>
          </div>
        </div>
      </div>

      {/* ── Chart 1: Stacked Bar ── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sky-500 shrink-0" />
          {chart1Title}
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart1Data} margin={{ top: 5, right: 5, left: -28, bottom: 5 }}>
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={filterMonth === 'all' ? 9 : 8}
                tickLine={false}
                axisLine={false}
                interval={filterMonth === 'all' ? 0 : 4}
              />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: '11px', borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                cursor={{ fill: '#f0fdf4' }}
              />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
              <Bar dataKey="บ้าน" stackId="a" fill="#1D4ED8" maxBarSize={18} />
              <Bar dataKey="สถานี" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Chart 2: Doughnut ── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-sky-500 shrink-0" />
          สัดส่วนการชาร์จ
        </h3>
        {pieData.some(d => d.value > 0) ? (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={42} outerRadius={68}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => `${Number(v).toLocaleString()} บาท`}
                  contentStyle={{ fontSize: '11px', borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูล</div>
        )}
      </div>

      {/* ── Chart 3: Yearly Comparison (only when > 1 year of data) ── */}
      {availableYears.length >= 1 && (
        <div className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-amber-500 shrink-0" />
            เปรียบเทียบรายปี (แยกรายปี)
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData} margin={{ top: 5, right: 5, left: -28, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: '11px', borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  cursor={{ fill: '#fffbeb' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                {availableYears.map((year, i) => (
                  <Bar
                    key={year}
                    dataKey={String(year + 543)}
                    fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={14}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── History List (Reference Style) ── */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-700 text-base">รายการล่าสุด</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            กดแก้ไขหรือลบ
          </span>
        </div>

        {filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            <FolderOpen className="h-10 w-10 mb-2 text-slate-300" />
            <p className="text-sm">ไม่มีข้อมูลในช่วงเวลานี้</p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-4">
            {filteredData.map(log => {
              const isHome = log.type === 'home';
              return (
                <div
                  key={log.id}
                  className={`bg-white rounded-xl shadow-sm p-3.5 relative border-l-4 ${isHome ? 'border-l-sky-500' : 'border-l-sky-500'}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Date Box */}
                    <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl py-2 px-2.5 min-w-[3.2rem] border border-slate-100 shrink-0">
                      <span className="text-xl font-black text-slate-700 leading-none">{fmtDay(log.date)}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{fmtMonthS(log.date)}</span>
                      <span className="text-[9px] text-slate-400">{fmtYearBE(log.date)}</span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isHome ? 'bg-sky-50' : 'bg-sky-50'}`}>
                        {isHome
                          ? <Home className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.5} />
                          : <MapPin className="h-3.5 w-3.5 text-sky-500" strokeWidth={1.5} />
                        }
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        {isHome ? 'ชาร์จบ้าน' : 'สถานีชาร์จ'}
                      </span>
                    </div>
                      {/* Details row: SOC for home or station */}
                      {log.start_soc != null || log.end_soc != null ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {!isHome && log.station_name && (
                            <span className="text-[11px] font-medium text-slate-700 mr-1">{log.station_name} •</span>
                          )}
                          {log.start_soc != null && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">Start {log.start_soc}%</span>
                          )}
                          {log.start_soc != null && log.end_soc != null && (
                            <span className="text-[10px] text-slate-400">→</span>
                          )}
                          {log.end_soc != null && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">End {log.end_soc}%</span>
                          )}
                          {log.units != null && Number(log.units) > 0 && (
                            <span className="text-[10px] text-sky-500 font-semibold ml-1">{Number(log.units).toFixed(1)} kWh</span>
                          )}
                        </div>
                      ) : !isHome ? (
                        <p className="text-[11px] font-medium text-slate-600 truncate">{log.station_name}</p>
                      ) : null}

                      {/* Odometer & Distance badge */}
                      {log.odometer != null && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                            <Gauge className="h-3 w-3 text-slate-400" />
                            {Number(log.odometer).toLocaleString()} กม.
                          </span>
                          {log.distance != null && log.distance > 0 && (() => {
                            const attrCpk = computeAttributedCostPerKm(log, logs);
                            return (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-100/60">
                                +{Number(log.distance).toLocaleString()} กม.
                                {attrCpk !== null ? (
                                  <span className="text-teal-600 font-bold">
                                    ({attrCpk.toFixed(2)} ฿/กม.✓)
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal">
                                    ({(log.cost / log.distance).toFixed(2)} ฿/กม.)
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                          {/* Show soc_before on legacy station logs if no start_soc */}
                          {!isHome && log.start_soc == null && log.soc_before != null && (
                            <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                              แบตก่อนชาร์จ {log.soc_before}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cost + Actions */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="text-base font-black text-sky-500 leading-none">
                        {parseFloat(String(log.cost)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onEdit(log)}
                          className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 flex items-center justify-center transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => onDelete(log.id)}
                          disabled={deletingId === log.id}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            deletingId === log.id
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-red-50 text-red-500 hover:bg-red-100'
                          }`}
                          title="ลบ"
                        >
                          {deletingId === log.id ? (
                            <div className="w-3.5 h-3.5 border-[2px] border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
