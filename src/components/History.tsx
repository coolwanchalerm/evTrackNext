import React, { useState, useMemo } from 'react';
import type { EvLog } from '../data/seedData';
import { deleteLog } from '../lib/supabase';
import { Search, Trash2, Home, MapPin, Filter, RefreshCcw, Info, ChevronRight } from 'lucide-react';

interface HistoryProps {
  logs: EvLog[];
  onDeleteSuccess: (id: number) => void;
  selectedYear: string;
  setSelectedYear: (y: string) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  filterLastOneYear: boolean;
  setFilterLastOneYear: (v: boolean) => void;
}

export const History: React.FC<HistoryProps> = ({
  logs, onDeleteSuccess,
  selectedYear, setSelectedYear,
  selectedMonth, setSelectedMonth,
  filterLastOneYear, setFilterLastOneYear
}) => {
  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'home' | 'station'>('all');

  const SHORT_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const MONTH_OPTS = [{ value: 'all', label: 'ทุกเดือน' }, ...FULL_TH.map((l, i) => ({ value: String(i + 1).padStart(2, '0'), label: l }))];

  const years = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => { try { set.add(new Date(l.date).getFullYear().toString()); } catch {} });
    return ['all', ...Array.from(set).sort((a, b) => b.localeCompare(a))];
  }, [logs]);

  const handleDelete = async (id: number) => {
    if (!confirm('คุณต้องการลบรายการนี้หรือไม่?')) return;
    setDeletingId(id);
    try {
      if (await deleteLog(id)) onDeleteSuccess(id);
    } finally { setDeletingId(null); }
  };

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (filterType !== 'all' && log.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!log.station_name?.toLowerCase().includes(q) && !log.type.includes(q) && !(log.type === 'home' && 'บ้าน'.includes(q))) return false;
      }
      if (filterLastOneYear) {
        const ago = new Date();
        ago.setFullYear(ago.getFullYear() - 1);
        if (new Date(log.date) < ago) return false;
      } else {
        if (selectedYear !== 'all' && new Date(log.date).getFullYear().toString() !== selectedYear) return false;
        if (selectedMonth !== 'all' && String(new Date(log.date).getMonth() + 1).padStart(2, '0') !== selectedMonth) return false;
      }
      return true;
    });
  }, [logs, filterType, search, filterLastOneYear, selectedYear, selectedMonth]);

  const grouped = useMemo(() => {
    const map: Record<string, EvLog[]> = {};
    filtered.forEach(log => {
      try {
        const d = new Date(log.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!map[key]) map[key] = [];
        map[key].push(log);
      } catch {}
    });
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(key => {
      const [y, m] = key.split('-');
      return { title: `${FULL_TH[+m - 1]} ${y}`, total: map[key].reduce((s, l) => s + l.cost, 0), logs: map[key] };
    });
  }, [filtered]);

  const fmtDate = (d: string) => {
    try {
      const dt = new Date(d);
      return `${dt.getDate()} ${SHORT_TH[dt.getMonth()]} ${dt.getFullYear()}`;
    } catch { return d; }
  };

  const reset = () => { setSelectedYear('all'); setSelectedMonth('all'); setFilterLastOneYear(false); setSearch(''); setFilterType('all'); };

  return (
    <div className="pt-4 pb-4">
      {/* ── Filter Type Pill Tabs (like reference screenshot) ── */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['all', 'home', 'station'] as const).map(t => (
            <button key={t} type="button" onClick={() => setFilterType(t)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${filterType === t ? 'pill-active border-sky-500' : 'pill-inactive'}`}
            >
              {t === 'all' ? 'ทั้งหมด' : t === 'home' ? 'ชาร์จบ้าน' : 'ชาร์จสถานี'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search + Filter Button ── */}
      <div className="px-4 mb-4 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา สถานี หรือ ประเภท..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-sky-400 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          />
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all ${showFilter || selectedYear !== 'all' || selectedMonth !== 'all' || filterLastOneYear ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* ── Filter Drawer ── */}
      {showFilter && (
        <div className="mx-4 mb-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">ตัวกรองขั้นสูง</span>
            <button onClick={reset} className="text-[10px] text-sky-500 font-bold flex items-center gap-1 hover:text-sky-700">
              <RefreshCcw className="h-3 w-3" /> ล้างทั้งหมด
            </button>
          </div>

          <button type="button" onClick={() => { setFilterLastOneYear(!filterLastOneYear); if (!filterLastOneYear) { setSelectedYear('all'); setSelectedMonth('all'); } }}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${filterLastOneYear ? 'bg-sky-500 text-white border-sky-500' : 'text-slate-500 border-slate-200 bg-slate-50'}`}
          >
            ⏮ ย้อนหลัง 1 ปี (Last 1 Year)
          </button>

          {!filterLastOneYear && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1.5">ปี</label>
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none">
                  {years.map(y => <option key={y} value={y}>{y === 'all' ? 'ทุกปี' : `ปี ${y}`}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1.5">เดือน</label>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none">
                  {MONTH_OPTS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Results Summary ── */}
      <div className="px-4 mb-3 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">พบ {filtered.length} รายการ</span>
        <span className="text-xs font-bold text-slate-600">{Math.round(filtered.reduce((s, l) => s + l.cost, 0)).toLocaleString()} บาท</span>
      </div>

      {/* ── Grouped Log List (Reference EV App Style) ── */}
      {grouped.length > 0 ? (
        <div className="space-y-4 px-4">
          {grouped.map(group => (
            <div key={group.title}>
              {/* Month header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{group.title}</span>
                <span className="text-xs font-bold text-slate-400">{Math.round(group.total).toLocaleString()} บาท</span>
              </div>

              {/* Cards */}
              <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.05)] overflow-hidden divide-y divide-slate-50">
                {group.logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/50 transition-all group">
                    {/* EV icon box — like reference */}
                    <div className="ev-icon-box w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
                      {log.type === 'home' ? <Home className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {log.type === 'home' ? 'ชาร์จไฟที่บ้าน' : log.station_name}
                      </div>
                      {log.type === 'home' && (
                        <div className="text-[11px] text-slate-400 mt-0.5">แบต {log.start_soc}% → {log.end_soc}% · {Number(log.units).toFixed(1)} kWh</div>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="badge-success text-[9px] font-bold px-2 py-0.5 rounded-full">ชำระสำเร็จ</span>
                        <span className="text-[10px] text-slate-400">{fmtDate(log.date)}</span>
                      </div>
                    </div>

                    {/* Price + Delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-800">{Math.round(log.cost).toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400 font-medium">บาท</div>
                      </div>
                      <button
                        disabled={deletingId === log.id}
                        onClick={() => handleDelete(log.id)}
                        className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all active:scale-90 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <Info className="h-7 w-7 text-slate-400" />
          </div>
          <div className="text-slate-500 text-sm font-medium">ไม่พบรายการชาร์จ</div>
          {(selectedYear !== 'all' || selectedMonth !== 'all' || filterLastOneYear || search || filterType !== 'all') && (
            <button onClick={reset} className="text-xs font-bold text-sky-500 hover:text-sky-700">
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      )}
    </div>
  );
};
