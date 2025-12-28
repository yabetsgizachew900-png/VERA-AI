
export enum VoiceName {
  ZEPHYR = 'Zephyr',
  PUCK = 'Puck',
  CHARON = 'Charon',
  KORE = 'Kore',
  FENRIR = 'Fenrir',
  ROBIN = 'Robin'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  sources?: GroundingSource[];
  isSpeaking?: boolean;
  isDeepThinking?: boolean;
  thought?: string;
}

export interface SessionStatus {
  isActive: boolean;
  isConnecting: boolean;
  error: string | null;
}