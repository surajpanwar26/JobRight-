import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as IChatMessage, MessageRole } from '../types';
import { User, Sparkles, Bot, BrainCircuit } from 'lucide-react';

interface ChatMessageProps {
  message: IChatMessage;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;
  const isThinking = message.isThinking;

  return (
    <div className={`flex gap-4 p-4 md:p-6 ${isUser ? 'bg-white' : 'bg-gray-50'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-gray-200 text-gray-600' : 'bg-brand-600 text-white'
      }`}>
        {isUser ? <User size={18} /> : (isThinking ? <BrainCircuit size={18} /> : <Bot size={18} />)}
      </div>
      
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">
            {isUser ? 'You' : 'JobRight AI'}
          </span>
          {!isUser && isThinking && (
             <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
               <Sparkles size={10} />
               Deep Thought
             </span>
          )}
        </div>
        
        <div className="prose prose-sm max-w-none text-gray-800 prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-gray-100">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;