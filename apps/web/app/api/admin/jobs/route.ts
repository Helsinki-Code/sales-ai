import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
export async function GET(){ const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Unauthorized"},{status:401}); const {workspaceId}=await getWorkspaceContext(user.id); const {data,error}=await supabase.from("jobs").select("id,status,endpoint,stage,progress,created_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(100); if(error) return NextResponse.json({error:error.message},{status:500}); return NextResponse.json({jobs:data}); }
