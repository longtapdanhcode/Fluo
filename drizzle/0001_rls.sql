-- App chỉ truy cập DB từ server (Drizzle, role postgres). Bật RLS và KHÔNG tạo policy
-- để chặn hoàn toàn truy cập qua Data API công khai của Supabase (anon/authenticated key).
-- Sau này nếu cần đọc trực tiếp từ client thì thêm policy cụ thể cho từng bảng.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lesson_completions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile_badges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Xóa tài khoản Supabase thì xóa luôn hồ sơ và tiến độ (chỉ khi chạy trên Supabase có schema auth).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    ALTER TABLE "profiles"
      ADD CONSTRAINT "profiles_account_id_auth_users_fk"
      FOREIGN KEY ("account_id") REFERENCES auth.users("id") ON DELETE CASCADE;
  END IF;
END $$;
