import { AsyncPipe, DatePipe, NgClass } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatPaginator, MatPaginatorModule, PageEvent } from "@angular/material/paginator";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { NgxMatSelectSearchModule } from "ngx-mat-select-search";
import { BehaviorSubject, combineLatest, Observable, of } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, filter, map, shareReplay, startWith, switchMap, tap } from "rxjs/operators";
import { ParkingLot, Reservation, User } from "../models/parking.models";
import { MockApiObservableService } from "../services/mock-api-observable.service";
import { ReservationDialogComponent } from "./reservation-dialog/reservation-dialog.component";

export interface StatusOption {
	value: string;
	label: string;
}

@Component({
	selector: "app-dashboard",
	imports: [
		MatTableModule,
		MatMenuModule,
		MatButtonModule,
		MatIconModule,
		DatePipe,
		MatDialogModule,
		AsyncPipe,
		MatPaginatorModule,
		MatSortModule,
		MatFormFieldModule,
		MatInputModule,
		MatSelectModule,
		NgClass,
		MatProgressSpinnerModule,
		ReactiveFormsModule,
		NgxMatSelectSearchModule,
	],
	templateUrl: "./dashboard.component.html",
	styleUrl: "./dashboard.component.scss",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements AfterViewInit, OnInit {
	@ViewChild(MatPaginator) paginator!: MatPaginator;
	@ViewChild(MatSort) sort!: MatSort;

	readonly Math = Math;
	pageSize = 10;
	pageIndex = 0;
	totalItems = 0;

	private dialog = inject(MatDialog);
	private api = inject(MockApiObservableService);

	// Status options
	readonly statusOptions: StatusOption[] = [
		{ value: "ACTIVE", label: "Active" },
		{ value: "COMPLETED", label: "Completed" },
		{ value: "CANCELLED", label: "Cancelled" },
	];

	/** filters/search with debounce */
	public searchInput$ = new BehaviorSubject<string>("");
	protected search$ = this.searchInput$.pipe(debounceTime(300), distinctUntilChanged(), startWith(""));

	protected statusFilter$ = new BehaviorSubject<string | null>(null);
	protected lotFilter$ = new BehaviorSubject<string | null>(null);
	protected userFilter$ = new BehaviorSubject<string | null>(null);

	/** Form controls for filters */
	protected statusControl = new FormControl<string | null>(null);
	protected lotControl = new FormControl<string | null>(null);
	protected userControl = new FormControl<string | null>(null);

	/** Search controls for dropdowns */
	protected statusSearchControl = new FormControl("");
	protected lotSearchControl = new FormControl("");
	protected userSearchControl = new FormControl("");

	/** Filtered options for dropdowns */
	protected filteredStatuses$: Observable<StatusOption[]>;
	protected filteredLots$: Observable<ParkingLot[]>;
	protected filteredUsers$: Observable<User[]>;

	/** trigger reload after create/delete */
	private refresh$ = new BehaviorSubject<void>(undefined);

	/** single datasource instance */
	protected dataSource = new MatTableDataSource<Reservation>([]);

	/** Store all filtered and sorted data */
	private allFilteredData: Reservation[] = [];

	/** Current sort state */
	private currentSort: Sort = { active: "checkInDateTime", direction: "desc" };

	/** reference data with caching */
	protected parkingLots$ = this.api.getParkingLots().pipe(
		shareReplay(1),
		catchError(() => of([])),
		startWith([])
	);

	protected users$ = this.api.getUsers().pipe(
		shareReplay(1),
		catchError(() => of([])),
		startWith([])
	);

	/** Cached lookup maps */
	private lotNameMap = new Map<string, string>();
	private userNameMap = new Map<string, string>();
	private userEmailMap = new Map<string, string>();

	/** Column visibility */
	protected visibleColumns: string[] = [];
	protected readonly allColumns = ["id", "userName", "lotName", "spaceNumber", "checkInDateTime", "checkOutDateTime", "status", "actions"];

	/** Alias for allColumns to maintain compatibility with template */
	protected readonly displayedColumns = this.allColumns;

	/** Store original order for default sort */
	private originalOrder: Reservation[] = [];

	constructor() {
		// Initialize filtered statuses
		this.filteredStatuses$ = this.statusSearchControl.valueChanges.pipe(
			startWith(""),
			map((search) => {
				if (!search) return this.statusOptions;
				search = search.toLowerCase();
				return this.statusOptions.filter((s) => s.label.toLowerCase().includes(search) || s.value.toLowerCase().includes(search));
			})
		);

		// Initialize filtered lots
		this.filteredLots$ = combineLatest([this.parkingLots$, this.lotSearchControl.valueChanges.pipe(startWith(""), debounceTime(200))]).pipe(
			map(([lots, search]) => {
				if (!search) return lots;
				search = search.toLowerCase();
				return lots.filter((lot) => lot.name.toLowerCase().includes(search) || lot.id.toLowerCase().includes(search));
			})
		);

		// Initialize filtered users
		this.filteredUsers$ = combineLatest([this.users$, this.userSearchControl.valueChanges.pipe(startWith(""), debounceTime(200))]).pipe(
			map(([users, search]) => {
				if (!search) return users;
				search = search.toLowerCase();
				return users.filter(
					(user) =>
						user.firstName.toLowerCase().includes(search) ||
						user.lastName.toLowerCase().includes(search) ||
						user.email?.toLowerCase().includes(search) ||
						`${user.firstName} ${user.lastName}`.toLowerCase().includes(search)
				);
			})
		);

		// Initialize column visibility
		this.visibleColumns = [...this.allColumns];

		// Hide space column by default
		const spaceIndex = this.visibleColumns.indexOf("spaceNumber");
		if (spaceIndex > -1) {
			this.visibleColumns.splice(spaceIndex, 1);
		}
	}

	ngOnInit(): void {
		// Load column preferences from localStorage
		this.loadColumnPreferences();

		this.initializeDataSource();

		// Sync form controls with filter subjects
		this.statusControl.valueChanges.subscribe((value) => this.statusFilter$.next(value));
		this.lotControl.valueChanges.subscribe((value) => this.lotFilter$.next(value));
		this.userControl.valueChanges.subscribe((value) => this.userFilter$.next(value));
	}

	ngAfterViewInit(): void {
		// Setup custom sort handling
		this.setupSorting();

		// Initialize paginator
		if (this.paginator) {
			this.paginator.page.subscribe((event: PageEvent) => {
				this.onPageChange(event);
			});
		}
	}

	private setupSorting(): void {
		// Override the sort change to handle full dataset sorting
		if (this.sort) {
			this.sort.sortChange.subscribe((sort: Sort) => {
				this.handleSortChange(sort);
			});
		}

		// Disable built-in MatTableDataSource sorting
		this.dataSource.sort = null;
	}

	private initializeDataSource(): void {
		combineLatest([
			this.refresh$.pipe(
				startWith(undefined),
				switchMap(() => this.api.getReservations().pipe(catchError(() => of([]))))
			),
			this.search$,
			this.statusFilter$,
			this.lotFilter$,
			this.userFilter$,
			this.parkingLots$,
			this.users$,
		])
			.pipe(
				map(([reservations, search, status, lot, user, lots, users]) => {
					// Update caches
					lots.map((lot) => {
						this.lotNameMap.set(lot.id, lot.name);
					});

					users.map((user) => {
						this.userNameMap.set(user.id, `${user.firstName} ${user.lastName}`);
						this.userEmailMap.set(user.id, user.email || "");
					});

					let filtered = [...reservations];

					// Store original order
					this.originalOrder = [...reservations];

					// Apply search
					if (search) {
						const s = search.toLowerCase();
						filtered = filtered.filter((r) => {
							const userName = this.getUserNameSync(r.userId).toLowerCase();
							const lotName = this.getLotNameSync(r.lotId).toLowerCase();
							return r.id.toLowerCase().includes(s) || userName.includes(s) || lotName.includes(s);
						});
					}

					// Apply filters
					if (status) filtered = filtered.filter((r) => r.status === status);
					if (lot) filtered = filtered.filter((r) => r.lotId === lot);
					if (user) filtered = filtered.filter((r) => r.userId === user);

					return filtered;
				}),
				tap((filtered) => {
					// Store all filtered data
					this.allFilteredData = filtered;
					this.totalItems = filtered.length;

					// Apply current sort to the full dataset
					this.applySortToFullDataset();

					// Reset to first page when data changes
					this.pageIndex = 0;

					// Apply pagination to the sorted data
					this.applyPagination();
				})
			)
			.subscribe();
	}

	/** Apply sorting to the entire filtered dataset */
	private applySortToFullDataset(): void {
		if (!this.currentSort.active || this.currentSort.direction === "") {
			// Default sort - by check-in date descending
			this.allFilteredData = this.sortData(this.allFilteredData, {
				active: "checkInDateTime",
				direction: "desc",
			});
		} else {
			// Apply current sort
			this.allFilteredData = this.sortData(this.allFilteredData, this.currentSort);
		}
	}

	/** Sort data based on sort parameters */
	private sortData(data: Reservation[], sort: Sort): Reservation[] {
		if (!sort.active || sort.direction === "") {
			return [...this.originalOrder];
		}

		return [...data].sort((a, b) => {
			const isAsc = sort.direction === "asc";

			switch (sort.active) {
				case "userName":
					return this.compare(this.getUserNameSync(a.userId).toLowerCase(), this.getUserNameSync(b.userId).toLowerCase(), isAsc);
				case "lotName":
					return this.compare(this.getLotNameSync(a.lotId).toLowerCase(), this.getLotNameSync(b.lotId).toLowerCase(), isAsc);
				case "checkInDateTime":
					return this.compare(a.checkInDateTime ? new Date(a.checkInDateTime).getTime() : 0, b.checkInDateTime ? new Date(b.checkInDateTime).getTime() : 0, isAsc);
				case "checkOutDateTime":
					return this.compare(a.checkOutDateTime ? new Date(a.checkOutDateTime).getTime() : 0, b.checkOutDateTime ? new Date(b.checkOutDateTime).getTime() : 0, isAsc);
				case "id":
					return this.compare(a.id, b.id, isAsc);
				case "spaceNumber":
					return this.compare(a.spaceId, b.spaceId, isAsc);
				case "status":
					return this.compare(a.status, b.status, isAsc);
				default:
					return 0;
			}
		});
	}

	/** Compare function for sorting */
	private compare(a: string | number, b: string | number, isAsc: boolean): number {
		return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
	}

	/** Apply pagination to the sorted data */
	private applyPagination(): void {
		const startIndex = this.pageIndex * this.pageSize;
		const endIndex = startIndex + this.pageSize;
		const paginatedData = this.allFilteredData.slice(startIndex, endIndex);

		// Update the existing dataSource's data instead of reassigning
		this.dataSource.data = paginatedData;
	}

	/** Handle sort change - sorts the entire dataset */
	protected handleSortChange(sort: Sort): void {
		// Update current sort state
		this.currentSort = sort;

		if (!sort.active || sort.direction === "") {
			// Reset to original order with current filters applied
			this.reapplyFilters();
			// Then apply original order
			this.allFilteredData = this.sortData(this.allFilteredData, { active: "", direction: "" });
		} else {
			// Apply sort to full dataset
			this.allFilteredData = this.sortData(this.allFilteredData, sort);
		}

		// Reset to first page
		this.pageIndex = 0;

		// Update paginated view
		this.applyPagination();

		// Update sort header state
		if (this.sort) {
			this.sort.active = sort.active;
			this.sort.direction = sort.direction;
		}
	}

	/** Reapply filters to maintain filter state after sort reset */
	private reapplyFilters(): void {
		// Get current filter values
		const search = this.searchInput$.getValue();
		const status = this.statusControl.value;
		const lot = this.lotControl.value;
		const user = this.userControl.value;

		let filtered = [...this.originalOrder];

		if (search) {
			const s = search.toLowerCase();
			filtered = filtered.filter((r) => {
				const userName = this.getUserNameSync(r.userId).toLowerCase();
				const lotName = this.getLotNameSync(r.lotId).toLowerCase();
				return r.id.toLowerCase().includes(s) || userName.includes(s) || lotName.includes(s);
			});
		}

		if (status) filtered = filtered.filter((r) => r.status === status);
		if (lot) filtered = filtered.filter((r) => r.lotId === lot);
		if (user) filtered = filtered.filter((r) => r.userId === user);

		this.allFilteredData = filtered;
		this.totalItems = filtered.length;
	}

	/** Handle page change */
	protected onPageChange(event: PageEvent): void {
		this.pageSize = event.pageSize;
		this.pageIndex = event.pageIndex;
		this.applyPagination();
	}

	/** Search handlers */
	protected onSearchInput(value: string): void {
		this.searchInput$.next(value);
	}

	protected clearSearch(): void {
		this.searchInput$.next("");
	}

	/** Check if any filters are active */
	protected hasActiveFilters(): boolean {
		return !!(this.searchInput$.getValue() || this.statusControl.value || this.lotControl.value || this.userControl.value);
	}

	/** Clear all filters */
	protected clearAllFilters(): void {
		this.clearSearch();
		this.statusControl.setValue(null);
		this.lotControl.setValue(null);
		this.userControl.setValue(null);
		this.statusFilter$.next(null);
		this.lotFilter$.next(null);
		this.userFilter$.next(null);
	}

	/** Get status label from value */
	protected getStatusLabel(value: string): string {
		return this.statusOptions.find((s) => s.value === value)?.label || value;
	}

	/** Get status icon */
	protected getStatusIcon(status: string): string {
		switch (status) {
			case "ACTIVE":
				return "schedule";
			case "COMPLETED":
				return "check_circle";
			case "CANCELLED":
				return "cancel";
			default:
				return "circle";
		}
	}

	/** Get user initials for avatar */
	protected getInitials(user: User): string {
		return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
	}

	protected getUserInitials(name: string): string {
		if (!name || name === "Unknown" || name === "Unknown User" || name === "Unknown Lot") return "?";
		const parts = name.split(" ");
		return parts.length > 1 ? `${parts[0].charAt(0)}${parts[1].charAt(0)}` : parts[0].charAt(0);
	}

	/** Column management */
	protected toggleColumn(column: string): void {
		const index = this.visibleColumns.indexOf(column);
		if (index === -1) {
			this.visibleColumns.push(column);
		} else {
			this.visibleColumns.splice(index, 1);
		}
		// Sort columns to maintain original order
		this.visibleColumns.sort((a, b) => this.allColumns.indexOf(a) - this.allColumns.indexOf(b));
		this.saveColumnPreferences();
	}

	protected getColumnLabel(column: string): string {
		const labels: Record<string, string> = {
			id: "ID",
			userName: "User",
			lotName: "Parking Lot",
			spaceNumber: "Space Number",
			checkInDateTime: "Check In",
			checkOutDateTime: "Check Out",
			status: "Status",
			actions: "Actions",
		};
		return labels[column] || column;
	}

	private loadColumnPreferences(): void {
		const saved = localStorage.getItem("dashboard-columns");
		if (saved) {
			try {
				const columns = JSON.parse(saved);
				if (Array.isArray(columns) && columns.length > 0) {
					this.visibleColumns = columns;
				}
			} catch (e) {
				// Use default
			}
		}
	}

	private saveColumnPreferences(): void {
		localStorage.setItem("dashboard-columns", JSON.stringify(this.visibleColumns));
	}

	/** CRUD actions */
	public openCreate(): void {
		const dialogRef = this.dialog.open(ReservationDialogComponent, {
			width: "800px",
			maxWidth: "95vw",
			data: {},
		});

		dialogRef
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(() => this.refresh$.next());
	}

	public openEdit(reservation: Reservation): void {
		const dialogRef = this.dialog.open(ReservationDialogComponent, {
			width: "800px",
			maxWidth: "95vw",
			data: reservation,
		});

		dialogRef
			.afterClosed()
			.pipe(filter(Boolean))
			.subscribe(() => this.refresh$.next());
	}

	public deleteReservation(id: string): void {
		if (confirm("Are you sure you want to delete this reservation?")) {
			this.api.deleteReservation(id).subscribe(() => this.refresh$.next());
		}
	}

	/** Synchronous lookup methods */
	protected getLotNameSync(lotId: string): string {
		return this.lotNameMap.get(lotId) || "Unknown Lot";
	}

	protected getUserNameSync(userId: string): string {
		return this.userNameMap.get(userId) || "Unknown User";
	}

	/** Check if data is still loading */
	protected isLoading(): boolean {
		return this.lotNameMap.size === 0 || this.userNameMap.size === 0;
	}

	/** Get start index for pagination display */
	protected getStartIndex(): number {
		return this.totalItems === 0 ? 0 : this.pageIndex * this.pageSize + 1;
	}

	/** Get end index for pagination display */
	protected getEndIndex(): number {
		return Math.min((this.pageIndex + 1) * this.pageSize, this.totalItems);
	}
}
