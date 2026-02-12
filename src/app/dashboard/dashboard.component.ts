import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';
import { Reservation } from '../models/parking.models';
import { MockApiObservableService } from '../services/mock-api-observable.service';
import { ReservationDialogComponent } from './reservation-dialog/reservation-dialog.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    MatTableModule,
    MatMenuModule,
    MatButtonModule,
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
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements AfterViewInit, OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private dialog = inject(MatDialog);
  private api = inject(MockApiObservableService);

  /** filters/search with debounce */
  private searchInput$ = new BehaviorSubject<string>('');
  protected search$ = this.searchInput$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    startWith(''),
  );

  protected statusFilter$ = new BehaviorSubject<string | null>(null);
  protected lotFilter$ = new BehaviorSubject<string | null>(null);
  protected userFilter$ = new BehaviorSubject<string | null>(null);

  /** trigger reload after create/delete */
  private refresh$ = new BehaviorSubject<void>(undefined);

  /** single datasource instance */
  protected dataSource = new MatTableDataSource<Reservation>([]);

  /** reference data with caching - initialize with empty array and shareReplay */
  protected parkingLots$ = this.api.getParkingLots().pipe(
    shareReplay(1),
    catchError(() => of([])),
    startWith([]),
  );

  protected users$ = this.api.getUsers().pipe(
    shareReplay(1),
    catchError(() => of([])),
    startWith([]),
  );

  /** Cached lookup maps */
  private lotNameMap = new Map<string, string>();
  private userNameMap = new Map<string, string>();

  /** Observable versions for template - emit immediately with current cache state */
  protected lotNameMap$: Observable<Map<string, string>>;
  protected userNameMap$: Observable<Map<string, string>>;

  /** Store original order for default sort */
  private originalOrder: Reservation[] = [];

  protected readonly displayedColumns = [
    'id',
    'userName',
    'lotName',
    'spaceNumber',
    'checkInDateTime',
    'checkOutDateTime',
    'status',
    'actions',
  ];

  constructor() {
    // Initialize with empty maps, update when data arrives
    this.lotNameMap$ = this.parkingLots$.pipe(
      map((lots) => {
        lots.map((lot) => this.lotNameMap.set(lot.id, lot.name));
        return new Map(this.lotNameMap);
      }),
      startWith(new Map()),
    );

    this.userNameMap$ = this.users$.pipe(
      map((users) => {
        users.map((user) => this.userNameMap.set(user.id, `${user.firstName} ${user.lastName}`));
        return new Map(this.userNameMap);
      }),
      startWith(new Map()),
    );
  }

  ngOnInit(): void {
    this.initializeDataSource();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Custom sort function to handle async data
    this.dataSource.sortingDataAccessor = (
      item: Reservation,
      property: string,
    ): string | number => {
      switch (property) {
        case 'userName':
          return this.userNameMap.get(item.userId)?.toLowerCase() || `zzz_${item.userId}`;
        case 'lotName':
          return this.lotNameMap.get(item.lotId)?.toLowerCase() || `zzz_${item.lotId}`;
        case 'checkInDateTime':
          return item.checkInDateTime ? new Date(item.checkInDateTime).getTime() : 0;
        case 'checkOutDateTime':
          return item.checkOutDateTime ? new Date(item.checkOutDateTime).getTime() : 0;
        case 'id':
          return item.id || '';
        case 'spaceNumber':
          return item.spaceId || '';
        case 'status':
          return item.status || '';
        default:
          return (item as any)[property] || '';
      }
    };
  }

  private initializeDataSource(): void {
    /** Combine filters + refresh to update table */
    combineLatest([
      this.refresh$.pipe(
        startWith(undefined),
        switchMap(() => this.api.getReservations().pipe(catchError(() => of([])))),
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
          lots.map((lot) => this.lotNameMap.set(lot.id, lot.name));
          users.map((user) => this.userNameMap.set(user.id, `${user.firstName} ${user.lastName}`));

          let filtered = [...reservations];

          // Store original order (by creation date or ID)
          this.originalOrder = [...reservations];

          /** search */
          if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter((r) => {
              const userName = this.userNameMap.get(r.userId)?.toLowerCase() || '';
              const lotName = this.lotNameMap.get(r.lotId)?.toLowerCase() || '';
              return r.id.toLowerCase().includes(s) || userName.includes(s) || lotName.includes(s);
            });
          }

          /** dropdown filters */
          if (status) filtered = filtered.filter((r) => r.status === status);
          if (lot) filtered = filtered.filter((r) => r.lotId === lot);
          if (user) filtered = filtered.filter((r) => r.userId === user);

          return filtered;
        }),
        tap((filtered) => (this.dataSource.data = filtered)),
      )
      .subscribe();
  }

  /** Handle sort change with proper cycle: asc → desc → default */
  protected handleSortChange(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      // Reset to default order (original order)
      this.dataSource.data = [...this.originalOrder];
      this.dataSource.sort = this.sort; // Reapply sort reference
    }
  }

  /** Handle search input with debounce */
  protected onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  /** CRUD actions */
  public openCreate(): void {
    const dialogRef = this.dialog.open(ReservationDialogComponent, {
      width: '750px',
      maxWidth: '95vw',
      data: {},
    });

    dialogRef
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.refresh$.next());
  }

  public openEdit(reservation: Reservation): void {
    const dialogRef = this.dialog.open(ReservationDialogComponent, {
      width: '750px',
      maxWidth: '95vw',
      data: reservation,
    });

    dialogRef
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.refresh$.next());
  }

  public deleteReservation(id: string): void {
    if (confirm('Are you sure you want to delete this reservation?')) {
      this.api.deleteReservation(id).subscribe(() => this.refresh$.next());
    }
  }

  /** Async helper mapping for template - uses cached maps immediately */
  protected getLotName(lotId: string): Observable<string> {
    return of(this.lotNameMap.get(lotId) || 'Loading...');
  }

  protected getUserName(userId: string): Observable<string> {
    return of(this.userNameMap.get(userId) || 'Loading...');
  }

  /** Check if data is still loading */
  protected isLoading(): boolean {
    return this.lotNameMap.size === 0 || this.userNameMap.size === 0;
  }
}
