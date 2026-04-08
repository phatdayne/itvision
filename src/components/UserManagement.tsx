import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  OperationType, 
  handleFirestoreError,
  query,
  orderBy,
  setDoc
} from '../firebase';
import { UserPlus, Trash2, Shield, User as UserIcon, Mail, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface User {
  id: string;
  uid?: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'user';
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    const userEmail = newEmail.toLowerCase().trim();
    const promise = setDoc(doc(db, 'users', userEmail), {
      email: userEmail,
      role: newRole,
      createdAt: new Date().toISOString()
    });

    toast.promise(promise, {
      loading: 'Đang thêm người dùng...',
      success: 'Thêm người dùng thành công!',
      error: 'Lỗi khi thêm người dùng'
    });

    try {
      await promise;
      setNewEmail('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (email === 'whoiamppt@gmail.com') {
      toast.error("Không thể xóa Admin mặc định!");
      return;
    }
    
    if (window.confirm(`Bạn có chắc muốn xóa người dùng ${email}?`)) {
      const promise = deleteDoc(doc(db, 'users', id));

      toast.promise(promise, {
        loading: 'Đang xóa người dùng...',
        success: 'Xóa người dùng thành công!',
        error: 'Lỗi khi xóa người dùng'
      });

      try {
        await promise;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'users');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm người dùng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          Thêm người dùng
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email người dùng</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Vai trò</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="user">User (Chỉ xem/tạo Ticket)</option>
                  <option value="admin">Admin (Toàn quyền)</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Xác nhận
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Người dùng</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Vai trò</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Trạng thái</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        {u.displayName ? (
                          <span className="font-bold">{u.displayName[0]}</span>
                        ) : (
                          <UserIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{u.displayName || 'Chưa cập nhật'}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role === 'admin' && <Shield className="w-3 h-3" />}
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.uid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {u.uid ? 'Đã kích hoạt' : 'Chờ đăng nhập'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa người dùng"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <UserIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">Không tìm thấy người dùng nào.</p>
          </div>
        )}
      </div>
    </div>
  );
}
