CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_social_profiles_unique_phyllo_user
  ON trainer_social_profiles(phyllo_user_id)
  WHERE phyllo_user_id IS NOT NULL AND btrim(phyllo_user_id) <> '';
