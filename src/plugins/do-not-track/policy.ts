/** Source selection for the real NETWORK tracker blocker.
 * The 'In player' JSON hook is not a tracker request blocker.
 */
export const EASYLIST = 'https://easylist.to/easylist/easylist.txt';
export const EASYPRIVACY = 'https://easylist.to/easylist/easyprivacy.txt';

export function buildTrackerListSources(
  additionalBlockLists: string[],
  disableDefaultLists: boolean | unknown[] = false,
) {
  const disableDefaults = Array.isArray(disableDefaultLists)
    ? disableDefaultLists.length > 0
    : disableDefaultLists === true;
  const extra = additionalBlockLists.filter((url) => /^https:\/\//i.test(url));
  const urls = [
    ...(!disableDefaults ? [EASYLIST, EASYPRIVACY] : []),
    ...extra,
  ];
  if (urls.length === 0) {
    throw new Error('Ne pas traquer : aucune liste de blocage sélectionnée');
  }
  return { disableDefaults, extra, urls };
}
