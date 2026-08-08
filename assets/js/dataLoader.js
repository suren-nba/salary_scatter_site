export const SALARY_DATA_URL = new URL(
  "../../data/salary_scatter_web.json?v=data-20260730-1",
  import.meta.url,
).href;

let salaryDataPromise = null;

export function loadSalaryData() {
  if (salaryDataPromise) return salaryDataPromise;

  salaryDataPromise = fetch(SALARY_DATA_URL, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load salary data: HTTP ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      salaryDataPromise = null;
      throw error;
    });

  return salaryDataPromise;
}
