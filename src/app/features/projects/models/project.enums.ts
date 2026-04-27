export * from '../../../core/models/project-enums';

export enum StrategicCriterionType {
  FinancialImpact = 1,
  CustomerImpact = 2,
  OperationalEfficiency = 3,
  StrategicAlignment = 4,
  CrossFunctionalImpact = 5,
  InnovationDigitalisation = 6,
  RiskMitigationUrgency = 7,
  SustainabilityESG = 8,
}

export enum StrategicCriterionScore {
  Low = 1,
  Medium = 3,
  High = 5,
}

export enum DeliverablePriority {
  Low = 0,
  Medium = 1,
  High = 2,
}

export enum RoadblockStatus {
  Open = 0,
  Resolved = 1,
}

export enum BookingType {
  Normal = 0,
  Premium = 1,
}

export enum ProjectFileType {
  BRD = 0,
  FDD = 1,
  PROCESS = 2,
  UAT = 3,
  RiskAssessment = 4,
  Timeline = 5,
  StrategicEvaluation = 6,
  OnePager = 7,
  SharePoint = 8,
  SAPApproval = 9,
  Compliance = 10,
}
