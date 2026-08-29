import React, { useState, useEffect, useMemo } from 'react';
import {
  BedDouble,
  Sparkles,
  Wrench,
  Users,
  DollarSign,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Search,
  Filter,
  Shield,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  Lock,
  Eye,
  Edit3,
  Info,
  Star,
  Tag,
  Check,
  X,
} from 'lucide-react';
import {
  Room,
  RoomStatus,
  ROOM_STATUS_CONFIG,
  COMMON_AMENITY_PRESETS,
  fetchRooms,
  updateRoom,
  updateRoomStatus,
  uploadRoomPhoto,
} from '../../../lib/api/rooms';
import {
  Booking,
  fetchBookings,
  BOOKING_STATUS_CONFIG,
  BOOKING_SOURCE_CONFIG,
} from '../../../lib/api/bookings';
import { isOwnerOrManager, UserRole } from '../../../lib/rbac';
import { cn } from '../../../lib/utils';

interface RoomsPageProps {
  currentUser?: {
    id?: string;
    email: string;
    fullName: string;
    role: UserRole | string;
  };
}

export const RoomsPage: React.FC<RoomsPageProps> = ({
  currentUser = { email: 'manager@villainlet.com', fullName: 'Villa Manager', role: 'MANAGER' },
}) => {
  const userRole = (currentUser?.role as UserRole) || 'MANAGER';
  const canEdit = isOwnerOrManager(userRole);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Room Modal State
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'photos' | 'bookings'>('details');
  const [roomBookings, setRoomBookings] = useState<Booking[]>([]);
  const [loadingRoomBookings, setLoadingRoomBookings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Form State (when modal is open)
  const [formData, setFormData] = useState<{
    name: string;
    roomNumber: string;
    maxOccupancy: number;
    basePrice: string | number;
    description: string;
    amenities: string[];
    imageUrls: string[];
    status: RoomStatus;
  }>({
    name: '',
    roomNumber: '',
    maxOccupancy: 2,
    basePrice: 350,
    description: '',
    amenities: [],
    imageUrls: [],
    status: 'AVAILABLE',
  });

  // Custom Amenity Input
  const [customAmenity, setCustomAmenity] = useState('');
  // Direct Image URL Input
  const [directImageUrl, setDirectImageUrl] = useState('');
  // Photo Uploading State
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Quick Status Override Modal State
  const [quickOverrideRoom, setQuickOverrideRoom] = useState<Room | null>(null);
  const [targetStatus, setTargetStatus] = useState<RoomStatus>('AVAILABLE');
  const [isOverriding, setIsOverriding] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadRoomsData = async () => {
    setLoading(true);
    const result = await fetchRooms(currentUser);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      setRooms(result.rooms);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRoomsData();
  }, []);

  // Filtered list
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.roomNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rooms, searchQuery, statusFilter]);

  // Statistics Summary
  const metrics = useMemo(() => {
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === 'AVAILABLE').length;
    const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length;
    const cleaning = rooms.filter((r) => r.status === 'CLEANING').length;
    const maintenance = rooms.filter((r) => r.status === 'MAINTENANCE').length;
    return { total, available, occupied, cleaning, maintenance };
  }, [rooms]);

  // Open Room Modal
  const handleOpenRoomModal = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      name: room.name,
      roomNumber: room.roomNumber,
      maxOccupancy: room.maxOccupancy,
      basePrice: room.basePrice,
      description: room.description || '',
      amenities: [...room.amenities],
      imageUrls: [...room.imageUrls],
      status: room.status,
    });
    setActiveModalTab('details');

    // Fetch this room's bookings
    setLoadingRoomBookings(true);
    fetchBookings({ roomId: room.id }, currentUser).then((res) => {
      setRoomBookings(res.bookings || []);
      setLoadingRoomBookings(false);
    });
  };

  // Close Room Modal
  const handleCloseModal = () => {
    setSelectedRoom(null);
    setCustomAmenity('');
    setDirectImageUrl('');
  };

  // Save Room Details
  const handleSaveRoomDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !canEdit) return;

    setIsSaving(true);
    const result = await updateRoom(
      selectedRoom.id,
      {
        name: formData.name.trim(),
        roomNumber: formData.roomNumber.trim(),
        maxOccupancy: Number(formData.maxOccupancy),
        basePrice: Number(formData.basePrice),
        description: formData.description.trim(),
        amenities: formData.amenities,
        imageUrls: formData.imageUrls,
        status: formData.status,
      },
      currentUser
    );

    if (result.success && result.room) {
      setRooms((prev) => prev.map((r) => (r.id === selectedRoom.id ? result.room! : r)));
      setSelectedRoom(result.room);
      showToast(`Saved changes to ${result.room.name}`, 'success');
    } else {
      showToast(result.error || 'Failed to update room', 'error');
    }
    setIsSaving(false);
  };

  // Toggle Amenity
  const handleToggleAmenity = (amenity: string) => {
    if (!canEdit) return;
    setFormData((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists ? prev.amenities.filter((a) => a !== amenity) : [...prev.amenities, amenity],
      };
    });
  };

  // Add Custom Amenity
  const handleAddCustomAmenity = () => {
    if (!customAmenity.trim() || !canEdit) return;
    const formatted = customAmenity.trim();
    if (!formData.amenities.includes(formatted)) {
      setFormData((prev) => ({
        ...prev,
        amenities: [...prev.amenities, formatted],
      }));
    }
    setCustomAmenity('');
  };

  // Add Direct Image URL
  const handleAddDirectImageUrl = () => {
    if (!directImageUrl.trim() || !canEdit) return;
    setFormData((prev) => ({
      ...prev,
      imageUrls: [...prev.imageUrls, directImageUrl.trim()],
    }));
    setDirectImageUrl('');
  };

  // Upload Photo File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !canEdit) return;

    setUploadingPhoto(true);
    const file = files[0];
    const uploadRes = await uploadRoomPhoto(file, currentUser);

    if (uploadRes.url) {
      setFormData((prev) => ({
        ...prev,
        imageUrls: [uploadRes.url!, ...prev.imageUrls],
      }));
      showToast('Photo uploaded to Supabase Storage.', 'success');
    } else {
      showToast(uploadRes.error || 'Failed to upload photo', 'error');
    }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  // Set Primary Photo
  const handleSetPrimaryPhoto = (index: number) => {
    if (!canEdit) return;
    setFormData((prev) => {
      const urls = [...prev.imageUrls];
      const [chosen] = urls.splice(index, 1);
      return { ...prev, imageUrls: [chosen, ...urls] };
    });
  };

  // Delete Photo
  const handleDeletePhoto = (index: number) => {
    if (!canEdit) return;
    setFormData((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  };

  // Handle Quick Status Override Submit
  const handleConfirmQuickOverride = async () => {
    if (!quickOverrideRoom || !canEdit) return;
    setIsOverriding(true);

    const result = await updateRoomStatus(quickOverrideRoom.id, targetStatus, currentUser);
    if (result.success && result.room) {
      setRooms((prev) => prev.map((r) => (r.id === quickOverrideRoom.id ? result.room! : r)));
      showToast(
        `Status for ${quickOverrideRoom.name} updated to ${ROOM_STATUS_CONFIG[targetStatus].label}.`,
        'success'
      );
      setQuickOverrideRoom(null);
    } else {
      showToast(result.error || 'Failed to override status', 'error');
    }
    setIsOverriding(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2',
            toast.type === 'success' && 'bg-slate-900 border-slate-800 text-white',
            toast.type === 'error' && 'bg-rose-950 border-rose-800 text-rose-100',
            toast.type === 'info' && 'bg-slate-900 border-slate-800 text-white'
          )}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span className="text-xs font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Villa Bedrooms & Suites</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              5 Dedicated Suites
            </span>
          </div>
          <p className="text-xs text-slate-500">
            View real-time room statuses, manage suite rates, configure amenities, and update high-res gallery photos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-rooms"
            onClick={loadRoomsData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors shadow-2xs"
            title="Refresh room list"
          >
            <RotateCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Suites</span>
            <BedDouble className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Full Villa Inventory</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-emerald-700 mb-1">
            <span>Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{metrics.available}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">Ready for check-in</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-indigo-700 mb-1">
            <span>Occupied</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-700">{metrics.occupied}</div>
          <div className="text-[11px] text-indigo-600/80 mt-1">Guests in-house</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-amber-700 mb-1">
            <span>Housekeeping</span>
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{metrics.cleaning}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">Turnover in progress</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-rose-700 mb-1">
            <span>Maintenance</span>
            <Wrench className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700">{metrics.maintenance}</div>
          <div className="text-[11px] text-rose-600/80 mt-1">Out of service</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            id="input-search-rooms"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms by name, suite code, or features..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1 scrollbar-none">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </span>
          <button
            id="filter-all-rooms"
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0',
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            All ({rooms.length})
          </button>

          {(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as RoomStatus[]).map((st) => {
            const count = rooms.filter((r) => r.status === st).length;
            const cfg = ROOM_STATUS_CONFIG[st];
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                id={`filter-${st.toLowerCase()}`}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 border whitespace-nowrap',
                  isSelected
                    ? cn(cfg.bg, cfg.text, cfg.border, 'ring-1 ring-current font-semibold')
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                )}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Rooms Grid */}
      {loading && rooms.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading villa bedrooms...</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-2xs">
          <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-900">No rooms match your filter</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or switching status filter to "All".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => {
            const statusCfg = ROOM_STATUS_CONFIG[room.status];
            const heroImage =
              room.imageUrls[0] ||
              'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80';

            return (
              <div
                key={room.id}
                id={`room-card-${room.roomNumber.toLowerCase()}`}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col group"
              >
                {/* Hero Photo with Badges */}
                <div className="relative aspect-16/10 bg-slate-100 overflow-hidden">
                  <img
                    src={heroImage}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-900/80 text-white backdrop-blur-xs border border-white/10 shadow-xs">
                      {room.roomNumber}
                    </span>

                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-xs border',
                        statusCfg.bg,
                        statusCfg.text,
                        statusCfg.border
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', statusCfg.dot)} />
                      <span>{statusCfg.label}</span>
                    </span>
                  </div>

                  {/* Photo Count */}
                  {room.imageUrls.length > 1 && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-medium flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>{room.imageUrls.length} photos</span>
                    </div>
                  )}

                  {/* Price Banner */}
                  <div className="absolute bottom-3 left-3 text-white">
                    <span className="text-xl font-bold tracking-tight">${Number(room.basePrice)}</span>
                    <span className="text-[11px] text-white/80 font-normal"> / night</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4.5 flex-1 flex flex-col justify-between space-y-3.5">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-bold text-slate-900 text-sm tracking-tight group-hover:text-indigo-600 transition-colors">
                        {room.name}
                      </h3>
                      <span className="text-[11px] font-medium text-slate-500 shrink-0 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>Max {room.maxOccupancy}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                      {room.description || 'Spacious luxury villa bedroom.'}
                    </p>

                    {/* Amenities Preview */}
                    <div className="flex flex-wrap gap-1.5">
                      {room.amenities.slice(0, 3).map((amenity) => (
                        <span
                          key={amenity}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                        >
                          {amenity}
                        </span>
                      ))}
                      {room.amenities.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 text-[10px] font-medium">
                          +{room.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Status Quick Override for Owner/Manager */}
                    {canEdit ? (
                      <button
                        id={`btn-quick-override-${room.id}`}
                        onClick={() => {
                          setQuickOverrideRoom(room);
                          setTargetStatus(room.status);
                        }}
                        className="text-[11px] text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1 transition-colors"
                        title="Override suite status"
                      >
                        <RotateCw className="w-3 h-3 text-slate-400" />
                        <span>Override Status</span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">View Mode</div>
                    )}

                    <button
                      id={`btn-view-details-${room.id}`}
                      onClick={() => handleOpenRoomModal(room)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors"
                    >
                      {canEdit ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{canEdit ? 'Edit Suite' : 'View Details'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Room Detail / Edit Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white border-0 sm:border sm:border-slate-200 rounded-none sm:rounded-2xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 my-auto">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70 rounded-none sm:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  {formData.roomNumber || 'RM'}
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <span className="line-clamp-1">{formData.name || 'Room Details'}</span>
                    {!canEdit && (
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0">
                        View Only
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-mono">ID: {selectedRoom.id}</p>
                </div>
              </div>

              <button
                id="btn-close-room-modal"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="px-4 sm:px-6 border-b border-slate-200 flex items-center gap-4 sm:gap-6 text-xs font-semibold text-slate-500 overflow-x-auto scrollbar-none shrink-0">
              <button
                id="tab-details"
                onClick={() => setActiveModalTab('details')}
                className={cn(
                  'py-3 border-b-2 -mb-px transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                  activeModalTab === 'details'
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent hover:text-slate-800'
                )}
              >
                <BedDouble className="w-3.5 h-3.5" />
                <span>Suite Details & Rates</span>
              </button>

              <button
                id="tab-photos"
                onClick={() => setActiveModalTab('photos')}
                className={cn(
                  'py-3 border-b-2 -mb-px transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                  activeModalTab === 'photos'
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent hover:text-slate-800'
                )}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Gallery & Photos ({formData.imageUrls.length})</span>
              </button>

              <button
                id="tab-bookings"
                onClick={() => setActiveModalTab('bookings')}
                className={cn(
                  'py-3 border-b-2 -mb-px transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                  activeModalTab === 'bookings'
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent hover:text-slate-800'
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Booking History</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
              {/* TAB 1: DETAILS & PRICING */}
              {activeModalTab === 'details' && (
                <form id="form-room-details" onSubmit={handleSaveRoomDetails} className="space-y-5">
                  {!canEdit && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        You are viewing this suite in <strong>read-only mode</strong>. Only Property Owners and General
                        Managers can modify room configurations.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Suite Name</label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Room Code / Number</label>
                      <input
                        type="text"
                        disabled={!canEdit}
                        required
                        value={formData.roomNumber}
                        onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Base Nightly Rate ($ USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="number"
                          step="0.01"
                          disabled={!canEdit}
                          required
                          value={formData.basePrice}
                          onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                          className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Max Occupancy</label>
                      <div className="relative">
                        <Users className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="number"
                          min="1"
                          max="10"
                          disabled={!canEdit}
                          required
                          value={formData.maxOccupancy}
                          onChange={(e) => setFormData({ ...formData, maxOccupancy: Number(e.target.value) })}
                          className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Current Status</label>
                      <select
                        disabled={!canEdit}
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as RoomStatus })}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                      >
                        {(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as RoomStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {ROOM_STATUS_CONFIG[st].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      disabled={!canEdit}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the suite's ambiance, bedding, views, and unique architectural features..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
                    />
                  </div>

                  {/* Amenities Manager */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">Suite Amenities & Perks</label>
                      <span className="text-[11px] text-slate-400">{formData.amenities.length} selected</span>
                    </div>

                    {/* Active Amenities Chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {formData.amenities.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No amenities added yet.</span>
                      ) : (
                        formData.amenities.map((amenity) => (
                          <span
                            key={amenity}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 text-xs font-medium"
                          >
                            <span>{amenity}</span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleToggleAmenity(amenity)}
                                className="text-indigo-600 hover:text-rose-600 ml-0.5"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Preset Quick-Add List */}
                    {canEdit && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] text-slate-500 font-medium">Quick Add Presets:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {COMMON_AMENITY_PRESETS.map((preset) => {
                            const isAdded = formData.amenities.includes(preset);
                            return (
                              <button
                                type="button"
                                key={preset}
                                onClick={() => handleToggleAmenity(preset)}
                                className={cn(
                                  'text-[11px] px-2 py-0.5 rounded-md border transition-colors',
                                  isAdded
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                )}
                              >
                                {isAdded ? '✓ ' : '+ '}
                                {preset}
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Amenity input */}
                        <div className="flex items-center gap-2 pt-1.5">
                          <input
                            type="text"
                            value={customAmenity}
                            onChange={(e) => setCustomAmenity(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomAmenity();
                              }
                            }}
                            placeholder="Add custom amenity (e.g. Nespresso Bar)..."
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomAmenity}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              )}

              {/* TAB 2: PHOTO GALLERY & UPLOADER */}
              {activeModalTab === 'photos' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Suite Photos</h4>
                      <p className="text-[11px] text-slate-500">
                        First image serves as the primary cover photo for cards and guest view.
                      </p>
                    </div>

                    {canEdit && (
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {formData.imageUrls.map((url, idx) => (
                      <div
                        key={url + idx}
                        className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-2xs"
                      >
                        <img src={url} alt={`Suite ${idx + 1}`} className="w-full h-full object-cover" />

                        {idx === 0 && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            <span>Primary Cover</span>
                          </div>
                        )}

                        {canEdit && (
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            {idx !== 0 && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryPhoto(idx)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-900 rounded-md text-[11px] font-semibold shadow-xs"
                                title="Set as primary"
                              >
                                Set Cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(idx)}
                              className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs shadow-xs"
                              title="Delete photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Photo by URL option */}
                  {canEdit && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <input
                        type="url"
                        value={directImageUrl}
                        onChange={(e) => setDirectImageUrl(e.target.value)}
                        placeholder="Or paste external image URL (e.g. Unsplash / CDN)..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddDirectImageUrl}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shrink-0"
                      >
                        Add URL
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: BOOKINGS & SCHEDULE */}
              {activeModalTab === 'bookings' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Reservation History for {selectedRoom.roomNumber}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        All past, present, and upcoming reservations linked to this suite.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {roomBookings.length} Total Records
                    </span>
                  </div>

                  {loadingRoomBookings ? (
                    <div className="py-12 text-center">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-slate-500">Loading reservation ledger...</p>
                    </div>
                  ) : roomBookings.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                      <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <h4 className="text-sm font-semibold text-slate-800">No active bookings recorded for this suite</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        You can create reservations for this suite anytime directly in the <strong>Booking Calendar</strong> tab.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {roomBookings.map((b) => {
                        const statusCfg = BOOKING_STATUS_CONFIG[b.status];
                        const sourceCfg = BOOKING_SOURCE_CONFIG[b.source];
                        const inDate = new Date(b.checkIn).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const outDate = new Date(b.checkOut).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });

                        return (
                          <div
                            key={b.id}
                            className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {b.guestName}
                                </span>
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                    statusCfg.bg,
                                    statusCfg.text,
                                    statusCfg.border
                                  )}
                                >
                                  {statusCfg.label}
                                </span>
                                <span
                                  className={cn(
                                    'px-1.5 py-0.2 rounded text-[10px] font-medium border hidden sm:inline',
                                    sourceCfg.bg,
                                    sourceCfg.text,
                                    sourceCfg.border
                                  )}
                                >
                                  {sourceCfg.label}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>
                                  {inDate} → {outDate}
                                </span>
                                <span>•</span>
                                <span>{b.numGuests} Guests</span>
                                {b.notes && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate italic text-slate-400 max-w-[140px]">
                                      "{b.notes}"
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-bold text-slate-900">${Number(b.totalAmount)}</div>
                              <div className="text-[10px] text-slate-400">
                                Paid: ${Number(b.amountPaid)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Room Turnover Checklist */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Turnover Readiness Checklist
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>High-thread-count Linens Restocked</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Bath Amenities & Toiletries Refilled</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Mini Bar & Espresso Bar Sanitized</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Digital Keycard Encoder Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70 rounded-none sm:rounded-b-2xl">
              <div className="text-[11px] sm:text-xs text-slate-500">
                <span className="hidden sm:inline">Last updated: </span>
                <span className="font-medium text-slate-700">
                  {selectedRoom.updatedAt ? new Date(selectedRoom.updatedAt).toLocaleDateString() : 'Today'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-modal-cancel"
                  onClick={handleCloseModal}
                  className="px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>

                {canEdit && activeModalTab === 'details' && (
                  <button
                    type="submit"
                    form="form-room-details"
                    id="btn-save-room-changes"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Save Details</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Status Override Modal */}
      {quickOverrideRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <RotateCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Manual Status Override</h3>
                <p className="text-xs text-slate-500">
                  {quickOverrideRoom.name} ({quickOverrideRoom.roomNumber})
                </p>
              </div>
            </div>

            {/* Explanatory callout as requested */}
            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 mb-4 leading-relaxed">
              <strong>Operational Note:</strong> Once the <em>Booking Calendar</em> and <em>Housekeeping</em> modules
              are activated, room statuses will derive automatically upon guest check-in/out and cleaning inspection.
              This manual override serves as an immediate operational escape hatch.
            </div>

            <div className="space-y-3 mb-5">
              <label className="block text-xs font-semibold text-slate-700">Select Target Suite Status:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as RoomStatus[]).map((st) => {
                  const cfg = ROOM_STATUS_CONFIG[st];
                  const isChosen = targetStatus === st;
                  return (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setTargetStatus(st)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all',
                        isChosen
                          ? cn(cfg.bg, cfg.text, cfg.border, 'ring-2 ring-indigo-500 font-semibold shadow-xs')
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0', cfg.dot)} />
                      <div>
                        <div className="text-xs font-bold">{cfg.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                          {cfg.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickOverrideRoom(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isOverriding}
                onClick={handleConfirmQuickOverride}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
              >
                {isOverriding ? 'Updating Status...' : 'Apply Status Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer for viewport clearance */}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
};

export default RoomsPage;
