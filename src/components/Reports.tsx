import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Ticket } from '../types';
import { Calendar, Download, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { db, collection, query, onSnapshot, OperationType, handleFirestoreError } from '../firebase';

export default function Reports() {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  // Process data for daily report
  const getDailyStats = () => {
    const stats: { [key: string]: { date: string, total: number, closed: number, open: number } } = {};
    
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      stats[dateStr] = { date: dateStr, total: 0, closed: 0, open: 0 };
    }

    tickets.forEach(t => {
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
    tickets.forEach(t => {
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
    tickets.forEach(t => {
      const name = t.assignedTo || 'Chưa phân công';
      if (!assignees[name]) assignees[name] = { name, total: 0, closed: 0 };
      assignees[name].total++;
      if (t.status === 'closed') assignees[name].closed++;
    });
    return Object.values(assignees).sort((a, b) => b.total - a.total);
  };

  const dailyData = getDailyStats();
  const statusData = getStatusDistribution();
  const assigneeData = getAssigneePerformance();

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tải báo cáo...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Báo cáo IT Support</h2>
          <p className="text-slate-500">Theo dõi hiệu suất xử lý ticket hằng ngày</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" />
            Xuất PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
            <Calendar className="w-4 h-4" />
            7 ngày qua
          </button>
        </div>
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
