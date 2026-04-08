import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TicketList from './components/TicketList';
import AssetList from './components/AssetList';
import Reports from './components/Reports';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { LogIn, Mail, Lock, User as UserIcon, ArrowRight, ShieldAlert, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import UserManagement from './components/UserManagement';

function AppContent() {
  const { user, loading, login, loginWithEmail, registerWithEmail, logout, isAuthorized, isAdmin } = useFirebase();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isRegistering) {
        await registerWithEmail(email, password, name);
        toast.success('Đăng ký thành công!');
      } else {
        await loginWithEmail(email, password);
        toast.success('Đăng nhập thành công!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" richColors />
      {!user ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">IT Support Nexus</h1>
            <p className="text-slate-500 text-center mb-8">
              {isRegistering ? 'Tạo tài khoản mới' : 'Vui lòng đăng nhập để tiếp tục'}
            </p>

            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
              {isRegistering && (
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Họ và tên"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {authLoading ? 'Đang xử lý...' : isRegistering ? 'Đăng ký' : 'Đăng nhập'}
                {!authLoading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Hoặc</span>
              </div>
            </div>

            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all mb-6"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Tiếp tục với Google
            </button>

            <p className="text-center text-sm text-slate-500">
              {isRegistering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="ml-1 text-indigo-600 font-semibold hover:underline"
              >
                {isRegistering ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
              </button>
            </p>
          </div>
        </div>
      ) : !isAuthorized ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Truy cập bị từ chối</h1>
            <p className="text-slate-500 mb-8">
              Tài khoản <span className="font-semibold text-slate-700">{user.email}</span> chưa được cấp quyền truy cập hệ thống. 
              Vui lòng liên hệ Quản trị viên để được hỗ trợ.
            </p>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </div>
        </div>
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/assets" element={<AssetList />} />
            <Route path="/reports" element={<Reports />} />
            {isAdmin && <Route path="/users" element={<UserManagement />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
