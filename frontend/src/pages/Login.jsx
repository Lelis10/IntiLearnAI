import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, GraduationCap } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      {/* Government Header */}
      <header className="bg-[#003366] p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="bg-white p-2 rounded-full">
            <span className="text-3xl">🇪🇨</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">MINISTERIO DE EDUCACIÓN</h1>
            <p className="text-sm text-gray-300 tracking-widest uppercase">Plataforma IntiLearnAI</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-lg shadow-lg max-w-lg w-full text-center border-t-4 border-[#003366]">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Bienvenido</h2>
          <p className="text-gray-500 mb-10">Seleccione su perfil para ingresar al sistema.</p>

          <div className="space-y-6">
            <button
              onClick={() => navigate('/student')}
              className="w-full flex items-center justify-center gap-4 bg-[#0055A4] hover:bg-[#003366] text-white text-lg font-semibold py-5 rounded-lg transition-all shadow-md group"
            >
              <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors">
                <User size={28} />
              </div>
              Estudiante
            </button>

            <button
              onClick={() => navigate('/teacher')}
              className="w-full flex items-center justify-center gap-4 bg-white border-2 border-[#003366] text-[#003366] hover:bg-gray-50 text-lg font-semibold py-5 rounded-lg transition-all shadow-sm group"
            >
              <div className="bg-[#003366]/10 p-2 rounded-full group-hover:bg-[#003366]/20 transition-colors">
                <GraduationCap size={28} />
              </div>
              Docente / Administrativo
            </button>
          </div>
        </div>
      </div>

      <footer className="bg-gray-800 text-white p-4 text-center text-sm">
        <p>© 2025 Ministerio de Educación del Ecuador - Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default Login;
