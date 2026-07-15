import { useState, useEffect, useMemo } from 'react';
import { fetchLogs, deleteLog, updateLog, isSupabaseConnected } from './lib/supabase';
import type { EvLog } from './data/seedData';
import { Stats } from './components/Stats';
import { Record } from './components/Record';
import { Settings } from './components/Settings';
import { BarChart3, Zap, Settings as SettingsIcon } from 'lucide-react';

type TabType = 'stats' | 'record' | 'settings';

function App() {
  const [logs, setLogs] = useState<EvLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [isCloud, setIsCloud] = useState(false);
  const [editingLog, setEditingLog] = useState<EvLog | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs();
      setLogs(data);
      setIsCloud(isSupabaseConnected());
    } catch (e) {
      console.error('Failed to load logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ยอดรวมเดือนนี้ (แสดงใน header)
  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    return logs
      .filter(l => {
        const d = new Date(l.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, l) => s + l.cost, 0);
  }, [logs]);

  const historicalStations = useMemo(() => {
    const s = new Set<string>();
    logs.forEach(l => { if (l.type === 'station' && l.station_name) s.add(l.station_name); });
    return Array.from(s);
  }, [logs]);

  // Edit: เปิดฟอร์มแก้ไข → ไปหน้าบันทึก
  const handleEdit = (log: EvLog) => {
    setEditingLog(log);
    setActiveTab('record');
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
  };

  // สำเร็จทั้ง Create และ Update
  const handleRecordSuccess = (log: EvLog, isEdit: boolean) => {
    if (isEdit) {
      setLogs(prev => prev.map(l => l.id === log.id ? log : l));
    } else {
      setLogs(prev => [log, ...prev]);
    }
    setEditingLog(null);
    setActiveTab('stats');
  };

  // ลบรายการเดี่ยว
  const handleDeleteLog = async (id: number) => {
    if (!window.confirm('ยืนยันการลบรายการนี้? ข้อมูลจะหายถาวร')) return;
    const ok = await deleteLog(id);
    if (ok) setLogs(prev => prev.filter(l => l.id !== id));
  };

  // หลัง Bulk Delete: reload จาก state ที่อัปเดตแล้ว
  const handleBulkDeleteSuccess = (newLogs: EvLog[]) => {
    setLogs(newLogs);
  };

  const pageInfo: Record<TabType, { title: string; subtitle: string }> = {
    stats: { title: 'สถิติการชาร์จ', subtitle: 'ภาพรวมค่าใช้จ่ายทั้งหมด' },
    record: {
      title: editingLog ? '✏️ แก้ไขรายการ' : 'บันทึกการชาร์จ',
      subtitle: editingLog ? 'อัปเดตข้อมูลการชาร์จไฟ' : 'เพิ่มข้อมูลการชาร์จใหม่',
    },
    settings: { title: 'ตั้งค่าระบบ', subtitle: 'จัดการข้อมูลและการเชื่อมต่อ' },
  };

  const current = pageInfo[activeTab];

  return (
    <div className="min-h-screen bg-sky-50 flex justify-center items-start py-0 sm:py-6">
      <div className="w-full max-w-md min-h-screen sm:min-h-[850px] sm:max-h-[850px] bg-sky-50 flex flex-col relative sm:rounded-3xl sm:shadow-2xl sm:overflow-hidden">

        {/* ─── Blue Gradient Header ─── */}
        <div className="header-gradient px-5 pt-12 pb-16 relative overflow-hidden shrink-0">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute top-6 -right-6 w-24 h-24 rounded-full bg-white/08" />

          <div className="flex items-center justify-between mb-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg tracking-wide">evTrack</span>
            </div>
            {/* ยอดรวมเดือนนี้ */}
            <div className="text-right">
              <p className="text-[10px] text-sky-200 font-medium tracking-wider uppercase">ยอดรวมเดือนนี้</p>
              <p className="text-white font-bold text-2xl leading-tight">
                {currentMonthTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                <span className="text-base font-normal text-sky-200 ml-1">฿</span>
              </p>
            </div>
          </div>

          <h1 className="text-white font-bold text-2xl leading-tight">{current.title}</h1>
          <p className="text-sky-100 text-sm mt-1">{current.subtitle}</p>
        </div>

        {/* ─── White Sheet Card ─── */}
        <div className="sheet-card flex-1 overflow-y-auto -mt-6 pb-28 relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-3">
              <div className="w-10 h-10 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
            <>
              {activeTab === 'stats' && (
                <Stats
                  logs={logs}
                  onEdit={handleEdit}
                  onDelete={handleDeleteLog}
                />
              )}
              {activeTab === 'record' && (
                <Record
                  editingLog={editingLog}
                  onSuccess={handleRecordSuccess}
                  onCancelEdit={handleCancelEdit}
                  historicalStations={historicalStations}
                />
              )}
              {activeTab === 'settings' && (
                <Settings
                  logs={logs}
                  onBulkDeleteSuccess={handleBulkDeleteSuccess}
                  onConfigChange={loadData}
                />
              )}
            </>
          )}
        </div>

        {/* ─── Bottom Navigation (3 tabs) ─── */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-end justify-around">

            {/* สถิติ */}
            <NavBtn
              icon={<BarChart3 className="h-5 w-5" />}
              label="สถิติ"
              active={activeTab === 'stats'}
              onClick={() => setActiveTab('stats')}
            />

            {/* บันทึก (Center FAB) */}
            <div className="flex flex-col items-center -mt-6">
              <button
                onClick={() => { setEditingLog(null); setActiveTab('record'); }}
                className={`fab-btn w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95 ${activeTab === 'record' ? 'ring-4 ring-sky-200' : ''}`}
              >
                <Zap className="h-7 w-7 text-white" />
              </button>
              <span className={`text-[10px] mt-1 font-semibold ${activeTab === 'record' ? 'text-sky-500' : 'text-slate-400'}`}>
                บันทึก
              </span>
            </div>

            {/* ตั้งค่า */}
            <NavBtn
              icon={<SettingsIcon className="h-5 w-5" />}
              label="ตั้งค่า"
              active={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
            />

          </div>
        </nav>
      </div>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 py-1 px-4 transition-all">
      <div className={`p-1.5 rounded-xl transition-all ${active ? 'bottom-nav-active-bg' : ''}`}>
        <span className={active ? 'bottom-nav-active' : 'text-slate-400'}>{icon}</span>
      </div>
      <span className={`text-[10px] font-semibold ${active ? 'text-sky-500' : 'text-slate-400'}`}>{label}</span>
    </button>
  );
}

export default App;
