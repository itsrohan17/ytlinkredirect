import React from 'react';
import {
  Sun,
  Moon,
  RotateCcw,
  Trash2,
  Server,
  ShieldCheck,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DashboardView, ServerHealthStatus, UserPreferences } from '../../types';

interface SettingsViewProps {
  preferences: UserPreferences;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onResetPreferences: () => void;
  onClearLocalHistory: () => void;
  onRotateSession: () => Promise<void>;
  localHistoryCount: number;
  health: ServerHealthStatus | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onUpdatePreferences,
  onResetPreferences,
  onClearLocalHistory,
  onRotateSession,
  localHistoryCount,
  health,
}) => {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Section 1: Persisted Browser User Preferences */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Workspace Preferences
            </h2>
            <p className="text-xs text-zinc-500">
              Saved locally in your browser via <code className="text-[11px]">localStorage</code> — takes effect immediately across sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetPreferences}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Theme */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Appearance Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ theme: 'dark' })}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                  preferences.theme === 'dark'
                    ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Moon className="w-4 h-4" /> Dark Mode
              </button>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ theme: 'light' })}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                  preferences.theme === 'light'
                    ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Sun className="w-4 h-4" /> Light Mode
              </button>
            </div>
          </div>

          {/* Default Landing Screen */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Default Startup Screen
            </label>
            <select
              value={preferences.defaultView}
              onChange={(e) =>
                onUpdatePreferences({ defaultView: e.target.value as DashboardView })
              }
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
            >
              <option value="overview">Overview</option>
              <option value="links">Smart Links</option>
              <option value="analytics">Analytics</option>
              <option value="media">Media Studio</option>
              <option value="utilities">Utilities</option>
            </select>
          </div>

          {/* Default QR Size */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Default QR Studio Export Size
            </label>
            <select
              value={preferences.defaultQrSize}
              onChange={(e) =>
                onUpdatePreferences({
                  defaultQrSize: Number(e.target.value) as UserPreferences['defaultQrSize'],
                })
              }
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
            >
              <option value={256}>256 × 256 px</option>
              <option value={384}>384 × 384 px</option>
              <option value={512}>512 × 512 px (Default)</option>
              <option value={768}>768 × 768 px</option>
              <option value={1024}>1024 × 1024 px</option>
            </select>
          </div>

          {/* Default QR EC */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Default QR Error Correction
            </label>
            <select
              value={preferences.defaultQrEc}
              onChange={(e) =>
                onUpdatePreferences({
                  defaultQrEc: e.target.value as UserPreferences['defaultQrEc'],
                })
              }
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
            >
              <option value="L">L (7% recovery)</option>
              <option value="M">M (15% recovery)</option>
              <option value="Q">Q (25% recovery)</option>
              <option value="H">H (30% recovery — Best with logos)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.compactTables}
              onChange={(e) => onUpdatePreferences({ compactTables: e.target.checked })}
              className="rounded border-zinc-300 dark:border-zinc-700 text-red-600"
            />
            Use compact row spacing in Smart Links &amp; Analytics tables
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRotateSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Rotate Session Token
            </button>

            <button
              type="button"
              onClick={onClearLocalHistory}
              disabled={localHistoryCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/25 text-xs font-medium disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Local Quick History ({localHistoryCount})
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Read-Only Server Configuration & Capabilities */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex items-start justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              Server &amp; Infrastructure Status (Read-Only)
            </h2>
            <p className="text-xs text-zinc-500">
              Configured via environment variables on the server. No credentials, bucket URLs, or API tokens are exposed to the client bundle.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Zero-Secret Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Database Engine
            </span>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {health?.capabilities.databaseMode === 'turso'
                ? 'Turso Cloud LibSQL'
                : health?.capabilities.databaseMode === 'memory'
                ? 'In-Memory SQLite (Ephemeral)'
                : 'Local SQLite File'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-1">
            <span className="text-zinc-500 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" /> Background Worker Object Storage
            </span>
            <p className="font-semibold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
              {health?.capabilities.objectStorageConfigured ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> S3/R2 Configured
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Not Configured (Optional)
                </>
              )}
            </p>
          </div>
        </div>

        {health && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">Runtime</span>
              <span className="font-mono font-semibold uppercase">
                {health.environment}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">Browser WASM Max</span>
              <span className="font-mono font-semibold">
                {health.capabilities.limits.browserWasmMaxMb} MB
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">Worker Upload Max</span>
              <span className="font-mono font-semibold">
                {health.capabilities.limits.workerMaxMb} MB
              </span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-500 block">Signed URL TTL</span>
              <span className="font-mono font-semibold">
                {health.capabilities.limits.signedUrlTtlSeconds}s / {health.capabilities.limits.fileTtlHours}h file
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
