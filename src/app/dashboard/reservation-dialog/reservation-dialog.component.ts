import { CommonModule } from '@angular/common';
import { Component, inject, Inject, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  MatNativeDateModule,
  MatOptionModule,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { Subject, takeUntil } from 'rxjs';
import { MOCK_PARKING_LOTS } from '../../data/mock-parking-lots';
import { MOCK_PARKING_SPACES } from '../../data/mock-parking-spaces';
import {
  CreateReservationDto,
  ParkingLot,
  ParkingSpace,
  Reservation,
  ReservationStatus,
  UpdateReservationDto,
} from '../../models/parking.models';
import { MockApiObservableService } from '../../services/mock-api-observable.service';

@Component({
  selector: 'app-reservation-dialog',
  templateUrl: './reservation-dialog.component.html',
  styleUrls: ['./reservation-dialog.component.scss'],
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
  ],
  providers: [provideNativeDateAdapter()],
})
export class ReservationDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private reservationService = inject(MockApiObservableService);
  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<ReservationDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: Reservation | null,
  ) {}

  public parkingLots: ParkingLot[] = MOCK_PARKING_LOTS;
  public allParkingSpaces: ParkingSpace[] = MOCK_PARKING_SPACES;
  public filteredSpaces: ParkingSpace[] = [];

  public isLoading = false;

  statuses = Object.values(ReservationStatus);

  // ✅ typed form
  form = this.fb.group(
    {
      userId: ['', Validators.required],
      lotId: ['', Validators.required],
      spaceId: ['', Validators.required],
      checkInDate: [null as Date | null, Validators.required],
      checkInTime: [null as Date | null, Validators.required],
      checkOutDate: [null as Date | null, Validators.required],
      checkOutTime: [null as Date | null, Validators.required],
      status: [ReservationStatus.PENDING, Validators.required],
      specialRequirements: [''],
      totalCost: [0, [Validators.required, Validators.min(0)]],
    },
    { validators: this.dateRangeValidator.bind(this) },
  );

  // ================= INIT =================
  ngOnInit() {
    this.setupLotChangeListener();
    this.setupDateTimeSync();

    if (this.data) {
      this.patchForEdit(this.data);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public endDateFilter = (date: Date | null): boolean => {
    const start = this.form.get('checkInDate')?.value;
    if (!start || !date) return true;

    const min = new Date(start);
    min.setDate(min.getDate() - 1);

    return date > min;
  };

  public save(): void {
    if (this.form.invalid) {
      console.log(this.form.value);
      this.form.markAllAsTouched(); // ⭐ MAGIC LINE
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
        specialRequirements: v.specialRequirements || '',
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
        specialRequirements: v.specialRequirements || '',
      };

      this.reservationService.createReservation(payload).subscribe(() => {
        this.dialogRef.close(true);
      });
    }
  }

  public close() {
    this.dialogRef.close();
  }

  // ================= PATCH =================
  private patchForEdit(reservation: Reservation) {
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
  }

  // ================= VALIDATOR =================
  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const inDate = group.get('checkInDate');
    const inTime = group.get('checkInTime');
    const outDate = group.get('checkOutDate');
    const outTime = group.get('checkOutTime');

    if (!inDate?.value || !inTime?.value || !outDate?.value || !outTime?.value) {
      return null;
    }

    const start = this.combineDateAndTime(inDate.value, inTime.value);
    const end = this.combineDateAndTime(outDate.value, outTime.value);

    const invalid = end.getTime() <= start.getTime();

    // ⭐ CLEAR OLD ERRORS FIRST
    [outDate, outTime].forEach((c) => {
      if (c?.hasError('invalidDateRange')) {
        const e = { ...c.errors };
        delete e['invalidDateRange'];
        c.setErrors(Object.keys(e).length ? e : null);
      }
    });

    if (!invalid) return null;

    // ⭐ ADD ERROR TO CONTROLS
    outDate?.setErrors({ ...(outDate.errors || {}), invalidDateRange: true });
    outTime?.setErrors({ ...(outTime.errors || {}), invalidDateRange: true });

    return { invalidDateRange: true };
  }

  // ================= DATE FILTER =================

  // ================= LOT =================
  private setupLotChangeListener() {
    this.form
      .get('lotId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((lotId) => {
        if (!lotId) {
          this.filteredSpaces = [];
          return;
        }
        this.filterSpacesByLot(lotId);
        this.form.patchValue({ spaceId: '' }, { emitEvent: false });
      });
  }

  private filterSpacesByLot(lotId: string) {
    this.filteredSpaces = this.allParkingSpaces.filter((s) => s.lotId === lotId);
  }

  // ================= SYNC =================
  private setupDateTimeSync() {
    this.sync('checkInDate', 'checkInTime', 9);
    this.sync('checkOutDate', 'checkOutTime', 17);
  }

  private sync(dateKey: string, timeKey: string, defaultHour: number) {
    this.form
      .get(dateKey)
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((date: Date | null) => {
        if (!date) return;

        const time = this.form.get(timeKey)?.value;

        if (time) {
          this.form.patchValue(
            { [timeKey]: this.combineDateAndTime(date, time) },
            { emitEvent: false },
          );
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

  // ================= TIME MIN =================
  private getNow(): Date {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  }

  private isToday(date: Date | null | undefined): boolean {
    if (!date) return false;

    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  get checkInMinTime(): Date | null {
    const date = this.form.get('checkInDate')?.value;
    return this.isToday(date) ? this.getNow() : null;
  }

  get checkOutMinTime(): Date | null {
    const date = this.form.get('checkOutDate')?.value;
    return this.isToday(date) ? this.getNow() : null;
  }

  // ================= SAVE =================
}
