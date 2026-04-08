import React from 'react';
import { Plus, Search, Filter, MoreVertical, Clock, CheckCircle2, AlertCircle, X, Pencil, Trash2, MessageSquare, Send, Upload, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, Comment } from '../types';
import { cn } from '@/src/lib/utils';
import { 
  db, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp, 
  OperationType, 
  handleFirestoreError,
  createNotification,
  getDocs,
  where
} from '../firebase';
import { useFirebase } from '../contexts/FirebaseContext';
import { toast } from 'sonner';

export default function TicketList() {
  const { user, isAdmin } = useFirebase();
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = React.useState(false);
  const [isFilterVisible, setIsFilterVisible] = React.useState(false);
  const [editingTicket, setEditingTicket] = React.useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [facilities, setFacilities] = React.useState<{id: string, name: string}[]>([]);
  
  // Filter states
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [newTicket, setNewTicket] = React.useState({
    title: '',
    description: '',
    category: 'Hardware',
    priority: 'medium' as const,
    assignedTo: '',
    status: 'open' as const,
    facility: '',
    image: ''
  });

  React.useEffect(() => {
    const facilitiesQuery = query(collection(db, 'facilities'), orderBy('name', 'asc'));
    const unsubscribeFacilities = onSnapshot(facilitiesQuery, (snapshot) => {
      const facilityData = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setFacilities(facilityData);
      if (facilityData.length > 0 && !newTicket.facility) {
        setNewTicket(prev => ({ ...prev, facility: facilityData[0].name }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'facilities');
    });

    return () => unsubscribeFacilities();
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    
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

  React.useEffect(() => {
    if (!selectedTicket) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'tickets', selectedTicket.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `tickets/${selectedTicket.id}/comments`);
    });

    return () => unsubscribe();
  }, [selectedTicket?.id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Kích thước ảnh quá lớn (tối đa 5MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTicket({ ...newTicket, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const docRef = await addDoc(collection(db, 'tickets'), {
        ...newTicket,
        createdBy: user.uid,
        creatorEmail: user.email,
        createdAt: serverTimestamp(),
      });

      toast.success('Tạo ticket thành công!');
      setIsModalOpen(false);

      // Notify Admins
      const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      adminsSnapshot.forEach(adminDoc => {
        if (adminDoc.id !== user.uid) {
          createNotification(
            adminDoc.id,
            'Ticket mới được tạo',
            `Người dùng ${user.email} đã tạo ticket: ${newTicket.title}`,
            'info',
            '/tickets'
          );
        }
      });

      setNewTicket({
        title: '',
        description: '',
        category: 'Hardware',
        priority: 'medium',
        assignedTo: '',
        status: 'open',
        facility: facilities[0]?.name || '',
        image: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tickets');
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    try {
      const originalTicket = tickets.find(t => t.id === editingTicket.id);
      const isNowClosing = editingTicket.status === 'closed' && originalTicket?.status !== 'closed';
      
      const updateData: any = {
        title: editingTicket.title,
        description: editingTicket.description,
        category: editingTicket.category,
        priority: editingTicket.priority,
        assignedTo: editingTicket.assignedTo,
        status: editingTicket.status,
        facility: editingTicket.facility || '',
        image: editingTicket.image || '',
        updatedAt: serverTimestamp()
      };

      if (isNowClosing) {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'tickets', editingTicket.id), updateData);

      toast.success('Cập nhật ticket thành công!');
      setIsEditModalOpen(false);

      // Notify the creator if someone else updated it
      if (user && editingTicket.createdBy !== user.uid) {
        createNotification(
          editingTicket.createdBy,
          'Ticket của bạn đã được cập nhật',
          `Trạng thái: ${editingTicket.status}, Người xử lý: ${editingTicket.assignedTo || 'Chưa phân công'}`,
          'success',
          '/tickets'
        );
      }

      setEditingTicket(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tickets');
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ticket này?')) return;

    const promise = deleteDoc(doc(db, 'tickets', id));

    toast.promise(promise, {
      loading: 'Đang xóa ticket...',
      success: 'Xóa ticket thành công!',
      error: 'Lỗi khi xóa ticket'
    });

    try {
      await promise;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tickets');
    }
  };

  const handleQuickStatusUpdate = async (ticketId: string, newStatus: 'open' | 'in-progress' | 'closed') => {
    try {
      const originalTicket = tickets.find(t => t.id === ticketId);
      const isNowClosing = newStatus === 'closed' && originalTicket?.status !== 'closed';
      
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (isNowClosing) {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'tickets', ticketId), updateData);
      
      // Update local state if selectedTicket is open
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }

      toast.success('Cập nhật trạng thái thành công!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'tickets');
    }
  };

  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingTicket) {
      if (file.size > 1024 * 1024) {
        toast.error('Kích thước ảnh quá lớn (tối đa 1MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingTicket({ ...editingTicket, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket || !newComment.trim()) return;

    const commentText = newComment.trim();
    setNewComment('');

    try {
      await addDoc(collection(db, 'tickets', selectedTicket.id, 'comments'), {
        ticketId: selectedTicket.id,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        userPhoto: user.photoURL || '',
        text: commentText,
        createdAt: serverTimestamp()
      });

      // Notify the other party
      const isCreator = user.uid === selectedTicket.createdBy;
      const recipientId = isCreator ? (selectedTicket.assignedTo === 'Vinh' || selectedTicket.assignedTo === 'Phát' ? null : null) : selectedTicket.createdBy;
      
      // If creator comments, notify assigned person or all admins
      if (isCreator) {
        // Simple logic: notify all admins if creator comments
        const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
        adminsSnapshot.forEach(adminDoc => {
          if (adminDoc.id !== user.uid) {
            createNotification(
              adminDoc.id,
              'Bình luận mới trên Ticket',
              `${user.email} đã bình luận: ${commentText}`,
              'info',
              '/tickets'
            );
          }
        });
      } else {
        // If someone else comments, notify the creator
        createNotification(
          selectedTicket.createdBy,
          'Có bình luận mới trên Ticket của bạn',
          `${user.email}: ${commentText}`,
          'info',
          '/tickets'
        );
      }

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tickets/${selectedTicket.id}/comments`);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.creatorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (t.assignedTo && t.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    
    const ticketDate = t.createdAt?.toDate() || new Date();
    const matchesStartDate = !startDate || ticketDate >= new Date(startDate);
    const matchesEndDate = !endDate || ticketDate <= new Date(endDate + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesCategory && matchesStartDate && matchesEndDate;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'in-progress': return <AlertCircle className="w-4 h-4 text-indigo-500" />;
      case 'closed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'low': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề hoặc người yêu cầu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setIsFilterVisible(!isFilterVisible)}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-all",
                isFilterVisible 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter className="w-4 h-4" />
              Bộ lọc
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
            >
              <Plus className="w-4 h-4" />
              Tạo Ticket
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {isFilterVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Trạng thái</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="open">Mở</option>
                    <option value="in-progress">Đang xử lý</option>
                    <option value="closed">Đã đóng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Loại Ticket</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="all">Tất cả danh mục</option>
                    <option value="Hardware">Phần cứng</option>
                    <option value="Software">Phần mềm</option>
                    <option value="Network">Mạng</option>
                    <option value="Account">Tài khoản</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Từ ngày</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Đến ngày</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button 
                      onClick={resetFilters}
                      className="px-3 py-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Xóa bộ lọc"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Tạo Ticket Mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề</label>
                  <input
                    required
                    type="text"
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="VD: Lỗi kết nối wifi..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả chi tiết (Tùy chọn)</label>
                  <textarea
                    rows={3}
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cơ sở</label>
                    <select
                      required
                      value={newTicket.facility}
                      onChange={(e) => setNewTicket({ ...newTicket, facility: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="" disabled>Chọn cơ sở</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Danh mục</label>
                    <select
                      value={newTicket.category}
                      onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Hardware">Phần cứng</option>
                      <option value="Software">Phần mềm</option>
                      <option value="Network">Mạng</option>
                      <option value="Account">Tài khoản</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ ưu tiên</label>
                    <select
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Người xử lý</label>
                    <select
                      value={newTicket.assignedTo}
                      onChange={(e) => setNewTicket({ ...newTicket, assignedTo: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Chưa phân công</option>
                      <option value="Vinh">Vinh</option>
                      <option value="Phát">Phát</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Hình ảnh đính kèm (Tùy chọn)</label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Tải ảnh lên
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    {newTicket.image && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                        <img src={newTicket.image} className="w-full h-full object-cover" alt="Preview" />
                        <button
                          type="button"
                          onClick={() => setNewTicket({ ...newTicket, image: '' })}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                  >
                    Gửi yêu cầu
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Ticket Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingTicket && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Chỉnh sửa Ticket</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateTicket} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề</label>
                  <input
                    required
                    type="text"
                    value={editingTicket.title}
                    onChange={(e) => setEditingTicket({ ...editingTicket, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả chi tiết (Tùy chọn)</label>
                  <textarea
                    rows={3}
                    value={editingTicket.description}
                    onChange={(e) => setEditingTicket({ ...editingTicket, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cơ sở</label>
                    <select
                      required
                      value={editingTicket.facility}
                      onChange={(e) => setEditingTicket({ ...editingTicket, facility: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="" disabled>Chọn cơ sở</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Danh mục</label>
                    <select
                      value={editingTicket.category}
                      onChange={(e) => setEditingTicket({ ...editingTicket, category: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Hardware">Phần cứng</option>
                      <option value="Software">Phần mềm</option>
                      <option value="Network">Mạng</option>
                      <option value="Account">Tài khoản</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ ưu tiên</label>
                    <select
                      value={editingTicket.priority}
                      onChange={(e) => setEditingTicket({ ...editingTicket, priority: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Người xử lý</label>
                    <select
                      value={editingTicket.assignedTo}
                      onChange={(e) => setEditingTicket({ ...editingTicket, assignedTo: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">Chưa phân công</option>
                      <option value="Vinh">Vinh</option>
                      <option value="Phát">Phát</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                    <select
                      value={editingTicket.status}
                      onChange={(e) => setEditingTicket({ ...editingTicket, status: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="open">Mở</option>
                      <option value="in-progress">Đang xử lý</option>
                      <option value="closed">Đã đóng</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Hình ảnh đính kèm</label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      Thay đổi ảnh
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleEditFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    {editingTicket.image && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                        <img src={editingTicket.image} className="w-full h-full object-cover" alt="Preview" />
                        <button
                          type="button"
                          onClick={() => setEditingTicket({ ...editingTicket, image: '' })}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comment Modal */}
      <AnimatePresence>
        {isCommentModalOpen && selectedTicket && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Thảo luận Ticket</h3>
                    <p className="text-sm text-slate-500 mt-1">#{selectedTicket.id.slice(-6)} - {selectedTicket.title}</p>
                  </div>
                  {(isAdmin || user?.uid === selectedTicket.createdBy) && (
                    <div className="ml-4 flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trạng thái:</span>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleQuickStatusUpdate(selectedTicket.id, e.target.value as any)}
                        className="text-sm font-medium bg-transparent border-none focus:ring-0 p-0 cursor-pointer text-indigo-600"
                      >
                        <option value="open">Mở</option>
                        <option value="in-progress">Đang xử lý</option>
                        <option value="closed">Đã đóng</option>
                      </select>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsCommentModalOpen(false);
                    setSelectedTicket(null);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 min-h-[300px]">
                {comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12">
                    <MessageSquare className="w-12 h-12 text-slate-200 mb-3" />
                    <p className="text-slate-500">Chưa có bình luận nào. Hãy bắt đầu cuộc thảo luận!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div 
                        key={comment.id} 
                        className={cn(
                          "flex gap-3 max-w-[85%]",
                          comment.userId === user?.uid ? "ml-auto flex-row-reverse" : ""
                        )}
                      >
                        <div className="flex-shrink-0">
                          {comment.userPhoto ? (
                            <img src={comment.userPhoto} alt="" className="w-8 h-8 rounded-full shadow-sm" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px] shadow-sm">
                              {comment.userName[0]}
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          "space-y-1",
                          comment.userId === user?.uid ? "text-right" : "text-left"
                        )}>
                          <div className={cn(
                            "p-3 rounded-2xl text-sm shadow-sm",
                            comment.userId === user?.uid 
                              ? "bg-indigo-600 text-white rounded-tr-none" 
                              : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                          )}>
                            {comment.text}
                          </div>
                          <p className="text-[10px] text-slate-400 px-1">
                            {comment.userName} • {comment.createdAt?.toDate().toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white">
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Nhập bình luận của bạn..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-200"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket / Cơ sở</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Người yêu cầu</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Người xử lý</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ưu tiên</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ngày tạo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Đang tải dữ liệu...</td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Không tìm thấy ticket nào.</td>
                </tr>
              ) : (
                filteredTickets.map((ticket, idx) => (
                  <motion.tr
                    key={ticket.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {ticket.image && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                            <img src={ticket.image} className="w-full h-full object-cover" alt="" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{ticket.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ticket.category}</span>
                            {ticket.facility && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{ticket.facility}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {ticket.creatorEmail[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-700">{ticket.creatorEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                          {ticket.assignedTo ? ticket.assignedTo[0].toUpperCase() : '?'}
                        </div>
                        <span className="text-sm text-slate-700">{ticket.assignedTo || 'Chưa phân công'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <span className="text-sm font-medium capitalize text-slate-700">
                          {ticket.status === 'open' ? 'Mở' : ticket.status === 'in-progress' ? 'Đang xử lý' : 'Đã đóng'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        getPriorityColor(ticket.priority)
                      )}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <div>
                        {ticket.createdAt?.toDate().toLocaleDateString('vi-VN')}
                        {ticket.completedAt && (
                          <div className="mt-1 text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Xong: {ticket.completedAt.toDate().toLocaleString('vi-VN', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setIsCommentModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors relative"
                          title="Thảo luận"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {(isAdmin || user?.uid === ticket.createdBy) && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingTicket(ticket);
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTicket(ticket.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
