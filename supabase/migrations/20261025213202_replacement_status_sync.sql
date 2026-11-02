-- A finished replacement whose local subscription is still open is listed again
-- so the daily follow-up can set that status to canceled. The row does not
-- ask Stripe to cancel a second time. An unfinished replacement stays in the
-- list until Stripe has accepted the cancellation.

drop function if exists public.list_pending_subscription_replacements();

create function public.list_pending_subscription_replacements()
returns table (
  stripe_invoice_id text,
  replaces_subscription_id text,
  stripe_customer_id text,
  status_sync_only boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.stripe_invoice_id,
         i.replaces_subscription_id,
         i.stripe_customer_id,
         i.replacement_finished_at is not null
    from public.stripe_invoices i
    left join public.stripe_subscriptions s
      on s.stripe_subscription_id = i.replaces_subscription_id
     and s.user_id = i.user_id
   where i.replaces_subscription_id is not null
     and i.status = 'paid'
     and (
       i.replacement_finished_at is null
       or s.status in ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused')
     );
$$;

revoke all on function public.list_pending_subscription_replacements() from public, anon, authenticated;
grant execute on function public.list_pending_subscription_replacements() to postgres, service_role;
