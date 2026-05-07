import { Component, Inject, OnInit, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ProjectService } from '../../../projects/services/project';
import { InternDto } from '../../../../core/services/interns-api.service';
import { ProjectInternAllocationDto } from '../../../interns/models/intern.models';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-intern-details-dialog',
  standalone: false,
  templateUrl: './intern-details-dialog.html',
  styleUrl: './intern-details-dialog.scss'
})
export class InternDetailsDialog implements OnInit {
  public allocations = signal<ProjectInternAllocationDto[]>([]);
  public isLoading = signal(true);
  public error = signal<string | null>(null);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { intern: InternDto, projectIds: string[] },
    private dialogRef: MatDialogRef<InternDetailsDialog>,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    this.loadAllocations();
  }

  private loadAllocations(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // We fetch detailed allocations for each project where the intern is assigned
    const requests = this.data.projectIds.map(pid => 
      this.projectService.getInternAllocations(pid).pipe(
        catchError(() => of([] as ProjectInternAllocationDto[]))
      )
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        // Filter only allocations belonging to this intern
        const allAllocations = results.flat().filter(a => a.internId === this.data.intern.id);
        this.allocations.set(allAllocations);
      },
      error: (err) => {
        this.error.set('Failed to load allocation details.');
        console.error(err);
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
