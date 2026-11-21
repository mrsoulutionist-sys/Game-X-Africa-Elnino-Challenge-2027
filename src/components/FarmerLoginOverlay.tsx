import React, { useState } from 'react';
import { Sprout, ArrowRight } from 'lucide-react';

interface FarmerLoginOverlayProps {
  onLogin: (farmerName: string, passcode: string) => Promise<void>;
  loading: boolean;
  errorMsg: string | null;
}

export const FarmerLoginOverlay: React.FC<FarmerLoginOverlayProps> = ({
  onLogin,
  loading,
  errorMsg,
}) => {
  const [farmerName, setFarmerName] = useState('');
  const [passcode, setPasscode] = useState('');

  const canSubmit = farmerName.trim().length > 0 && passcode.length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onLogin(farmerName, passcode);
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-slate-950 border border-emerald-500/40 p-6 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 text-emerald-400">
          <Sprout className="w-5 h-5" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider">
            Game X Africa · El Niño Lab
          </span>
        </div>

        <h1 className="mt-2 text-xl font-bold text-white">Farmer Check-In</h1>

        <div className="mt-5 space-y-3.5">
          <div>
            <label
              htmlFor="farmer-name-input"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Farmer Name
            </label>
            <input
              id="farmer-name-input"
              type="text"
              value={farmerName}
              onChange={(e) => setFarmerName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Thabo"
              autoFocus
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="farmer-passcode-input"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Passcode (any letters or numbers)
            </label>
            <input
              id="farmer-passcode-input"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Your secret code"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="mt-3 text-xs text-rose-400 font-medium">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`mt-5 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
            canSubmit
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>{loading ? 'Loading Farm...' : 'Enter Workshop'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
