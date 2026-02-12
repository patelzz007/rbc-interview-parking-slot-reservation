/**
 * Enums for parking lot system
 */
export enum SpaceType {
	STANDARD = "STANDARD",
	ACCESSIBLE = "ACCESSIBLE",
	COMPACT = "COMPACT",
	EV_CHARGING = "EV_CHARGING",
}

export enum SpaceStatus {
	AVAILABLE = "AVAILABLE",
	RESERVED = "RESERVED",
	OCCUPIED = "OCCUPIED",
	MAINTENANCE = "MAINTENANCE",
}

export enum ReservationStatus {
	PENDING = "PENDING",
	CONFIRMED = "CONFIRMED",
	ACTIVE = "ACTIVE",
	COMPLETED = "COMPLETED",
	CANCELLED = "CANCELLED",
}

/**
 * Parking Lot interface
 */
export interface ParkingLot {
	id: string;
	name: string;
	address: string;
	city: string;
	state: string;
	zipCode: string;
	totalSpaces: number;
	availableSpaces: number;
	pricePerHour: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Parking Lot Space interface
 */
export interface ParkingSpace {
	id: string;
	lotId: string;
	spaceNumber: string;
	level: number;
	type: SpaceType;
	status: SpaceStatus;
	createdAt: string;
	updatedAt: string;
}

/**
 * User interface
 */
export interface User {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	licenseNumber: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Reservation interface
 */
export interface Reservation {
	id: string;
	userId: string;
	lotId: string;
	spaceId: string;
	checkInDateTime: string;
	checkOutDateTime: string;
	status: ReservationStatus;
	specialRequirements?: string;
	totalCost: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * DTO for creating a new reservation
 */
export interface CreateReservationDto {
	userId: string;
	lotId: string;
	spaceId: string;
	checkInDateTime: string;
	checkOutDateTime: string;
	specialRequirements?: string;
}

/**
 * DTO for updating an existing reservation
 */
export interface UpdateReservationDto {
	userId?: string;
	lotId?: string;
	spaceId?: string;
	checkInDateTime?: string;
	checkOutDateTime?: string;
	status?: ReservationStatus;
	specialRequirements?: string;
}
