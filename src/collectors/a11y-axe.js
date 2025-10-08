export async function collectA11y(url) {
  return {
    tool: 'placeholder',
    url,
    summary: {
      violations: 0,
      passes: 10,
      incomplete: 0
    },
    notes: 'Vervang dit met axe-core/cli of Pa11y voor échte a11y checks.'
  };
}
