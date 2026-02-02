const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";

type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  details?: string;
};

const runCheck = async (name: string, url: string): Promise<CheckResult> => {
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return {
        name,
        ok: false,
        status: response.status,
        details: `Non-200 response from ${url}`,
      };
    }
    return { name, ok: true, status: response.status };
  } catch (error) {
    return {
      name,
      ok: false,
      details: `Request failed for ${url}: ${String(error)}`,
    };
  }
};

const printResult = (result: CheckResult) => {
  const statusPart =
    result.status !== undefined ? ` (status ${result.status})` : "";
  const detailsPart = result.details ? ` - ${result.details}` : "";
  const prefix = result.ok ? "OK" : "FAIL";
  console.log(`${prefix} ${result.name}${statusPart}${detailsPart}`);
};

const main = async () => {
  const checks: Array<Promise<CheckResult>> = [
    runCheck("health", `${SERVER_URL}/api/health`),
  ];

  const results = await Promise.all(checks);
  results.forEach(printResult);

  const failed = results.some((result) => !result.ok);
  if (failed) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error("Server checkup failed:", error);
  process.exitCode = 1;
});
