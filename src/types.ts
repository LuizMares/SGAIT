/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  AGENTE = 'AGENTE'
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  googleId?: string;
  firstAccessAt: string;
  lastLoginAt: string;
}

export interface InfractionType {
  code: string;
  description: string;
  framing: string;
  article: string;
  nature: 'Leve' | 'Média' | 'Grave' | 'Gravíssima';
  fineValue: number;
  score: number;
  adminMeasure: string;
}

export interface TrafficTicket {
  id: string;
  aitNumber: string;
  infractionDate: string;
  infractionTime: string;
  location: string;
  plate: string;
  vehicleType: string;
  infractionCode: string;
  infractionDescription: string;
  framing: string;
  article: string;
  nature: 'Leve' | 'Média' | 'Grave' | 'Gravíssima';
  fineValue: number;
  score: number;
  adminMeasure: string;
  additionalInfractions?: InfractionType[];
  infractions?: InfractionType[];
  detectionType?: 'In Loco' | 'Videomonitoramento' | string;
  observations?: string;
  photos: string[]; // Base64 or Supabase Storage URL
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorizedEmail {
  email: string;
  role: UserRole;
  name: string;
  lastLoginAt?: string;
}

export interface SystemStats {
  totalTickets: number;
  todayTickets: number;
  weekTickets: number;
  monthTickets: number;
  yearTickets: number;
  totalFineValue: number;
  collectedFineValue: number;
}
