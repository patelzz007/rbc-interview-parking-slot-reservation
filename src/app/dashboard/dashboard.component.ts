import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { MatTableModule } from "@angular/material/table";
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from "@angular/material/button";
import { DatePipe, AsyncPipe } from "@angular/common";
import { ReservationDialogComponent } from "./reservation-dialog/reservation-dialog.component";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { filter, switchMap, startWith, tap } from "rxjs/operators";
import { MockApiObservableService } from "../services/mock-api-observable.service";
import { BehaviorSubject } from "rxjs";
import { Reservation } from "../models/parking.models";

@Component({
	selector: "app-dashboard",
	imports: [MatTableModule, MatMenuModule, MatButtonModule, DatePipe, MatDialogModule, AsyncPipe],
	templateUrl: "./dashboard.component.html",
	styleUrl: "./dashboard.component.scss",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
	private dialog = inject(MatDialog);
	private api = inject(MockApiObservableService);

	/** trigger reload after create/delete */
	private refresh$ = new BehaviorSubject<void>(undefined);

	/** reservations stream */
	protected reservations$ = this.refresh$.pipe(
		startWith(undefined),
		switchMap(() => this.api.getReservations()),
		tap((res) => {
			console.log("📋 Reservations updated:", res);
			console.log("📊 Total:", res.length);
		})
	);

	/** reference data */
	protected parkingLots$ = this.api.getParkingLots();
	protected users$ = this.api.getUsers();

	protected readonly displayedColumns = [
		"id",
		"userName",
		"lotName",
		"spaceNumber",
		"checkInDateTime",
		"checkOutDateTime",
		"status",
		"actions",
	];

	public openCreate(): void {
		const dialogRef = this.dialog.open(ReservationDialogComponent, {
			width: "600px",
			maxWidth: "90vw",
			data: {},
		});

		dialogRef
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(() => {
				// reload table
				this.refresh$.next();
			});
	}

	public openEdit(reservation: Reservation): void {
		const dialogRef = this.dialog.open(ReservationDialogComponent, {
			width: "600px",
			maxWidth: "90vw",
			data: reservation, // ⭐ pass object
		});

		dialogRef
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(() => {
				this.refresh$.next(); // reload
			});
	}

	public deleteReservation(id: string): void {
		this.api.deleteReservation(id).subscribe(() => {
			this.refresh$.next();
		});
	}

	/** helper mapping */
	protected getLotName(lotId: string, lots: any[]): string {
		return lots.find((l) => l.id === lotId)?.name || "Unknown";
	}

	protected getUserName(userId: string, users: any[]): string {
		const u = users.find((x) => x.id === userId);
		return u ? `${u.firstName} ${u.lastName}` : "Unknown";
	}
}
