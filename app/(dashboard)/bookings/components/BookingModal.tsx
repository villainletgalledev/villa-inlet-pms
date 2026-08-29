import React from 'react';
import {
  CalendarCheck,
  X,
  AlertCircle,
  Lock,
  User,
  Mail,
  Phone,
  Users,
  DollarSign,
  CreditCard,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Booking, BookingStatus, BookingSource, BOOKING_STATUS_CONFIG, BOOKING_SOURCE_CONFIG } from '../../../../lib/api/bookings';
import { Room } from '../../../../lib/api/rooms';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBooking: Booking | null;
  canEdit: boolean;
  isOwnerMgr: boolean;
  rooms: Room[];
  formData: {
    roomId: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    numGuests: number;
    totalAmount: number | string;
    amountPaid: number | string;
    status: BookingStatus;
    source: BookingSource;
    notes: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      roomId: string;
      guestName: string;
      guestEmail: string;
      guestPhone: string;
      checkIn: string;
      checkOut: string;
      numGuests: number;
      totalAmount: number | string;
      amountPaid: number | string;
      status: BookingStatus;
      source: BookingSource;
      notes: string;
    }>
  >;
  conflictError: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  onQuickCheckOut: () => void;
  onDatesOrRoomChange: (newRoomId: string, newCheckIn: string, newCheckOut: string) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  editingBooking,
  canEdit,
  isOwnerMgr,
  rooms,
  formData,
  setFormData,
  conflictError,
  isSubmitting,
  onSubmit,
  onDelete,
  onQuickCheckOut,
  onDatesOrRoomChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 sm:rounded-2xl max-w-xl w-full h-full sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 my-auto">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70 sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {editingBooking ? 'Reservation Details' : 'New Villa Reservation'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                {editingBooking
                  ? `Booking #${editingBooking.id.slice(0, 8)}`
                  : 'Create a direct reservation with instant conflict detection.'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-booking-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Conflict Error Alert */}
          {conflictError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Booking Conflict Detected</strong>
                <span>{conflictError}</span>
              </div>
            </div>
          )}

          {/* Read Only banner for unauthorized roles */}
          {!canEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                You are in <strong>read-only mode</strong>. Only Property Owners, Managers, and Front Desk Staff can modify reservations.
              </span>
            </div>
          )}

          <form id="form-booking" onSubmit={onSubmit} className="space-y-4">
            {/* Room Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Bedroom / Suite
              </label>
              <select
                disabled={!canEdit}
                required
                value={formData.roomId}
                onChange={(e) =>
                  onDatesOrRoomChange(e.target.value, formData.checkIn, formData.checkOut)
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} - {r.name} (${Number(r.basePrice)}/night, Max {r.maxOccupancy} Guests)
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Check-In Date
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  required
                  value={formData.checkIn}
                  onChange={(e) =>
                    onDatesOrRoomChange(formData.roomId, e.target.value, formData.checkOut)
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Check-Out Date
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  required
                  value={formData.checkOut}
                  onChange={(e) =>
                    onDatesOrRoomChange(formData.roomId, formData.checkIn, e.target.value)
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Guest Contact Details */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Primary Guest Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Guest Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      disabled={!canEdit}
                      required
                      value={formData.guestName}
                      onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                      placeholder="e.g. Sophia Montgomery"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Guest Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      disabled={!canEdit}
                      required
                      value={formData.guestEmail}
                      onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                      placeholder="guest@example.com"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      disabled={!canEdit}
                      value={formData.guestPhone}
                      onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Number of Guests
                  </label>
                  <div className="relative">
                    <Users className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="number"
                      min="1"
                      max="10"
                      disabled={!canEdit}
                      required
                      value={formData.numGuests}
                      onChange={(e) => setFormData({ ...formData, numGuests: Number(e.target.value) })}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Financials & Status */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Rates, Payment & Source
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Booking Rate ($ USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      disabled={!canEdit}
                      required
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount Paid / Deposit ($ USD)
                  </label>
                  <div className="relative">
                    <CreditCard className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="number"
                      step="0.01"
                      disabled={!canEdit}
                      value={formData.amountPaid}
                      onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reservation Status
                  </label>
                  <select
                    disabled={!canEdit}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as BookingStatus })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    {(['CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED'] as BookingStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {BOOKING_STATUS_CONFIG[st].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Booking Channel / Source
                  </label>
                  <select
                    disabled={!canEdit}
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as BookingSource })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    {(['DIRECT', 'AIRBNB', 'BOOKING_COM', 'OTHER'] as BookingSource[]).map((sc) => (
                      <option key={sc} value={sc}>
                        {BOOKING_SOURCE_CONFIG[sc].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Requests & Concierge Notes
              </label>
              <textarea
                rows={2}
                disabled={!canEdit}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Airport transfer requested, anniversary champagne, late check-in..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 leading-relaxed"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70 sm:rounded-b-2xl">
          <div className="flex items-center gap-2">
            {editingBooking && canEdit && (
              <>
                {editingBooking.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={onQuickCheckOut}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200/80 transition-colors cursor-pointer"
                    title="Mark checkout & trigger housekeeping turnover"
                  >
                    Check Out
                  </button>
                )}

                {isOwnerMgr && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete reservation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {canEdit && (
              <button
                type="submit"
                form="form-booking"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{editingBooking ? 'Save Changes' : 'Confirm'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
