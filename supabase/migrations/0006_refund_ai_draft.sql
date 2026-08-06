-- creagent — give a draft back when the draft never happened.
-- Run after 0005_polar_billing.sql.

-- consume_ai_draft() charges before the model is called, because the check and
-- the increment have to be one statement or two concurrent drafts both take the
-- last slot. That ordering is right, and it leaves one hole: when Foundry
-- answers 502, or returns something that will not parse, the visitor has paid
-- for a draft they never received. On Free that is one of ten.
--
-- This is the other half. Deliberately not a general "set my counter": it only
-- ever subtracts one, only from the caller's own row, only for the current
-- month, and never below zero — so the worst a caller can do by shouting it at
-- PostgREST is refund drafts they already spent, which is the same position
-- they would be in by simply not drafting.
create or replace function public.refund_ai_draft()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  update public.ai_usage
     set drafts = greatest(drafts - 1, 0)
   where user_id = uid
     and month = date_trunc('month', now())::date;
end;
$$;

revoke all on function public.refund_ai_draft() from public;
grant execute on function public.refund_ai_draft() to authenticated;
