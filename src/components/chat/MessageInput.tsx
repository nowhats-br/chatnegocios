import React, { useRef } from 'react';
import { Paperclip, Mic, Send, Smile, MessageCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onQuickResponseClick: () => void;
  onFileSelect: (file: File) => void;
  setText: (text: string) => void;
  text: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onQuickResponseClick, onFileSelect, text, setText }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="p-4 bg-card/60 backdrop-blur-sm border-t">
      <form onSubmit={handleSubmit} className="flex items-center bg-secondary rounded-lg px-2 py-1">
        <Button type="button" variant="ghost" size="icon"><Smile className="h-5 w-5 text-muted-foreground"/></Button>
        
        <Button type="button" variant="ghost" size="icon" onClick={onQuickResponseClick}>
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
        </Button>
        
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            id="file-upload"
        />
        <Button asChild type="button" variant="ghost" size="icon" className="cursor-pointer">
            <label htmlFor="file-upload">
                <Paperclip className="h-5 w-5 text-muted-foreground"/>
                <span className="sr-only">Anexar arquivo</span>
            </label>
        </Button>

        <input
          type="text"
          placeholder="Digite uma mensagem"
          className="flex-1 bg-transparent px-4 py-3 focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              handleSubmit(e);
            }
          }}
        />
        <Button type="button" variant="ghost" size="icon"><Mic className="h-5 w-5 text-muted-foreground"/></Button>
        <Button type="submit" size="icon" className="ml-2 bg-primary hover:bg-primary/90 rounded-full" disabled={!text.trim()}>
          <Send className="h-5 w-5"/>
        </Button>
      </form>
    </div>
  );
};

export default MessageInput;
