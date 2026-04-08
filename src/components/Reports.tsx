import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Ticket } from '../types';
import { Calendar, Download, FileText, Clock, CheckCircle2, FileSpreadsheet, Filter } from 'lucide-react';
import { db, collection, query, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Filter states
  const [filterDay, setFilterDay] = React.useState<string>('');
  const [filterMonth, setFilterMonth] = React.useState<string>('');
  const [filterYear, setFilterYear] = React.useState<string>(new Date().getFullYear().toString());

  React.useEffect(() => {
    const q = query(collection(db, 'tickets'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      setTickets(ticketData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tickets');
    });

    return () => unsubscribe();
  }, []);

  // Filtered tickets based on selection
  const filteredTickets = React.useMemo(() => {
    return tickets.filter(t => {
      if (!t.createdAt) return false;
      const date = t.createdAt.toDate();
      
      const matchYear = filterYear === '' || date.getFullYear().toString() === filterYear;
      const matchMonth = filterMonth === '' || (date.getMonth() + 1).toString() === filterMonth;
      const matchDay = filterDay === '' || date.getDate().toString() === filterDay;
      
      return matchYear && matchMonth && matchDay;
    });
  }, [tickets, filterDay, filterMonth, filterYear]);

  // Process data for daily report
  const getDailyStats = () => {
    const stats: { [key: string]: { date: string, total: number, closed: number, open: number } } = {};
    
    // Last 7 days or selected month's days
    if (filterMonth !== '' && filterYear !== '') {
      const daysInMonth = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${i.toString().padStart(2, '0')}/${filterMonth.padStart(2, '0')}`;
        stats[dateStr] = { date: dateStr, total: 0, closed: 0, open: 0 };
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        stats[dateStr] = { date: dateStr, total: 0, closed: 0, open: 0 };
      }
    }

    filteredTickets.forEach(t => {
      if (!t.createdAt) return;
      const date = t.createdAt.toDate();
      const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      if (stats[dateStr]) {
        stats[dateStr].total++;
        if (t.status === 'closed') stats[dateStr].closed++;
        else stats[dateStr].open++;
      }
    });

    return Object.values(stats);
  };

  const getStatusDistribution = () => {
    const stats = { open: 0, 'in-progress': 0, closed: 0 };
    filteredTickets.forEach(t => {
      stats[t.status]++;
    });
    return [
      { name: 'Mở', value: stats.open, color: '#f59e0b' },
      { name: 'Đang xử lý', value: stats['in-progress'], color: '#6366f1' },
      { name: 'Đã đóng', value: stats.closed, color: '#10b981' },
    ];
  };

  const getAssigneePerformance = () => {
    const assignees: { [key: string]: { name: string, total: number, closed: number } } = {};
    filteredTickets.forEach(t => {
      const name = t.assignedTo || 'Chưa phân công';
      if (!assignees[name]) assignees[name] = { name, total: 0, closed: 0 };
      assignees[name].total++;
      if (t.status === 'closed') assignees[name].closed++;
    });
    return Object.values(assignees).sort((a, b) => b.total - a.total);
  };

  const exportToExcel = () => {
    const dataToExport = filteredTickets.map(t => ({
      'Mã Ticket': t.id,
      'Tiêu đề': t.title,
      'Mô tả': t.description,
      'Danh mục': t.category,
      'Trạng thái': t.status === 'open' ? 'Mở' : t.status === 'in-progress' ? 'Đang xử lý' : 'Đã đóng',
      'Ưu tiên': t.priority === 'high' ? 'Cao' : t.priority === 'medium' ? 'Trung bình' : 'Thấp',
      'Người yêu cầu': t.creatorEmail,
      'Người xử lý': t.assignedTo || 'Chưa phân công',
      'Ngày tạo': t.createdAt?.toDate().toLocaleString('vi-VN'),
      'Ngày hoàn thành': t.completedAt?.toDate().toLocaleString('vi-VN') || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
    
    // Generate filename based on filters
    let filename = 'Bao_cao_ticket';
    if (filterDay) filename += `_Ngay_${filterDay}`;
    if (filterMonth) filename += `_Thang_${filterMonth}`;
    if (filterYear) filename += `_Nam_${filterYear}`;
    filename += '.xlsx';

    XLSX.writeFile(workbook, filename);
  };

  const dailyData = getDailyStats();
  const statusData = getStatusDistribution();
  const assigneeData = getAssigneePerformance();

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải báo cáo...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Báo cáo IT Support</h2>
          <p className="text-slate-500">Theo dõi hiệu suất xử lý ticket hằng ngày</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 mr-2">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Bộ lọc:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Ngày</label>
          <select 
            value={filterDay} 
            onChange={(e) => setFilterDay(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Tháng</label>
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả</option>
            {months.map(m => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase">Năm</label>
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">Tất cả</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <button 
          onClick={() => {
            setFilterDay('');
            setFilterMonth('');
            setFilterYear(new Date().getFullYear().toString());
          }}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 ml-auto"
        >
          Đặt lại
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Processing Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Số lượng Ticket xử lý hằng ngày
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="closed" name="Đã đóng" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="open" name="Đang mở" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-900 mb-6">Tình trạng Ticket</h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {statusData.map((item) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assignee Performance Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Hiệu suất nhân viên xử lý</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Nhân viên IT</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Tổng Ticket</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Đã hoàn thành</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Tỷ lệ</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assigneeData.map((item) => (
                <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {item.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">{item.total}</td>
                  <td className="px-6 py-4 text-emerald-600 font-medium">{item.closed}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-24">
                        <div 
                          className="h-full bg-indigo-500 rounded-full" 
                          style={{ width: `${(item.closed / item.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        {Math.round((item.closed / item.total) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.total - item.closed > 0 ? (
                      <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                        <Clock className="w-3 h-3" /> Còn {item.total - item.closed} đang xử lý
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Hoàn thành tốt
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
