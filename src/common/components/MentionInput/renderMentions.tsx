// Converts plain text with @mention markers into JSX with highlighted MentionChip spans.
// Used in read/display mode (not editing).
import React from 'react';

interface MentionUser {
  nickname: string;
  name?: string;
  avatar_url?: string | null;
}

interface Props {
  text: string;
  // Optional map of nickname → user for tooltip enrichment
  userMap?: Record<string, MentionUser>;
}

const MENTION_REGEX = /(\B@[\w-]{1,50})/g;

const renderMentions = ({ text, userMap = {} }: Props): React.ReactNode => {
  const parts = text.split(MENTION_REGEX);

  return parts.map((part, i) => {
    if (!part.startsWith('@')) {
      return part;
    }

    const nickname = part.slice(1);
    const user = userMap[nickname];
    const title = user ? `${user.name ?? nickname} (@${nickname})` : `@${nickname}`;

    return (
      <span
        key={i}
        title={title}
        // [theme-exception] Mention chips use brand-tinted indigo highlight intentionally
        className="inline-flex items-center gap-1 rounded-full bg-indigo-900/50 px-1.5 py-0.5 text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-900"
      >
        {part}
      </span>
    );
  });
};

export default renderMentions;
