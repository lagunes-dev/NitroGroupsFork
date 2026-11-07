import type { GenreResponse } from "./Genre";
import type { GroupMediaResponse } from "@/features/groupMedia/types/GroupMedia";

export interface MusicGroup {
  id: number;
  ownerUserId: number;
  slug: string;
  groupName: string;
  description: string;
  biography: string;
  numMembers: number;
  yearsExperience: number;
  phone: string;
  email: string;
  locationText: string;
  serviceRadiusKm: number;
  currency: string;
  basePrice?: number;
  hourlyRate?: number;
  minimumDurationHours: number;
  setupTimeMinutes: number;
  averageRating: number;
  totalReviews: number;
  viewCount: number;
  bookingCount: number;
  isVerified: boolean;
  isFeatured: boolean;
  isAcceptingBookings: boolean;
  active: boolean;
  profilePictureUrl?: string;
  coverImageUrl?: string;
  /**
   * Ronda 9: cómo quiere el grupo que se le pague. Texto libre de hasta 500 que solo lee el cliente
   * de un evento aceptado; el perfil público no lo lleva y la app nunca cobra (D1/S18).
   */
  paymentInstructions?: string | null;
  genres?: GenreResponse[];
  media?: GroupMediaResponse[];
}
