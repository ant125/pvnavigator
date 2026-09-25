/**
 * /calculate page scroll lives on the document, not the overflow-x-clip shell.
 * Always zero window + scrollingElement. Do not pick an inner clip ancestor.
 */
export function scrollPageToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  const scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    scrollingElement.scrollTop = 0;
  }
}
