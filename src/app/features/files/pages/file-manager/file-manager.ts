import { Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialog, ConfirmationDialogData } from '../../../../shared/components/confirmation-dialog/confirmation-dialog';
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
import { extractApiErrorMessages } from '../../../../shared/utils/api-error.util';

@Component({
  selector: 'app-file-manager',
  standalone: false,
  templateUrl: './file-manager.html',
  styleUrl: './file-manager.scss',
})
export class FileManager implements OnInit {
  private readonly allowedProjectFileExtensions = new Set(['.pdf', '.xlsx', '.docx', '.pptx']);
  private readonly allowedProjectFileContentTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]);
  private readonly maxProjectFileSizeBytes = 10 * 1024 * 1024;
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly fileService = inject(FileService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

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
  uploadFileError = '';
  versionFileError = '';

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
    const fileError = this.validateProjectFile(this.uploadFile);
    if (this.uploadForm.invalid || fileError || !this.hasProjectId) {
      this.uploadForm.markAllAsTouched();
      if (fileError) {
        this.uploadFileError = fileError;
        this.notifications.showWarning(fileError);
      }
      return;
    }

    this.isUploading = true;
    const uploadFile = this.uploadFile as File;
    const formValue = this.uploadForm.getRawValue();

    this.fileService
      .upload(this.currentProjectId, {
        file: uploadFile,
        fileType: Number(formValue.fileType),
        description: formValue.description?.trim() || null,
      } satisfies UploadProjectFileFormValue)
      .subscribe({
        next: (file) => {
          this.isUploading = false;
          this.uploadForm.reset({ fileType: null, description: '' });
          this.uploadFile = null;
          this.uploadFileError = '';
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
    const fileError = this.validateProjectFile(this.versionFile);
    if (!this.selectedFile || fileError || !this.hasProjectId || !this.isComplianceFile(this.selectedFile)) {
      if (fileError) {
        this.versionFileError = fileError;
        this.notifications.showWarning(fileError);
      }
      return;
    }

    this.isUploadingVersion = true;
    const versionFile = this.versionFile as File;

    this.fileService
      .uploadVersion(this.currentProjectId, this.selectedFile.id, {
        file: versionFile,
        description: this.versionForm.controls.description.value?.trim() || null,
      } satisfies UploadProjectFileVersionFormValue)
      .subscribe({
        next: (version) => {
          this.isUploadingVersion = false;
          this.versionFile = null;
          this.versionFileError = '';
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

    const data: ConfirmationDialogData = {
      title: 'Delete Project File',
      message: `Are you sure you want to delete "${file.originalFileName}"? This action cannot be undone and will remove all versions of this file.`,
      icon: 'delete_sweep',
      saveLabel: 'Delete File',
      saveColor: 'warn',
      cancelLabel: 'Cancel'
    };

    const dialogRef = this.dialog.open(ConfirmationDialog, {
      data,
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'save') {
        this.executeDelete(file);
      }
    });
  }

  private executeDelete(file: ProjectFileDto): void {
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
    const selectedFile = input.files?.[0] ?? null;
    const validationError = this.validateProjectFile(selectedFile);

    if (validationError) {
      this.uploadFile = null;
      this.uploadFileError = validationError;
      input.value = '';
      this.notifications.showWarning(validationError);
      return;
    }

    this.uploadFile = selectedFile;
    this.uploadFileError = '';
  }

  onVersionFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0] ?? null;
    const validationError = this.validateProjectFile(selectedFile);

    if (validationError) {
      this.versionFile = null;
      this.versionFileError = validationError;
      input.value = '';
      this.notifications.showWarning(validationError);
      return;
    }

    this.versionFile = selectedFile;
    this.versionFileError = '';
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

    const apiMessages = extractApiErrorMessages(apiError?.error);
    if (apiMessages.length > 0) {
      return apiMessages.join(' ');
    }

    if (apiError?.message) {
      return apiError.message;
    }

    return fallback;
  }

  private validateProjectFile(file: File | null): string {
    if (!file) {
      return 'Choose a file before uploading.';
    }

    if (file.size <= 0) {
      return 'File cannot be empty.';
    }

    if (file.size > this.maxProjectFileSizeBytes) {
      return 'File size cannot exceed 10 MB.';
    }

    const extension = this.fileExtension(file.name);
    if (!this.allowedProjectFileExtensions.has(extension)) {
      return 'Allowed file extensions are .pdf, .xlsx, .docx and .pptx.';
    }

    if (!this.allowedProjectFileContentTypes.has(file.type)) {
      return 'Allowed file types are PDF, Excel, Word and PowerPoint.';
    }

    return '';
  }

  private fileExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
  }
}
