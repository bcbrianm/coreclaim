CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.app_role AS ENUM ('mechanic','shop_user','super_user','admin');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  timezone text NOT NULL DEFAULT 'America/Denver',
  labor_rate_hourly numeric(10,2) NOT NULL DEFAULT 150.00,
  inbound_email_alias text NOT NULL UNIQUE DEFAULT ('shop-' || left(replace(gen_random_uuid()::text,'-',''),8) || '@inbound.coreclaim.io'),
  stripe_customer_id text,
  subscription_tier text NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter','pro')),
  subscription_status text NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('trialing','active','past_due','canceled')),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'shop_user',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_shop_members_unique_auth_user ON public.shop_members(shop_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_shop_members_user ON public.shop_members(user_id);

CREATE OR REPLACE FUNCTION public.is_shop_member(target_shop_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = target_shop_id AND user_id = auth.uid() AND is_active = true)
$$;
CREATE OR REPLACE FUNCTION public.has_shop_role(target_shop_id uuid, allowed_roles public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = target_shop_id AND user_id = auth.uid() AND is_active = true AND role = ANY(allowed_roles))
$$;

CREATE TABLE public.shop_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  sms_provider text NOT NULL DEFAULT 'none' CHECK (sms_provider IN ('none','shopmonkey','tekmetric','fullbay')),
  api_key_encrypted text,
  webhook_secret text,
  outbound_webhook_url text,
  alert_preference text NOT NULL DEFAULT 'sms' CHECK (alert_preference IN ('sms','email','both')),
  manager_phones text[] NOT NULL DEFAULT '{}',
  manager_emails text[] NOT NULL DEFAULT '{}',
  owner_phones text[] NOT NULL DEFAULT '{}',
  owner_emails text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shop_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL DEFAULT 'shop_user',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_shop_invites_unique_pending ON public.shop_invites(shop_id, lower(email)) WHERE status = 'pending';

CREATE TABLE public.shop_member_pins (
  member_id uuid PRIMARY KEY REFERENCES public.shop_members(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz
);

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_return_window_days int NOT NULL DEFAULT 30,
  grace_period_days int NOT NULL DEFAULT 10,
  ar_dispute_email text,
  account_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_shop ON public.suppliers(shop_id);

-- Grants
GRANT SELECT, UPDATE ON public.shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shop_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.suppliers TO authenticated;
GRANT ALL ON public.shops, public.shop_integrations, public.shop_members, public.shop_invites, public.shop_member_pins, public.suppliers TO service_role;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_member_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read shops" ON public.shops FOR SELECT TO authenticated USING (public.is_shop_member(id));
CREATE POLICY "admins update shops" ON public.shops FOR UPDATE TO authenticated USING (public.has_shop_role(id, ARRAY['admin']::public.app_role[])) WITH CHECK (public.has_shop_role(id, ARRAY['admin']::public.app_role[]));

CREATE POLICY "admins manage integrations" ON public.shop_integrations FOR ALL TO authenticated USING (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[]));
CREATE POLICY "admins manage invites" ON public.shop_invites FOR ALL TO authenticated USING (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[]));

CREATE POLICY "members read team" ON public.shop_members FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));
CREATE POLICY "admins add team" ON public.shop_members FOR INSERT TO authenticated WITH CHECK (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[]));
CREATE POLICY "admins update team" ON public.shop_members FOR UPDATE TO authenticated USING (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['admin']::public.app_role[]));

CREATE POLICY "members read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_shop_member(shop_id));
CREATE POLICY "managers add suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[]));
CREATE POLICY "managers update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[]));

-- Triggers
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.shop_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.shop_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_shop_billing_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at)
     AND NOT (auth.role() = 'service_role' OR current_user IN ('postgres','service_role')) THEN
    RAISE EXCEPTION 'Billing fields are managed by Stripe webhooks';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_shops_billing_guard BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.guard_shop_billing_fields();

CREATE OR REPLACE FUNCTION public.guard_last_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.is_active = true AND (NEW.is_active = false OR NEW.role <> 'admin') THEN
    IF NOT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = OLD.shop_id AND role = 'admin' AND is_active = true AND id <> OLD.id) THEN
      RAISE EXCEPTION 'Cannot remove or demote the last active admin of this shop';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_members_last_admin BEFORE UPDATE ON public.shop_members FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();

CREATE OR REPLACE FUNCTION public.seed_new_shop() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shop_integrations(shop_id) VALUES (NEW.id);
  INSERT INTO public.suppliers(shop_id, name)
  SELECT NEW.id, n FROM unnest(ARRAY['NAPA','O''Reilly','AutoZone','FleetPride','LKQ','Jasper','Advance','OEM Dealership']) AS n;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_shops_seed AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.seed_new_shop();

-- RPCs
CREATE OR REPLACE FUNCTION public.create_shop_workspace(shop_name text, shop_phone text, shop_timezone text, owner_full_name text, owner_pin text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_shop uuid; v_member uuid; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NULLIF(trim(shop_name),'') IS NULL THEN RAISE EXCEPTION 'Shop name is required'; END IF;
  IF owner_pin IS NULL OR owner_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  v_email := COALESCE(NULLIF(trim(auth.jwt() ->> 'email'),''), (SELECT email FROM auth.users WHERE id = auth.uid()));
  INSERT INTO public.shops(name, phone, timezone) VALUES (trim(shop_name), NULLIF(trim(shop_phone),''), COALESCE(NULLIF(trim(shop_timezone),''),'America/Denver')) RETURNING id INTO v_shop;
  INSERT INTO public.shop_members(shop_id, user_id, email, full_name, role) VALUES (v_shop, auth.uid(), v_email, COALESCE(NULLIF(trim(owner_full_name),''), v_email, 'Owner'), 'admin') RETURNING id INTO v_member;
  INSERT INTO public.shop_member_pins(member_id, pin_hash) VALUES (v_member, crypt(owner_pin, gen_salt('bf')));
  RETURN v_shop;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_pending_invites() RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_email text; v_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN '{}'::uuid[]; END IF;
  v_email := COALESCE(NULLIF(trim(auth.jwt() ->> 'email'),''), (SELECT email FROM auth.users WHERE id = auth.uid()));
  IF v_email IS NULL THEN RETURN '{}'::uuid[]; END IF;
  WITH inv AS (
    SELECT DISTINCT ON (shop_id) shop_id, role, full_name FROM public.shop_invites
    WHERE lower(email) = lower(v_email) AND status = 'pending' ORDER BY shop_id, created_at DESC
  ), ins AS (
    INSERT INTO public.shop_members(shop_id, user_id, email, full_name, role)
    SELECT shop_id, auth.uid(), v_email, COALESCE(NULLIF(trim(full_name),''), v_email), role FROM inv
    ON CONFLICT (shop_id, user_id) WHERE user_id IS NOT NULL
    DO UPDATE SET is_active = true, role = EXCLUDED.role, full_name = EXCLUDED.full_name, email = EXCLUDED.email
    RETURNING shop_id
  ) SELECT COALESCE(array_agg(shop_id), '{}'::uuid[]) INTO v_ids FROM ins;
  UPDATE public.shop_invites SET status = 'accepted' WHERE lower(email) = lower(v_email) AND status = 'pending';
  RETURN v_ids;
END; $$;

CREATE OR REPLACE FUNCTION public.set_shop_member_pin(target_member_id uuid, new_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_shop uuid; v_user uuid;
BEGIN
  IF new_pin IS NULL OR new_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;
  SELECT shop_id, user_id INTO v_shop, v_user FROM public.shop_members WHERE id = target_member_id;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT (public.has_shop_role(v_shop, ARRAY['admin']::public.app_role[]) OR (v_user IS NOT NULL AND v_user = auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed to set this PIN';
  END IF;
  INSERT INTO public.shop_member_pins(member_id, pin_hash, failed_attempts, locked_until)
  VALUES (target_member_id, crypt(new_pin, gen_salt('bf')), 0, NULL)
  ON CONFLICT (member_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, locked_until = NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_shop_pin(target_member_id uuid, raw_pin text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_shop uuid; v_active boolean; p record;
BEGIN
  SELECT shop_id, is_active INTO v_shop, v_active FROM public.shop_members WHERE id = target_member_id;
  IF v_shop IS NULL OR NOT public.is_shop_member(v_shop) THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'This team member is deactivated'; END IF;
  SELECT * INTO p FROM public.shop_member_pins WHERE member_id = target_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No PIN set for this team member yet'; END IF;
  IF p.locked_until IS NOT NULL AND p.locked_until > now() THEN RAISE EXCEPTION 'PIN locked. Try again after %', to_char(p.locked_until, 'HH24:MI'); END IF;
  IF crypt(raw_pin, p.pin_hash) = p.pin_hash THEN
    UPDATE public.shop_member_pins SET failed_attempts = 0, locked_until = NULL WHERE member_id = target_member_id;
    RETURN true;
  END IF;
  UPDATE public.shop_member_pins SET failed_attempts = failed_attempts + 1,
    locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END
  WHERE member_id = target_member_id;
  RETURN false;
END; $$;

CREATE OR REPLACE FUNCTION public.unlock_shop_member_pin(target_member_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.shop_members WHERE id = target_member_id;
  IF NOT public.has_shop_role(v_shop, ARRAY['admin']::public.app_role[]) THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE public.shop_member_pins SET failed_attempts = 0, locked_until = NULL WHERE member_id = target_member_id;
END; $$;

CREATE OR REPLACE FUNCTION public.member_pin_status(p_shop_id uuid) RETURNS TABLE(member_id uuid, has_pin boolean, is_locked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, p.member_id IS NOT NULL, COALESCE(p.locked_until > now(), false)
  FROM public.shop_members m LEFT JOIN public.shop_member_pins p ON p.member_id = m.id
  WHERE m.shop_id = p_shop_id AND public.is_shop_member(p_shop_id)
$$;

REVOKE ALL ON FUNCTION public.create_shop_workspace(text,text,text,text,text), public.accept_pending_invites(), public.set_shop_member_pin(uuid,text), public.verify_shop_pin(uuid,text), public.unlock_shop_member_pin(uuid), public.member_pin_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shop_workspace(text,text,text,text,text), public.accept_pending_invites(), public.set_shop_member_pin(uuid,text), public.verify_shop_pin(uuid,text), public.unlock_shop_member_pin(uuid), public.member_pin_status(uuid), public.is_shop_member(uuid), public.has_shop_role(uuid, public.app_role[]) TO authenticated;