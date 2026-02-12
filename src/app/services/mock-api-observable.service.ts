import { Injectable, signal } from "@angular/core";
import { Observable, of, throwError } from "rxjs";
import { delay } from "rxjs/operators";
import { ParkingLot, ParkingSpace, Reservation, User, CreateReservationDto, UpdateReservationDto, SpaceStatus, ReservationStatus } from "../models/parking.models";
import { MOCK_PARKING_LOTS } from "../data/mock-parking-lots";
import { MOCK_PARKING_SPACES } from "../data/mock-parking-spaces";
import { MOCK_USERS } from "../data/mock-users";
import { MOCK_RESERVATIONS } from "../data/mock-reservations";

/**
 * Mock API Service (Observable-based)
 * Simulates HTTP endpoints for parking lot reservation system
 * Returns Observables to simulate async HTTP calls with delays
 * Alternative to the signal-based API for candidates unfamiliar with signals
 */
@Injectable({
	providedIn: "root",
})
export class MockApiObservableService {
	private readonly API_DELAY = 500; // Simulate network delay

	// Internal signals for in-memory data store
	private readonly _parkingLots = signal<ParkingLot[]>([...MOCK_PARKING_LOTS]);
	private readonly _parkingSpaces = signal<ParkingSpace[]>([...MOCK_PARKING_SPACES]);
	private readonly _users = signal<User[]>([...MOCK_USERS]);
	private readonly _reservations = signal<Reservation[]>([...MOCK_RESERVATIONS]);

	/**
	 * Get all reservations
	 */
	getReservations(): Observable<Reservation[]> {
		return of([...this._reservations()]).pipe(delay(this.API_DELAY));
	}

	/**
	 * Get single reservation by ID
	 */
	getReservation(id: string): Observable<Reservation> {
		const reservation = this._reservations().find((r) => r.id === id);
		if (!reservation) {
			return throwError(() => new Error(`Reservation with id ${id} not found`)).pipe(delay(this.API_DELAY));
		}
		return of({ ...reservation }).pipe(delay(this.API_DELAY));
	}

	/**
	 * Create new reservation
	 */
	createReservation(dto: CreateReservationDto): Observable<Reservation> {
		const now = new Date().toISOString();
		const checkIn = new Date(dto.checkInDateTime);
		const checkOut = new Date(dto.checkOutDateTime);
		const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

		// Get lot to calculate cost
		const lot = this._parkingLots().find((l) => l.id === dto.lotId);
		if (!lot) {
			return throwError(() => new Error(`Parking lot with id ${dto.lotId} not found`)).pipe(delay(this.API_DELAY));
		}

		const newReservation: Reservation = {
			id: this.generateUUID(),
			userId: dto.userId,
			lotId: dto.lotId,
			spaceId: dto.spaceId,
			checkInDateTime: dto.checkInDateTime,
			checkOutDateTime: dto.checkOutDateTime,
			status: ReservationStatus.PENDING,
			specialRequirements: dto.specialRequirements,
			totalCost: Math.max(0, hours * lot.pricePerHour),
			createdAt: now,
			updatedAt: now,
		};

		this._reservations.update((reservations) => [...reservations, newReservation]);

		// Update space status
		this.updateSpaceStatus(dto.spaceId, SpaceStatus.RESERVED);

		return of({ ...newReservation }).pipe(delay(this.API_DELAY));
	}

	/**
	 * Update existing reservation
	 */
	updateReservation(id: string, dto: UpdateReservationDto): Observable<Reservation> {
		const index = this._reservations().findIndex((r) => r.id === id);
		if (index === -1) {
			return throwError(() => new Error(`Reservation with id ${id} not found`)).pipe(delay(this.API_DELAY));
		}

		const existing = this._reservations()[index];
		const now = new Date().toISOString();

		// Recalculate cost if dates changed
		let totalCost = existing.totalCost;
		if (dto.checkInDateTime || dto.checkOutDateTime) {
			const checkIn = new Date(dto.checkInDateTime || existing.checkInDateTime);
			const checkOut = new Date(dto.checkOutDateTime || existing.checkOutDateTime);
			const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
			const lot = this._parkingLots().find((l) => l.id === (dto.lotId || existing.lotId));
			if (lot) {
				totalCost = Math.max(0, hours * lot.pricePerHour);
			}
		}

		const updated: Reservation = {
			...existing,
			...dto,
			totalCost,
			updatedAt: now,
		};

		this._reservations.update((reservations) => [...reservations.slice(0, index), updated, ...reservations.slice(index + 1)]);

		// Update space statuses if space changed
		if (dto.spaceId && dto.spaceId !== existing.spaceId) {
			this.updateSpaceStatus(existing.spaceId, SpaceStatus.AVAILABLE);
			this.updateSpaceStatus(dto.spaceId, SpaceStatus.RESERVED);
		}

		return of({ ...updated }).pipe(delay(this.API_DELAY));
	}

	/**
	 * Delete reservation
	 */
	deleteReservation(id: string): Observable<void> {
		const reservation = this._reservations().find((r) => r.id === id);
		if (!reservation) {
			return throwError(() => new Error(`Reservation with id ${id} not found`)).pipe(delay(this.API_DELAY));
		}

		this._reservations.update((reservations) => reservations.filter((r) => r.id !== id));

		// Update space status back to available
		this.updateSpaceStatus(reservation.spaceId, SpaceStatus.AVAILABLE);

		return of(void 0).pipe(delay(this.API_DELAY));
	}

	/**
	 * Get all parking lots
	 */
	getParkingLots(): Observable<ParkingLot[]> {
		return of([...this._parkingLots()]).pipe(delay(this.API_DELAY));
	}

	/**
	 * Get available spaces for a parking lot
	 */
	getAvailableSpaces(lotId: string): Observable<ParkingSpace[]> {
		const spaces = this._parkingSpaces().filter((s) => s.lotId === lotId && s.status === SpaceStatus.AVAILABLE);
		return of([...spaces]).pipe(delay(this.API_DELAY));
	}

	/**
	 * Get all spaces for a parking lot (regardless of status)
	 */
	getLotSpaces(lotId: string): Observable<ParkingSpace[]> {
		const spaces = this._parkingSpaces().filter((s) => s.lotId === lotId);
		return of([...spaces]).pipe(delay(this.API_DELAY));
	}

	/**
	 * Get all users (helper method for development)
	 */
	getUsers(): Observable<User[]> {
		return of([...this._users()]).pipe(delay(this.API_DELAY));
	}

	/**
	 * Private helper: Update space status
	 */
	private updateSpaceStatus(spaceId: string, status: SpaceStatus): void {
		this._parkingSpaces.update((spaces) => spaces.map((s) => (s.id === spaceId ? { ...s, status, updatedAt: new Date().toISOString() } : s)));
	}

	/**
	 * Private helper: Generate UUID
	 */
	private generateUUID(): string {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}
}
