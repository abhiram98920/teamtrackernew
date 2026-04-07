import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get('project_name');

    try {
        let query = supabase
            .from('project_corrections')
            .select('*')
            .order('created_at', { ascending: false });

        if (projectName) {
            query = query.eq('project_name', projectName);
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ corrections: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { project_name, submitter_name, correction_text } = body;

        if (!project_name || !submitter_name || !correction_text) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase.from('project_corrections').insert([{
            project_name,
            submitter_name,
            correction_text,
            is_completed: false
        }]).select().single();

        if (error) throw error;
        return NextResponse.json({ correction: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, is_completed } = body;

        if (!id) {
            return NextResponse.json({ error: 'Correction ID required' }, { status: 400 });
        }

        const updateData: any = { is_completed };
        if (is_completed) {
            updateData.completed_at = new Date().toISOString();
        } else {
            updateData.completed_at = null;
        }

        const { data, error } = await supabase
            .from('project_corrections')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ correction: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
         return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    try {
        const { error } = await supabase.from('project_corrections').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
