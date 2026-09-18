-- Prerequisite missing from repo history (orphan from old Lovable SQL).
-- uuid arg = student_id (auth user / candidate student key used by BEQA sessions).
CREATE OR REPLACE FUNCTION public.calculate_haile_readiness_score(user_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_beqa numeric;
  v_exam_total integer;
  v_exam_passed integer;
BEGIN
  SELECT s.final_beqa_score
    INTO v_beqa
  FROM public.beqa_diagnostic_sessions s
  WHERE s.student_id = user_id_param
    AND s.final_beqa_score IS NOT NULL
  ORDER BY s.end_time DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  IF v_beqa IS NOT NULL THEN
    RETURN round(v_beqa);
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE r.passed)::integer
    INTO v_exam_total, v_exam_passed
  FROM public.exam_results r
  WHERE r.user_id = user_id_param;

  IF v_exam_total > 0 THEN
    RETURN round((v_exam_passed::numeric / v_exam_total::numeric) * 100);
  END IF;

  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.calculate_haile_readiness_score(uuid) IS
  'Haile readiness score for a student (auth user / BEQA student_id). Prefer latest BEQA final_beqa_score; else exam pass-rate percent; else 0.';

REVOKE ALL ON FUNCTION public.calculate_haile_readiness_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_haile_readiness_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_haile_readiness_score(uuid) TO service_role;
