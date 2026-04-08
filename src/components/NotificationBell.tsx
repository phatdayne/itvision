import React from 'react';
import { Bell, Check, Trash2, ExternalLink, Info, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, deleteDoc, doc } from '../firebase';
import { useFirebase } from '../contexts/FirebaseContext';
import { AppNotification } from '../types';
import { cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
  const { user } = useFirebase();
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      
      // Check for new notifications to trigger browser notification
      const unreadCount = notifData.filter(n => !n.read).length;
      const prevUnreadCount = notifications.filter(n => !n.read).length;
      
      if (unreadCount > prevUnreadCount && unreadCount > 0) {
        const newest = notifData.find(n => !n.read);
        if (newest && Notification.permission === 'granted') {
          new Notification(newest.title, { body: newest.message });
        }
      }

      setNotifications(notifData);
    });

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => unsubscribe();
  }, [user?.uid]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-600 relative transition-colors rounded-full hover:bg-slate-100"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[70] overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Thông báo</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Không có thông báo nào.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 hover:bg-slate-50 transition-colors relative group",
                        !n.read && "bg-indigo-50/30"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1">{getIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm text-slate-900", !n.read && "font-bold")}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {n.createdAt?.toDate().toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="absolute top-4 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.read && (
                          <button 
                            onClick={() => markAsRead(n.id)}
                            className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"
                            title="Đã đọc"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(n.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="Xóa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {n.link && (
                          <Link 
                            to={n.link}
                            onClick={() => setIsOpen(false)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Xem chi tiết"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
