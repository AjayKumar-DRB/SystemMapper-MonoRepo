export interface ProjectionModel {
  id: string;
  nodes: unknown[];
  edges: unknown[];
}

export type FilterCriteria = Record<string, unknown>;
export type GroupCriteria = Record<string, unknown>;
