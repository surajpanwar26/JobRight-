import React from 'react';
import { X, Gift, Calendar, CheckCircle } from 'lucide-react';
import { ChangeLogEntry } from '../types';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  changelog: ChangeLogEntry[];
  currentVersion: string;
}

const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, changelog, currentVersion }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn">
        
        {/* Header */}
        <div className="bg-brand-600 p-6 text-white shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/20 p-1.5 rounded-lg">
                    <Gift size={20} />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-100">What's New</span>
              </div>
              <h2 className="text-2xl font-bold">JobRight Updated</h2>
              <p className="text-brand-100 text-sm mt-1">Version {currentVersion} is now running locally.</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {changelog.map((log, index) => (
            <div key={log.version} className="relative pl-4 border-l-2 border-gray-100">
               <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${index === 0 ? 'bg-brand-500' : 'bg-gray-300'}`} />
               
               <div className="flex justify-between items-baseline mb-3">
                 <h3 className="text-lg font-bold text-gray-900">{log.title}</h3>
                 <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Calendar size={12} /> {log.date}
                 </span>
               </div>
               
               <div className="space-y-3">
                 {log.features.map((feature, i) => (
                   <div key={i} className="flex items-start gap-3 text-sm text-gray-600 leading-relaxed">
                     <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                     <span>{feature}</span>
                   </div>
                 ))}
               </div>
               
               {index === 0 && (
                   <div className="mt-4 inline-block px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full">
                       Current Version
                   </div>
               )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button 
            onClick={onClose}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-brand-200"
          >
            Awesome, Let's Go!
          </button>
        </div>

      </div>
    </div>
  );
};

export default UpdateModal;