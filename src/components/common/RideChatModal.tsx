import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, ShieldCheck, User } from 'lucide-react';
import { MotorideRide, RideMessage } from '../../types/motoride';
import { motorideApi } from '../../services/motorideApi';
import { realtimeSync } from '../../services/realtimeSync';

interface RideChatModalProps {
  ride: MotorideRide;
  currentUserId: string;
  currentUserRole: 'passenger' | 'captain';
  currentUserName: string;
  onClose?: () => void;
}

export const RideChatModal: React.FC<RideChatModalProps> = ({
  ride,
  currentUserId,
  currentUserRole,
  currentUserName,
  onClose,
}) => {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const list = await motorideApi.getRideMessages(ride.id);
      setMessages(list);
    } catch (err) {
      console.warn('Failed to load chat messages:', err);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);

    const unsub = realtimeSync.on('RIDE_MESSAGE_RECEIVED', (payload: RideMessage) => {
      if (payload && payload.ride_id === ride.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [ride.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const sent = await motorideApi.sendRideMessage(ride.id, {
        sender_id: currentUserId,
        sender_role: currentUserRole,
        sender_name: currentUserName,
        message: text,
      });
      if (sent && !messages.some((m) => m.id === sent.id)) {
        setMessages((prev) => [...prev, sent]);
      }
    } catch (err) {
      console.warn('Failed to send message:', err);
      setInputText(text); // restore on error
    } finally {
      setIsSending(false);
    }
  };

  const otherPartyName = currentUserRole === 'captain' ? (ride.passenger_name || 'Passenger') : (ride.captain_name || 'Captain');

  return (
    <div className="flex flex-col h-full bg-slate-950/95 backdrop-blur-2xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Chat with {otherPartyName}
            </h4>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Secure In-Ride Connection ({ride.ride_code})
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[220px] max-h-[340px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6 text-slate-400 text-xs">
            <ShieldCheck className="w-8 h-8 text-emerald-400/60 mb-2 stroke-[1.5]" />
            <p className="font-semibold text-slate-300">No messages yet</p>
          </div>
        ) : (
          messages.map((m, index) => {
            const isMe = m.sender_id === currentUserId || m.sender_role === currentUserRole;
            return (
              <div
                key={`${m.id}-${index}`}
                className={`flex flex-col max-w-[82%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <span className="text-[9px] text-slate-400 px-1 mb-0.5">
                  {m.sender_name} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    isMe
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-none shadow-md'
                      : 'bg-white/10 text-white border border-white/15 rounded-tl-none'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white/5 border-t border-white/10 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${otherPartyName}...`}
          className="flex-1 bg-black/50 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold transition-all shrink-0 cursor-pointer shadow-md"
          title="Send message"
        >
          <Send className="w-4 h-4 stroke-[2.5]" />
        </button>
      </form>
    </div>
  );
};
