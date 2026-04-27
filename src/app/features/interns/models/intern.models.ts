export interface InternDto {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  supervisorId: string;
  supervisorName: string;
  supervisorEmail: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateInternDto {
  name: string;
  roleId: string;
  supervisorId: string;
}

export interface UpdateInternDto {
  id: string;
  name: string;
  roleId: string;
  supervisorId: string;
}

export interface ProjectInternAllocationDto {
  internAllocationId: string;
  internId: string;
  internName: string;
  roleId: string;
  roleName: string;
  supervisorId: string;
  supervisorName: string;
  supervisorEmail: string;
  allocatedHours: number;
  hoursWorked: number;
  remainingHours: number;
  allocationDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  hourEntries: InternHourEntryDto[];
}

export interface InternHourEntryDto {
  id: string;
  internAllocationId: string;
  bookedByUserId: string;
  bookedByUserName: string;
  date: string;
  hours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateProjectInternAllocationDto {
  internId: string;
  allocatedHours: number;
  allocationDate?: string | null;
  notes?: string | null;
}

export interface UpdateProjectInternAllocationDto {
  allocatedHours: number;
  allocationDate: string;
  notes?: string | null;
}

export interface CreateInternHourEntryDto {
  date: string;
  hours: number;
  notes?: string | null;
}

export interface UpdateInternHourEntryDto {
  date: string;
  hours: number;
  notes?: string | null;
}
