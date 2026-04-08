import { Timestamp } from 'firebase/firestore';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  facility?: string;
  createdBy: string;
  creatorEmail: string;
  assignedTo?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
  image?: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  serial?: string;
  status: 'active' | 'maintenance' | 'retired';
  owner?: string;
  location?: string;
  image?: string;
  createdAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  ticketId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: Timestamp;
}
