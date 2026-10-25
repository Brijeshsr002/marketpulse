import { connection } from "next/server";
import { json, preflight } from "@/lib/http";
import { getOverview } from "@/lib/market";

export async function GET() {
  await connection();
  return json(await getOverview());
}

export const OPTIONS = preflight;
