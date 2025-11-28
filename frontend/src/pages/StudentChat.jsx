import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, User, Bot } from 'lucide-react';

const StudentChat = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: '¡Hola! Soy Inti ☀️. Tu asistente educativo oficial. ¿En qué puedo ayudarte hoy?' }
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
                body: JSON.stringify({ message: input })
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
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
            {/* Government Header */}
            <header className="bg-[#003366] p-4 shadow-md flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-full">
                        <span className="text-2xl">🇪🇨</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-wide">MINISTERIO DE EDUCACIÓN</h1>
                        <p className="text-xs text-gray-300 tracking-widest uppercase">Plataforma IntiLearnAI</p>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-5xl mx-auto w-full">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-10 h-10 rounded-full bg-[#003366] flex items-center justify-center text-white shrink-0">
                                <Bot size={20} />
                            </div>
                        )}

                        <div
                            className={`max-w-[75%] p-5 rounded-lg text-md leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                                }`}
                        >
                            {msg.text}
                        </div>

                        {msg.role === 'user' && (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 shrink-0">
                                <User size={20} />
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-gray-200 shadow-lg">
                <div className="flex gap-4 max-w-4xl mx-auto">
                    <button className="p-4 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                        <Mic size={24} />
                    </button>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Escribe tu pregunta aquí..."
                        className="flex-1 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003366] text-lg"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading}
                        className="p-4 bg-[#003366] text-white rounded-lg hover:bg-[#002244] disabled:opacity-50 transition-colors shadow-md"
                    >
                        <Send size={24} />
                    </button>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">IntiLearnAI puede cometer errores. Verifica la información importante.</p>
            </div>
        </div>
    );
};

export default StudentChat;
