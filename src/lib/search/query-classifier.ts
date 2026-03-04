export function classifyQuery(input: string): string {
  if (!input) return "general";
  const s = input.toLowerCase();
  if (s.includes("stock") || s.includes("finance") || s.includes("market")) return "finance_news";
  if (s.includes("encyclopedia") || s.includes("wiki")) return "encyclopedia";
  if (s.includes("academic") || s.includes("paper") || s.includes("research")) return "academic";
  return "general";
}

export function quickClassify(input: string): string {
  return classifyQuery(input);
}
