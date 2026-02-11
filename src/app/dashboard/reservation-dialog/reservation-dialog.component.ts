import { Component, inject, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { Subject, takeUntil } from 'rxjs';
import { MOCK_PARKING_LOTS } from '../../data/mock-parking-lots';
import { MOCK_PARKING_SPACES } from '../../data/mock-parking-spaces';
import { ParkingLot, ParkingSpace } from '../../models/parking.models';

export enum ReservationStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled',
}

@Component({
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatDialogContent,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatSelect,
    MatOption,
    MatDialogActions,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTimepickerModule
  ],
  providers: [provideNativeDateAdapter()],
  selector: 'app-reservation-dialog',
  templateUrl: './reservation-dialog.component.html',
  styleUrls: ['./reservation-dialog.component.scss'],
})
export class ReservationDialogComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // Mock data
  parkingLots = MOCK_PARKING_LOTS;
  allParkingSpaces = MOCK_PARKING_SPACES;
  filteredSpaces: ParkingSpace[] = [];

  constructor(
    private dialogRef: MatDialogRef<ReservationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    console.log('Dialog data:', data);
    // if edit mode → patch values
    if (data) this.form.patchValue(data);
  }

  statuses = Object.values(ReservationStatus);

  // Updated form with proper types - dates/times should be Date | null, not strings
  form = this.fb.group({
    userId: ['', Validators.required],
    lotId: ['', Validators.required],
    spaceId: ['', Validators.required],
    checkInDate: [null as Date | null, Validators.required],
    checkInTime: [null as Date | null, Validators.required],
    checkOutDate: [null as Date | null, Validators.required],
    checkOutTime: [null as Date | null, Validators.required],
    status: [ReservationStatus.Pending, Validators.required],
    specialRequirements: [''],
    totalCost: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit() {
    this.setupDateTimeSync();
    this.setupLotChangeListener();
    
    // If editing and lotId is already set, filter spaces
    if (this.data?.lotId) {
      this.filterSpacesByLot(this.data.lotId);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Sets up listener for lot selection changes to filter spaces
   */
  private setupLotChangeListener() {
    this.form.get('lotId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(lotId => {
        if (lotId) {
          this.filterSpacesByLot(lotId);
          // Clear space selection when lot changes
          this.form.patchValue({ spaceId: '' }, { emitEvent: false });
        } else {
          this.filteredSpaces = [];
        }
      });
  }

  /**
   * Filters parking spaces by selected lot
   */
  private filterSpacesByLot(lotId: string) {
    this.filteredSpaces = this.allParkingSpaces.filter(space => space.lotId === lotId);
  }

  /**
   * Gets the display name for a parking lot
   */
  getLotName(lotId: string): string {
    const lot = this.parkingLots.find(l => l.id === lotId);
    return lot ? lot.name : lotId;
  }

  /**
   * Gets the display name for a parking space
   */
  getSpaceName(spaceId: string): string {
    const space = this.allParkingSpaces.find(s => s.id === spaceId);
    return space ? `${space.spaceNumber} (Level ${space.level})` : spaceId;
  }

  /**
   * Synchronizes date and time fields so that:
   * - When a date is selected, the time uses that date
   * - When a time is selected, it uses the corresponding date
   */
  private setupDateTimeSync() {
    // When check-in DATE changes, update check-in TIME to use that date
    this.form.get('checkInDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(date => {
        if (date) {
          const currentTime = this.form.get('checkInTime')?.value;
          if (currentTime) {
            // Preserve the hours/minutes but use the new date
            const updatedDateTime = this.combineDateAndTime(date, currentTime);
            this.form.patchValue({ checkInTime: updatedDateTime }, { emitEvent: false });
          } else {
            // Set default time (9:00 AM) on the selected date
            const defaultDateTime = new Date(date);
            defaultDateTime.setHours(9, 0, 0, 0);
            this.form.patchValue({ checkInTime: defaultDateTime }, { emitEvent: false });
          }
        }
      });

    // When check-in TIME changes, ensure it uses the check-in DATE
    this.form.get('checkInTime')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(time => {
        if (time) {
          const selectedDate = this.form.get('checkInDate')?.value;
          if (selectedDate) {
            const correctedDateTime = this.combineDateAndTime(selectedDate, time);
            // Only update if the dates don't match
            if (this.getDaysDifference(time, correctedDateTime) !== 0) {
              this.form.patchValue({ checkInTime: correctedDateTime }, { emitEvent: false });
            }
          }
        }
      });

    // When check-out DATE changes, update check-out TIME to use that date
    this.form.get('checkOutDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(date => {
        if (date) {
          const currentTime = this.form.get('checkOutTime')?.value;
          if (currentTime) {
            // Preserve the hours/minutes but use the new date
            const updatedDateTime = this.combineDateAndTime(date, currentTime);
            this.form.patchValue({ checkOutTime: updatedDateTime }, { emitEvent: false });
          } else {
            // Set default time (5:00 PM) on the selected date
            const defaultDateTime = new Date(date);
            defaultDateTime.setHours(17, 0, 0, 0);
            this.form.patchValue({ checkOutTime: defaultDateTime }, { emitEvent: false });
          }
        }
      });

    // When check-out TIME changes, ensure it uses the check-out DATE
    this.form.get('checkOutTime')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(time => {
        if (time) {
          const selectedDate = this.form.get('checkOutDate')?.value;
          if (selectedDate) {
            const correctedDateTime = this.combineDateAndTime(selectedDate, time);
            // Only update if the dates don't match
            if (this.getDaysDifference(time, correctedDateTime) !== 0) {
              this.form.patchValue({ checkOutTime: correctedDateTime }, { emitEvent: false });
            }
          }
        }
      });
  }

  /**
   * Combines a date with a time, preserving hours/minutes from time
   * @param date The date to use
   * @param time The time to extract hours/minutes from
   * @returns A new Date object with the combined date and time
   */
  private combineDateAndTime(date: Date, time: Date): Date {
    const combined = new Date(date);
    combined.setHours(time.getHours());
    combined.setMinutes(time.getMinutes());
    combined.setSeconds(0);
    combined.setMilliseconds(0);
    return combined;
  }

  /**
   * Gets the difference in days between two dates
   */
  private getDaysDifference(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  save() {
    if (this.form.invalid) return;
    
    const formValue = this.form.value;
    
    // Combine date and time into epoch timestamps
    const checkInDateTime = this.convertToEpoch(
      formValue.checkInDate ?? null, 
      formValue.checkInTime ?? null
    );
    const checkOutDateTime = this.convertToEpoch(
      formValue.checkOutDate ?? null, 
      formValue.checkOutTime ?? null
    );
    
    // Prepare the API payload
    const payload = {
      userId: formValue.userId,
      lotId: formValue.lotId,
      spaceId: formValue.spaceId,
      checkInDateTime: checkInDateTime,
      checkOutDateTime: checkOutDateTime,
      status: formValue.status,
      specialRequirements: formValue.specialRequirements,
      totalCost: formValue.totalCost,
    };
    
    console.log('API Payload:', payload);
    this.dialogRef.close(payload);
  }

  /**
   * Converts date and time to epoch timestamp (milliseconds)
   * @param date The date value
   * @param time The time value
   * @returns Epoch timestamp in milliseconds, or null if either value is missing
   */
  private convertToEpoch(date: Date | null, time: Date | null): number | null {
    if (!date || !time) return null;
    
    const combined = this.combineDateAndTime(date, time);
    return combined.getTime(); // Returns epoch in milliseconds
  }

  close() {
    this.dialogRef.close();
  }
}