REVOKE EXECUTE ON FUNCTION public.guard_last_admin(), public.seed_new_shop(), public.guard_shop_billing_fields(), public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_shop_member(uuid), public.has_shop_role(uuid, public.app_role[]) FROM PUBLIC, anon;

CREATE TABLE public.cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  created_by_member_id uuid REFERENCES public.shop_members(id),
  short_code text NOT NULL DEFAULT '',
  is_backroom_audit boolean NOT NULL DEFAULT false,
  is_ro_completed boolean NOT NULL DEFAULT false,
  ro_number text, vin text, vehicle_description text, customer_name text,
  supplier_invoice_number text NOT NULL DEFAULT '',
  invoice_date date, return_deadline date,
  invoice_image_url text,
  part_number text NOT NULL DEFAULT 'GENERIC',
  unit_sequence int NOT NULL DEFAULT 1,
  part_description text,
  part_cost numeric(10,2) NOT NULL DEFAULT 0,
  expected_core_amount numeric(10,2) NOT NULL DEFAULT 0,
  credited_amount numeric(10,2) NOT NULL DEFAULT 0,
  variance_amount numeric(10,2) GENERATED ALWAYS AS (expected_core_amount - credited_amount) STORED,
  return_type text NOT NULL DEFAULT 'CORE_EXCHANGE' CHECK (return_type IN ('CORE_EXCHANGE','UNUSED_PART_RMA')),
  current_status text NOT NULL DEFAULT 'AWAITING_TEARDOWN' CHECK (current_status IN ('NEEDS_REVIEW','AWAITING_TEARDOWN','IN_RETURN_BIN','DAMAGED_CORE_HOLD','PICKED_UP_BY_DRIVER','PENDING_NEXT_CYCLE','CREDIT_VERIFIED','PARTIAL_CREDIT','DISPUTE_ELIGIBLE','DISPUTED','REJECTED_BY_VENDOR','EXPIRED','WRITTEN_OFF','DELETED_IN_ERROR')),
  original_box_intact boolean NOT NULL DEFAULT true,
  condition_photo_url text,
  warranty_months int NOT NULL DEFAULT 12,
  warranty_covers_labor boolean NOT NULL DEFAULT false,
  parent_core_id uuid REFERENCES public.cores(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_cores_unique_active_line ON public.cores(shop_id, supplier_id, supplier_invoice_number, part_number, unit_sequence) WHERE current_status <> 'DELETED_IN_ERROR';
CREATE INDEX idx_cores_shop_status ON public.cores(shop_id, current_status);
CREATE INDEX idx_cores_shop_supplier ON public.cores(shop_id, supplier_id);
CREATE INDEX idx_cores_shop_short_code ON public.cores(shop_id, short_code);
CREATE INDEX idx_cores_shop_deadline ON public.cores(shop_id, return_deadline);

CREATE TABLE public.core_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_id uuid NOT NULL REFERENCES public.cores(id),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  actor_member_id uuid REFERENCES public.shop_members(id),
  actor_type text NOT NULL DEFAULT 'USER' CHECK (actor_type IN ('USER','SYSTEM_CRON','WEBHOOK')),
  event_type text NOT NULL,
  previous_status text, new_status text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_core_events_core_id ON public.core_events(core_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.cores_before_write() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_code text; i int; v_priv boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR i IN 1..50 LOOP
      v_code := (1000 + floor(random()*9000))::int::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cores WHERE shop_id = NEW.shop_id AND short_code = v_code AND current_status NOT IN ('CREDIT_VERIFIED','WRITTEN_OFF','DELETED_IN_ERROR','EXPIRED','REJECTED_BY_VENDOR'));
      v_code := NULL;
    END LOOP;
    IF v_code IS NULL THEN
      LOOP
        v_code := (10000 + floor(random()*90000))::int::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cores WHERE shop_id = NEW.shop_id AND short_code = v_code AND current_status NOT IN ('CREDIT_VERIFIED','WRITTEN_OFF','DELETED_IN_ERROR','EXPIRED','REJECTED_BY_VENDOR'));
      END LOOP;
    END IF;
    NEW.short_code := v_code;
  ELSE
    NEW.short_code := OLD.short_code;
    NEW.updated_at := now();
    v_priv := (auth.role() = 'service_role' OR current_user IN ('postgres','service_role'));
    IF NOT v_priv THEN
      IF OLD.current_status IN ('CREDIT_VERIFIED','WRITTEN_OFF','DELETED_IN_ERROR') AND NEW.current_status IS DISTINCT FROM OLD.current_status
         AND NOT public.has_shop_role(NEW.shop_id, ARRAY['admin']::public.app_role[]) THEN
        RAISE EXCEPTION 'Only admins can reopen a closed core';
      END IF;
      IF NEW.current_status = 'DELETED_IN_ERROR' AND OLD.current_status <> 'DELETED_IN_ERROR'
         AND NOT public.has_shop_role(NEW.shop_id, ARRAY['admin']::public.app_role[]) THEN
        RAISE EXCEPTION 'Only admins can delete cores';
      END IF;
      IF NEW.current_status = 'WRITTEN_OFF' AND OLD.current_status <> 'WRITTEN_OFF'
         AND NOT (public.has_shop_role(NEW.shop_id, ARRAY['admin']::public.app_role[])
           OR (public.has_shop_role(NEW.shop_id, ARRAY['super_user']::public.app_role[]) AND (NEW.expected_core_amount - NEW.credited_amount) <= 50.00)) THEN
        RAISE EXCEPTION 'Write-offs over $50 require an admin';
      END IF;
    END IF;
  END IF;
  NEW.part_number := COALESCE(NULLIF(trim(NEW.part_number),''),'GENERIC');
  IF NEW.is_backroom_audit AND NULLIF(trim(NEW.supplier_invoice_number),'') IS NULL THEN
    NEW.supplier_invoice_number := 'AUDIT-' || to_char(now(),'YYYYMMDD') || '-' || NEW.short_code;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.return_deadline IS NULL THEN
    NEW.return_deadline := (COALESCE(NEW.invoice_date, CURRENT_DATE) + make_interval(days => COALESCE((SELECT default_return_window_days FROM public.suppliers WHERE id = NEW.supplier_id), 30)))::date;
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id OR NEW.supplier_invoice_number IS DISTINCT FROM OLD.supplier_invoice_number OR NEW.part_number IS DISTINCT FROM OLD.part_number OR (OLD.current_status = 'DELETED_IN_ERROR' AND NEW.current_status <> 'DELETED_IN_ERROR'))
     AND NEW.current_status <> 'DELETED_IN_ERROR'
     AND EXISTS (SELECT 1 FROM public.cores WHERE shop_id = NEW.shop_id AND supplier_id = NEW.supplier_id AND supplier_invoice_number = NEW.supplier_invoice_number AND part_number = NEW.part_number AND unit_sequence = NEW.unit_sequence AND current_status <> 'DELETED_IN_ERROR' AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)) THEN
    NEW.unit_sequence := COALESCE((SELECT MAX(unit_sequence) FROM public.cores WHERE shop_id = NEW.shop_id AND supplier_id = NEW.supplier_id AND supplier_invoice_number = NEW.supplier_invoice_number AND part_number = NEW.part_number AND current_status <> 'DELETED_IN_ERROR' AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)),0) + 1;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cores_before BEFORE INSERT OR UPDATE ON public.cores FOR EACH ROW EXECUTE FUNCTION public.cores_before_write();

CREATE OR REPLACE FUNCTION public.cores_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.core_events(core_id, shop_id, actor_member_id, actor_type, event_type, new_status)
  VALUES (NEW.id, NEW.shop_id, NEW.created_by_member_id, CASE WHEN NEW.created_by_member_id IS NOT NULL THEN 'USER' ELSE 'WEBHOOK' END, 'CORE_CREATED', NEW.current_status);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_cores_after_insert AFTER INSERT ON public.cores FOR EACH ROW EXECUTE FUNCTION public.cores_after_insert();

CREATE VIEW public.mechanic_cores_view AS
SELECT c.id, c.shop_id, c.supplier_id, s.name AS supplier_name, c.short_code, c.is_backroom_audit, c.is_ro_completed, c.ro_number, c.vin, c.vehicle_description, c.customer_name, c.supplier_invoice_number, c.invoice_date, c.return_deadline, c.part_number, c.unit_sequence, c.part_description, c.return_type, c.current_status, c.original_box_intact, c.condition_photo_url, c.created_at
FROM public.cores c JOIN public.suppliers s ON s.id = c.supplier_id
WHERE public.is_shop_member(c.shop_id) AND c.current_status <> 'DELETED_IN_ERROR';

CREATE OR REPLACE FUNCTION public.mechanic_update_core_status(p_core_id uuid, p_new_status text, p_condition_photo_url text DEFAULT NULL, p_original_box_intact boolean DEFAULT NULL, p_actor_member_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v jsonb;
BEGIN
  SELECT * INTO c FROM public.cores WHERE id = p_core_id;
  IF NOT FOUND OR NOT public.is_shop_member(c.shop_id) THEN RAISE EXCEPTION 'Core not found'; END IF;
  IF p_actor_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shop_members WHERE id = p_actor_member_id AND shop_id = c.shop_id AND is_active = true) THEN RAISE EXCEPTION 'Invalid operator'; END IF;
  IF p_new_status NOT IN ('IN_RETURN_BIN','DAMAGED_CORE_HOLD') THEN RAISE EXCEPTION 'Status not allowed'; END IF;
  IF c.current_status NOT IN ('NEEDS_REVIEW','AWAITING_TEARDOWN','IN_RETURN_BIN','DAMAGED_CORE_HOLD') THEN RAISE EXCEPTION 'Core already moved past the bay (%)', c.current_status; END IF;
  UPDATE public.cores SET current_status = p_new_status, condition_photo_url = COALESCE(p_condition_photo_url, condition_photo_url), original_box_intact = COALESCE(p_original_box_intact, original_box_intact) WHERE id = p_core_id;
  INSERT INTO public.core_events(core_id, shop_id, actor_member_id, event_type, previous_status, new_status, metadata_json)
  VALUES (p_core_id, c.shop_id, p_actor_member_id, 'BAY_STATUS_UPDATE', c.current_status, p_new_status, jsonb_build_object('photo', p_condition_photo_url IS NOT NULL, 'box_intact', p_original_box_intact));
  SELECT to_jsonb(m) INTO v FROM public.mechanic_cores_view m WHERE m.id = p_core_id;
  RETURN v;
END; $$;

-- logistics & finance
CREATE TABLE public.pickup_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  driver_name text, driver_truck_number text, signature_url text, loadout_photo_url text, manifest_pdf_url text,
  created_by_member_id uuid REFERENCES public.shop_members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pickup_manifest_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid NOT NULL REFERENCES public.pickup_manifests(id) ON DELETE CASCADE,
  core_id uuid NOT NULL REFERENCES public.cores(id)
);
CREATE INDEX idx_pmi_manifest ON public.pickup_manifest_items(manifest_id);

CREATE TABLE public.vendor_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  statement_date date, statement_pdf_url text,
  status text NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING','RECONCILED','DISCREPANCIES_FOUND')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.vendor_statements(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_ref text, part_number text,
  credit_amount numeric(10,2) NOT NULL DEFAULT 0,
  matched_status text NOT NULL DEFAULT 'UNMATCHED' CHECK (matched_status IN ('UNMATCHED','MATCHED','PARTIAL'))
);
CREATE INDEX idx_lines_statement ON public.statement_lines(statement_id);
CREATE TABLE public.core_credit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  core_id uuid NOT NULL REFERENCES public.cores(id),
  statement_line_id uuid NOT NULL REFERENCES public.statement_lines(id) ON DELETE CASCADE,
  allocated_amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alloc_core ON public.core_credit_allocations(core_id);
CREATE INDEX idx_alloc_line ON public.core_credit_allocations(statement_line_id);
CREATE TABLE public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  core_id uuid NOT NULL REFERENCES public.cores(id),
  created_by_member_id uuid REFERENCES public.shop_members(id),
  failure_date date, failure_reason text,
  labor_hours_claimed numeric(5,2) NOT NULL DEFAULT 0,
  labor_rate_snapshot numeric(10,2) NOT NULL DEFAULT 0,
  total_claim_amount numeric(10,2) NOT NULL DEFAULT 0,
  claim_pdf_url text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','PAID')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  dedupe_key text UNIQUE,
  channel text CHECK (channel IN ('sms','email')),
  recipient text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.processed_webhook_events (
  event_key text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- grants
GRANT SELECT, INSERT, UPDATE ON public.cores TO authenticated;
GRANT SELECT, INSERT ON public.core_events TO authenticated;
GRANT SELECT ON public.mechanic_cores_view TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pickup_manifests, public.pickup_manifest_items, public.warranty_claims, public.notification_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_statements, public.statement_lines, public.core_credit_allocations TO authenticated;
GRANT ALL ON public.cores, public.core_events, public.pickup_manifests, public.pickup_manifest_items, public.vendor_statements, public.statement_lines, public.core_credit_allocations, public.warranty_claims, public.notification_logs, public.processed_webhook_events TO service_role;
GRANT SELECT ON public.mechanic_cores_view TO service_role;

ALTER TABLE public.cores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.core_credit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read cores" ON public.cores FOR SELECT TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "staff add cores" ON public.cores FOR INSERT TO authenticated WITH CHECK (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "staff update cores" ON public.cores FOR UPDATE TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));

CREATE POLICY "staff read events" ON public.core_events FOR SELECT TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "members add events" ON public.core_events FOR INSERT TO authenticated WITH CHECK (public.is_shop_member(shop_id) AND (actor_member_id IS NULL OR EXISTS (SELECT 1 FROM public.shop_members sm WHERE sm.id = actor_member_id AND sm.shop_id = core_events.shop_id AND sm.is_active = true)));

CREATE POLICY "members manifests" ON public.pickup_manifests FOR ALL TO authenticated USING (public.is_shop_member(shop_id)) WITH CHECK (public.is_shop_member(shop_id));
CREATE POLICY "members manifest items" ON public.pickup_manifest_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.pickup_manifests pm WHERE pm.id = manifest_id AND public.is_shop_member(pm.shop_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.pickup_manifests pm WHERE pm.id = manifest_id AND public.is_shop_member(pm.shop_id)));
CREATE POLICY "members notifications" ON public.notification_logs FOR ALL TO authenticated USING (public.is_shop_member(shop_id)) WITH CHECK (public.is_shop_member(shop_id));

CREATE POLICY "staff read statements" ON public.vendor_statements FOR SELECT TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "managers write statements" ON public.vendor_statements FOR ALL TO authenticated USING (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[]));
CREATE POLICY "staff read lines" ON public.statement_lines FOR SELECT TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "managers write lines" ON public.statement_lines FOR ALL TO authenticated USING (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[]));
CREATE POLICY "staff read allocations" ON public.core_credit_allocations FOR SELECT TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "managers write allocations" ON public.core_credit_allocations FOR ALL TO authenticated USING (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['super_user','admin']::public.app_role[]));

CREATE POLICY "staff read claims" ON public.warranty_claims FOR SELECT TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "staff add claims" ON public.warranty_claims FOR INSERT TO authenticated WITH CHECK (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));
CREATE POLICY "staff update claims" ON public.warranty_claims FOR UPDATE TO authenticated USING (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[])) WITH CHECK (public.has_shop_role(shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]));

-- allocation triggers
CREATE OR REPLACE FUNCTION public.allocation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.allocated_amount <= 0 THEN RAISE EXCEPTION 'Allocation must be positive'; END IF;
  IF (COALESCE((SELECT SUM(allocated_amount) FROM public.core_credit_allocations WHERE statement_line_id = NEW.statement_line_id AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)),0) + NEW.allocated_amount)
     > (SELECT credit_amount FROM public.statement_lines WHERE id = NEW.statement_line_id) THEN
    RAISE EXCEPTION 'Allocation exceeds remaining statement line credit';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_alloc_guard BEFORE INSERT OR UPDATE ON public.core_credit_allocations FOR EACH ROW EXECUTE FUNCTION public.allocation_guard();

CREATE OR REPLACE FUNCTION public.allocation_rollup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_core uuid; t_line uuid; t_stmt uuid; v_credit numeric; v_exp numeric; v_status text; v_line_sum numeric; v_line_amt numeric; v_supplier uuid; v_shop uuid; v_grace int;
BEGIN
  t_core := COALESCE(NEW.core_id, OLD.core_id);
  t_line := COALESCE(NEW.statement_line_id, OLD.statement_line_id);
  SELECT statement_id INTO t_stmt FROM public.statement_lines WHERE id = t_line;
  SELECT COALESCE(SUM(allocated_amount),0) INTO v_credit FROM public.core_credit_allocations WHERE core_id = t_core;
  SELECT expected_core_amount, current_status INTO v_exp, v_status FROM public.cores WHERE id = t_core;
  UPDATE public.cores SET credited_amount = v_credit,
    current_status = CASE
      WHEN v_status IN ('WRITTEN_OFF','DELETED_IN_ERROR') THEN v_status
      WHEN v_credit >= v_exp AND v_credit > 0 THEN 'CREDIT_VERIFIED'
      WHEN v_credit > 0 THEN 'PARTIAL_CREDIT'
      WHEN v_status IN ('CREDIT_VERIFIED','PARTIAL_CREDIT') THEN 'PICKED_UP_BY_DRIVER'
      ELSE v_status END
  WHERE id = t_core;
  IF t_line IS NOT NULL AND t_stmt IS NOT NULL THEN
    SELECT COALESCE(SUM(allocated_amount),0) INTO v_line_sum FROM public.core_credit_allocations WHERE statement_line_id = t_line;
    SELECT credit_amount INTO v_line_amt FROM public.statement_lines WHERE id = t_line;
    UPDATE public.statement_lines SET matched_status = CASE WHEN v_line_sum >= v_line_amt AND v_line_sum > 0 THEN 'MATCHED' WHEN v_line_sum > 0 THEN 'PARTIAL' ELSE 'UNMATCHED' END WHERE id = t_line;
    SELECT supplier_id, shop_id INTO v_supplier, v_shop FROM public.vendor_statements WHERE id = t_stmt;
    SELECT grace_period_days INTO v_grace FROM public.suppliers WHERE id = v_supplier;
    UPDATE public.vendor_statements SET status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.statement_lines WHERE statement_id = t_stmt AND matched_status <> 'MATCHED')
       AND NOT EXISTS (SELECT 1 FROM public.cores WHERE shop_id = v_shop AND supplier_id = v_supplier AND current_status = 'PICKED_UP_BY_DRIVER' AND credited_amount < expected_core_amount AND return_deadline + COALESCE(v_grace,10) < CURRENT_DATE)
      THEN 'RECONCILED' ELSE 'DISCREPANCIES_FOUND' END
    WHERE id = t_stmt;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_alloc_rollup AFTER INSERT OR UPDATE OR DELETE ON public.core_credit_allocations FOR EACH ROW EXECUTE FUNCTION public.allocation_rollup();

CREATE OR REPLACE FUNCTION public.complete_driver_pickup(p_shop_id uuid, p_supplier_id uuid, p_core_ids uuid[], p_driver_name text DEFAULT NULL, p_driver_truck_number text DEFAULT NULL, p_signature_url text DEFAULT NULL, p_loadout_photo_url text DEFAULT NULL, p_actor_member_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ids uuid[]; v_manifest uuid;
BEGIN
  IF NOT public.has_shop_role(p_shop_id, ARRAY['shop_user','super_user','admin']::public.app_role[]) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_actor_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shop_members WHERE id = p_actor_member_id AND shop_id = p_shop_id AND is_active = true) THEN RAISE EXCEPTION 'Invalid operator'; END IF;
  SELECT array_agg(id) INTO v_ids FROM public.cores WHERE id = ANY(p_core_ids) AND shop_id = p_shop_id AND supplier_id = p_supplier_id AND current_status = 'IN_RETURN_BIN';
  IF COALESCE(array_length(v_ids,1),0) = 0 THEN RAISE EXCEPTION 'No eligible cores in the return bin for this supplier'; END IF;
  INSERT INTO public.pickup_manifests(shop_id, supplier_id, driver_name, driver_truck_number, signature_url, loadout_photo_url, created_by_member_id)
  VALUES (p_shop_id, p_supplier_id, COALESCE(NULLIF(trim(p_driver_name),''),'Driver Refused Signature'), NULLIF(trim(p_driver_truck_number),''), p_signature_url, p_loadout_photo_url, p_actor_member_id)
  RETURNING id INTO v_manifest;
  INSERT INTO public.pickup_manifest_items(manifest_id, core_id) SELECT v_manifest, unnest(v_ids);
  UPDATE public.cores SET current_status = 'PICKED_UP_BY_DRIVER' WHERE id = ANY(v_ids);
  INSERT INTO public.core_events(core_id, shop_id, actor_member_id, event_type, previous_status, new_status, metadata_json)
  SELECT unnest(v_ids), p_shop_id, p_actor_member_id, 'DRIVER_PICKUP', 'IN_RETURN_BIN', 'PICKED_UP_BY_DRIVER', jsonb_build_object('manifest_id', v_manifest);
  RETURN v_manifest;
END; $$;

REVOKE EXECUTE ON FUNCTION public.cores_before_write(), public.cores_after_insert(), public.allocation_guard(), public.allocation_rollup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mechanic_update_core_status(uuid,text,text,boolean,uuid), public.complete_driver_pickup(uuid,uuid,uuid[],text,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mechanic_update_core_status(uuid,text,text,boolean,uuid), public.complete_driver_pickup(uuid,uuid,uuid[],text,text,text,text,uuid) TO authenticated;

-- storage policies (bucket created separately)
CREATE POLICY "core evidence access" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'core-evidence'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_shop_member(((storage.foldername(name))[1])::uuid)
  AND ((storage.foldername(name))[2] <> 'statements' OR public.has_shop_role(((storage.foldername(name))[1])::uuid, ARRAY['super_user','admin']::public.app_role[]))
  AND ((storage.foldername(name))[2] <> 'claims' OR public.has_shop_role(((storage.foldername(name))[1])::uuid, ARRAY['shop_user','super_user','admin']::public.app_role[]))
)
WITH CHECK (
  bucket_id = 'core-evidence'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_shop_member(((storage.foldername(name))[1])::uuid)
  AND ((storage.foldername(name))[2] <> 'statements' OR public.has_shop_role(((storage.foldername(name))[1])::uuid, ARRAY['super_user','admin']::public.app_role[]))
  AND ((storage.foldername(name))[2] <> 'claims' OR public.has_shop_role(((storage.foldername(name))[1])::uuid, ARRAY['shop_user','super_user','admin']::public.app_role[]))
);