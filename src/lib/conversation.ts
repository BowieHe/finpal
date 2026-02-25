import { Conversation, Message } from '@/types/conversation';
import { generateId } from '@/utils/format';

const CONVERSATIONS_KEY = 'finpal_conversations';
const CURRENT_CONVERSATION_KEY = 'finpal_current_conversation';

export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    if (stored) {
      const conversations = JSON.parse(stored);
      return Array.isArray(conversations) ? conversations : [];
    }
  } catch (error) {
    console.error('Failed to read conversations from localStorage:', error);
  }

  return [];
}

function saveConversations(conversations: Conversation[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('Failed to save conversations to localStorage:', error);
  }
}

function getCurrentConversationId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(CURRENT_CONVERSATION_KEY);
  } catch (error) {
    console.error('Failed to read current conversation ID:', error);
    return null;
  }
}

export function setCurrentConversationId(id: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (id) {
      localStorage.setItem(CURRENT_CONVERSATION_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_CONVERSATION_KEY);
    }
  } catch (error) {
    console.error('Failed to save current conversation ID:', error);
  }
}

export function getCurrentConversation(): Conversation | null {
  const currentId = getCurrentConversationId();
  if (!currentId) {
    return null;
  }

  const conversations = getConversations();
  return conversations.find(c => c.id === currentId) || null;
}

function createConversation(title: string, messages: Message[] = []): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title,
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

export function createNewConversation(): string {
  const conversations = getConversations();
  const newConversation = createConversation('新对话');
  conversations.unshift(newConversation);
  saveConversations(conversations);
  setCurrentConversationId(newConversation.id);
  return newConversation.id;
}

export function deleteConversation(id: string): void {
  const conversations = getConversations();
  const filtered = conversations.filter(c => c.id !== id);
  saveConversations(filtered);

  const currentId = getCurrentConversationId();
  if (currentId === id) {
    setCurrentConversationId(null);
  }
}

export function addMessageToConversation(conversationId: string, message: Message): void {
  const conversations = getConversations();
  const index = conversations.findIndex(c => c.id === conversationId);

  if (index !== -1) {
    const conversation = conversations[index];
    const updatedMessages = [...conversation.messages, message];

    conversations[index] = {
      ...conversation,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    saveConversations(conversations);
  }
}

export function updateConversationTitle(conversationId: string, question: string): void {
  const conversations = getConversations();
  const index = conversations.findIndex(c => c.id === conversationId);

  if (index !== -1) {
    const maxLength = 30;
    let title = question.trim();
    
    if (title.length > maxLength) {
      title = title.substring(0, maxLength) + '...';
    }

    conversations[index] = {
      ...conversations[index],
      title,
      updatedAt: Date.now(),
    };

    saveConversations(conversations);
  }
}
