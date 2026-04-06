import { NextResponse } from "next/server";
import { SOCKET_URL } from "@/lib/env";

export const GET = async () => {
  try {
    const response = await fetch(`${SOCKET_URL}/orderbook`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Indexer request failed with ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch orderbook from indexer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};
