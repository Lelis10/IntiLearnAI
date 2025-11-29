import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sparkles } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white text-[#9c3f0f] font-sans">
      <header className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
            ☀️
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-orange-700/70 font-semibold">Plataforma Educativa</p>
            <h1 className="text-3xl font-black text-[#9c3f0f]">IntiLearn</h1>
            <p className="text-sm text-orange-700/70">El sol que ilumina tu aprendizaje</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-orange-800/80 bg-white border border-orange-100 rounded-full px-4 py-2 shadow-sm">
          <Sparkles className="w-4 h-4 text-orange-500" />
          Español Latinoamérica
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-orange-100 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-10 space-y-6 bg-gradient-to-br from-orange-100/80 via-white to-amber-50">
              <p className="inline-flex items-center gap-2 bg-white text-orange-700 px-3 py-1 rounded-full text-xs font-semibold shadow-sm border border-orange-100">
                ✨ Nueva experiencia Inti
              </p>
              <h2 className="text-4xl font-black leading-tight text-[#9c3f0f]">Explora, pregunta y aprende con calor de sol.</h2>
              <p className="text-orange-800/80 text-lg leading-relaxed">
                Ingresa como estudiante para escoger la materia que deseas aprender y conversar con Inti.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-orange-800/80">
                <span className="px-4 py-2 rounded-full bg-white border border-orange-200 shadow-sm">Respuesta en español</span>
                <span className="px-4 py-2 rounded-full bg-white border border-orange-200 shadow-sm">Diseño inspirado en Inti</span>
                <span className="px-4 py-2 rounded-full bg-white border border-orange-200 shadow-sm">IA educativa</span>
              </div>
            </div>

            <div className="p-10 bg-white space-y-6">
              <div className="grid gap-4">
                <button
                  onClick={() => navigate('/student')}
                  className="w-full flex items-center justify-between gap-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-lg font-semibold px-5 py-5 rounded-xl transition-all shadow-lg hover:translate-y-[-2px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-full">
                      <User size={26} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm uppercase tracking-wide text-white/80">Perfil</p>
                      <p className="text-2xl font-bold">Estudiante</p>
                      <p className="text-xs text-white/90">Elige materia, conversa y recibe guías claras.</p>
                    </div>
                  </div>
                  <span className="text-3xl">→</span>
                </button>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50 to-white p-5 text-sm text-orange-800/80 shadow-inner">
                <p className="font-semibold text-[#9c3f0f] mb-1">Mensaje de Inti</p>
                <p>Estoy aquí para ayudarte a aprender con energía y claridad. ¡Empecemos! 🔆</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-orange-800/70 pb-8">
        <p>© 2025 IntiLearn - Inspirado en la luz del conocimiento.</p>
      </footer>
    </div>
  );
};

export default Login;
