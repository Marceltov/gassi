// Runs once when the server starts: checks the configuration, opens the database (migrations) and prints the setup link
// while nobody set the server up. A missing or invalid variable stops the process with its name.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startup } = await import("@/backend");
  try {
    await startup();
  } catch (e) {
    console.error(`gassi cannot start: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
