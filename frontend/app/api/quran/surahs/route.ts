import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters?language=en");
    const data = await res.json();
    
    return NextResponse.json(data.chapters);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch surahs" },
      { status: 500 }
    );
  }
}
