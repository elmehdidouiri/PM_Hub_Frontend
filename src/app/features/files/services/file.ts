import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ProjectFilesApiService } from '../../../core/services/project-files-api.service';
import {
  ProjectFileDto,
  ProjectFileVersionDto,
  UpdateProjectFileDto,
  UploadProjectFileFormValue,
  UploadProjectFileVersionFormValue,
} from '../models/file.models';

type UnknownRecord = Record<string, unknown>;

@Injectable({
  providedIn: 'root',
})
export class FileService {
  constructor(private readonly projectFilesApi: ProjectFilesApiService) {}

  list(projectId: string): Observable<ProjectFileDto[]> {
    return this.projectFilesApi.list(projectId).pipe(
      map((items) => (Array.isArray(items) ? items : []).map((item) => this.toProjectFileDto(item)))
    );
  }

  get(projectId: string, id: string): Observable<ProjectFileDto | null> {
    return this.projectFilesApi.get(projectId, id).pipe(map((item) => (item ? this.toProjectFileDto(item) : null)));
  }

  update(projectId: string, id: string, payload: UpdateProjectFileDto): Observable<ProjectFileDto | null> {
    return this.projectFilesApi.update(projectId, id, payload).pipe(map((item) => (item ? this.toProjectFileDto(item) : null)));
  }

  upload(projectId: string, payload: UploadProjectFileFormValue): Observable<ProjectFileDto | null> {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('fileType', String(payload.fileType));

    if (payload.description?.trim()) {
      formData.append('description', payload.description.trim());
    }

    return this.projectFilesApi.upload(projectId, formData).pipe(map((item) => (item ? this.toProjectFileDto(item) : null)));
  }

  listVersions(projectId: string, id: string): Observable<ProjectFileVersionDto[]> {
    return this.projectFilesApi.listVersions(projectId, id).pipe(
      map((items) => (Array.isArray(items) ? items : []).map((item) => this.toProjectFileVersionDto(item)))
    );
  }

  uploadVersion(projectId: string, id: string, payload: UploadProjectFileVersionFormValue): Observable<ProjectFileVersionDto | null> {
    const formData = new FormData();
    formData.append('file', payload.file);

    if (payload.description?.trim()) {
      formData.append('description', payload.description.trim());
    }

    return this.projectFilesApi.uploadVersion(projectId, id, formData).pipe(
      map((item) => (item ? this.toProjectFileVersionDto(item) : null))
    );
  }

  delete(projectId: string, id: string): Observable<void> {
    return this.projectFilesApi.delete(projectId, id);
  }

  download(projectId: string, id: string): Observable<Blob> {
    return this.projectFilesApi.download(projectId, id);
  }

  private toProjectFileDto(value: unknown): ProjectFileDto {
    const record = this.asRecord(value);

    return {
      id: this.readString(record, ['id']),
      projectId: this.readString(record, ['projectId']),
      fileType: this.readNumber(record, ['fileType']),
      fileTypeLabel: this.readString(record, ['fileTypeLabel']),
      originalFileName: this.readString(record, ['originalFileName']),
      fileUrl: this.readString(record, ['fileUrl']),
      contentType: this.readString(record, ['contentType']),
      fileSize: this.readNumber(record, ['fileSize']),
      fileSizeLabel: this.readString(record, ['fileSizeLabel']),
      description: this.readNullableString(record, ['description']),
      createdAt: this.readString(record, ['createdAt']),
      updatedAt: this.readNullableString(record, ['updatedAt']),
      versions: this.readArray(record, ['versions']).map((item) => this.toProjectFileVersionDto(item)),
    };
  }

  private toProjectFileVersionDto(value: unknown): ProjectFileVersionDto {
    const record = this.asRecord(value);

    return {
      id: this.readString(record, ['id']),
      projectFileId: this.readString(record, ['projectFileId']),
      versionNumber: this.readNumber(record, ['versionNumber']),
      originalFileName: this.readString(record, ['originalFileName']),
      fileUrl: this.readString(record, ['fileUrl']),
      contentType: this.readString(record, ['contentType']),
      fileSize: this.readNumber(record, ['fileSize']),
      description: this.readNullableString(record, ['description']),
      createdAt: this.readString(record, ['createdAt']),
    };
  }

  private asRecord(value: unknown): UnknownRecord {
    return typeof value === 'object' && value !== null ? (value as UnknownRecord) : {};
  }

  private readArray(record: UnknownRecord, keys: string[]): unknown[] {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  private readString(record: UnknownRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        return value.trim();
      }
    }

    return '';
  }

  private readNullableString(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        return value.trim();
      }

      if (value === null) {
        return null;
      }
    }

    return null;
  }

  private readNumber(record: UnknownRecord, keys: string[]): number {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
        return Number(value);
      }
    }

    return 0;
  }
}
