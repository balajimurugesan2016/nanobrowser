export { COMPUTER_USE_TOOL_NAME } from './computerUseVersion';

export interface ComputerUseConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  viewportWidth: number;
  viewportHeight: number;
}

export interface ComputerActionInput {
  action: string;
  coordinate?: [number, number];
  text?: string;
  scroll_direction?: 'up' | 'down' | 'left' | 'right';
  scroll_amount?: number;
  duration?: number;
  start_coordinate?: [number, number];
  end_coordinate?: [number, number];
  region?: [number, number, number, number];
  key?: string;
}

export interface ComputerToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: ComputerActionInput;
}

export interface AnthropicMessageContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: ComputerActionInput;
  tool_use_id?: string;
  content?: AnthropicMessageContentBlock[] | string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
  };
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicMessageContentBlock[];
}

export interface AnthropicMessagesResponse {
  id?: string;
  type?: string;
  role?: string;
  content?: AnthropicMessageContentBlock[];
  stop_reason?: string | null;
  error?: {
    message?: string;
    type?: string;
    metadata?: {
      raw?: string;
    };
  };
}
