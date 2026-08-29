import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  route: string;
  description: string;
  icon: LucideIcon;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  route,
  description,
  icon: Icon,
}) => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-10 min-h-[calc(100vh-4rem)]">
      <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-xl p-8 shadow-xs">
        <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700">
          <Icon className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Under Development</span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-1">{title}</h1>
        <p className="text-xs font-mono text-slate-600 mb-3">{route}</p>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{description}</p>

        <div className="pt-5 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-600 px-3 py-2 bg-slate-50 rounded-lg">
            <span>Status</span>
            <span className="font-medium text-slate-800">Coming soon</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 px-3 py-2 bg-slate-50 rounded-lg">
            <span>Module Stage</span>
            <span className="font-medium text-slate-800">Shell & Navigation Setup</span>
          </div>
        </div>
      </div>
    </div>
  );
};
