export interface ProjectFileDto {
  id: string;
  projectId: string;
  fileType: number;
  fileTypeLabel: string;
  originalFileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  fileSizeLabel: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  versions: ProjectFileVersionDto[];
}

export interface ProjectFileVersionDto {
  id: string;
  projectFileId: string;
  versionNumber: number;
  originalFileName: string;
  fileUrl: string;
  contentType: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
}

export interface UpdateProjectFileDto {
  description?: string | null;
}

export interface UploadProjectFileFormValue {
  file: File;
  fileType: number;
  description?: string | null;
}

export interface UploadProjectFileVersionFormValue {
  file: File;
  description?: string | null;
}
