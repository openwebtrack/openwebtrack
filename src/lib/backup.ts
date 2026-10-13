/**
 * OpenWebTrack backup format — a lossless JSON dump of one website's data that
 * another OpenWebTrack instance can import.
 *
 * Shape: { format, version, exportedAt, website, funnels, visitors, sessions, pageviews, events, payments }
 */
export const BACKUP_FORMAT = 'openwebtrack';
export const BACKUP_VERSION = 1;

/** Sections in dependency order: parents must be imported before the rows that reference them. */
export const BACKUP_SECTIONS = ['funnels', 'visitors', 'sessions', 'pageviews', 'events', 'payments'] as const;
export type BackupSection = (typeof BACKUP_SECTIONS)[number];

/** Max rows per section accepted by a single import request. */
export const BACKUP_MAX_ROWS_PER_CHUNK = 5000;
