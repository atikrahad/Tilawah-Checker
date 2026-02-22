import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // In Next.js 15+ params is a Promise
) {
  try {
    const { id } = await params;
    
    // translations=131 (Clear Quran), audio=7 (Mishary)
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${id}?language=en&fields=text_uthmani&audio=7&translations=131`
    );
    const data = await res.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch verses" },
      { status: 500 }
    );
  }
}
