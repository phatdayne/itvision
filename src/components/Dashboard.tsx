import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Ticket as TicketIcon, Box, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { db, collection, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import { Ticket, Asset } from '../types';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribeTickets = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      const ticketData = snapshot.docs.map(doc => doc.data()) as Ticket[];
      setTickets(ticketData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tickets');
    });

    const unsubscribeAssets = onSnapshot(collection(db, 'assets'), (snapshot) => {
      const assetData = snapshot.docs.map(doc => doc.data()) as Asset[];
      setAssets(assetData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assets');
    });

    return () => {
      unsubscribeTickets();
      unsubscribeAssets();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const stats = {
    totalTickets: tickets.length,
    openTickets: tickets.filter(t => t.status !== 'closed').length,
    closedTickets: tickets.filter(t => t.status === 'closed').length,
    totalAssets: assets.length,
    assetsByStatus: {
      active: assets.filter(a => a.status === 'active').length,
      maintenance: assets.filter(a => a.status === 'maintenance').length,
      retired: assets.filter(a => a.status === 'retired').length,
    }
  };

  const pieData = [
    { name: 'Đang hoạt động', value: stats.assetsByStatus.active },
    { name: 'Bảo trì', value: stats.assetsByStatus.maintenance },
    { name: 'Đã thanh lý', value: stats.assetsByStatus.retired },
  ];

  const barData = [
    { name: 'Tổng Ticket', value: stats.totalTickets },
    { name: 'Đang mở', value: stats.openTickets },
    { name: 'Đã đóng', value: stats.closedTickets },
  ];

  const cards = [
    { title: 'Tổng Ticket', value: stats.totalTickets, icon: TicketIcon, color: 'bg-indigo-500' },
    { title: 'Ticket Đang Mở', value: stats.openTickets, icon: Clock, color: 'bg-amber-500' },
    { title: 'Ticket Đã Đóng', value: stats.closedTickets, icon: CheckCircle2, color: 'bg-emerald-500' },
    { title: 'Tổng Tài Sản', value: stats.totalAssets, icon: Box, color: 'bg-slate-700' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div className={`${card.color} p-3 rounded-xl text-white`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6">Trạng thái Ticket</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-6">Phân bổ Tài sản</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }}></div>
                <span className="text-xs text-slate-500 font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
