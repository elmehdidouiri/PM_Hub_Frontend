export interface BaseReferenceDto {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface DescribedReferenceDto extends BaseReferenceDto {
  description?: string;
}

export interface BusinessUnitDto extends DescribedReferenceDto {}

export interface TechnologyDto extends DescribedReferenceDto {}

export interface SolutionDomainDto extends DescribedReferenceDto {}

export interface PlantDto extends DescribedReferenceDto {
  departmentCount?: number;
}

export interface DepartmentDto extends BaseReferenceDto {
  businessUnitId: string;
  businessUnitName?: string;
  plantId: string;
  plantName?: string;
}

