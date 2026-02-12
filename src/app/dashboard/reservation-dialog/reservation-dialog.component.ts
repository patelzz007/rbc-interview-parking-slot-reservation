import { CommonModule } from "@angular/common";
import { Component, inject, Inject, OnDestroy, OnInit } from "@angular/core";
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from "@angular/forms";
import { MatNativeDateModule, MatOptionModule, provideNativeDateAdapter } from "@angular/material/core";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatTimepickerModule } from "@angular/material/timepicker";
import { NgxMatSelectSearchModule } from "ngx-mat-select-search";
import { Subject, takeUntil, combineLatest, of, startWith, debounceTime, distinctUntilChanged, map } from "rxjs";
import { MOCK_PARKING_LOTS } from "../../data/mock-parking-lots";
import { MOCK_PARKING_SPACES } from "../../data/mock-parking-spaces";
import { MOCK_USERS } from "../../data/mock-users";
import { CreateReservationDto, ParkingLot, ParkingSpace, Reservation, ReservationStatus, UpdateReservationDto, User } from "../../models/parking.models";
import { MockApiObservableService } from "../../services/mock-api-observable.service";

@Component({
	selector: "app-reservation-dialog",
	templateUrl: "./reservation-dialog.component.html",
	styleUrls: ["./reservation-dialog.component.scss"],
	imports: [
		CommonModule,
		MatFormFieldModule,
		MatDialogContent,
		MatInputModule,
		MatSelectModule,
		MatOptionModule,
		MatDialogActions,
		ReactiveFormsModule,
		MatDatepickerModule,
		MatNativeDateModule,
		MatTimepickerModule,
		MatIconModule,
		NgxMatSelectSearchModule,
	],
	providers: [provideNativeDateAdapter()],
})
export class ReservationDialogComponent implements OnInit, OnDestroy {
	private fb = inject(FormBuilder);
	private reservationService = inject(MockApiObservableService);
	private destroy$ = new Subject<void>();
	public durationHours = 0;

	// Search controls for dropdowns
	public userSearchControl = new FormControl("");
	public statusSearchControl = new FormControl("");
	public lotSearchControl = new FormControl("");
	public spaceSearchControl = new FormControl("");

	// Filtered options observables
	public filteredUsers$ = of<User[]>([]);
	public filteredStatuses$ = of<string[]>([]);
	public filteredLots$ = of<ParkingLot[]>([]);
	public filteredSpaces$ = of<ParkingSpace[]>([]);

	constructor(
		private dialogRef: MatDialogRef<ReservationDialogComponent, boolean>,
		@Inject(MAT_DIALOG_DATA) public data: Reservation | null
	) {}

	public users: User[] = MOCK_USERS;
	public parkingLots: ParkingLot[] = MOCK_PARKING_LOTS;
	public allParkingSpaces: ParkingSpace[] = MOCK_PARKING_SPACES;
	public filteredSpaces: ParkingSpace[] = [];
	public isLoading = false;
	public statuses = Object.values(ReservationStatus);

	public form = this.fb.group(
		{
			userId: ["", Validators.required],
			lotId: ["", Validators.required],
			spaceId: ["", Validators.required],
			checkInDate: [null as Date | null, Validators.required],
			checkInTime: [null as Date | null, Validators.required],
			checkOutDate: [null as Date | null, Validators.required],
			checkOutTime: [null as Date | null, Validators.required],
			status: [ReservationStatus.PENDING, Validators.required],
			specialRequirements: [""],
			totalCost: [{ value: 0, disabled: true }, [Validators.required, Validators.min(0)]],
		},
		{ validators: this.dateRangeValidator.bind(this) }
	);

	ngOnInit() {
		this.setupSearchFilters();
		this.setupLotChangeListener();
		this.setupDateTimeSync();
		this.setupDurationAndPrice();

		if (this.data) {
			this.patchForEdit(this.data);
		}
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private setupSearchFilters(): void {
		// Filter users
		this.filteredUsers$ = combineLatest([of(this.users), this.userSearchControl.valueChanges.pipe(startWith(""), debounceTime(200), distinctUntilChanged())]).pipe(
			map(([users, searchTerm]) => {
				if (!searchTerm) return users;
				searchTerm = searchTerm.toLowerCase();
				return users.filter(
					(user) =>
						user.firstName.toLowerCase().includes(searchTerm) ||
						user.lastName.toLowerCase().includes(searchTerm) ||
						user.email?.toLowerCase().includes(searchTerm) ||
						`${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm)
				);
			})
		);

		// Filter statuses
		this.filteredStatuses$ = combineLatest([of(this.statuses), this.statusSearchControl.valueChanges.pipe(startWith(""), debounceTime(200), distinctUntilChanged())]).pipe(
			map(([statuses, searchTerm]) => {
				if (!searchTerm) return statuses;
				searchTerm = searchTerm.toLowerCase();
				return statuses.filter((status) => status.toLowerCase().includes(searchTerm));
			})
		);

		// Filter parking lots
		this.filteredLots$ = combineLatest([of(this.parkingLots), this.lotSearchControl.valueChanges.pipe(startWith(""), debounceTime(200), distinctUntilChanged())]).pipe(
			map(([lots, searchTerm]) => {
				if (!searchTerm) return lots;
				searchTerm = searchTerm.toLowerCase();
				return lots.filter((lot) => lot.name.toLowerCase().includes(searchTerm) || lot.address.toLowerCase().includes(searchTerm));
			})
		);
	}

	private setupSpaceSearchFilter(lotId: string): void {
		const lotSpaces = this.allParkingSpaces.filter((space) => space.lotId === lotId);

		this.filteredSpaces$ = combineLatest([of(lotSpaces), this.spaceSearchControl.valueChanges.pipe(startWith(""), debounceTime(200), distinctUntilChanged())]).pipe(
			map(([spaces, searchTerm]) => {
				if (!searchTerm) return spaces;
				searchTerm = searchTerm.toLowerCase();
				return spaces.filter(
					(space) => space.spaceNumber.toString().includes(searchTerm) || space.type.toLowerCase().includes(searchTerm) || `Space ${space.spaceNumber}`.toLowerCase().includes(searchTerm)
				);
			})
		);
	}

	getUserFullName(userId: string | null | undefined): string {
		const user = this.users.find((u) => u.id === userId);
		return user ? `${user.firstName} ${user.lastName}` : "";
	}

	/**
	 * Get lot name by lot ID for select trigger display
	 */
	getLotName(lotId: string | null | undefined): string {
		const lot = this.parkingLots.find((l) => l.id === lotId);
		return lot ? lot.name : "";
	}

	/**
	 * Get space display text by space ID for select trigger display
	 */
	getSpaceDisplay(spaceId: string | null | undefined): string {
		const space = this.allParkingSpaces.find((s) => s.id === spaceId);
		return space ? `Space #${space.spaceNumber}` : "";
	}

	getLotRate(lotId: string | number | null | undefined): number {
		const lot = this.parkingLots.find((l) => l.id === lotId);
		return lot?.pricePerHour || 0;
	}

	public endDateFilter = (date: Date | null): boolean => {
		const start = this.form.get("checkInDate")?.value;
		if (!start || !date) return true;

		const min = new Date(start);
		min.setDate(min.getDate() - 1);

		return date > min;
	};

	public save(): void {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			this.scrollToFirstError();
			return;
		}

		const v = this.form.value;

		const checkIn = this.combineDateAndTime(v.checkInDate!, v.checkInTime!);
		const checkOut = this.combineDateAndTime(v.checkOutDate!, v.checkOutTime!);

		this.isLoading = true;

		if (this.data?.id) {
			const payload: UpdateReservationDto = {
				userId: v.userId!,
				lotId: v.lotId!,
				spaceId: v.spaceId!,
				checkInDateTime: checkIn.getTime().toString(),
				checkOutDateTime: checkOut.getTime().toString(),
				specialRequirements: v.specialRequirements || "",
				status: v.status!,
			};

			this.reservationService.updateReservation(this.data.id, payload).subscribe(() => {
				this.dialogRef.close(true);
			});
		} else {
			const payload: CreateReservationDto = {
				userId: v.userId!,
				lotId: v.lotId!,
				spaceId: v.spaceId!,
				checkInDateTime: checkIn.getTime().toString(),
				checkOutDateTime: checkOut.getTime().toString(),
				specialRequirements: v.specialRequirements || "",
			};

			this.reservationService.createReservation(payload).subscribe(() => {
				this.dialogRef.close(true);
			});
		}
	}

	public close(): void {
		this.dialogRef.close();
	}

	private patchForEdit(reservation: Reservation): void {
		const checkIn = new Date(Number(reservation.checkInDateTime));
		const checkOut = new Date(Number(reservation.checkOutDateTime));

		this.form.patchValue({
			userId: reservation.userId,
			lotId: reservation.lotId,
			spaceId: reservation.spaceId,
			checkInDate: checkIn,
			checkInTime: checkIn,
			checkOutDate: checkOut,
			checkOutTime: checkOut,
			status: reservation.status,
			specialRequirements: reservation.specialRequirements,
			totalCost: reservation.totalCost,
		});

		this.filterSpacesByLot(reservation.lotId);
		this.setupSpaceSearchFilter(reservation.lotId);
	}

	private setupDurationAndPrice(): void {
		this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
			const v = this.form.value;

			if (!v.checkInDate || !v.checkInTime || !v.checkOutDate || !v.checkOutTime) {
				this.durationHours = 0;
				return;
			}

			const start = this.combineDateAndTime(v.checkInDate, v.checkInTime);
			const end = this.combineDateAndTime(v.checkOutDate, v.checkOutTime);

			const diffMs = end.getTime() - start.getTime();

			if (diffMs <= 0) {
				this.durationHours = 0;
				return;
			}

			this.durationHours = diffMs / 1000 / 60 / 60;

			this.computePrice();
		});
	}

	private computePrice(): void {
		const lotId = this.form.get("lotId")?.value;
		if (!lotId || !this.durationHours) return;

		const lot = this.parkingLots.find((l) => l.id === lotId);
		if (!lot) return;

		const total = this.durationHours * lot.pricePerHour;

		this.form.patchValue({ totalCost: Number(total.toFixed(2)) }, { emitEvent: false });
	}

	private scrollToFirstError(): void {
		setTimeout(() => {
			const el = document.querySelector(".ng-invalid");
			el?.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	}

	private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
		const inDate = group.get("checkInDate");
		const inTime = group.get("checkInTime");
		const outDate = group.get("checkOutDate");
		const outTime = group.get("checkOutTime");

		if (!inDate?.value || !inTime?.value || !outDate?.value || !outTime?.value) return null;

		const start = this.combineDateAndTime(inDate.value, inTime.value);
		const end = this.combineDateAndTime(outDate.value, outTime.value);

		const invalid = end.getTime() <= start.getTime();

		[outDate, outTime].map((c: AbstractControl<any, any, any>) => {
			if (c?.hasError("invalidDateRange")) {
				const e = { ...c.errors };
				delete e["invalidDateRange"];
				c.setErrors(Object.keys(e).length ? e : null);
			}
		});

		if (!invalid) return null;

		outDate?.setErrors({ ...(outDate.errors || {}), invalidDateRange: true });
		outTime?.setErrors({ ...(outTime.errors || {}), invalidDateRange: true });

		return { invalidDateRange: true };
	}

	private setupLotChangeListener(): void {
		this.form
			.get("lotId")
			?.valueChanges.pipe(takeUntil(this.destroy$))
			.subscribe((lotId) => {
				if (!lotId) {
					this.filteredSpaces = [];
					this.filteredSpaces$ = of([]);
					return;
				}
				this.filterSpacesByLot(lotId);
				this.setupSpaceSearchFilter(lotId);
				this.form.patchValue({ spaceId: "" }, { emitEvent: false });
			});
	}

	private filterSpacesByLot(lotId: string) {
		this.filteredSpaces = this.allParkingSpaces.filter((s) => s.lotId === lotId);
	}

	private setupDateTimeSync(): void {
		this.sync("checkInDate", "checkInTime", 9);
		this.sync("checkOutDate", "checkOutTime", 17);
	}

	private sync(dateKey: string, timeKey: string, defaultHour: number): void {
		this.form.get(dateKey)?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((date: Date | null) => {
				if (!date) return;

				const time = this.form.get(timeKey)?.value;

				if (time) {
					this.form.patchValue({ [timeKey]: this.combineDateAndTime(date, time) }, { emitEvent: false });
				} else {
					const d = new Date(date);
					d.setHours(defaultHour, 0, 0, 0);
					this.form.patchValue({ [timeKey]: d }, { emitEvent: false });
				}
			});
	}

	private combineDateAndTime(date: Date, time: Date): Date {
		const d = new Date(date);
		d.setHours(time.getHours(), time.getMinutes(), 0, 0);
		return d;
	}

	private getNow(): Date {
		const now = new Date();
		now.setSeconds(0, 0);
		return now;
	}

	private isToday(date: Date | null | undefined): boolean {
		if (!date) return false;

		const today = new Date();
		return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
	}

	get checkInMinTime(): Date | null {
		const date = this.form.get("checkInDate")?.value;
		return this.isToday(date) ? this.getNow() : null;
	}

	get checkOutMinTime(): Date | null {
		const date = this.form.get("checkOutDate")?.value;
		return this.isToday(date) ? this.getNow() : null;
	}

	// Helper methods for template
	getStatusIcon(status: string): string {
		switch (status) {
			case "ACTIVE":
				return "schedule";
			case "COMPLETED":
				return "check_circle";
			case "CANCELLED":
				return "cancel";
			case "PENDING":
				return "pending";
			default:
				return "circle";
		}
	}

	getUserInitials(user: User): string {
		return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
	}

	// Reset search controls when dialog closes
	resetSearchControls(): void {
		this.userSearchControl.reset();
		this.statusSearchControl.reset();
		this.lotSearchControl.reset();
		this.spaceSearchControl.reset();
	}
}
