import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FlaskConical, Languages, Globe2, Sparkles, Atom } from 'lucide-react';

const subjects = [
  {
    title: 'Matemáticas',
    description: 'Álgebra, geometría, cálculo y razonamiento lógico con ejemplos visuales.',
    icon: <Atom className="w-7 h-7" />,
    accent: 'from-orange-500/20 to-orange-600/10',
  },
  {
    title: 'Física',
    description: 'Mecánica, electricidad y ondas explicadas con experimentos guiados.',
    icon: <FlaskConical className="w-7 h-7" />,
    accent: 'from-amber-500/20 to-amber-600/10',
  },
  {
    title: 'Lengua y Literatura',
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
    title: 'Filosofía',
    description: 'Conceptos, autores y debates para formar pensamiento crítico.',
    icon: <Sparkles className="w-7 h-7" />,
    accent: 'from-amber-400/20 to-orange-300/10',
  },
  {
    title: 'Inglés',
    description: 'Vocabulario, conversación y gramática con frases del día a día.',
    icon: <Languages className="w-7 h-7" />,
    accent: 'from-orange-500/20 to-yellow-500/10',
  },
];

const StudentSubjects = () => {
  const navigate = useNavigate();

  const handleSelect = (subject) => {
    navigate('/student/chat', { state: { subject } });
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
          <button
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-orange-900/80 border border-orange-200 rounded-full px-4 py-2 bg-white hover:shadow-md transition"
          >
            Cambiar perfil
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
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
