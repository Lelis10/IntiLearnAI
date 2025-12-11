import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FlaskConical, Languages, Globe2, Sparkles, Atom, Download, Settings } from 'lucide-react';

const subjects = [
  {
    title: 'Matematicas',
    description: 'Álgebra, geometría, cálculo y razonamiento lógico con ejemplos visuales.',
    icon: <Atom className="w-7 h-7" />,
    accent: 'from-orange-500/20 to-orange-600/10',
  },
  {
    title: 'Fisica',
    description: 'Mecánica, electricidad y ondas explicadas con experimentos guiados.',
    icon: <FlaskConical className="w-7 h-7" />,
    accent: 'from-amber-500/20 to-amber-600/10',
  },
  {
    title: 'Lengua',
    description: 'Comprensión lectora, gramática y redacción con ejercicios prácticos.',
    icon: <BookOpen className="w-7 h-7" />,
    accent: 'from-yellow-500/20 to-orange-500/10',
  },
  {
    title: 'Historia',
    description: 'Líneas de tiempo, personajes claves y contexto cultural de cada época.',
    icon: <Globe2 className="w-7 h-7" />,
    accent: 'from-orange-400/20 to-amber-400/10',
  },
  {
    title: 'Filosofia',
    description: 'Conceptos, autores y debates para formar pensamiento crítico.',
    icon: <Sparkles className="w-7 h-7" />,
    accent: 'from-amber-400/20 to-orange-300/10',
  },
  {
    title: 'Ingles',
    description: 'Vocabulario, conversación y gramática con frases del día a día.',
    icon: <Languages className="w-7 h-7" />,
    accent: 'from-orange-500/20 to-yellow-500/10',
  },
];

const StudentSubjects = () => {
  const navigate = useNavigate();
  const [modelStatus, setModelStatus] = useState({ exists: true, sizeBytes: 0, info: null });
  const [downloadState, setDownloadState] = useState({ percent: 0, inProgress: false, error: null });

  useEffect(() => {
    const desktopBridge = window.desktopBridge;
    if (!desktopBridge) return undefined;

    const loadStatus = async () => {
      const status = await desktopBridge.getModelStatus();
      setModelStatus(status);
      if (!status.exists) {
        setDownloadState((prev) => ({ ...prev, inProgress: false, error: null }));
      }
    };

    const handleProgress = (payload) => {
      if (payload?.missing) {
        setModelStatus((prev) => ({ ...prev, exists: false }));
      }
      if (payload?.error) {
        setDownloadState({ percent: 0, inProgress: false, error: payload.error });
        return;
      }
      setDownloadState((prev) => ({
        ...prev,
        inProgress: payload.percent !== undefined,
        percent: payload.percent ?? prev.percent,
        error: null,
      }));
      if (payload.percent === 100) {
        loadStatus();
      }
    };

    desktopBridge.onModelDownloadProgress(handleProgress);
    loadStatus();

    return () => {
      desktopBridge.removeModelDownloadProgress();
    };
  }, []);

  const handleSelect = (subject) => {
    navigate('/student/chat', { state: { subject } });
  };

  const handleDownload = async () => {
    const desktopBridge = window.desktopBridge;
    if (!desktopBridge) return;
    setDownloadState({ percent: 0, inProgress: true, error: null });
    const result = await desktopBridge.downloadModel();
    if (!result.ok) {
      setDownloadState({ percent: 0, inProgress: false, error: result.error });
      return;
    }
    setDownloadState({ percent: 100, inProgress: false, error: null });
    const status = await desktopBridge.getModelStatus();
    setModelStatus(status);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** order).toFixed(1)} ${units[order]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white text-[#8a3b11]">
      <header className="bg-white/70 backdrop-blur shadow-sm border-b border-orange-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              ☀️
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-orange-700/70 font-semibold">Plataforma</p>
              <h1 className="text-2xl font-extrabold text-[#9c3f0f]">IntiLearn</h1>
              <p className="text-xs text-orange-700/70">El sol que ilumina tu aprendizaje</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="text-sm font-semibold text-orange-900/80 border border-orange-200 rounded-full px-4 py-2 bg-white hover:shadow-md transition inline-flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Ajustes
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-sm font-semibold text-orange-900/80 border border-orange-200 rounded-full px-4 py-2 bg-white hover:shadow-md transition"
            >
              Cambiar perfil
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {!modelStatus.exists && (
          <div className="mb-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3 text-orange-900 font-semibold">
              <Download className="w-4 h-4" /> Modelo compacto pendiente de descarga
            </div>
            <p className="text-sm text-orange-800/80">
              Descarga automática del modelo cuantizado para usar la app sin conexión. Tamaño aproximado: {formatSize(modelStatus.sizeBytes || 2400 * 1024 * 1024)}.
            </p>
            {downloadState.error && (
              <p className="text-sm text-red-700">{downloadState.error}</p>
            )}
            {downloadState.inProgress && (
              <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
                <div className="bg-orange-500 h-2 transition-all" style={{ width: `${downloadState.percent}%` }} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={downloadState.inProgress}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-sm disabled:opacity-70"
              >
                <Download className="w-4 h-4" /> {downloadState.inProgress ? 'Descargando...' : 'Descargar ahora'}
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-200 text-orange-800 text-sm font-semibold bg-white hover:shadow-md"
              >
                <Settings className="w-4 h-4" /> Ajustar ubicación
              </button>
            </div>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-orange-100 overflow-hidden">
          <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center bg-gradient-to-r from-orange-100/80 via-amber-50 to-white">
            <div className="lg:col-span-2 space-y-4">
              <p className="inline-flex items-center gap-2 bg-white text-orange-700 px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-orange-100">
                ✨ Nueva experiencia
              </p>
              <h2 className="text-4xl font-black text-[#9c3f0f] leading-tight">Elige tu camino de aprendizaje</h2>
              <p className="text-lg text-orange-800/80 leading-relaxed">
                Selecciona la materia que quieres explorar y crea una conversación personalizada con Inti.
                Todas las indicaciones, ejemplos y recursos se mostrarán en español para que puedas avanzar con confianza.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-orange-800/70">
                <span className="px-4 py-2 rounded-full bg-white border border-orange-200 shadow-sm">Guiado por IA</span>
                <span className="px-4 py-2 rounded-full bg-white border border-orange-200 shadow-sm">Ejemplos prácticos</span>
                <span className="px-4 py-2 rounded-full bg-white border border-orange-200 shadow-sm">Estilo del sol Inti</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-200/40 to-transparent rounded-3xl blur-3xl"></div>
              <div className="relative bg-white rounded-2xl border border-orange-100 shadow-lg p-6 flex flex-col items-center text-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-3xl text-white shadow-md">
                  🌞
                </div>
                <p className="text-xl font-semibold text-[#9c3f0f]">Conexión instantánea</p>
                <p className="text-sm text-orange-800/70">Recibe respuestas amigables, claras y alineadas con el plan educativo.</p>
              </div>
            </div>
          </div>

          <div className="p-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 bg-white">
            {subjects.map((subject) => (
              <button
                key={subject.title}
                onClick={() => handleSelect(subject.title)}
                className="group rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-white to-orange-50 hover:from-orange-50 hover:to-amber-50 shadow-sm hover:shadow-lg transition p-6 text-left flex flex-col gap-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subject.accent} flex items-center justify-center text-orange-700 shadow-inner`}>
                  {subject.icon}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-orange-700/80 uppercase tracking-wide">Materias</p>
                  <h3 className="text-2xl font-bold text-[#9c3f0f] group-hover:text-orange-700 transition">{subject.title}</h3>
                  <p className="text-sm text-orange-800/80 leading-relaxed">{subject.description}</p>
                </div>
                <span className="text-sm font-semibold text-orange-700 group-hover:translate-x-1 transition inline-flex items-center gap-2">
                  Empezar ahora <span aria-hidden>→</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentSubjects;
