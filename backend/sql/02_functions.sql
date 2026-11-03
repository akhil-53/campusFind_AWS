CREATE OR REPLACE FUNCTION fn_actor() RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::INT
$$;

CREATE OR REPLACE FUNCTION fn_setting(p_key TEXT, p_default TEXT) RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = p_key), p_default)
$$;

CREATE OR REPLACE FUNCTION fn_review_due() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
  SELECT now() + make_interval(mins => fn_setting('review_deadline_minutes', '2880')::INT)
$$;

CREATE OR REPLACE FUNCTION fn_notify(p_user INT, p_title TEXT, p_msg TEXT, p_link TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO notifications(user_id, title, message, link)
  SELECT p_user, p_title, p_msg, p_link WHERE p_user IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION fn_audit(p_action TEXT, p_entity TEXT, p_id INT, p_details JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO audit_logs(user_id, action, entity_name, entity_id, details)
  VALUES (fn_actor(), p_action, p_entity, p_id, p_details)
$$;

-- Upgraded Match Scoring (0..100):
-- Visual / Image AI Similarity (35 pts, primary preference)
-- Text Similarity (30 pts when photos present, 65 pts fallback)
-- Location Match (20 pts)
-- Realistic Campus Turnover Time (10 pts within 7 days, 5 pts within 30 days)
-- Color Match (5 pts)
CREATE OR REPLACE FUNCTION fn_match_score(
  r_loc INT, r_from TIMESTAMPTZ, r_to TIMESTAMPTZ, r_text TEXT, r_color TEXT,
  f_loc INT, f_found TIMESTAMPTZ, f_text TEXT, f_color TEXT,
  r_labels TEXT DEFAULT NULL, f_labels TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_loc_score   INT := 0;
  v_time_score  INT := 0;
  v_color_score INT := 0;
  v_text_score  INT := 0;
  v_img_score   INT := 0;
  v_total       INT := 0;
  v_has_photos  BOOLEAN := FALSE;
BEGIN
  -- 1. Location Score (20 pts): Same room/block in SJT
  IF r_loc IS NOT NULL AND f_loc IS NOT NULL AND r_loc = f_loc THEN
    v_loc_score := 20;
  END IF;

  -- 2. Realistic Campus Time Score (10 pts):
  -- Items found within 12 hours before or up to 7 days after get full points (covers class sweeps, security & student memory errors)
  -- Items found within 24 hours before or up to 30 days after get 5 points
  IF f_found >= (r_from - interval '12 hours') AND f_found <= (r_to + interval '7 days') THEN
    v_time_score := 10;
  ELSIF f_found >= (r_from - interval '24 hours') AND f_found <= (r_to + interval '30 days') THEN
    v_time_score := 5;
  ELSE
    v_time_score := 0;
  END IF;

  -- 3. Color Match (5 pts)
  IF r_color IS NOT NULL AND f_color IS NOT NULL
     AND lower(trim(r_color)) = lower(trim(f_color)) THEN
    v_color_score := 5;
  END IF;

  -- 4. Check if both items have AI Visual Labels from uploaded photos
  IF r_labels IS NOT NULL AND trim(r_labels) <> ''
     AND f_labels IS NOT NULL AND trim(f_labels) <> '' THEN
    v_has_photos := TRUE;
  END IF;

  IF v_has_photos THEN
    -- Visual / Image AI Similarity has PRIMARY PREFERENCE (35 pts)
    v_img_score := ROUND(35 * similarity(lower(r_labels), lower(f_labels)))::INT;
    -- Text Similarity gets 30 pts
    v_text_score := ROUND(30 * similarity(lower(COALESCE(r_text, '')), lower(COALESCE(f_text, ''))))::INT;
  ELSE
    -- Graceful fallback when no photos exist: visual 35 pts dynamically shifts to Text Similarity
    v_img_score := 0;
    v_text_score := ROUND(65 * similarity(lower(COALESCE(r_text, '')), lower(COALESCE(f_text, ''))))::INT;
  END IF;

  v_total := v_loc_score + v_time_score + v_color_score + v_text_score + v_img_score;
  RETURN LEAST(100, GREATEST(0, v_total));
END $$;

-- Least-loaded available level-1 faculty (ties -> lowest user_id)
CREATE OR REPLACE FUNCTION fn_pick_faculty() RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT u.user_id
  FROM users u
  JOIN roles r        ON r.role_id = u.role_id AND r.role_name = 'FACULTY'
  JOIN designations d ON d.designation_id = u.designation_id AND d.level_rank = 1
  LEFT JOIN assignments a ON a.assigned_to = u.user_id AND a.status = 'ACTIVE'
  WHERE u.is_active AND u.is_available
  GROUP BY u.user_id
  ORDER BY COUNT(a.assignment_id), u.user_id
  LIMIT 1
$$;

-- Assign a report that has no ACTIVE REVIEW assignment; prefer p_prefer if still active
CREATE OR REPLACE FUNCTION fn_assign_report(p_report INT, p_prefer INT DEFAULT NULL) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_fac INT;
BEGIN
  IF EXISTS (SELECT 1 FROM assignments WHERE report_id = p_report
             AND assignment_type = 'REVIEW' AND status = 'ACTIVE') THEN
    RETURN NULL;
  END IF;
  SELECT u.user_id INTO v_fac FROM users u JOIN roles r ON r.role_id = u.role_id
   WHERE u.user_id = p_prefer AND r.role_name = 'FACULTY' AND u.is_active;
  IF v_fac IS NULL THEN v_fac := fn_pick_faculty(); END IF;
  IF v_fac IS NULL THEN RETURN NULL; END IF;
  INSERT INTO assignments(report_id, assigned_to, assignment_type, level, due_at)
  VALUES (p_report, v_fac, 'REVIEW', 1, fn_review_due());
  UPDATE lost_reports SET status = 'ASSIGNED' WHERE report_id = p_report AND status <> 'ASSIGNED';
  RETURN v_fac;
END $$;
