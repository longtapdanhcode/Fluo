-- Bảng mới của quy trình nội dung (tính năng 001): bật RLS, không policy.
-- App và script chỉ truy cập DB từ server qua Drizzle (constitution, Nguyên tắc II).
ALTER TABLE "vocabulary" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercise_vocabulary" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_reports" ENABLE ROW LEVEL SECURITY;
