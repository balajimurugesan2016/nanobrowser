import type { Message } from '@extension/storage';
import { t } from '@extension/i18n';
import { ACTOR_PROFILES } from '../types/message';
import { memo } from 'react';

interface MessageListProps {
  messages: Message[];
  isDarkMode?: boolean;
}

export default memo(function MessageList({ messages, isDarkMode = false }: MessageListProps) {
  return (
    <div className="max-w-full space-y-4">
      {messages.map((message, index) => (
        <MessageBlock
          key={`${message.actor}-${message.timestamp}-${index}`}
          message={message}
          isSameActor={index > 0 ? messages[index - 1].actor === message.actor : false}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
});

interface MessageBlockProps {
  message: Message;
  isSameActor: boolean;
  isDarkMode?: boolean;
}

function MessageBlock({ message, isSameActor, isDarkMode = false }: MessageBlockProps) {
  if (!message.actor) {
    console.error('No actor found');
    return <div />;
  }
  const actor = ACTOR_PROFILES[message.actor as keyof typeof ACTOR_PROFILES];
  const isProgress = message.kind === 'progress' || message.content === t('chat_progress_showing');

  return (
    <div
      className={`flex max-w-full gap-3 ${
        !isSameActor
          ? `mt-4 border-t ${isDarkMode ? 'border-sky-800/50' : 'border-sky-200/50'} pt-4 first:mt-0 first:border-t-0 first:pt-0`
          : ''
      }`}>
      {!isSameActor && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: actor.iconBackground }}>
          <img src={actor.icon} alt={actor.name} className="size-6" />
        </div>
      )}
      {isSameActor && <div className="w-8" />}

      <div className="min-w-0 flex-1">
        {!isSameActor && (
          <div className={`mb-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
            {actor.name}
          </div>
        )}

        <div className="space-y-0.5">
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {isProgress ? (
              <div className={`h-1 overflow-hidden rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div className="h-full animate-progress bg-blue-500" />
              </div>
            ) : message.kind === 'plan' ? (
              <PlanContent message={message} isDarkMode={isDarkMode} />
            ) : message.kind === 'batch' ? (
              <BatchContent message={message} isDarkMode={isDarkMode} />
            ) : message.kind === 'capture' ? (
              <CaptureContent message={message} isDarkMode={isDarkMode} />
            ) : (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            )}
          </div>
          {!isProgress && (
            <div className={`text-right text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-300'}`}>
              {formatTimestamp(message.timestamp)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanContent({ message, isDarkMode }: { message: Message; isDarkMode: boolean }) {
  const steps = message.metadata?.planSteps ?? [];

  return (
    <div
      className={`rounded-lg border p-3 ${isDarkMode ? 'border-sky-800/50 bg-sky-950/30' : 'border-sky-200 bg-sky-50'}`}>
      <div className={`mb-2 font-medium ${isDarkMode ? 'text-sky-200' : 'text-sky-900'}`}>{message.content}</div>
      {steps.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5">
          {steps.map((step, index) => (
            <li key={`${index}-${step}`} className="break-words">
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function BatchContent({ message, isDarkMode }: { message: Message; isDarkMode: boolean }) {
  const actions = message.metadata?.batchActions ?? [];
  const current = message.metadata?.batchCurrent ?? 0;
  const total = message.metadata?.batchTotal ?? actions.length;
  const toolName = message.metadata?.toolName ?? 'browser_batch';
  const isComplete = current >= total && total > 0 && actions.every(a => a.status === 'done' || a.status === 'failed');

  return (
    <div
      className={`rounded-lg border p-3 ${isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
      <div
        className={`mb-2 flex items-center justify-between gap-2 text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <span>
          {t('chat_navigator_batchLabel')} — {current}/{total} {t('chat_navigator_batchActions')}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
          {t('chat_navigator_toolLabel', [toolName])}
        </span>
      </div>
      <ul className="space-y-1.5">
        {actions.map((action, index) => (
          <li key={`${index}-${action.label}`} className="flex items-start gap-2">
            <BatchStatusIcon status={action.status} isComplete={isComplete} isDarkMode={isDarkMode} />
            <div className="min-w-0 flex-1">
              <span className={action.status === 'running' ? 'font-medium' : ''}>{action.label}</span>
              {action.detail && (
                <span className={`ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{action.detail}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {message.metadata?.pageUrl && (
        <div
          className={`truncate text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}
          title={message.metadata.pageUrl}>
          {message.metadata.pageUrl}
        </div>
      )}
      {message.metadata?.screenshot && (
        <img
          src={`data:image/jpeg;base64,${message.metadata.screenshot}`}
          alt={t('chat_navigator_screenshotAlt')}
          className={`mt-2 max-h-32 rounded border object-contain ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
        />
      )}
    </div>
  );
}

function BatchStatusIcon({
  status,
  isComplete,
  isDarkMode,
}: {
  status: string;
  isComplete: boolean;
  isDarkMode: boolean;
}) {
  if (status === 'done' || (isComplete && status !== 'failed')) {
    return <span className="mt-0.5 text-green-500">✓</span>;
  }
  if (status === 'failed') {
    return <span className="mt-0.5 text-red-500">✗</span>;
  }
  if (status === 'running') {
    return (
      <span
        className={`mt-1 inline-block size-2 animate-pulse rounded-full ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'}`}
      />
    );
  }
  return <span className={`mt-1 inline-block size-2 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />;
}

function CaptureContent({ message, isDarkMode }: { message: Message; isDarkMode: boolean }) {
  const screenshot = message.metadata?.screenshot;
  const pageUrl = message.metadata?.pageUrl;

  return (
    <div className="space-y-2">
      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{message.content}</div>
      {pageUrl && (
        <div className={`truncate text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`} title={pageUrl}>
          {pageUrl}
        </div>
      )}
      {screenshot && (
        <img
          src={`data:image/jpeg;base64,${screenshot}`}
          alt={t('chat_navigator_screenshotAlt')}
          className={`max-h-32 rounded border object-contain ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
        />
      )}
    </div>
  );
}

/**
 * Formats a timestamp (in milliseconds) to a readable time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Check if the message is from today
  const isToday = date.toDateString() === now.toDateString();

  // Check if the message is from yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // Check if the message is from this year
  const isThisYear = date.getFullYear() === now.getFullYear();

  // Format the time (HH:MM)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr; // Just show the time for today's messages
  }

  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  if (isThisYear) {
    // Show month and day for this year
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }

  // Show full date for older messages
  return `${date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}, ${timeStr}`;
}
