import { useEffect, useRef } from 'react';
import Message from './Message';
import Transcript from './Transcript';

export default function ConversationPanel({ messages, partialTranscript }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partialTranscript]);

  return (
    <div className="flex flex-col flex-1 overflow-y-auto min-h-0 px-4 py-4 gap-3">
      {messages.length === 0 && !partialTranscript ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-slate-500 text-sm tracking-wide">
            Speak naturally. VERA is ready.
          </p>
        </div>
      ) : (
        <>
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} />
          ))}
          {partialTranscript && <Transcript partialTranscript={partialTranscript} />}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
