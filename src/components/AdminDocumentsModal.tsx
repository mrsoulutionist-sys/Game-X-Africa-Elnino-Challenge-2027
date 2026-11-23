import React from 'react';
import { Download, FileText, X } from 'lucide-react';
import {
  triggerSafeDocumentDownload,
  type AdminDocumentRecord,
} from '../firebase/adminService';

interface AdminDocumentsModalProps {
  open: boolean;
  documents: AdminDocumentRecord[];
  onClose: () => void;
}

export const AdminDocumentsModal: React.FC<AdminDocumentsModalProps> = ({
  open,
  documents,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl bg-slate-950 border border-sky-500/40 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-white">
              Admin Guides &amp; Challenge Documents
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guides modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {documents.length === 0 ? (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-xs text-slate-400">
              No guides or challenge documents have been uploaded by the Admin yet.
            </div>
          ) : (
            documents.map((item) => (
              <div
                key={item.docId}
                className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      {item.category}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.title}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  )}
                  <p className="text-[10px] font-mono text-slate-500 mt-1">
                    {item.fileName} · {Math.max(1, Math.round(item.sizeBytes / 1024))} KB · Uploaded by {item.uploadedByAdminName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => triggerSafeDocumentDownload(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
