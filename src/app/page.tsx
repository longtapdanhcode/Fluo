import { Baloo_2 } from "next/font/google";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { site } from "@/lib/site";
import "./home.css";

const baloo = Baloo_2({ subsets: ["latin", "vietnamese"], weight: ["600", "700"], variable: "--hm-display" });

const kinds = ["Chọn hình", "Nghe", "Xếp câu", "Ghép cặp"];

// Chữ cái mọc thành cây: cao dần như một chuỗi ngày học.
const plants = [
  { ch: "a", h: 56 },
  { ch: "b", h: 84 },
  { ch: "c", h: 70 },
  { ch: "x", h: 110 },
  { ch: "y", h: 92 },
  { ch: "z", h: 128 },
];

export default async function Home() {
  const user = await getUser();
  const startHref = user ? "/learn" : "/login";

  return (
    <div data-theme="hum" className={`hm ${baloo.variable}`}>
      <header className="hm-container hm-nav">
        <Link href="/" className="hm-wordmark">
          {site.name}
        </Link>
        <Link href={user ? "/learn" : "/login"} className="hm-navlink">
          {user ? "Vào học" : "Đăng nhập"}
        </Link>
      </header>

      <main>
        <section className="hm-container hm-hero" aria-labelledby="hm-title">
          <div className="hm-hero-copy">
            <h1 id="hm-title">Học tiếng Anh mỗi ngày 5 phút</h1>
            <p className="hm-lead">
              Vui như chơi game, bắt đầu từ con số 0. <mark>Miễn phí.</mark>
            </p>
            <div className="hm-actions">
              <Link href={startHref} className="hm-btn hm-btn--primary">
                Bắt đầu học
              </Link>
              <Link href="/try" className="hm-btn">
                Thử 1 bài, không cần đăng ký
              </Link>
            </div>
          </div>

          <div className="hm-stage" aria-label="Một câu trong bài học đầu tiên">
            <div className="hm-lesson">
              <div className="hm-lesson-top">
                <span className="hm-progress" aria-hidden>
                  <span />
                </span>
                <span>Bài 1: Xin chào!</span>
              </div>
              <p className="hm-lesson-q">Xếp thành câu: “Rất vui được gặp bạn”</p>
              <div className="hm-kraft" lang="en">
                <span className="hm-tile hm-tile--1">Nice</span>
                <span className="hm-tile hm-tile--2">to</span>
                <span className="hm-tile hm-tile--3">meet</span>
                <span className="hm-tile hm-tile--4">you</span>
              </div>
              <div className="hm-lesson-foot">
                <span className="hm-correct">Chính xác!</span>
                <span className="hm-chip">Có âm thanh và phản hồi ngay</span>
              </div>
            </div>
          </div>
        </section>

        <section className="hm-container hm-section" aria-labelledby="hm-short">
          <div className="hm-split">
            <div className="hm-split-copy">
              <h2 id="hm-short">Bài ngắn 5 phút</h2>
              <p className="hm-body">Chọn hình, nghe, xếp câu, ghép cặp: học như chơi.</p>
            </div>
            <ul className="hm-kinds" role="list">
              {kinds.map((k) => (
                <li key={k} className="hm-kind">
                  <h3>{k}</h3>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hm-container hm-section" aria-labelledby="hm-streak">
          <div className="hm-split hm-split--flip">
            <div className="hm-split-copy">
              <h2 id="hm-streak">Streak và XP</h2>
              <p className="hm-body">Giữ chuỗi ngày học, nhận điểm kinh nghiệm mỗi bài.</p>
            </div>
            <div className="hm-bed" aria-hidden>
              <div className="hm-hill" />
              <div className="hm-plants">
                {plants.map((p) => (
                  <span key={p.ch} className="hm-plant">
                    <b>{p.ch}</b>
                    <i style={{ "--h": `${p.h}px` } as React.CSSProperties} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="hm-container hm-section" aria-labelledby="hm-ai">
          <div className="hm-split">
            <div className="hm-split-copy">
              <h2 id="hm-ai">AI giải thích lỗi</h2>
              <p className="hm-body">Sai ở đâu, AI giải thích ngắn gọn bằng tiếng Việt.</p>
            </div>
            <div className="hm-ai">
              <p className="hm-ai-head">Chưa đúng rồi</p>
              <p className="hm-ai-answer">
                Đáp án đúng: <strong>Xin chào</strong> = <span lang="en">Hello</span>
              </p>
              <div className="hm-ai-note">
                <span>Vì sao sai?</span>
                <p>“Hello” là lời chào phổ biến nhất, dùng được mọi lúc.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="hm-field" aria-labelledby="hm-try">
          <div className="hm-container hm-field-inner">
            <h2 id="hm-try">Thử 1 bài, không cần đăng ký</h2>
            <div className="hm-actions">
              <Link href="/try" className="hm-btn hm-btn--primary">
                Học thử ngay
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="hm-footer">
        <div className="hm-container hm-footer-inner">
          <Link href="/" className="hm-wordmark">
            {site.name}
          </Link>
          <nav aria-label="Liên kết cuối trang">
            <Link href={startHref}>{user ? "Vào học" : "Đăng nhập"}</Link>
            <Link href="/try">Học thử</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
