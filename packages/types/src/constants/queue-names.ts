/**
 * Queue names for BullMQ.
 * Note: BullMQ v5+ does not allow colons (:) in queue names as they are
 * reserved for Redis key namespacing. Use hyphens instead.
 */
export const QueueNames = {
  SCAN: 'systemmapper-repository-scan',
  PARSE: 'systemmapper-repository-parse',
  GRAPH_BUILD: 'systemmapper-graph-build',
  GRAPH_UPDATE: 'systemmapper-graph-update',
  BLAST_RADIUS: 'systemmapper-blast-radius',
  METRICS: 'systemmapper-metrics',
  NOTIFICATIONS: 'systemmapper-notifications',
  CLEANUP: 'systemmapper-cleanup',
  RETRY: 'systemmapper-retry',
} as const;
