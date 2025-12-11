import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, User, Bot, ArrowLeft, Wifi, WifiOff, Loader2, RefreshCcw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

const StudentChat = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const selectedSubject = location.state?.subject || 'Tema libre';

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: `¡Hola! Soy Inti ☀️. Tu guía para ${selectedSubject.toLowerCase()}. ¿Qué quieres aprender hoy?`,
            isStreaming: false,
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [backendStatus, setBackendStatus] = useState({
        online: false,
        phase: 'starting',
        message: 'Comprobando backend...',
    });
    const [refreshingBackend, setRefreshingBackend] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const bridge = window.desktopBridge;
        if (!bridge) return undefined;

        const handleStatus = (status) => {
            setBackendStatus(status);
        };

        bridge.onBackendStatus(handleStatus);
        bridge.getBackendStatus().then((status) => {
            if (status) {
                setBackendStatus(status);
            }
        });

        return () => {
            bridge.removeBackendStatus();
        };
    }, []);

    const renderHighlightedText = (text, keyPrefix = 'highlight') => {
        const highlightRegex = /(\*\*[^*]+\*\*)/g;

        return text.split(highlightRegex).map((segment, index) => {
            const isHighlighted = segment.startsWith('**') && segment.endsWith('**');

            if (isHighlighted) {
                return (
                    <span
                        key={`${keyPrefix}-${index}`}
                        className="font-semibold text-orange-700 bg-orange-50 px-1 rounded"
                    >
                        {segment.slice(2, -2)}
                    </span>
                );
            }

            return <React.Fragment key={`${keyPrefix}-${index}`}>{segment}</React.Fragment>;
        });
    };

    const renderMessageContent = (msg) => {
        if (msg.role === 'suggestion') {
            return (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-blue-800">
                        <span className="text-xl">💡</span>
                        <p className="text-sm font-semibold">
                            Parece que tu pregunta es de <span className="font-bold">{msg.subject}</span>.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            navigate('/student/chat', { state: { subject: msg.subject } });
                            setMessages([{
                                role: 'assistant',
                                text: `¡Hola! He cambiado a ${msg.subject}. ¿En qué te puedo ayudar?`,
                                isStreaming: false,
                            }]);
                        }}
                        className="self-start px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm w-full md:w-auto text-center"
                    >
                        Ir a {msg.subject}
                    </button>
                    <p className="text-xs text-blue-600/70">¿Quieres cambiar de materia para una mejor respuesta?</p>
                </div>
            );
        }

        if (msg.role !== 'assistant') {
            return msg.text;
        }

        if (msg.isStreaming) {
            return renderHighlightedText(msg.text, 'stream');
        }

        const parts = [];
        const regex = /(\$\$[^$]+\$\$|\$[^$]+\$)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(msg.text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: msg.text.slice(lastIndex, match.index) });
            }

            const content = match[0];

            if (content.startsWith('$$')) {
                parts.push({ type: 'block', content: content.slice(2, -2) });
            } else {
                parts.push({ type: 'inline', content: content.slice(1, -1) });
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < msg.text.length) {
            parts.push({ type: 'text', content: msg.text.slice(lastIndex) });
        }

        return parts.map((part, index) => {
            if (part.type === 'block') {
                return <BlockMath key={`block-${index}`} math={part.content} />;
            }

            if (part.type === 'inline') {
                return <InlineMath key={`inline-${index}`} math={part.content} />;
            }

            return (
                <React.Fragment key={`text-${index}`}>
                    {renderHighlightedText(part.content, `text-${index}`)}
                </React.Fragment>
            );
        });
    };

    const appendAssistantToken = (prevMessages, token) => {
        const newMessages = [...prevMessages];
        const sentenceBoundary = /[.?!]/;

        const ensureStreamingAssistant = () => {
            const lastMessage = newMessages[newMessages.length - 1];
            if (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.isStreaming) {
                newMessages.push({ role: 'assistant', text: '', isStreaming: true });
            }
        };

        ensureStreamingAssistant();

        let lastMessageIndex = newMessages.length - 1;
        let lastMessage = { ...newMessages[lastMessageIndex] };
        let buffer = `${lastMessage.text}${token}`;

        while (true) {
            const match = buffer.match(sentenceBoundary);

            if (!match) {
                newMessages[lastMessageIndex] = { ...lastMessage, text: buffer };
                break;
            }

            const boundaryEnd = (match.index || 0) + 1;
            const completedText = buffer.slice(0, boundaryEnd).trimEnd();
            const remainder = buffer.slice(boundaryEnd).trimStart();

            newMessages[lastMessageIndex] = { ...lastMessage, text: completedText, isStreaming: false };

            const newAssistant = { role: 'assistant', text: remainder, isStreaming: true };
            newMessages.push(newAssistant);

            lastMessageIndex = newMessages.length - 1;
            lastMessage = { ...newAssistant };
            buffer = remainder;

            if (!buffer) {
                break;
            }
        }

        return newMessages;
    };

    const requestBackendRestart = async () => {
        if (!window.desktopBridge || refreshingBackend) return;
        setRefreshingBackend(true);
        try {
            await window.desktopBridge.restartBackend();
            const status = await window.desktopBridge.getBackendStatus();
            if (status) {
                setBackendStatus(status);
            }
        } finally {
            setRefreshingBackend(false);
        }
    };

    const statusColor = backendStatus.online && backendStatus.phase === 'ready'
        ? 'bg-green-500'
        : ['starting', 'preparing', 'restarting', 'loading_model'].includes(backendStatus.phase)
            ? 'bg-amber-500'
            : 'bg-red-500';

    const statusIcon = backendStatus.online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;

    const sendMessage = () => {
        if (!input.trim()) return;

        if (!backendStatus.online) {
            setMessages(prev => ([
                ...prev,
                {
                    role: 'assistant',
                    text: 'La conexión con el backend no está disponible. Espera a que se recupere o pulsa reintentar.',
                    isStreaming: false,
                }
            ]));
            return;
        }

        const userMessage = { role: 'user', text: input };
        const historyPayload = [...messages, userMessage].map(({ role, text }) => ({ role, text }));
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        // Remove any existing listeners to be safe
        window.desktopBridge.removeChatListeners();

        let detectedSubject = null;

        window.desktopBridge.onChatChunk((chunk) => {
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.token) {
                        setMessages(prev => appendAssistantToken(prev, data.token));
                    }
                    if (data.suggested_subject) {
                        detectedSubject = data.suggested_subject;
                    }
                } catch (e) {
                    console.error("Error parsing chunk", e);
                }
            }
        });

        window.desktopBridge.onChatEnd(() => {
            setLoading(false);
            window.desktopBridge.removeChatListeners();

            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessageIndex = newMessages.length - 1;

                // Cleanup partial streaming states
                if (lastMessageIndex >= 0) {
                    const lastMessage = newMessages[lastMessageIndex];
                    if (lastMessage.role === 'assistant' && lastMessage.text === '' && lastMessage.isStreaming) {
                        newMessages.pop();
                    } else {
                        newMessages[lastMessageIndex] = {
                            ...lastMessage,
                            isStreaming: false,
                        };
                    }
                }

                if (detectedSubject) {
                    newMessages.push({ role: 'suggestion', subject: detectedSubject });
                }

                return newMessages;
            });
        });

        window.desktopBridge.onChatError((error) => {
            console.error("Error sending message:", error);
            setBackendStatus(prev => ({
                ...prev,
                online: false,
                phase: 'error',
                message: error || 'Error de conexión con el backend',
            }));
            setLoading(false);
            window.desktopBridge.removeChatListeners();
            setMessages(prev => ([
                ...prev,
                {
                    role: 'assistant',
                    text: 'Lo siento, hubo un error de conexión con el escritorio.',
                    isStreaming: false,
                }
            ]));
        });

        // Trigger the stream
        window.desktopBridge.streamChat({
            message: input,
            subject: selectedSubject,
            history: historyPayload
        });
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${statusColor}`}>
                            {statusIcon}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-orange-900">{backendStatus.online ? 'En línea' : 'Sin conexión'}</span>
                            <span className="text-xs text-orange-700/70">{backendStatus.message}</span>
                        </div>
                        <button
                            onClick={requestBackendRestart}
                            disabled={refreshingBackend}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border border-orange-200 text-orange-800 hover:bg-orange-50 disabled:opacity-60"
                        >
                            <RefreshCcw className={`w-3 h-3 ${refreshingBackend ? 'animate-spin' : ''}`} /> Reiniciar
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-6 space-y-4 max-w-5xl mx-auto w-full">
                {(!backendStatus.online || backendStatus.phase !== 'ready') && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-sm">
                        <Loader2 className={`w-5 h-5 mt-0.5 ${backendStatus.phase === 'loading_model' || backendStatus.online ? 'animate-spin text-amber-600' : 'text-amber-700'}`} />
                        <div>
                            <p className="font-semibold text-orange-900">
                                {backendStatus.phase === 'loading_model' ? 'Cargando inteligencia...' : 'Estado de inicio'}
                            </p>
                            <p className="text-sm">{backendStatus.message || 'Iniciando el modelo y cargando embeddings...'}</p>
                        </div>
                    </div>
                )}

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

                            {msg.role === 'suggestion' && (
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow">
                                    <div className="text-sm font-bold">INFO</div>
                                </div>
                            )}

                            <div
                                className={`max-w-[75%] p-5 rounded-2xl text-md leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-orange-500 text-white rounded-br-none'
                                    : msg.role === 'suggestion'
                                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                                        : 'bg-white text-[#8a3b11] rounded-bl-none border border-orange-100'
                                    }`}
                            >
                                {renderMessageContent(msg)}
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
                        placeholder={
                            backendStatus.phase === 'loading_model'
                                ? "Espera un momento, estoy preparando mi cerebro..."
                                : `Escribe tu pregunta sobre ${selectedSubject.toLowerCase()} aquí...`
                        }
                        disabled={backendStatus.phase === 'loading_model' || loading || !backendStatus.online}
                        className="flex-1 p-4 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg bg-white/80 disabled:opacity-70 disabled:bg-gray-50"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !backendStatus.online || backendStatus.phase === 'loading_model'}
                        className="p-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-xl hover:from-orange-600 hover:to-amber-500 disabled:opacity-50 transition-colors shadow-md"
                    >
                        {backendStatus.phase === 'loading_model' ? (
                            <Loader2 className="animate-spin w-6 h-6" />
                        ) : (
                            <Send size={24} />
                        )}
                    </button>
                </div>
                <p className="text-center text-xs text-orange-700/70 mt-2">IntiLearn puede cometer errores. Verifica la información importante.</p>
            </div>
        </div >
    );
};

export default StudentChat;
