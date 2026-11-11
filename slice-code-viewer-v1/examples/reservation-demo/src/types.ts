export interface ReservationLine {
  sku: string;
  quantity: number;
}

export interface ReservationRequest {
  requestId: string;
  lines: ReservationLine[];
}

export interface ReservationConfirmation {
  reservationId: string;
  requestId: string;
  lines: ReservationLine[];
}

export type ReservationResult =
  | { status: "reserved"; confirmation: ReservationConfirmation }
  | { status: "rejected"; shortages: ReservationLine[] }
  | { status: "conflict"; message: string };
