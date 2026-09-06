# Supabase

Version-controlled schema for the existing PVNavigator Supabase project.

Convention:

- SQL migrations live in `migrations/`
- Do not create production tables only in the Dashboard
- Do not use Prisma

Apply migrations with the Supabase CLI (`supabase db push`) or the equivalent project migration API. The Data API must keep using the anon / publishable key in clients; never the service role.
