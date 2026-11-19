import {
  AccountBalanceOutlined,
  PersonOutlined,
  BusinessOutlined,
} from '@mui/icons-material';

export const PARTICIPANT_COLORS = {
  founder: 'secondary',
  council: 'primary',
  staff: 'default',
  division: 'success',
} as const;

export type ParticipantType = keyof typeof PARTICIPANT_COLORS;

export const getParticipantType = (id: string): ParticipantType => {
  if (id === 'founder') return 'founder';
  if (id.startsWith('seat-') || id.startsWith('council-')) return 'council';
  if (id.startsWith('staff-')) return 'staff';
  if (id.startsWith('division-')) return 'division';
  return 'staff';
};

export const ParticipantIcon = ({ type, size = 'small' }: { type: ParticipantType; size?: 'small' | 'medium' | 'large' }) => {
  switch (type) {
    case 'founder':
    case 'council':
      return <AccountBalanceOutlined fontSize={size} />;
    case 'staff':
      return <PersonOutlined fontSize={size} />;
    case 'division':
      return <BusinessOutlined fontSize={size} />;
    default:
      return <PersonOutlined fontSize={size} />;
  }
};

export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const MESSAGE_STATUS_COLORS = {
  pending: 'warning',
  sent: 'primary',
  delivered: 'primary',
  read: 'success',
  failed: 'error',
  replied: 'info',
} as const;

export type MessageStatusColor = typeof MESSAGE_STATUS_COLORS[keyof typeof MESSAGE_STATUS_COLORS];

export const MESSAGE_STATUS_LABELS = {
  pending: 'Pending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
  replied: 'Replied',
} as const;