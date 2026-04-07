import { Timestamp } from 'firebase/firestore';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  category: string;
  createdBy: string;
  creatorEmail: string;
  assignedTo?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
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
