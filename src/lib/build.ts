/**
 * Identifies the deployed bundle.
 *
 * This exists because a fix can look absent when it is really a stale cache,
 * and on a phone there is no console to check. Append `?rxdebug=1` to a
 * prescription URL and the dialog shows this value plus a readout of the export
 * pipeline, so "is the new code actually running" becomes a fact rather than a
 * guess. Bump it whenever the prescription export changes.
 */
export const BUILD_ID = "rx-2026.07.29-e";
