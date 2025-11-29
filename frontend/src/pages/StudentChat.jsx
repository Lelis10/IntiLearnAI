import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, User, Bot, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const StudentChat = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const selectedSubject = location.state?.subject || 'Tema libre';

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: `¡Hola! Soy Inti ☀️. Tu guía para ${selectedSubject.toLowerCase()}. ¿Qué quieres aprender hoy?`,
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        // Create a placeholder for the bot response
        setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

        try {
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: input, subject: selectedSubject })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.token) {
                            setMessages(prev => {
                                const newMessages = [...prev];
                                const lastMessageIndex = newMessages.length - 1;
                                const lastMessage = { ...newMessages[lastMessageIndex] };
                                lastMessage.text += data.token;
                                newMessages[lastMessageIndex] = lastMessage;
                                return newMessages;
                            });
                        }
                    } catch (e) {
                        console.error("Error parsing chunk", e);
                    }
                }
            }

        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = 'Lo siento, hubo un error de conexión.';
                return newMessages;
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white flex flex-col font-sans text-[#8a3b11]">
            <header className="bg-white/80 backdrop-blur border-b border-orange-100 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/student')}
                            className="p-2 rounded-full border border-orange-200 text-orange-700 hover:bg-orange-50 transition"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold text-lg shadow">
                            ☀️
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-orange-700/70 font-semibold">IntiLearn</p>
                            <h1 className="text-lg font-bold text-[#9c3f0f]">Chat educativo en español</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white border border-orange-100 rounded-full px-4 py-2 text-sm shadow-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Conectado | {selectedSubject}
                    </div>
                </div>
            </header>

            <div className="flex-1 p-6 space-y-4 max-w-5xl mx-auto w-full">
                <div className="bg-white/80 backdrop-blur rounded-2xl border border-orange-100 shadow-sm px-5 py-3 text-sm text-orange-800/80 flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <p className="font-semibold text-[#9c3f0f]">Tema elegido: {selectedSubject}</p>
                        <p>Comparte tu duda, un ejercicio o un texto. Inti responderá con ejemplos y pasos claros.</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                        <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-100">Respuestas en español</span>
                        <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-100">Explicaciones breves</span>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-white rounded-2xl border border-orange-100 shadow-inner max-h-[60vh]">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shrink-0 shadow">
                                    <Bot size={20} />
                                </div>
                            )}

                            <div
                                className={`max-w-[75%] p-5 rounded-2xl text-md leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-orange-500 text-white rounded-br-none'
                                    : 'bg-white text-[#8a3b11] rounded-bl-none border border-orange-100'
                                    }`}
                            >
                                {msg.text}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 border border-orange-200">
                                    <User size={20} />
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="p-6 bg-white/90 backdrop-blur border-t border-orange-100 shadow-lg">
                <div className="flex gap-4 max-w-4xl mx-auto">
                    <button className="p-4 bg-orange-50 rounded-xl text-orange-700 hover:bg-orange-100 transition-colors border border-orange-100">
                        <Mic size={24} />
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder={`Escribe tu pregunta sobre ${selectedSubject.toLowerCase()} aquí...`}
                        className="flex-1 p-4 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg bg-white/80"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading}
                        className="p-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-xl hover:from-orange-600 hover:to-amber-500 disabled:opacity-50 transition-colors shadow-md"
                    >
                        <Send size={24} />
                    </button>
                </div>
                <p className="text-center text-xs text-orange-700/70 mt-2">IntiLearn puede cometer errores. Verifica la información importante.</p>
            </div>
        </div>
    );
};

export default StudentChat;
