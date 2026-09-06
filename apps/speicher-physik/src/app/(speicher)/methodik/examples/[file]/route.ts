import { NextResponse } from "next/server";

import {
  isAllowedMethodikExample,
  readMethodikExampleCsv,
} from "@/lib/methodik/exampleCsv";

export function generateStaticParams() {
  return [{ file: "ev-home-charging-profile-example.csv" }];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> }
) {
  const { file } = await context.params;
  if (!isAllowedMethodikExample(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const csv = readMethodikExampleCsv(file);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
