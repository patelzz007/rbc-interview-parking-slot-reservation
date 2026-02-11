import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MockApiService } from '../services/mock-api.service';
import { DatePipe } from '@angular/common';
import { ReservationDialogComponent } from './reservation-dialog/reservation-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-dashboard',
  imports: [MatTableModule, MatMenuModule, MatButtonModule, DatePipe, MatDialogModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  constructor(private dialog: MatDialog) {}

  private readonly mockApiService = inject(MockApiService);

  // Get reservations using the mock API service
  protected readonly reservations = this.mockApiService.getReservations();

  // Access reference data signals
  protected readonly parkingLots = this.mockApiService.parkingLots;
  protected readonly parkingSpaces = this.mockApiService.parkingSpaces;
  protected readonly users = this.mockApiService.users;

  // Define columns for the table
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

  openCreate() {
    this.dialog.open(ReservationDialogComponent, {
      width: '500px',
      data: {},
    });
  }

  public deleteReservation(): void {
    // Implement deletion logic here
    console.log('Delete reservation clicked');
  }

  // Helper methods to map IDs to display values
  protected getLotName(lotId: string): string {
    return this.parkingLots().find((lot) => lot.id === lotId)?.name || 'Unknown';
  }

  protected getSpaceNumber(spaceId: string): string {
    return this.parkingSpaces().find((space) => space.id === spaceId)?.spaceNumber || 'Unknown';
  }

  protected getUserName(userId: string): string {
    const user = this.users().find((u) => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  }
}
