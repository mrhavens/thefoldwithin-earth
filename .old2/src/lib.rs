use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use gloo_net::http::Request;
use pulldown_cmark::{Options, Parser, html};

use serde::Deserialize;
use web_sys::{Document, Element};

// ---------- utilities ----------

fn window() -> web_sys::Window {
    web_sys::window().expect("no global `window`")
}

fn doc() -> Document {
    window().document().expect("no document on window")
}

fn by_id(id: &str) -> Element {
    doc()
        .get_element_by_id(id)
        .unwrap_or_else(|| panic!("element #{id} not found"))
}

fn set_html(el: &Element, html_str: &str) {
    el.set_inner_html(html_str);
}

fn md_to_html(md: &str) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_FOOTNOTES);
    let parser = Parser::new_ext(md, opts);
    let mut out = String::new();
    html::push_html(&mut out, parser);
    out
}

fn strip_front_matter(s: &str) -> &str {
    // VERY small, robust front-matter stripper:
    // starts with '---\n', find the next '\n---' boundary.
    let bytes = s.as_bytes();
    if bytes.starts_with(b"---\n") {
        if let Some(end) = s[4..].find("\n---") {
            let idx = 4 + end + 4; // 4 for '---\n', + end, +4 for '\n---'
            return &s[idx..];
        }
    }
    s
}

// ---------- data types ----------

#[derive(Debug, Deserialize, Clone)]
#[serde(default)]
struct PostMeta {
    title: String,
    date: String,
    excerpt: String,
    tags: Vec<String>,
    section: String,
    slug: String,
    #[serde(rename = "readingTime")]
    reading_time: Option<u32>,
    cover: Option<String>,
    author: Option<String>,
    series: Option<String>,
    programs: Option<Vec<String>>,
    file: String,
}

impl Default for PostMeta {
    fn default() -> Self {
        Self {
            title: String::new(),
            date: String::new(),
            excerpt: String::new(),
            tags: vec![],
            section: String::new(),
            slug: String::new(),
            reading_time: None,
            cover: None,
            author: None,
            series: None,
            programs: None,
            file: String::new(),
        }
    }
}

// ---------- HTML builders (pure, no DOM globals) ----------

fn card_html(p: &PostMeta) -> String {
    let cover_style = p
        .cover
        .as_ref()
        .map(|u| format!(r#" style="background-image:url({}); background-size:cover;""#, u))
        .unwrap_or_default();

    format!(
        r#"<article data-slug="{slug}" tabindex="0">
  <div class="thumb"{cover}></div>
  <h3>{title}</h3>
  <span class="pill section">{section}</span>
  <p class="date">{date}</p>
  <p>{excerpt}</p>
</article>"#,
        slug = p.slug,
        cover = cover_style,
        title = &p.title,
        section = &p.section,
        date = &p.date,
        excerpt = &p.excerpt
    )
}

fn home_html(posts: &[PostMeta]) -> String {
    let cards = posts.iter().map(card_html).collect::<Vec<_>>().join("");
    format!(
        r#"<section class="latest-all">
  <h2>Latest Across All Sections</h2>
  <div class="grid">{cards}</div>
</section>"#
    )
}

fn post_html(post: &PostMeta, body_html: &str) -> String {
    let author = post
        .author
        .as_ref()
        .map(|a| format!(r#"<p class="author">By {a}</p>"#))
        .unwrap_or_default();

    let programs = post.programs.as_ref().map(|ps| {
        ps.iter()
            .map(|p| format!(r#"<span class="pill program">{}</span>"#, p))
            .collect::<String>()
    }).unwrap_or_default();

    // NOTE: raw strings here avoid escaping issues; the comma is outside.
    format!(
        r#"<section class="post">
  <a href="#/" id="back">← Back</a>
  <div class="markdown">
    <h1>{title}</h1>
    <p class="date">{date}</p>
    {author}
    <div class="meta"><span class="pill section">{section}</span>{programs}</div>
    <hr/>
    {body}
  </div>
</section>"#,
        title = &post.title,
        date = &post.date,
        author = author,
        section = &post.section,
        programs = programs,
        body = body_html
    )
}

// ---------- routing & rendering ----------

async fn fetch_index() -> Result<Vec<PostMeta>, JsValue> {
    let text = Request::get("index.json").send().await?.text().await?;
    let posts: Vec<PostMeta> = serde_json::from_str(&text)
        .map_err(|e| JsValue::from_str(&format!("index.json parse error: {e}")))?;
    Ok(posts)
}

async fn fetch_markdown(rel_path: &str) -> Result<String, JsValue> {
    // content/<relative>
    let url = format!("content/{rel}", rel = rel_path);
    let text = Request::get(&url).send().await?.text().await?;
    Ok(text)
}

async fn render_route_async() -> Result<(), JsValue> {
    let hash = window().location().hash()?; // e.g. "#/post/slug"
    let main = by_id("main");

    // Ensure index.json is reachable
    let posts = fetch_index().await?;

    // Simple router
    // "" or "#/" -> home
    // "#/post/<slug>" -> post
    let route = hash.trim_start_matches('#');
    let parts: Vec<&str> = route.split('/').filter(|s| !s.is_empty()).collect();

    if parts.is_empty() {
        let html = home_html(&posts);
        set_html(&main, &html);
        return Ok(());
    }

    match parts.as_slice() {
        ["post", slug] => {
            // find post
            if let Some(p) = posts.iter().find(|p| p.slug == *slug) {
                // fetch md, strip front matter, convert to HTML
                let md = fetch_markdown(&p.file).await.unwrap_or_else(|_| String::from("# Missing\nFile not found."));
                let body_md = strip_front_matter(&md).trim();
                let body_html = md_to_html(body_md);
                let html = post_html(p, &body_html);
                set_html(&main, &html);
            } else {
                set_html(&main, r#"<p class="error">⚠️ Post not found.</p>"#);
            }
        }
        _ => {
            set_html(&main, r#"<p class="error">⚠️ Page not found.</p>"#);
        }
    }

    Ok(())
}

fn add_hashchange_handler() {
    // Use a no-arg closure to satisfy wasm-bindgen type inference (fixes E0283)
    let cb = Closure::<dyn FnMut()>::new(move || {
        // We can't `.await` here directly; spawn a future.
        wasm_bindgen_futures::spawn_local(async {
            if let Err(e) = render_route_async().await {
                web_sys::console::error_1(&e);
                let _ = doc()
                    .get_element_by_id("main")
                    .map(|el| el.set_inner_html(r#"<p class="error">⚠️ Render failed.</p>"#));
            }
        });
    });

    // assign and forget (leak) to keep closure alive
    window().set_onhashchange(Some(cb.as_ref().unchecked_ref()));
    cb.forget();
}

async fn initial_render() {
    if let Err(e) = render_route_async().await {
        web_sys::console::error_1(&e);
        set_html(&by_id("main"), r#"<p class="error">⚠️ Initial render failed.</p>"#);
    }
}

// ---------- wasm entry ----------

#[wasm_bindgen(start)]
pub fn start() {
    // better panics in console
    console_error_panic_hook::set_once();

    // Ensure there is a #main element to render into
    // (If not found, this will panic clearly at runtime.)
    let _ = by_id("main");

    add_hashchange_handler();
    // kick once
    wasm_bindgen_futures::spawn_local(async { initial_render().await });
}
