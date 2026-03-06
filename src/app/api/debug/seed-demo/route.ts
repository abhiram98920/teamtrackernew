import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const results: Record<string, any> = {};

        // ── 1. Create the demo team ──────────────────────────────────────────
        const teamName = 'Demo Team';
        let teamId: string;

        const { data: existingTeam } = await supabaseAdmin
            .from('teams')
            .select('id')
            .eq('name', teamName)
            .maybeSingle();

        if (existingTeam) {
            teamId = existingTeam.id;
            results.team = { status: 'Already exists', id: teamId, name: teamName };
        } else {
            const { data: newTeam, error: teamError } = await supabaseAdmin
                .from('teams')
                .insert({ name: teamName })
                .select('id')
                .single();

            if (teamError) {
                return NextResponse.json({ error: `Team creation failed: ${teamError.message}` }, { status: 500 });
            }
            teamId = newTeam.id;
            results.team = { status: 'Created', id: teamId, name: teamName };
        }

        // ── 2. Create or update the auth user ────────────────────────────────
        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin123';
        let userId: string;

        // Try to create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { full_name: 'Admin User' },
        });

        if (authError) {
            if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                // User exists — fetch their ID
                const { data: users } = await supabaseAdmin.auth.admin.listUsers();
                const existing = users?.users?.find((u) => u.email === adminEmail);
                if (!existing) {
                    return NextResponse.json({ error: 'Auth user exists but could not be found.' }, { status: 500 });
                }
                userId = existing.id;

                // Update password to make sure it matches
                await supabaseAdmin.auth.admin.updateUserById(userId, { password: adminPassword });
                results.auth = { status: 'Already exists (password updated)', id: userId };
            } else {
                return NextResponse.json({ error: `Auth creation failed: ${authError.message}` }, { status: 500 });
            }
        } else {
            userId = authData.user.id;
            results.auth = { status: 'Created', id: userId };
        }

        // ── 3. Upsert user_profile ───────────────────────────────────────────
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                id: userId,
                email: adminEmail,
                full_name: 'Admin User',
                role: 'manager',       // manager role so they can see all data
                team_id: teamId,
            }, { onConflict: 'id' });

        if (profileError) {
            results.profile = { status: 'Failed', error: profileError.message };
        } else {
            results.profile = { status: 'Upserted', team_id: teamId };
        }

        return NextResponse.json({
            success: true,
            message: 'Demo account ready!',
            credentials: { email: adminEmail, password: adminPassword },
            results,
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
