import React from 'react';
import { Layers } from 'lucide-react';

interface BookingLegendProps {
  className?: string;
  showCancelledHint?: boolean;
}

export const BookingLegend: React.FC<BookingLegendProps> = ({
  className = '',
  showCancelledHint = true,
}) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 py-2 border-t border-slate-100 ${className}`}
    >
      <span className="font-semibold text-slate-700 flex items-center gap-1 shrink-0">
        <Layers className="w-3.5 h-3.5 text-slate-500" />
        <span>Status Key:</span>
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 shadow-2xs" />
        <span className="font-medium text-slate-700">Confirmed</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shadow-2xs" />
        <span className="font-medium text-slate-700">Pending Deposit</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 shadow-2xs" />
        <span className="font-medium text-slate-700">Checked Out</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-2xs" />
        <span className="font-medium text-slate-700">Cancelled (When filtered)</span>
      </div>
      {showCancelledHint && (
        <span className="text-slate-400 text-[10px] sm:text-[11px] sm:ml-auto italic">
          Tip: Click empty cells to create reservations. Drag or swipe horizontally to navigate dates.
        </span>
      )}
    </div>
  );
};
