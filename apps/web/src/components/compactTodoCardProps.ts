import type { ComponentProps } from 'react';
import type { TodoCard } from './TodoCard';

export const COMPACT_TODO_CARD_PROPS = {
  compact: true,
  compactUuid: true,
  showSubtasks: false,
  showSubtaskCount: true,
  showStatus: false,
  showDescription: false,
  showAssociatedTickets: false,
  showPullRequests: false,
} satisfies Omit<ComponentProps<typeof TodoCard>, 'todo' | 'onClick'>;
