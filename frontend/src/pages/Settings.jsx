import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  DownloadCloud,
  FolderOpen,
  Gauge,
  HardDrive,
  Settings as SettingsIcon,
  TriangleAlert,
} from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return 'N/D';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** order).toFixed(1)} ${units[order]}`;
};

const Settings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({ modelPath: '', cachePath: '' });
  const [disk, setDisk] = useState({ model: null, cache: null });
  const [modelStatus, setModelStatus] = useState({ exists: false, sizeBytes: 0, info: null });
  const [downloadState, setDownloadState] = useState({ percent: 0, inProgress: false, error: null });
  const [loading, setLoading] = useState(true);

  const desktopBridge = window.desktopBridge;

  const refreshDisk = async (nextSettings) => {
    if (!desktopBridge) return;
    const modelInfo = await desktopBridge.getDiskInfo(nextSettings.modelPath);
    const cacheInfo = await desktopBridge.getDiskInfo(nextSettings.cachePath);
    setDisk({ model: modelInfo, cache: cacheInfo });
  };

  const refreshModelStatus = async () => {
    if (!desktopBridge) return;
    const status = await desktopBridge.getModelStatus();
    setModelStatus(status);
  };

  useEffect(() => {
    if (!desktopBridge) return undefined;

    const load = async () => {
      const loadedSettings = await desktopBridge.getSettings();
      setSettings(loadedSettings);
      await refreshDisk(loadedSettings);
      await refreshModelStatus();
      setLoading(false);
    };

    const handleProgress = (payload) => {
      setDownloadState((prev) => ({
        ...prev,
        inProgress: !payload.error && payload.percent !== undefined,
        percent: payload.percent ?? prev.percent,
        error: payload.error || null,
      }));
      if (payload.percent === 100) {
        refreshModelStatus();
      }
    };

    desktopBridge.onModelDownloadProgress(handleProgress);
    load();

    return () => {
      desktopBridge.removeModelDownloadProgress();
    };
  }, [desktopBridge]);

  const handleChoose = async (key) => {
    if (!desktopBridge) return;
    const selected = await desktopBridge.chooseDirectory(settings[key]);
    if (!selected) return;
    const updated = await desktopBridge.saveSettings({ ...settings, [key]: selected });
    setSettings(updated);
    await refreshDisk(updated);
  };

  const startDownload = async () => {
    if (!desktopBridge) return;
    setDownloadState({ percent: 0, inProgress: true, error: null });
    const result = await desktopBridge.downloadModel();
    if (!result.ok) {
      setDownloadState({ percent: 0, inProgress: false, error: result.error });
      return;
    }
    await refreshModelStatus();
    setDownloadState({ percent: 100, inProgress: false, error: null });
  };

  const downloadLabel = useMemo(() => {
    if (downloadState.error) return 'Reintentar descarga';
    if (downloadState.inProgress) return 'Descargando...';
    if (modelStatus.exists) return 'Modelo instalado';
    return 'Descargar modelo compacto';
  }, [downloadState, modelStatus]);

  const renderDiskCard = (label, value) => {
    if (!value) return null;
    const percent = value.totalBytes ? Math.round((value.freeBytes / value.totalBytes) * 100) : null;
    return (
      <div className="p-4 rounded-xl border border-orange-100 bg-orange-50/60 space-y-2">
        <div className="flex items-center gap-2 text-orange-800 font-semibold">
          <Gauge className="w-4 h-4" />
          <span>{label}</span>
        </div>
        <div className="text-sm text-orange-700">
          Libre: {formatBytes(value.freeBytes)} / {formatBytes(value.totalBytes)}
        </div>
        {percent !== null && (
          <div className="w-full bg-orange-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-orange-500 h-2"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        {value.error && <p className="text-xs text-red-700">{value.error}</p>}
      </div>
    );
  };

  const downloadProgress = downloadState.percent ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white text-orange-900">
      <header className="bg-white/80 backdrop-blur border-b border-orange-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-orange-700/70 font-semibold">Configuración</p>
              <h1 className="text-xl font-bold text-orange-900">Ajustes locales</h1>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-orange-200 text-orange-800 text-sm font-semibold bg-white hover:shadow-md transition"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-orange-700/80">Modelo compacto listo para usar</p>
              <p className="text-sm text-orange-700/70">
                {modelStatus.info?.description || 'Descarga el modelo cuantizado para funcionar sin conexión.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {modelStatus.exists ? (
                <span className="inline-flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Instalada ({formatBytes(modelStatus.sizeBytes)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-sm font-semibold">
                  <TriangleAlert className="w-4 h-4" /> No descargada
                </span>
              )}
              <button
                disabled={downloadState.inProgress}
                onClick={startDownload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 shadow-sm disabled:opacity-70"
              >
                <DownloadCloud className="w-4 h-4" /> {downloadLabel}
              </button>
            </div>
          </div>

          {(downloadState.inProgress || downloadState.percent) && (
            <div className="w-full bg-orange-100 rounded-full h-3 overflow-hidden">
              <div className="bg-orange-500 h-3 transition-all" style={{ width: `${downloadProgress}%` }} />
            </div>
          )}
          {downloadState.error && (
            <p className="text-sm text-red-700">{downloadState.error}</p>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-orange-100 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-orange-800 font-semibold">
              <HardDrive className="w-4 h-4" /> Ubicación del modelo
            </div>
            <div className="text-sm text-orange-800/80 break-all bg-orange-50/60 border border-orange-100 rounded-xl p-3">
              {settings.modelPath || 'Sin ruta definida'}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {renderDiskCard('Espacio disponible', disk.model)}
              <button
                onClick={() => handleChoose('modelPath')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-200 text-orange-800 text-sm font-semibold bg-white hover:shadow-md"
              >
                <FolderOpen className="w-4 h-4" /> Cambiar ubicación
              </button>
            </div>
          </div>

          <div className="bg-white border border-orange-100 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-orange-800 font-semibold">
              <HardDrive className="w-4 h-4" /> Caché de embeddings e índices
            </div>
            <div className="text-sm text-orange-800/80 break-all bg-orange-50/60 border border-orange-100 rounded-xl p-3">
              {settings.cachePath || 'Sin ruta definida'}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {renderDiskCard('Espacio disponible', disk.cache)}
              <button
                onClick={() => handleChoose('cachePath')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-200 text-orange-800 text-sm font-semibold bg-white hover:shadow-md"
              >
                <FolderOpen className="w-4 h-4" /> Cambiar ubicación
              </button>
            </div>
          </div>
        </section>

        <section className="bg-orange-50 border border-orange-100 rounded-2xl p-5 text-sm text-orange-800/80 space-y-2">
          <p className="font-semibold text-orange-900">Migraciones automáticas de índices</p>
          <p>
            Los embeddings y archivos de índice se guardan localmente en la ruta configurada. Si la versión de esquema cambia, la aplicación
            detectará el cambio y reconstruirá los índices con los datos disponibles para evitar incompatibilidades.
          </p>
          <p className="flex items-center gap-2 text-orange-700 font-semibold">
            <TriangleAlert className="w-4 h-4" /> Asegúrate de tener suficiente espacio en disco antes de reconstruir.
          </p>
        </section>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur flex items-center justify-center text-orange-800 font-semibold">
          Cargando ajustes...
        </div>
      )}
    </div>
  );
};

export default Settings;
