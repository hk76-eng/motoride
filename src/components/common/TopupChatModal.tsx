import React, { useState, useEffect, useRef } from 'react';
import { X, Send, UploadCloud, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { TopupDepositRequest, TopupChatMessage } from '../../types/motoride';
import { motorideApi } from '../../services/motorideApi';
import { realtimeSync } from '../../services/realtimeSync';
import { uploadMediaToSupabase, compressImageToDataUrl } from '../../lib/supabaseStorage';

interface TopupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositRequest: TopupDepositRequest;
  currentUserId: string;
  currentUserRole: 'admin' | 'captain';
  currentUserName: string;
  onStatusUpdated?: () => void;
}

export const TopupChatModal: React.FC<TopupChatModalProps> = ({
  isOpen,
  onClose,
  depositRequest,
  currentUserId,
  currentUserRole,
  currentUserName,
  onStatusUpdated,
}) => {
  const [messages, setMessages] = useState<TopupChatMessage[]>([]);
  const [text, setText] = useState<string>('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isSending, setIsProcessing] = useState<boolean>(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleAttachmentUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingAttachment(true);
    try {
      // 1. Instant local preview
      const localDataUrl = await compressImageToDataUrl(file, 1200, 1200, 0.85);
      if (localDataUrl) setAttachment(localDataUrl);

      // 2. Upload to Supabase Storage
      const fileName = `chat_${depositRequest.id}_${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const cdnUrl = await uploadMediaToSupabase(file, fileName, 'payments');
      if (cdnUrl) {
        setAttachment(cdnUrl);
      }
    } catch (err) {
      console.warn('Chat upload error:', err);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  useEffect(() => {
    if (isOpen && depositRequest?.id) {
      loadMessages();
    }
  }, [isOpen, depositRequest?.id]);

  useEffect(() => {
    if (!isOpen || !depositRequest?.id) return;

    const handleNewMessage = (data: any) => {
      if (data?.request_id === depositRequest.id && data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    };

    realtimeSync.on('TOPUP_CHAT_MESSAGE_RECEIVED', handleNewMessage);
    const interval = setInterval(loadMessages, 3000);

    return () => {
      realtimeSync.off('TOPUP_CHAT_MESSAGE_RECEIVED', handleNewMessage);
      clearInterval(interval);
    };
  }, [isOpen, depositRequest?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const list = await motorideApi.getTopupChatMessages(depositRequest.id);
      setMessages(list);
    } catch {}
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() && !attachment) return;

    setIsProcessing(true);
    try {
      const newMsg = await motorideApi.sendTopupChatMessage(depositRequest.id, {
        sender_id: currentUserId,
        sender_role: currentUserRole,
        sender_name: currentUserName,
        message: text.trim(),
        image_url: attachment || undefined,
      });

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg]);
        setText('');
        setAttachment(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !depositRequest) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-[85vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                  Top-Up Verification Chat
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  depositRequest.status === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : depositRequest.status === 'rejected'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                  {depositRequest.status === 'approved'
                    ? '✅ Approved & Credited'
                    : depositRequest.status === 'rejected'
                    ? '❌ Rejected'
                    : '⏳ Pending Verification'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Amount: <span className="font-extrabold text-amber-400 font-mono-num">₹{depositRequest.amount}</span> • UTR: {depositRequest.utr_number || 'N/A'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-3.5 scrollbar-thin bg-slate-950/50">
          {/* Initial Request Summary Card inside chat */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 flex flex-col gap-3 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              OFFICIAL PAYMENT PROOF SUBMITTED BY {depositRequest.captain_name.toUpperCase()}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-amber-400 font-mono-num">
                ₹{depositRequest.amount.toFixed(2)}
              </span>
              {depositRequest.utr_number && (
                <span className="text-xs font-mono text-slate-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                  UTR: {depositRequest.utr_number}
                </span>
              )}
            </div>

            {depositRequest.payment_slip_url && (
              <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/30 shadow-inner">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-amber-300 font-extrabold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                    <span>Uploaded Payment Slip Proof (Admin Verification)</span>
                  </span>
                  {depositRequest.payment_slip_url.startsWith('http') ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold flex items-center gap-1">
                      <UploadCloud className="w-3 h-3 text-emerald-400" />
                      <span>Supabase Storage</span>
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold">
                      Local Proof
                    </span>
                  )}
                </div>
                <div className="relative group/proof inline-block">
                  <img
                    src={depositRequest.payment_slip_url}
                    alt="Payment Slip Proof"
                    onClick={() => setPreviewImage(depositRequest.payment_slip_url || null)}
                    className="max-w-xs max-h-60 object-cover rounded-2xl border border-amber-500/40 cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                  />
                  <div
                    onClick={() => setPreviewImage(depositRequest.payment_slip_url || null)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/proof:opacity-100 rounded-2xl flex items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer"
                  >
                    Click to Enlarge
                  </div>
                </div>
              </div>
            )}
          </div>

          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId || (currentUserRole === 'admin' && msg.sender_role === 'admin');
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium px-1">
                  <span className="font-bold text-amber-300">{msg.sender_name}</span>
                  <span>({msg.sender_role})</span>
                  <span>•</span>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl flex flex-col gap-2 shadow-md ${
                    isMe
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-white rounded-tl-none'
                  }`}
                >
                  {msg.message && <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>}

                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Attachment"
                      onClick={() => setPreviewImage(msg.image_url || null)}
                      className="max-w-xs max-h-60 rounded-xl border border-black/20 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Preview Box before sending */}
        {attachment && (
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src={attachment} alt="Upload preview" className="w-10 h-10 rounded-lg object-cover border border-amber-500/40" />
              <div className="flex flex-col">
                <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
                  {attachment.startsWith('http') && <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{attachment.startsWith('http') ? 'Uploaded to Supabase Cloud' : 'Image Attached'}</span>
                </span>
                <span className="text-[10px] text-slate-400">Attached to verification chat</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
            >
              Remove
            </button>
          </div>
        )}

        {/* Form Input Footer */}
        <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <label className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer transition-all shrink-0 relative" title="Upload screenshot to Supabase Storage">
            {isUploadingAttachment ? (
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5 text-emerald-400" />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={isUploadingAttachment}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAttachmentUpload(file);
              }}
            />
          </label>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message or upload payment slip proof..."
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500/50"
          />

          <button
            type="submit"
            disabled={isSending || (!text.trim() && !attachment)}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 shrink-0 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

      </div>

      {/* Full Resolution Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[2200] bg-black/95 flex flex-col items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-3 rounded-2xl bg-slate-800 text-white font-bold cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={previewImage} alt="Full resolution proof" className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/20 shadow-2xl" />
        </div>
      )}
    </div>
  );
};
