import React, { useMemo } from 'react';
import type { EvLog } from '../data/seedData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Home, MapPin, TrendingUp, Zap, ChevronRight, Wallet, BatteryCharging } from 'lucide-react';

interface DashboardProps {
  logs: EvLog[];
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ logs, onNavigate }) => {
  const stats = useMemo(() => {
    let totalCost = 0, totalUnits = 0, homeCost = 0, homeUnits = 0, homeCount = 0, stationCost = 0, stationCount = 0;
    logs.forEach(log => {
      totalCost += log.cost;
      if (log.type === 'home') {
        homeCount++;
        homeCost += log.cost;
        if (log.units) { homeUnits += log.units; totalUnits += log.units; }
      } else {
        stationCount++;
        stationCost += log.cost;
      }
    });
    const avgUnitCost = homeUnits > 0 ? homeCost / homeUnits : 4.2218;
    const estRangeKm = (totalUnits + stationCost / 7.5) * 6.3;
    const costPerKm = estRangeKm > 0 ? totalCost / estRangeKm : 0;
    return { totalCost, totalUnits, avgUnitCost, homeCost, homeCount, stationCost, stationCount, estRangeKm, costPerKm };
  }, [logs]);

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  const monthlyData = useMemo(() => {
    const map: Record<string, { name: string; บ้าน: number; สถานี: number }> = {};
    logs.forEach(log => {
      const d = new Date(log.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { name: `${thaiMonths[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, บ้าน: 0, สถานี: 0 };
      if (log.type === 'home') map[key].บ้าน += Math.round(log.cost);
      else map[key].สถานี += Math.round(log.cost);
    });
    return Object.keys(map).sort().slice(-6).map(k => map[k]);
  }, [logs]);

  const pieData = [
    { name: 'บ้าน', value: Math.round(stats.homeCost), count: stats.homeCount },
    { name: 'สถานี', value: Math.round(stats.stationCost), count: stats.stationCount },
  ];
  const PIE_COLORS = ['#0EA5E9', '#14B8A6'];

  const topStations = useMemo(() => {
    const map: Record<string, { name: string; count: number; cost: number }> = {};
    logs.forEach(log => {
      if (log.type !== 'station' || !log.station_name) return;
      let name = log.station_name.trim();
      const l = name.toLowerCase();
      if (l.startsWith('ptt')) name = 'PTT EV';
      else if (l.startsWith('rever')) name = 'Rever';
      else if (l.startsWith('elex')) name = 'Elex';
      else if (l.startsWith('spark')) name = 'Spark';
      if (!map[name]) map[name] = { name, count: 0, cost: 0 };
      map[name].count++;
      map[name].cost += log.cost;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [logs]);

  // 3 most recent logs
  const recentLogs = useMemo(() => logs.slice(0, 3), [logs]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <div className="pb-4">

      {/* ── Quick Action Cards ── */}
      <div className="px-4 pt-5 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('charge-home')}
            className="bg-sky-500 text-white rounded-2xl p-4 flex flex-col gap-2 shadow-md shadow-sky-200 active:scale-[0.97] transition-transform text-left"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Home className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm">ชาร์จที่บ้าน</div>
              <div className="text-sky-100 text-xs">คำนวณค่าไฟ PEA</div>
            </div>
          </button>
          <button
            onClick={() => onNavigate('charge-station')}
            className="bg-teal-500 text-white rounded-2xl p-4 flex flex-col gap-2 shadow-md shadow-teal-200 active:scale-[0.97] transition-transform text-left"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm">ชาร์จสถานี</div>
              <div className="text-teal-100 text-xs">บันทึกค่าใช้จ่าย</div>
            </div>
          </button>
        </div>
      </div>

      {/* ── Summary Stats Row ── */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div className="stat-blue rounded-2xl p-4 text-white shadow-sm">
          <Wallet className="h-4 w-4 mb-2 opacity-80" />
          <div className="text-xl font-bold">{Math.round(stats.totalCost).toLocaleString()}</div>
          <div className="text-sky-100 text-xs">ค่าใช้จ่ายรวม (บาท)</div>
        </div>
        <div className="stat-teal rounded-2xl p-4 text-white shadow-sm">
          <BatteryCharging className="h-4 w-4 mb-2 opacity-80" />
          <div className="text-xl font-bold">{Math.round(stats.totalUnits).toLocaleString()}</div>
          <div className="text-teal-100 text-xs">หน่วยไฟสะสม (kWh)</div>
        </div>
        <div className="stat-amber rounded-2xl p-4 text-white shadow-sm">
          <TrendingUp className="h-4 w-4 mb-2 opacity-80" />
          <div className="text-xl font-bold">{stats.avgUnitCost.toFixed(2)}</div>
          <div className="text-amber-100 text-xs">เฉลี่ย (บาท/หน่วย)</div>
        </div>
        <div className="stat-violet rounded-2xl p-4 text-white shadow-sm">
          <Zap className="h-4 w-4 mb-2 opacity-80" />
          <div className="text-xl font-bold">{logs.length}</div>
          <div className="text-violet-100 text-xs">รายการชาร์จทั้งหมด</div>
        </div>
      </div>

      {/* ── Monthly Chart ── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-sm text-slate-700">ค่าใช้จ่ายรายเดือน</span>
          <span className="text-[10px] text-slate-400">6 เดือนล่าสุด</span>
        </div>
        {monthlyData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -28, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '11px' }}
                  cursor={{ fill: '#F0F9FF' }}
                />
                <Bar dataKey="บ้าน" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="สถานี" fill="#14B8A6" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูล</div>
        )}
        {/* Legend */}
        <div className="flex gap-4 mt-1 justify-center">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
            <span>ชาร์จบ้าน</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
            <span>ชาร์จสถานี</span>
          </div>
        </div>
      </div>

      {/* ── Home vs Station Donut ── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
        <span className="font-bold text-sm text-slate-700 block mb-3">สัดส่วนค่าใช้จ่าย</span>
        {logs.length > 0 ? (
          <div className="flex items-center">
            <div className="w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={54} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${Number(v).toLocaleString()} บาท`} contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3 pl-3">
              {pieData.map((item, i) => (
                <div key={item.name}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-[11px] text-slate-500 font-medium">{item.name === 'บ้าน' ? 'ชาร์จที่บ้าน' : 'ชาร์จสถานี'}</span>
                  </div>
                  <div className="pl-4 text-sm font-bold text-slate-800">
                    {item.value.toLocaleString()} บาท
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ({Math.round(item.value / (stats.totalCost || 1) * 100)}%)
                    </span>
                  </div>
                  <div className="pl-4 text-[10px] text-slate-400">{item.count} ครั้ง</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูล</div>
        )}
      </div>

      {/* ── Recent Activity ── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex justify-between items-center px-4 pt-4 pb-2">
          <span className="font-bold text-sm text-slate-700">รายการล่าสุด</span>
          <button onClick={() => onNavigate('history')} className="text-[11px] text-sky-500 font-semibold flex items-center gap-0.5">
            ดูทั้งหมด <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {recentLogs.length > 0 ? recentLogs.map((log, i) => (
          <div key={log.id} className={`flex items-center gap-3 px-4 py-3 ${i < recentLogs.length - 1 ? 'border-b border-slate-50' : ''}`}>
            <div className="ev-icon-box w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
              {log.type === 'home' ? <Home className="h-4.5 w-4.5" /> : <MapPin className="h-4.5 w-4.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">
                {log.type === 'home' ? 'ชาร์จไฟที่บ้าน' : log.station_name}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(log.date)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-slate-800">{Math.round(log.cost).toLocaleString()}</div>
              <div className="text-[9px] text-slate-400">บาท</div>
            </div>
          </div>
        )) : (
          <div className="py-8 text-center text-slate-400 text-sm">ยังไม่มีรายการ</div>
        )}
      </div>

      {/* ── Top Stations ── */}
      {topStations.length > 0 && (
        <div className="mx-4 mb-2 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="px-4 pt-4 pb-2">
            <span className="font-bold text-sm text-slate-700">สถานีที่ใช้บ่อย</span>
          </div>
          {topStations.map((s, i) => (
            <div key={s.name} className={`flex items-center gap-3 px-4 py-3 ${i < topStations.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-xs font-bold text-sky-600">{i + 1}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">{s.name}</div>
                <div className="text-[10px] text-slate-400">ใช้บริการ {s.count} ครั้ง</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-700">{Math.round(s.cost).toLocaleString()} บาท</div>
                <div className="text-[9px] text-slate-400">เฉลี่ย {Math.round(s.cost / s.count)} บ./ครั้ง</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
