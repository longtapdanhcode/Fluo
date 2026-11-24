/** Nạp .env.local trước khi import bất cứ module nào đọc biến môi trường (như @/db). Import file này đầu tiên. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
