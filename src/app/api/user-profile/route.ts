import { NextRequest, NextResponse } from 'next/server';
import { SynthesisService } from '@/lib/services/synthesisService';
import { KarmaService } from '@/lib/services/karmaService';
import { createLogger } from '@/lib/logger';

const logger = createLogger('UserProfileAPI');

export async function GET() {
  try {
    const profile = await KarmaService.getLatestProfile();
    const recentLogs = await KarmaService.getRecentLogs(10);
    
    return NextResponse.json({
      success: true,
      data: {
        profile,
        recentLogs
      }
    });
  } catch (error) {
    logger.error('Failed to fetch user profile', { error });
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { force } = await req.json();
    const newProfile = await SynthesisService.synthesizeProfile(force);
    
    return NextResponse.json({
      success: true,
      data: newProfile
    });
  } catch (error) {
    logger.error('Failed to synthesize user profile', { error });
    return NextResponse.json({ success: false, error: 'Synthesis failed' }, { status: 500 });
  }
}
