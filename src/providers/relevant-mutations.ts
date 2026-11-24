/** Ignore changes in unrelated content, while detecting a newly inserted or
 * removed subtree containing one of the observed controls. */
export function hasRelevantMutation(
  records: readonly MutationRecord[],
  selector: string,
): boolean {
  for (const record of records) {
    const target = record.target.nodeType === 1
      ? record.target as Element
      : record.target.parentElement;
    if (target?.closest(selector)) return true;
    for (const nodes of [record.addedNodes, record.removedNodes]) {
      for (const node of nodes) {
        if (node.nodeType !== 1) continue;
        const element = node as Element;
        if (element.matches(selector) || element.querySelector(selector)) return true;
      }
    }
  }
  return false;
}
