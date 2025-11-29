import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TeacherDashboard = () => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState(null);
    const [token, setToken] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const storedToken = localStorage.getItem('authToken');
        if (!storedToken) {
            navigate('/');
        } else {
            setToken(storedToken);
        }
    }, [navigate]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStatus(null);
    };

    const handleUpload = async () => {
        if (!file || !token) {
            navigate('/');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post('http://localhost:8000/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-Auth-Token': token,
                },
            });
            setStatus('success');
            setFile(null);
        } catch (error) {
            console.error("Upload failed:", error);
            setStatus('error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
            {/* Government Header */}
            <header className="bg-[#003366] p-4 shadow-md flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-full">
                        <span className="text-2xl">🇪🇨</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-wide">MINISTERIO DE EDUCACIÓN</h1>
                        <p className="text-xs text-gray-300 tracking-widest uppercase">Panel Docente</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        localStorage.removeItem('authToken');
                        navigate('/');
                    }}
                    className="text-white hover:text-gray-200 flex items-center gap-2 text-sm"
                >
                    <LogOut size={18} /> Salir
                </button>
            </header>

            <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
                <h1 className="text-3xl font-bold text-[#003366] mb-8 flex items-center gap-2 border-b-2 border-gray-200 pb-4">
                    <FileText className="text-[#0055A4]" />
                    Gestión de Recursos Educativos
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Upload Section */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-lg shadow-md border-t-4 border-[#0055A4]">
                        <h2 className="text-xl font-semibold mb-6 text-gray-800">Subir Nuevo Material</h2>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition-colors bg-gray-50/50">
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                accept=".pdf,.txt"
                            />
                            <label
                                htmlFor="file-upload"
                                className="cursor-pointer flex flex-col items-center gap-4"
                            >
                                <div className="p-5 bg-blue-100 rounded-full text-[#0055A4]">
                                    <Upload size={40} />
                                </div>
                                <div>
                                    <p className="text-lg font-medium text-gray-700">
                                        {file ? file.name : "Seleccionar archivo PDF o TXT"}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">Arrastre y suelte o haga clic para buscar</p>
                                </div>
                            </label>
                        </div>

                        {file && (
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="mt-6 w-full bg-[#0055A4] text-white py-3 rounded-lg font-semibold hover:bg-[#003366] disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {uploading ? "Procesando e Indexando..." : "Cargar al Sistema"}
                            </button>
                        )}

                        {status === 'success' && (
                            <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-3 border border-green-200">
                                <CheckCircle size={24} />
                                <div>
                                    <p className="font-semibold">¡Carga Exitosa!</p>
                                    <p className="text-sm">El material ha sido indexado y está listo para ser consultado por los estudiantes.</p>
                                </div>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-lg flex items-center gap-3 border border-red-200">
                                <AlertCircle size={24} />
                                <div>
                                    <p className="font-semibold">Error en la Carga</p>
                                    <p className="text-sm">Verifique la conexión con el servidor e intente nuevamente.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Stats */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Estado del Sistema</h3>
                            <p className="text-green-600 font-bold mt-2 flex items-center gap-2 text-lg">
                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                Operativo
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-[#003366]">
                            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Documentos Activos</h3>
                            <p className="text-4xl font-bold text-[#003366] mt-2">1</p>
                            <p className="text-xs text-gray-400 mt-1">Actualizado hoy</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
