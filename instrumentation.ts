// Runs once when the server starts: checks the configuration (a missing variable stops the start with its name) and
// opens the database, which runs the migrations, before the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { config, database } = await import("@/backend");
  config();
  await database();
}
