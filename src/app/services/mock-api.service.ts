import { Injectable, signal, computed, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Observable, of, throwError } from "rxjs";
import { delay } from "rxjs/operators";
import { ParkingLot, ParkingSpace, Reservation, User, CreateReservationDto, UpdateReservationDto, SpaceStatus, ReservationStatus } from "../models/parking.models";
import { MOCK_PARKING_LOTS } from "../data/mock-parking-lots";
import { MOCK_PARKING_SPACES } from "../data/mock-parking-spaces";
import { MOCK_USERS } from "../data/mock-users";
import { MOCK_RESERVATIONS } from "../data/mock-reservations";

/**
 * Mock API Service
 * Simulates HTTP endpoints for parking lot reservation system
 * Uses signals for in-memory data store with direct signal access
 * Also provides Observables to simulate HTTP calls with delays
 */
@Injectable({
	providedIn: "root",
})
export class MockApiService {
	private readonly API_DELAY = 500; // Simulate network delay

	// Internal signals for in-memory data store
	private readonly _parkingLots = signal<ParkingLot[]>([...MOCK_PARKING_LOTS]);
	private readonly _parkingSpaces = signal<ParkingSpace[]>([...MOCK_PARKING_SPACES]);
	private readonly _users = signal<User[]>([...MOCK_USERS]);
	private readonly _reservations = signal<Reservation[]>([...MOCK_RESERVATIONS]);

	// Public readonly signals for direct access (no delay)
	readonly parkingLots = this._parkingLots.asReadonly();
	readonly parkingSpaces = this._parkingSpaces.asReadonly();
	readonly users = this._users.asReadonly();
	readonly reservations = this._reservations.asReadonly();

	// Computed signals for derived state
	readonly parkingLotsCount = computed(() => this._parkingLots().length);
	readonly activeReservationsCount = computed(() => this._reservations().filter((r) => r.status === ReservationStatus.ACTIVE).length);

	/**
	 * Get all reservations
	 */
	getReservations(): Signal<Reservation[] | undefined> {
		return toSignal(of([...this.reservations()]).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Get single reservation by ID
	 */
	getReservation(id: string): Signal<Reservation | undefined> {
		const reservation = this.reservations().find((r) => r.id === id);
		if (!reservation) {
			return toSignal(throwError(() => new Error(`Reservation with id ${id} not found`)).pipe(delay(this.API_DELAY)));
		}
		return toSignal(of({ ...reservation }).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Create new reservation
	 */
	createReservation(dto: CreateReservationDto): Signal<Reservation | undefined> {
		const now = new Date().toISOString();
		const checkIn = new Date(dto.checkInDateTime);
		const checkOut = new Date(dto.checkOutDateTime);
		const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

		// Get lot to calculate cost
		const lot = this.parkingLots().find((l) => l.id === dto.lotId);
		if (!lot) {
			return toSignal(throwError(() => new Error(`Parking lot with id ${dto.lotId} not found`)).pipe(delay(this.API_DELAY)));
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

		return toSignal(of({ ...newReservation }).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Update existing reservation
	 */
	updateReservation(id: string, dto: UpdateReservationDto): Signal<Reservation | undefined> {
		const index = this._reservations().findIndex((r) => r.id === id);
		if (index === -1) {
			return toSignal(throwError(() => new Error(`Reservation with id ${id} not found`)).pipe(delay(this.API_DELAY)));
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

		return toSignal(of({ ...updated }).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Delete reservation
	 */
	deleteReservation(id: string): Signal<void> {
		const reservation = this._reservations().find((r) => r.id === id);
		if (!reservation) {
			return toSignal(throwError(() => new Error(`Reservation with id ${id} not found`)).pipe(delay(this.API_DELAY)));
		}

		this._reservations.update((reservations) => reservations.filter((r) => r.id !== id));

		// Update space status back to available
		this.updateSpaceStatus(reservation.spaceId, SpaceStatus.AVAILABLE);

		return toSignal(of(void 0).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Get all parking lots
	 */
	getParkingLots(): Signal<ParkingLot[] | undefined> {
		return toSignal(of([...this.parkingLots()]).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Get available spaces for a parking lot
	 */
	getAvailableSpaces(lotId: string): Signal<ParkingSpace[] | undefined> {
		const spaces = this.parkingSpaces().filter((s) => s.lotId === lotId && s.status === SpaceStatus.AVAILABLE);
		return toSignal(of([...spaces]).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Get all spaces for a parking lot (regardless of status)
	 */
	getLotSpaces(lotId: string): Signal<ParkingSpace[] | undefined> {
		const spaces = this.parkingSpaces().filter((s) => s.lotId === lotId);
		return toSignal(of([...spaces]).pipe(delay(this.API_DELAY)));
	}

	/**
	 * Get all users (helper method for development)
	 */
	getUsers(): Signal<User[] | undefined> {
		return toSignal(of([...this.users()]).pipe(delay(this.API_DELAY)));
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
