import { rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/** Publish only a finished build; a failed replacement restores the previous one. */
export async function publishBuild(staged, target, move = rename) {
  if (!(await stat(staged)).isDirectory()) throw new Error('Staged build must be a directory');
  const backup = `${target}.previous-${randomUUID()}`;
  let previous = false;
  try { await move(target, backup); previous = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await move(staged, target); }
  catch (error) {
    if (previous) {
      try { await move(backup, target); }
      catch (restoreError) {
        // Keep this backup outside the staging directory: cleanup must not erase it.
        throw new AggregateError([error, restoreError], `Build replacement failed. Previous build preserved at ${backup}`);
      }
    }
    throw error;
  }
  if (previous) await rm(backup, { recursive: true, force: true });
}
