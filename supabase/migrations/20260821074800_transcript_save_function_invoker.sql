alter function public.save_transcript_content(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) security invoker;
revoke execute on function public.save_transcript_content(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.save_transcript_content(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) to authenticated;
