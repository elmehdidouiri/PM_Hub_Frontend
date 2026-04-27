import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { NotificationService } from '../../../../core/services/notification.service';
import { ProjectFileType } from '../../../projects/models/project.enums';
import {
  ProjectFileDto,
  ProjectFileVersionDto,
  UpdateProjectFileDto,
  UploadProjectFileFormValue,
  UploadProjectFileVersionFormValue,
} from '../../models/file.models';
import { FileService } from '../../services/file';

@Component({
  selector: 'app-file-manager',
  standalone: false,
  templateUrl: './file-manager.html',
  styleUrl: './file-manager.scss',
})
export class FileManager implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly fileService = inject(FileService);
  private readonly notifications = inject(NotificationService);

  readonly projectForm = this.formBuilder.nonNullable.group({
    projectId: ['', [Validators.required, Validators.minLength(2)]],
  });

  readonly uploadForm = this.formBuilder.group({
    fileType: [null as number | null, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  readonly detailsForm = this.formBuilder.group({
    description: [''],
  });

  readonly versionForm = this.formBuilder.group({
    description: [''],
  });

  files: ProjectFileDto[] = [];
  versions: ProjectFileVersionDto[] = [];
  selectedFile: ProjectFileDto | null = null;
  uploadFile: File | null = null;
  versionFile: File | null = null;

  isLoading = false;
  isUploading = false;
  isSavingDetails = false;
  isUploadingVersion = false;
  deletingFileId: string | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const projectId = params.get('projectId') || this.route.snapshot.paramMap.get('projectId') || '';
      if (!projectId) {
        return;
      }

      this.projectForm.patchValue({ projectId });
      this.loadFiles();
    });
  }

  get totalStorageLabel(): string {
    const bytes = this.files.reduce((sum, file) => sum + (file.fileSize || 0), 0);
    if (!bytes) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  }

  get complianceFilesCount(): number {
    return this.files.filter((file) => this.isComplianceFile(file)).length;
  }

  get versionCount(): number {
    return this.files.reduce((sum, file) => sum + (file.versions?.length || 0), 0);
  }

  get knownFileTypes(): Array<{ value: number; label: string }> {
    const map = new Map<number, string>();

    this.files.forEach((file) => {
      if (!map.has(file.fileType)) {
        map.set(file.fileType, file.fileTypeLabel || `Type ${file.fileType}`);
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.value - right.value);
  }

  get hasProjectId(): boolean {
    return !!this.currentProjectId;
  }

  get currentProjectId(): string {
    return this.projectForm.controls.projectId.value.trim();
  }

  loadFiles(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.fileService.list(this.currentProjectId).subscribe({
      next: (files) => {
        this.isLoading = false;
        this.files = [...(files ?? [])].sort((left, right) =>
          (right.updatedAt || right.createdAt).localeCompare(left.updatedAt || left.createdAt)
        );

        if (!this.files.length) {
          this.selectedFile = null;
          this.versions = [];
          return;
        }

        const selected = this.files.find((file) => file.id === this.selectedFile?.id) || this.files[0];
        this.selectFile(selected, false);
      },
      error: (error) => {
        this.isLoading = false;
        this.files = [];
        this.selectedFile = null;
        this.versions = [];
        this.errorMessage = this.extractErrorMessage(error, 'Unable to load project files.');
      },
    });
  }

  submitUpload(): void {
    if (this.uploadForm.invalid || !this.uploadFile || !this.hasProjectId) {
      this.uploadForm.markAllAsTouched();
      if (!this.uploadFile) {
        this.notifications.showWarning('Choose a file before uploading.');
      }
      return;
    }

    this.isUploading = true;
    const formValue = this.uploadForm.getRawValue();

    this.fileService
      .upload(this.currentProjectId, {
        file: this.uploadFile,
        fileType: Number(formValue.fileType),
        description: formValue.description?.trim() || null,
      } satisfies UploadProjectFileFormValue)
      .subscribe({
        next: (file) => {
          this.isUploading = false;
          this.uploadForm.reset({ fileType: null, description: '' });
          this.uploadFile = null;
          this.notifications.showSuccess('File uploaded successfully.');

          if (file) {
            this.files = [file, ...this.files.filter((item) => item.id !== file.id)];
            this.selectFile(file);
          } else {
            this.loadFiles();
          }
        },
        error: (error) => {
          this.isUploading = false;
          this.notifications.showError(this.extractErrorMessage(error, 'Unable to upload file.'));
        },
      });
  }

  saveDetails(): void {
    if (!this.selectedFile || !this.hasProjectId || this.isSavingDetails) {
      return;
    }

    this.isSavingDetails = true;
    this.fileService
      .update(this.currentProjectId, this.selectedFile.id, {
        description: this.detailsForm.controls.description.value?.trim() || null,
      } satisfies UpdateProjectFileDto)
      .subscribe({
        next: (file) => {
          this.isSavingDetails = false;
          this.notifications.showSuccess('File details updated.');
          if (file) {
            this.patchFile(file);
          } else {
            this.loadFiles();
          }
        },
        error: (error) => {
          this.isSavingDetails = false;
          this.notifications.showError(this.extractErrorMessage(error, 'Unable to update file details.'));
        },
      });
  }

  uploadNewVersion(): void {
    if (!this.selectedFile || !this.versionFile || !this.hasProjectId || !this.isComplianceFile(this.selectedFile)) {
      if (!this.versionFile) {
        this.notifications.showWarning('Choose the new version file first.');
      }
      return;
    }

    this.isUploadingVersion = true;

    this.fileService
      .uploadVersion(this.currentProjectId, this.selectedFile.id, {
        file: this.versionFile,
        description: this.versionForm.controls.description.value?.trim() || null,
      } satisfies UploadProjectFileVersionFormValue)
      .subscribe({
        next: (version) => {
          this.isUploadingVersion = false;
          this.versionFile = null;
          this.versionForm.reset({ description: '' });
          this.notifications.showSuccess('New file version uploaded.');

          if (version && this.selectedFile) {
            this.versions = [version, ...this.versions];
            const updatedFile: ProjectFileDto = {
              ...this.selectedFile,
              versions: [version, ...(this.selectedFile.versions || [])],
              updatedAt: version.createdAt,
            };
            this.patchFile(updatedFile);
          } else {
            this.refreshSelectedVersions();
          }
        },
        error: (error) => {
          this.isUploadingVersion = false;
          this.notifications.showError(this.extractErrorMessage(error, 'Unable to upload the new version.'));
        },
      });
  }

  download(file: ProjectFileDto): void {
    if (!this.hasProjectId) {
      return;
    }

    this.fileService.download(this.currentProjectId, file.id).subscribe({
      next: (blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = file.originalFileName || 'download';
        anchor.click();
        window.URL.revokeObjectURL(blobUrl);
      },
      error: (error) => {
        this.notifications.showError(this.extractErrorMessage(error, 'Unable to download this file.'));
      },
    });
  }

  delete(file: ProjectFileDto): void {
    if (!this.hasProjectId || this.deletingFileId) {
      return;
    }

    const confirmed = window.confirm(`Delete "${file.originalFileName}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.deletingFileId = file.id;
    this.fileService.delete(this.currentProjectId, file.id).subscribe({
      next: () => {
        this.deletingFileId = null;
        this.notifications.showSuccess('File deleted successfully.');
        this.files = this.files.filter((item) => item.id !== file.id);
        if (this.selectedFile?.id === file.id) {
          this.selectedFile = this.files[0] ?? null;
          this.versions = this.selectedFile?.versions || [];
          this.detailsForm.patchValue({ description: this.selectedFile?.description || '' });
        }
      },
      error: (error) => {
        this.deletingFileId = null;
        this.notifications.showError(this.extractErrorMessage(error, 'Unable to delete this file.'));
      },
    });
  }

  selectFile(file: ProjectFileDto, reloadVersions = true): void {
    this.selectedFile = file;
    this.detailsForm.patchValue({ description: file.description || '' });
    this.versions = [...(file.versions || [])].sort((left, right) => right.versionNumber - left.versionNumber);

    if (reloadVersions) {
      this.refreshSelectedVersions();
    }
  }

  onUploadFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = input.files?.[0] ?? null;
  }

  onVersionFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.versionFile = input.files?.[0] ?? null;
  }

  isComplianceFile(file: ProjectFileDto | null): boolean {
    if (!file) {
      return false;
    }

    if (file.fileType === ProjectFileType.Compliance) {
      return true;
    }

    const label = file?.fileTypeLabel?.trim().toLowerCase() || '';
    return label === 'compliance' || label.includes('compliance');
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Not available';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
  }

  trackByFileId(_: number, file: ProjectFileDto): string {
    return file.id;
  }

  trackByVersionId(_: number, version: ProjectFileVersionDto): string {
    return version.id;
  }

  private refreshSelectedVersions(): void {
    if (!this.selectedFile || !this.hasProjectId) {
      return;
    }

    this.fileService.listVersions(this.currentProjectId, this.selectedFile.id).subscribe({
      next: (versions) => {
        this.versions = [...(versions ?? [])].sort((left, right) => right.versionNumber - left.versionNumber);
        this.selectedFile = this.selectedFile
          ? {
              ...this.selectedFile,
              versions: this.versions,
            }
          : null;
      },
      error: () => {
        this.versions = [...(this.selectedFile?.versions || [])].sort((left, right) => right.versionNumber - left.versionNumber);
      },
    });
  }

  private patchFile(file: ProjectFileDto): void {
    this.files = [file, ...this.files.filter((item) => item.id !== file.id)].sort((left, right) =>
      (right.updatedAt || right.createdAt).localeCompare(left.updatedAt || left.createdAt)
    );
    this.selectedFile = this.files.find((item) => item.id === file.id) ?? file;
    this.detailsForm.patchValue({ description: this.selectedFile.description || '' });
    this.versions = [...(this.selectedFile.versions || [])].sort((left, right) => right.versionNumber - left.versionNumber);
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    const apiError = error as {
      error?: { errors?: string[]; message?: string };
      message?: string;
    };

    if (Array.isArray(apiError?.error?.errors) && apiError.error.errors.length > 0) {
      return apiError.error.errors[0];
    }

    if (apiError?.error?.message) {
      return apiError.error.message;
    }

    if (apiError?.message) {
      return apiError.message;
    }

    return fallback;
  }
}
