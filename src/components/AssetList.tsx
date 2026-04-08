import React from 'react';
import { Plus, Search, Box, User, Calendar, Tag, ShieldCheck, AlertTriangle, Camera, X, MapPin, Filter, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset } from '../types';
import { cn } from '@/src/lib/utils';
import { 
  db, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp, 
  OperationType, 
  handleFirestoreError 
} from '../firebase';
import { useFirebase } from '../contexts/FirebaseContext';
import { toast } from 'sonner';

export default function AssetList() {
  const { isAdmin } = useFirebase();
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [facilities, setFacilities] = React.useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [facilityFilter, setFacilityFilter] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isFacilityModalOpen, setIsFacilityModalOpen] = React.useState(false);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [newAsset, setNewAsset] = React.useState({
    name: '',
    type: 'Laptop',
    serial: '',
    status: 'active' as const,
    owner: '',
    location: '',
    facility: '',
    image: ''
  });

  const [editingFacility, setEditingFacility] = React.useState<{id: string, name: string} | null>(null);
  const [newFacilityName, setNewFacilityName] = React.useState('');

  React.useEffect(() => {
    const assetsQuery = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
    const facilitiesQuery = query(collection(db, 'facilities'), orderBy('name', 'asc'));

    const unsubscribeAssets = onSnapshot(assetsQuery, (snapshot) => {
      const assetData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Asset[];
      setAssets(assetData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'assets');
    });

    const unsubscribeFacilities = onSnapshot(facilitiesQuery, (snapshot) => {
      const facilityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as {id: string, name: string}[];
      setFacilities(facilityData);
      if (facilityData.length > 0 && !newAsset.facility) {
        setNewAsset(prev => ({ ...prev, facility: facilityData[0].name }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'facilities');
    });

    return () => {
      unsubscribeAssets();
      unsubscribeFacilities();
    };
  }, []);

  const handleUpdateFacility = async (id: string, name: string) => {
    if (!isAdmin) return;
    const promise = setDoc(doc(db, 'facilities', id), { name }, { merge: true });
    
    toast.promise(promise, {
      loading: 'Đang cập nhật cơ sở...',
      success: 'Cập nhật cơ sở thành công!',
      error: 'Lỗi khi cập nhật cơ sở'
    });

    try {
      await promise;
      setEditingFacility(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `facilities/${id}`);
    }
  };

  const handleAddFacility = async () => {
    if (!isAdmin || !newFacilityName.trim()) return;
    const promise = addDoc(collection(db, 'facilities'), { name: newFacilityName });

    toast.promise(promise, {
      loading: 'Đang thêm cơ sở...',
      success: 'Thêm cơ sở thành công!',
      error: 'Lỗi khi thêm cơ sở'
    });

    try {
      await promise;
      setNewFacilityName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'facilities');
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        setNewAsset({ ...newAsset, image: imageData });
        stopCamera();
      }
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const promise = addDoc(collection(db, 'assets'), {
      ...newAsset,
      createdAt: serverTimestamp(),
    });

    toast.promise(promise, {
      loading: 'Đang lưu tài sản...',
      success: 'Lưu tài sản thành công!',
      error: 'Lỗi khi lưu tài sản'
    });

    try {
      await promise;
      setIsModalOpen(false);
      setNewAsset({
        name: '',
        type: 'Laptop',
        serial: '',
        status: 'active',
        owner: '',
        location: '',
        facility: facilities[0]?.name || '',
        image: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assets');
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài sản này?')) return;

    const promise = deleteDoc(doc(db, 'assets', id));

    toast.promise(promise, {
      loading: 'Đang xóa tài sản...',
      success: 'Xóa tài sản thành công!',
      error: 'Lỗi khi xóa tài sản'
    });

    try {
      await promise;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'assets');
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (a.serial && a.serial.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (a.owner && a.owner.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFacility = facilityFilter === 'all' || a.facility === facilityFilter;
    return matchesSearch && matchesFacility;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deployed':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider"><ShieldCheck className="w-3 h-3" /> Đã cấp phát</span>;
      case 'in-stock':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider"><Box className="w-3 h-3" /> Trong kho</span>;
      case 'maintenance':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider"><AlertTriangle className="w-3 h-3" /> Bảo trì</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex flex-1 gap-4 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tài sản, serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="relative w-48 hidden sm:block">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả cơ sở</option>
              {facilities.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setIsFacilityModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Quản lý cơ sở
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Thêm Tài Sản
          </button>
        </div>
      </div>

      {/* Facility Management Modal */}
      <AnimatePresence>
        {isFacilityModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Quản lý cơ sở</h3>
                <button onClick={() => setIsFacilityModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFacilityName}
                    onChange={(e) => setNewFacilityName(e.target.value)}
                    placeholder="Tên cơ sở mới..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button 
                    onClick={handleAddFacility}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Thêm
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {facilities.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      {editingFacility?.id === f.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editingFacility.name}
                            onChange={(e) => setEditingFacility({ ...editingFacility, name: e.target.value })}
                            className="flex-1 px-2 py-1 border border-indigo-300 rounded focus:outline-none"
                          />
                          <button onClick={() => handleUpdateFacility(f.id, editingFacility.name)} className="text-indigo-600 font-bold text-sm">Lưu</button>
                          <button onClick={() => setEditingFacility(null)} className="text-slate-400 text-sm">Hủy</button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-slate-700">{f.name}</span>
                          <button 
                            onClick={() => setEditingFacility(f)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Sửa
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Asset Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-900">Thêm Tài Sản Mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleCreateAsset} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Photo Section */}
                  <div className="space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Hình ảnh tài sản</label>
                    <div className="relative aspect-video bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden group">
                      {newAsset.image ? (
                        <>
                          <img src={newAsset.image} className="w-full h-full object-cover" alt="Preview" />
                          <button 
                            type="button"
                            onClick={() => setNewAsset({ ...newAsset, image: '' })}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : isCameraOpen ? (
                        <div className="absolute inset-0 bg-black">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button 
                              type="button"
                              onClick={capturePhoto}
                              className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-slate-300 active:scale-95 transition-transform"
                            >
                              <div className="w-8 h-8 bg-indigo-600 rounded-full"></div>
                            </button>
                            <button 
                              type="button"
                              onClick={stopCamera}
                              className="absolute right-4 bottom-2 p-2 bg-slate-800/50 text-white rounded-lg text-xs"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={startCamera}
                          className="flex flex-col items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Camera className="w-10 h-10" />
                          <span className="text-sm font-medium">Chụp ảnh tài sản</span>
                        </button>
                      )}
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tên tài sản</label>
                      <input
                        required
                        type="text"
                        value={newAsset.name}
                        onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="VD: Laptop Dell Latitude..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Loại tài sản</label>
                      <select
                        value={newAsset.type}
                        onChange={(e) => setNewAsset({ ...newAsset, type: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="Laptop">Laptop</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Monitor">Màn hình</option>
                        <option value="Peripheral">Thiết bị ngoại vi</option>
                        <option value="Server">Máy chủ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Số Serial / Service Tag</label>
                      <input
                        required
                        type="text"
                        value={newAsset.serial}
                        onChange={(e) => setNewAsset({ ...newAsset, serial: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Nhập mã serial..."
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cơ sở / Chi nhánh</label>
                    <select
                      value={newAsset.facility}
                      onChange={(e) => setNewAsset({ ...newAsset, facility: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      {facilities.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái</label>
                    <select
                      value={newAsset.status}
                      onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value as any })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="maintenance">Bảo trì</option>
                      <option value="retired">Đã thanh lý</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-colors shadow-lg shadow-indigo-200"
                  >
                    Lưu tài sản
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400">Đang tải dữ liệu...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">Không tìm thấy tài sản nào.</div>
        ) : (
          filteredAssets.map((asset, idx) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-all group overflow-hidden"
            >
              <div className="relative aspect-video bg-slate-100 overflow-hidden">
                {asset.image ? (
                  <img src={asset.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={asset.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Box className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  {getStatusBadge(asset.status)}
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold rounded flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {asset.facility}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-1">{asset.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{asset.type}</p>

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Serial:</span>
                    <span className="text-slate-900 font-mono">{asset.serial}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Người dùng:</span>
                    <span className="text-slate-900">{asset.owner || 'Chưa cấp phát'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Ngày tạo:</span>
                    <span className="text-slate-900">{asset.createdAt?.toDate().toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-6 flex gap-2">
                    <button className="flex-1 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                      Chi tiết
                    </button>
                    <button 
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="px-3 py-2 text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg hover:bg-red-50 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
